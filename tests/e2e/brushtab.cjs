const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const drag=async(x0,y0,x1,y1,steps)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:steps||12});await p.mouse.up();await W(200);};
 const px=(x,y)=>p.evaluate(([x,y])=>{const t=__gs.compositeMap('base');const d=__gs.readRGBA8(t);__gs.release(t);const i=(y*__gs.doc.w+x)*4;return [d[i],d[i+1],d[i+2],d[i+3]];},[x,y]);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Painting',false));await W();
 await p.evaluate(()=>__gs.act('addLayer'));await setFG('#cc2222');await p.evaluate(()=>__gs.act('fill'));await W(200);
 const before=await p.evaluate(()=>({undo:__gs.hist.undo.length,layers:__gs.allLayers().map(l=>l.name).join()}));
 // into the Brush tab
 await p.click('#modeTabs [data-mode=brush]');await W(600);
 let st=await p.evaluate(()=>({mode:__gs.ui.mode,w:__gs.doc.w,layers:__gs.allLayers().map(l=>l.name).join(),undo:__gs.hist.undo.length,fg:[...__gs.ui.fg],sec:getComputedStyle(document.querySelector('#brushTabSec')).display,v3:__gs.v3.on,name:document.querySelector('#docName').textContent}));
 ok(st.mode==='brush'&&st.w===512&&st.layers==='Sketch'&&st.undo===0&&st.fg.join()==='0,0,0'&&st.sec!=='none','Brush tab: its own white 512 canvas, black brush '+JSON.stringify(st));
 ok((await px(10,10))[0]>250,'sketch starts white');
 await p.evaluate(()=>Object.assign(__gs.brush,{size:50,hardness:1,flow:1,opacity:1,spacing:.1,tip:null,smoothing:0,pSize:false,hueJitter:0,satJitter:0,valJitter:0}));
 await drag(150,256,360,256);await drag(256,150,256,360);await W(900);
 const test=await p.evaluate(()=>{const c=document.querySelector('#btTest'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>40)n++;return n;});
 ok(test>200,'test stroke paints with the sketch ('+test+' pixels)');
 await p.screenshot({path:OUT+'brushtab.png'});
 await p.fill('#btName','Cross');await p.evaluate(()=>{const s=document.querySelector('#btSp');s.value=.5;s.dispatchEvent(new Event('input'));});await p.click('#btMake');await W(400);
 let mk=await p.evaluate(()=>{const s=__gs.library.find(s=>s.id==='custom');const q=s&&s.presets.find(q=>q.name==='Cross');return {q:!!q,sp:q&&q.spacing,tw:q&&q.tip.w,brushTip:__gs.brush.tip&&__gs.brush.tip.name};});
 ok(mk.q&&Math.abs(mk.sp-.5)<.01&&Math.abs(mk.tw-260)<20,'Make brush saves it with its settings '+JSON.stringify(mk));
 ok(mk.brushTip!=='Cross','the painting brush is left alone');
 ok(await p.locator('.btrow',{hasText:'Cross'}).count()===1,'listed under Your tips');
 // back to Paint: the painting is untouched
 await p.click('#modeTabs [data-mode=paint]');await W(600);
 st=await p.evaluate(()=>({w:__gs.doc.w,undo:__gs.hist.undo.length,layers:__gs.allLayers().map(l=>l.name).join(),fg:[...__gs.ui.fg].map(v=>Math.round(v*255)),name:document.querySelector('#docName').textContent}));
 ok(st.w===256&&st.undo===before.undo&&st.layers===before.layers&&st.name==='Painting','Paint: the document, its layers and undo steps are back '+JSON.stringify(st));
 const rp=await px(100,100);ok(rp[0]>190&&rp[1]<60,'painting pixels untouched '+rp);
 ok(st.fg.join()==='204,34,34','painting colour back '+st.fg);
 await p.evaluate(()=>__gs.undo());await W(300);ok((await px(100,100))[0]>250,'undo in Paint still undoes the painting');await p.evaluate(()=>__gs.redo());await W(300);
 // and the sketch is still there
 await p.click('#modeTabs [data-mode=brush]');await W(600);
 ok((await px(256,256))[0]<30&&await p.evaluate(()=>__gs.hist.undo.length)===2,'Brush: the sketch and its undo steps are kept');
 await p.evaluate(()=>__gs.undo());await W(300);ok((await px(256,200))[0]>250,'undo in the Brush tab undoes the sketch');
 // edit a saved tip
 await p.click('.btrow:has-text("Cross") button:text("Edit")');await W(500);
 ok((await px(256,256))[0]<30&&(await px(256,150))[0]<60,'Edit puts the tip back on the canvas');
 await drag(120,120,390,390);await W(900);await p.click('button:text("Update “Cross”")');await W(400);
 mk=await p.evaluate(()=>{const s=__gs.library.find(s=>s.id==='custom');return {n:s.presets.filter(q=>q.name==='Cross').length,tw:s.presets.find(q=>q.name==='Cross').tip.w};});
 ok(mk.n===1&&mk.tw>270,'Update changes the saved tip '+JSON.stringify(mk));
 // rename and delete
 await p.click('.btrow:has-text("Cross") button:text("Rename")');await W(200);await p.fill('#dlgBody input','Star');await p.click('#dlgOk');await W(200);
 ok(await p.locator('.btrow',{hasText:'Star'}).count()===1,'rename');
 await p.click('.btrow:has-text("Star") button[aria-label="Delete Star"]');await W(200);await p.click('#dlgOk');await W(200);
 ok(await p.evaluate(()=>!__gs.library.find(s=>s.id==='custom').presets.some(q=>q.name==='Star')),'delete');
 // saving is not for the sketch; a new canvas; guides
 await p.keyboard.press('Control+s');await W(300);ok(/Brush tab makes brushes/.test(await p.textContent('#toast')),'Ctrl+S explains instead of saving the sketch');
 await p.click('#btBody .segb:text-is("1024")');await W(300);if(await p.isVisible('#dlgOk'))await p.click('#dlgOk');await W(400);
 ok(await p.evaluate(()=>__gs.doc.w)===1024&&(await px(512,512))[0]>250,'a new 1024 canvas');
 ok(await p.evaluate(()=>!!document.querySelector('#xfOv .guide')),'centre guides shown');
 // File › New from the Brush tab goes back to Paint first
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'Fresh',false));await W(400);
 ok(await p.evaluate(()=>__gs.ui.mode)==='paint'&&await p.evaluate(()=>__gs.doc.w)===128,'a new document from the Brush tab lands in Paint');
 await p.click('#modeTabs [data-mode=brush]');await W(500);ok(await p.evaluate(()=>__gs.doc.w)===1024,'the sketch survives a new document');
 await p.click('#modeTabs [data-mode=paint]');await W(300);
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
