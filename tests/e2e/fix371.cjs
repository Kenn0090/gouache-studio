/* 0.28: Decals: click a decal, click the model; a movable sticker layer with colour, height, roughness, metal */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});

 await p.addInitScript(()=>{try{localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await W(400);
 /* the friend's bug: a brush tip picked while the eraser or blend tool is on stays on that tool */
 for(const t of ['erase','smudge','dodge']){
   const r=await p.evaluate(t=>{__gs.setTool(t);__gs.usePreset('Chalk');return __gs.ui.tool;},t);
   ok(r===t,'picking a brush while on '+t+' keeps '+t+' ('+r+')');}
 ok(await p.evaluate(()=>{__gs.setTool('brush');__gs.usePreset('Chalk');return __gs.ui.tool==='brush';}),'and on the brush it stays the brush');
 /* locked tiling: one number goes into every axis */
 const sc=await p.evaluate(()=>{localStorage.setItem('gs.pxfLock','1');const x={s:[1,1,1]};__gs.pxfSetScale(x,0,4,3,true);const a=x.s.slice();localStorage.setItem('gs.pxfLock','0');const y={s:[1,1,1]};__gs.pxfSetScale(y,0,4,3,true);return [a,y.s];});
 ok(sc[0].every(v=>Math.abs(v-.25)<1e-6)&&sc[1][0]===.25&&sc[1][1]===1,'locked tiling puts the number in every axis '+JSON.stringify(sc));
 await p.evaluate(()=>localStorage.setItem('gs.pxfLock','1'));
 /* 3D Paint */
 await p.evaluate(()=>{__gs.rl().on=true;});
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 ok(await p.evaluate(()=>[...document.querySelectorAll('.ruler')].every(r=>r.hidden||r.offsetParent===null)),'no rulers in 3D Paint');
 ok(await p.evaluate(()=>{const t=document.querySelector('#vpStrip').getBoundingClientRect(),w=document.querySelector('#work').getBoundingClientRect();return t.left>w.left+w.width*.6;}),'3D · Split · 2D · UV sits at the lower right');
 /* layer list starts under the buttons */
 ok(await p.evaluate(()=>{const l=document.querySelector('#layerList').getBoundingClientRect(),b=document.querySelector('.lbtns.top');return !!b&&l.top-b.getBoundingClientRect().bottom<40;}),'the layer list starts right under its buttons');
 /* Bake Maps and Shader are tabs beside the texture sets */
 const lay=await p.evaluate(()=>({g:__gs.dk.L.groups.map(g=>g.tabs.join('+')),c2:__gs.dk.col2.groups.map(g=>g.tabs.join('+')),sh:__gs.dk.L.shelf.tabs.join('+')}));
 ok(lay.g[0].includes('p3d')&&lay.g[0].includes('p3bake')&&lay.g[0].includes('shading'),'Bake Maps and Shader sit in the texture sets group '+JSON.stringify(lay));
 ok(!lay.c2.join().includes('shading')&&!lay.c2.join().includes('stencils')&&!lay.sh.includes('stencils'),'Shader left the side column; Stencils has no tab of its own');
 /* F re-centres the model */
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();const c=__gs.v3.cam;c.tx=2;c.ty=1;c.dist*=3;});
 await p.mouse.move(300,300);await p.keyboard.press('f');await W(300);
 const cam=await p.evaluate(()=>{const c=__gs.v3.cam;return [c.tx,c.ty,c.dist,__gs.ui.mode];});
 ok(cam[0]===0&&cam[1]===0&&cam[2]<20,'F brings the model back to the middle '+JSON.stringify(cam));
 /* stencil switch in Brushes, with a drop zone */
 await p.evaluate(()=>__gs.showPanel('brushes'));await W(300);
 ok(await p.evaluate(()=>{const b=document.querySelector('#stBrush');return !!b&&!b.hidden&&!!b.querySelector('#stUse');}),'Brushes has a Use a stencil switch');
 await p.evaluate(()=>{document.querySelector('#stUse').click();});await W(200);
 ok(await p.evaluate(()=>!!document.querySelector('#stDrop')),'ticking it shows a drop zone');
 await p.evaluate(async()=>{const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,8,16);const b=await new Promise(r=>c.toBlob(r,'image/png'));
   const dt=new DataTransfer();dt.items.add(new File([b],'half.png',{type:'image/png'}));document.querySelector('#stDrop').dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));});
 await W(600);
 ok(await p.evaluate(()=>!!__gs.st3.img&&__gs.st3.mode!=='off'),'dropping a picture makes it the stencil');
 /* the brush panel no longer repeats the top bar */
 ok(await p.evaluate(()=>!document.querySelector('#bSize')&&!document.querySelector('#bFlow')),'Tool settings no longer repeat size and flow');
 /* Tint & adjust */
 await p.evaluate(()=>__gs.cmdNewFillLayer());await W(600);
 const px=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base'));return [d[0],d[1],d[2]];});
 const before=await px();
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.maps.base.c=[.8,.8,.8];L.fill.tint={on:true,mode:'multiply',c:[1,0,0],amt:1};__gs.fillRender(L);});await W(300);
 const after=await px();
 ok(after[0]>150&&after[1]<40&&after[2]<40,'a red multiply tint turns the colour red '+JSON.stringify(before)+' -> '+JSON.stringify(after));
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.tint.on=false;L.fill.adj={con:0,bri:-1,sat:0,hue:0};__gs.fillRender(L);});await W(300);
 const dark=await px();ok(dark[0]<before[0]-40||dark[0]<120,'the brightness slider darkens it '+JSON.stringify(dark));
 await p.evaluate(()=>{__gs.renderMatEd(true);});await W(200);
 ok(await p.evaluate(()=>!!document.querySelector('#fl_tint_a')&&!!document.querySelector('#fl_adj_con')&&document.querySelector('#matEdBody').textContent.indexOf('Tint')<document.querySelector('#matEdBody').textContent.indexOf('Base colour')),'Tint & adjust sit above the channels');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
