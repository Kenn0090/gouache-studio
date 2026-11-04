/* 0.63: Smudge, Smear and Liquify on the 3D model (all maps of the layer, one undo step) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 /* ---- entering the tab ---- */
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 let s=await p.evaluate(()=>({mode:__gs.mode,own:__gs.tabDocs.key,w:__gs.doc.w,maps:__gs.doc.maps.join(),layers:__gs.allLayers().map(L=>L.name),v3:__gs.v3.on,paint:__gs.inPaint(()=>__gs.allLayers().map(L=>L.name)),
   dock2:!document.querySelector('#dock2').hidden&&!!document.querySelector('#dock2 section[aria-labelledby="hColor"]')}));
 ok(s.mode==='p3d'&&s.own==='p3d'&&s.w===256,'3D Paint has its own canvas '+JSON.stringify(s));
 ok(s.maps==='base,rough,metal,height,normal'&&s.layers.join()==='Base material,Paint','a PBR texture set with a base material and a paint layer');
 ok(s.v3&&s.dock2,'3D view on, Colour in the column beside it');
 const hb=await p.locator('#v3Hit').boundingBox();ok(hb&&hb.width>700,'3D layout: the viewport takes the painting area '+(hb&&Math.round(hb.width)));
 await p.screenshot({path:OUT+'p3d-enter.png'});
 /* ---- painting on the model with a left drag ---- */
 await setFG('#d02020');await p.evaluate(()=>Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null}));
 const cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const red=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),d=__gs.readRGBA8(__gs.mapT(L,'base'));let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<80&&d[i+3]>200)n++;return n;});
 await p.mouse.move(cx-60,cy);await p.mouse.down();await p.mouse.move(cx+60,cy,{steps:10});await p.mouse.up();await W(500);
 const r1=await red();ok(r1>200,'left drag paints on the model ('+r1+' px)');
 /* ---- Alt+left drag turns (Substance style), and does not paint ---- */
 await p.selectOption('#p3Model','plane');await W(900);
 const stroke=async(x0,y0,x1,y1)=>{await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move(x1,y1,{steps:12});await p.mouse.up();await W(500);};
 const stats=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),d=__gs.readRGBA8(__gs.mapT(L,'base'));let red=0,blue=0,mix=0,sx=0,sy=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<200)continue;const r=d[i],g=d[i+1],b=d[i+2];if(r>150&&b<80){red++;const p=i/4;sx+=p%__gs.doc.w;sy+=Math.floor(p/__gs.doc.w);}else if(b>150&&r<80)blue++;else if(r>70&&b>70&&g<120)mix++;}return {red,blue,mix,cx:red?sx/red:0,cy:red?sy/red:0};});
 // red on the left, blue on the right, side by side
 await p.evaluate(()=>Object.assign(__gs.brush,{size:70,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null,strength:.9,charge:0}));
 await setFG('#e01010');await stroke(cx-140,cy,cx-2,cy);await setFG('#1010e0');await stroke(cx+2,cy,cx+140,cy);
 const s0=await stats();ok(s0.red>300&&s0.blue>300&&s0.mix<60,'red and blue painted side by side '+JSON.stringify({red:s0.red,blue:s0.blue,mix:s0.mix}));
 // Smudge: drag across the boundary, red is pulled into the blue
 await p.evaluate(()=>{__gs.setTool('smudge');__gs.v3.paintOn=true;});await W(300);
 await p.evaluate(()=>{__gs.smudge3d.mode='smudge';});
 await stroke(cx-70,cy,cx+90,cy);const s1=await stats();
 ok(s1.mix>s0.mix+80,'Smudge pulls paint across the boundary: mixed pixels '+s0.mix+' → '+s1.mix);
 await p.evaluate(()=>__gs.undo());await W(600);const s2=await stats();ok(Math.abs(s2.mix-s0.mix)<20&&Math.abs(s2.red-s0.red)<30,'one undo step brings it back ('+s2.mix+' mixed, '+s2.red+' red)');
 // Smear drags a longer streak
 await p.evaluate(()=>{__gs.smudge3d.mode='smear';});await stroke(cx-70,cy,cx+90,cy);const s3=await stats();
 ok(Math.abs(s3.red-s0.red)>300||s3.mix>s0.mix+80,'Smear drags paint in a longer streak (red '+s0.red+' → '+s3.red+', mixed '+s0.mix+' → '+s3.mix+')');
 await p.evaluate(()=>__gs.undo());await W(600);
 // every map of the layer moves together: put a copy of the colours in Roughness and smudge again
 await p.evaluate(()=>{const L=__gs.layerByName('Paint');__gs.ensureMapTarget(L,'rough');const b=__gs.mapT(L,'base'),r=__gs.mapT(L,'rough');__gs.blit(b,r,0,0,b.w,b.h,0,0);});
 const rmix=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),d=__gs.readRGBA8(__gs.mapT(L,'rough'));let mix=0;for(let i=0;i<d.length;i+=4)if(d[i+3]>200&&d[i]>70&&d[i+2]>70&&d[i+1]<120)mix++;return mix;});
 const rm0=await rmix();await p.evaluate(()=>{__gs.setTool('smudge');__gs.smudge3d.mode='smudge';});await W(300);await stroke(cx-70,cy,cx+90,cy);const rm1=await rmix();
 ok(rm1>rm0+80,'the Roughness map is smudged together with the colour ('+rm0+' → '+rm1+')');
 await p.evaluate(()=>__gs.undo());await W(600);ok(Math.abs(await rmix()-rm0)<20,'and one undo brings both back');
 // Liquify: push the red to the right
 await p.evaluate(()=>{__gs.setTool('liquify');__gs.liq.mode='push';__gs.liq.size=160;__gs.liq.strength=.8;});await W(300);
 const a=await stats();await stroke(cx-80,cy,cx+60,cy);const b2=await stats();
 ok(Math.abs(b2.cx-a.cx)>2||Math.abs(b2.red-a.red)>40,'Liquify push moves the paint (red centre '+a.cx.toFixed(1)+' → '+b2.cx.toFixed(1)+', red '+a.red+' → '+b2.red+')');
 await p.evaluate(()=>__gs.undo());await W(600);const c2=await stats();ok(Math.abs(c2.red-a.red)<30,'Liquify is one undo step ('+c2.red+' vs '+a.red+')');
 // the hold modes run without errors
 await p.evaluate(()=>{__gs.liq.mode='bloat';});await p.mouse.move(cx-60,cy);await p.mouse.down();await W(300);await p.mouse.up();await W(400);
 await p.evaluate(()=>{__gs.liq.mode='cw';});await p.mouse.move(cx-60,cy);await p.mouse.down();await W(300);await p.mouse.up();await W(400);
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
