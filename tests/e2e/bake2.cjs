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
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(120);};
 const mpx=(name,k,pts)=>p.evaluate(([name,k,pts])=>{const L=__gs.layerByName(name),t=__gs.mapT(L,k);if(!t||t.empty)return null;const d=__gs.readRGBA8(t),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,k,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};


 const fs=require('fs');
 await p.evaluate(()=>__gs.newDoc(256,256,8,[.5,.5,.5],'bake2',false));
 const rd=f=>fs.readFileSync(__dirname+'/fixtures/'+f,'utf8');
 const bakeN=async(match,cage)=>p.evaluate(async([lo,hi,cg,match])=>{const C=__gs.bakeCfg;C.low=__gs.parseOBJ(lo,'low');C.high=__gs.parseOBJ(hi,'high');C.cage=cg?__gs.parseOBJ(cg,'cage'):null;C.match=match;C.ss=1;C.pad=4;C.front=cg?1:15;C.back=5;
    for(const k in C.kinds)C.kinds[k]=k==='normal';await __gs.runBake(C.low,['normal']);const L=__gs.allLayers().slice(-1)[0];const d=__gs.readRGBA8(__gs.mapT(L,'normal')),W=__gs.doc.w;
    const at=(x,y)=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4));return [at(64+22,128),at(64,128),L.name];},[rd('low2.obj'),rd('high2.obj'),cage?rd('cage2.obj'):null,match]);
 const a=await bakeN(false,false);console.log('no match',JSON.stringify(a));ok(a[0][0]>150,'without matching the barrel bump leaks onto the crate');
 const b2=await bakeN(true,false);console.log('match',JSON.stringify(b2));ok(Math.abs(b2[0][0]-128)<5,'matching by name keeps the crate flat');
 const c=await bakeN(false,true);console.log('cage',JSON.stringify(c));ok(c[0][0]>150,'cage bake finds the high-poly');
 // dialog opens
 await p.evaluate(()=>__gs.act('bake'));await p.waitForTimeout(300);ok(await p.evaluate(()=>__gs.ui.mode==='bake'&&!!document.querySelector('#bkGo')),'Maps › Bake opens the Bake tab');
 await p.screenshot({path:OUT+'bake-dlg.png'});await p.click('#modeTabs [data-mode=paint]');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
