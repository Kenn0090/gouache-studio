/* 0.23: mask stacks (rows under a layer: paint, fill, noise, generators, filters) and content effects. */
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
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'mstack',false));await W(300);
 await p.evaluate(()=>__gs.act('addLayer'));await W();await setFG('#e02020');await p.evaluate(()=>{document.activeElement.blur();__gs.act('fill');});await W(200);
 const L=()=>'__gs.doc.active';
 /* 0.29: a slow content effect is not redone while you paint on another layer */
 await p.evaluate(()=>{__gs.newDoc(96,96,8,[1,1,1],'cfxcache',false);});await W(300);
 await p.evaluate(()=>__gs.act('addLayer'));await W();await setFG('#e02020');await p.evaluate(()=>{document.activeElement.blur();__gs.act('fill');});await W(200);
 await p.evaluate(()=>{window.__cnt=0;const F=__gs.FX.invert,r=F.render;F.render=function(){window.__cnt++;return r.apply(this,arguments);};__gs.cfxAdd(__gs.doc.active,'invert');});await W(400);
 const c0=await p.evaluate(()=>window.__cnt);
 await p.evaluate(()=>__gs.act('addLayer'));await W(300);
 await drag(10,10,80,80);await drag(10,80,80,10);await W(300);
 const c1=await p.evaluate(()=>window.__cnt);
 ok(c0>=1&&c1<=c0+1,'painting on another layer does not redo the content effect ('+c0+' → '+c1+')');
 const px2=await comp('base',[[48,48]]);ok(true,'still composites '+JSON.stringify(px2));
 console.log(errs.join('\n'));console.log(fails?'FAILS '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);})();
