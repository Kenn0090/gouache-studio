const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(80);};
 const click=async(x,y)=>{const a=await scr(x,y);await p.mouse.click(a[0],a[1]);await p.waitForTimeout(80);};
 const px=async(name,pts)=>p.evaluate(([name,pts])=>{const L=__gs.layerByName(name),d=__gs.readRGBA8(L.target),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const nLayers=()=>p.evaluate(()=>__gs.doc.root.children.length);
 await p.evaluate(()=>{__gs.newDoc(400,300,8,[1,1,1],'Fill',false);});
 await setFG('#ff0000');await p.evaluate(()=>{__gs.ui.bg=[0,0,1];});
 // 1. live gradient layer
 await p.keyboard.press('g');ok(await p.textContent('#brushTitle')==='Gradient','gradient tool');
 await p.click('.gpre[aria-label="Foreground to background"]');
 const n0=await nLayers();await drag(50,150,350,150);
 let v=await px('Gradient',[[40,150],[360,150],[200,150]]);ok(await nLayers()===n0+1&&v[0][0]>250&&v[0][2]<5&&v[1][2]>250&&v[1][0]<5,'live gradient layer red→blue '+JSON.stringify(v));
 const perc=v[2];ok(await p.textContent('#brushTitle')==='Gradient layer','panel edits the layer');
 await p.screenshot({path:OUT+'grad-live.png'});
 await p.keyboard.press('Control+z');ok(await nLayers()===n0,'undo removes gradient layer');await p.keyboard.press('Control+Shift+Z');ok(await nLayers()===n0+1,'redo');
 // 2. drag end point
 const bp=await scr(350,150);await p.mouse.move(bp[0],bp[1]);await p.mouse.down();const cp=await scr(250,150);await p.mouse.move(cp[0],cp[1],{steps:5});await p.mouse.up();await p.waitForTimeout(800);
 let g=await p.evaluate(()=>__gs.doc.active.grad.b.map(Math.round));ok(g.join()==='250,150','end point dragged '+g);
 v=await px('Gradient',[[300,150]]);ok(v[0][2]>250,'beyond end is blue');
 let lab=await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label);ok(lab==='Edit gradient','edit is one undo step ('+lab+')');
 // 3. click on the line adds a colour stop; method changes pixels
 await click(150,150);await p.waitForTimeout(800);g=await p.evaluate(()=>__gs.doc.active.grad.def.stops.length);ok(g===3,'click on line adds a stop ('+g+')');
 await p.keyboard.press('Control+z');await p.waitForTimeout(100);
 await p.selectOption('#gMethod','classic');await p.waitForTimeout(100);v=await px('Gradient',[[150,150]]);ok(JSON.stringify(v[0])!==JSON.stringify(perc),'classic blending differs '+JSON.stringify(v[0])+' vs '+JSON.stringify(perc));
 await p.click('.segb:text-is("Radial")');v=await px('Gradient',[[50,150],[50,50]]);ok(v[0][0]>250&&v[1][2]>100,'radial shape '+JSON.stringify(v));
 // 4. rasterize
 await p.click('button:text-is("Rasterize")');g=await p.evaluate(()=>!!__gs.doc.active.grad);ok(!g,'rasterize');await p.keyboard.press('Control+z');g=await p.evaluate(()=>!!__gs.doc.active.grad);ok(g,'undo rasterize');
 // 5. PSD round trip keeps it editable
 const back=await p.evaluate(async()=>{const blob=await __gs.encodePSD();const buf=await blob.arrayBuffer();await __gs.openPSD(buf,'rt');const L=__gs.layerByName('Gradient');return L&&L.grad?L.grad.def.shape:null;});
 ok(back==='radial','PSD round trip keeps the live gradient ('+back+')');
 // 6. classic gradient into Background, inside a selection
 await p.click('#layerList .lrow:has(.lname:text-is("Background"))');
 await p.keyboard.press('m');await drag(0,0,200,300);await p.keyboard.press('g');await p.click('.segb:text-is("Classic")');
 await drag(0,50,400,50);v=await px('Background',[[20,50],[300,50]]);ok(v[0][0]>200&&v[0][1]<60&&v[1].join()==='255,255,255,255','classic gradient stays in selection '+JSON.stringify(v));
 await p.keyboard.press('Control+z');v=await px('Background',[[20,50]]);ok(v[0].join()==='255,255,255,255','undo classic');
 // 7. live gradient with selection gets a mask
 await p.click('.segb:text-is("Live gradient layer")');await drag(0,100,400,100);
 g=await p.evaluate(()=>!!__gs.doc.active.mask&&!!__gs.doc.active.grad);ok(g,'live gradient + selection = layer with mask');await p.keyboard.press('Control+d');
 // 8. paint bucket
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'Bucket',false);});await p.keyboard.press('Control+Shift+N');
 await setFG('#000000');await p.keyboard.press('m');await drag(100,50,200,150);await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');
 await setFG('#00ff00');await p.keyboard.press('g');await p.keyboard.press('Shift+G');ok(await p.textContent('#brushTitle')==='Paint bucket','Shift+G → bucket');
 await click(20,20);v=await px('Layer 2',[[20,20],[150,100],[290,190]]);ok(v[0][1]===255&&v[1].join()==='0,0,0,255'&&v[2][1]===255,'bucket fills around the square '+JSON.stringify(v));
 await click(150,100);v=await px('Layer 2',[[150,100]]);ok(v[0][1]===255,'bucket fills the square');
 await p.keyboard.press('Control+z');v=await px('Layer 2',[[150,100]]);ok(v[0][1]===0,'undo bucket');
 // 9. dodge and burn on grey
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[.5,.5,.5],'Tonal',false);});
 await p.keyboard.press('o');ok(await p.textContent('#brushTitle')==='Dodge','O → dodge');
 await drag(20,100,280,100,{steps:20});v=await px('Background',[[150,100],[150,20]]);ok(v[0][0]>140&&v[1][0]<130,'dodge lightens midtones '+JSON.stringify(v));
 await p.keyboard.press('Shift+O');ok(await p.textContent('#brushTitle')==='Burn','Shift+O → burn');
 await drag(20,160,280,160,{steps:20});v=await px('Background',[[150,160]]);ok(v[0][0]<120,'burn darkens '+JSON.stringify(v));
 lab=await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label);ok(lab==='Burn','undo label '+lab);
 // coloured pixel with protect tones keeps hue
 await p.evaluate(()=>{__gs.newDoc(200,100,8,[.8,.3,.2],'Hue',false);});await p.keyboard.press('Shift+O');await drag(10,50,190,50,{steps:20});
 v=await px('Background',[[100,50]]);const c=v[0];ok(c[0]>c[1]&&c[1]>=c[2]&&c[0]>210,'dodge with protect tones keeps it red-orange '+c);
 await p.screenshot({path:OUT+'tonal.png'});
 // 10. gradient bucket
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'GB',false);});
 await setFG('#000000');await p.keyboard.press('m');await drag(100,50,200,150);await p.keyboard.press('Alt+Delete');await p.keyboard.press('Control+d');
 await setFG('#ff0000');await p.evaluate(()=>{__gs.ui.bg=[0,0,1];});
 await p.keyboard.press('g');for(let i=0;i<3&&(await p.textContent('#brushTitle'))!=='Gradient bucket';i++)await p.keyboard.press('Shift+G');ok(await p.textContent('#brushTitle')==='Gradient bucket','Shift+G cycles to gradient bucket');
 await p.click('.gpre[aria-label="Foreground to background"]');await p.click('.segb:text-is("Linear")');
 await drag(110,100,190,100);v=await px('Background',[[105,100],[195,100],[50,100],[250,100]]);
 ok(v[0][0]>230&&v[0][2]<30&&v[1][2]>230&&v[1][0]<30&&v[2].join()==='255,255,255,255'&&v[3].join()==='255,255,255,255','gradient fills only the square '+JSON.stringify(v));
 lab=await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label);ok(lab==='Gradient bucket','one undo step ('+lab+')');
 await p.keyboard.press('Control+z');await click(150,100);v=await px('Background',[[101,100],[199,100]]);ok(v[0][0]>230&&v[1][2]>230,'click fills left to right '+JSON.stringify(v));
 await p.screenshot({path:OUT+'gbucket.png'});
 console.log(errs.length?errs.join('\n'):'no errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
