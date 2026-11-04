/* 0.94: engine projects: the record in the game's folder, shared masters kept, asked before updating */
const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__fs={};window.__log=[];
   P.invoke=async(cmd,a)=>{if(cmd==='file_mtime')return window.__fs[a.path]!=null?1:0;if(cmd==='file_size')return window.__fs[a.path]?window.__fs[a.path].length:0;
     if(cmd==='read_file')return Array.from(new TextEncoder().encode(window.__fs[a.path]||''));if(cmd==='dir_files')return [[a.dir+'/Assets',0,0]];if(cmd==='blender_send'){window.__log.push('ping');return false;}return null;};
   P.writeFile=async(path,bytes)=>{window.__fs[path]=new TextDecoder().decode(bytes);window.__log.push('w '+path);};P.pickFolder=async()=>'C:/G';});
 await p.evaluate(()=>{const g=__gs;g.es.to='unity';g.es.dirs.unity='C:/Game';g.texCfg.name='Rock';g.texCfg.preset='urp';g.texCfg.model='none';g.texCfg.size=64;g.texCfg.engShader=true;g.texCfg.size=64;});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 let fs=await p.evaluate(()=>window.__fs);
 const rec=JSON.parse(fs['C:/Game/gouache_project.json']||'null');
 ok(rec&&rec.engine==='unity'&&rec.assets.Rock&&rec.masters.unity===1&&rec.settings&&rec.settings.size===64,'the project record is written inside the game folder '+JSON.stringify(rec).slice(0,160));
 ok(!!fs['C:/Game/Assets/Gouache/GouacheShaded.shader'],'the shared shader is written the first time');
 /* the second asset: the shared shader is left alone */
 await p.evaluate(()=>{window.__fs['C:/Game/Assets/Gouache/GouacheShaded.shader']='// edited by me';__gs.texCfg.name='Crate';window.__log=[];});
 await p.evaluate(()=>__gs.exportTextures());await W(6000);
 fs=await p.evaluate(()=>window.__fs);
 ok(fs['C:/Game/Assets/Gouache/GouacheShaded.shader']==='// edited by me','a second asset leaves the shared shader alone');
 const rec2=JSON.parse(fs['C:/Game/gouache_project.json']);
 ok(rec2.assets.Rock&&rec2.assets.Crate,'both assets are remembered in the project');
 /* an old master: it asks first */
 await p.evaluate(()=>{const r=JSON.parse(window.__fs['C:/Game/gouache_project.json']);r.masters.unity=0;window.__fs['C:/Game/gouache_project.json']=JSON.stringify(r);__gs.texCfg.name='Rock';});
 await p.evaluate(()=>{window.__x=__gs.exportTextures();});await W(3000);
 ok(await p.evaluate(()=>/Update the master shaders/.test(document.body.textContent)),'when the look is newer it asks before updating the masters');
 await p.click('#dlgOk');await W(6000);
 fs=await p.evaluate(()=>window.__fs);
 ok(/gouache-master/.test(fs['C:/Game/Assets/Gouache/GouacheShaded.shader']||''),'after saying yes the shared shader is rewritten');
 ok(JSON.parse(fs['C:/Game/gouache_project.json']).masters.unity===1,'and the project record shows the new version');
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,200));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
