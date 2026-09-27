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


 await p.keyboard.press('Control+Alt+n');await p.waitForTimeout(200);
 await p.fill('#dW','64');await p.fill('#dH','32');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(400);
 await p.evaluate(()=>__gs.setDocMaps(['base','rough','metal','height','normal','ao','emis','opac']));
 await setFG('#ff8000');await p.keyboard.press('b');
 await p.evaluate(()=>{const m=__gs.ui.mapBrush;Object.assign(m.rough,{on:true,v:.2});Object.assign(m.metal,{on:true,v:1});Object.assign(m.height,{on:true,v:1});Object.assign(m.ao,{on:true,v:.4});Object.assign(m.opac,{on:true,v:.5});Object.assign(m.emis,{on:true,c:[0,1,0]});__gs.brush.size=12;__gs.brush.hardness=1;__gs.brush.pSize=false;});
 await drag(10,16,54,16);
 const fs=require('fs');
 for(const pr of ['unreal','urp','hdrp','godot','blender']){
   const files=await p.evaluate(async pr=>{__gs.texCfg.name='Rock Wall';__gs.texCfg.size=0;__gs.texCfg.fmt='png';const f=await __gs.buildTextures(__gs.TEX_PRESETS[pr],'Rock Wall');return f.map(x=>({name:x.name,data:Array.from(x.data)}));},pr);
   fs.mkdirSync(OUT+'tex/'+pr,{recursive:true});for(const f of files)fs.writeFileSync(OUT+'tex/'+pr+'/'+f.name,Buffer.from(f.data));
   console.log(pr+': '+files.map(f=>f.name).join(' '));}
 const f2=await p.evaluate(async()=>{__gs.texCfg.size=128;__gs.texCfg.fmt='tga';const f=await __gs.buildTextures(__gs.TEX_PRESETS.unreal,'Rock Wall');__gs.texCfg.size=0;__gs.texCfg.fmt='png';return f.map(x=>({name:x.name,data:Array.from(x.data)}));});
 fs.mkdirSync(OUT+'tex/tga',{recursive:true});for(const f of f2)fs.writeFileSync(OUT+'tex/tga/'+f.name,Buffer.from(f.data));
 await p.click('#menubar button:has-text("File"), button.menu:has-text("File")').catch(()=>{});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
