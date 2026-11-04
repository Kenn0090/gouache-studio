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
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__fs={};
   P.invoke=async(cmd,a)=>{if(cmd==='file_mtime')return window.__fs[a.path]!=null?1:0;if(cmd==='file_size')return window.__fs[a.path]?window.__fs[a.path].length:0;
     if(cmd==='read_file')return Array.from(new TextEncoder().encode(window.__fs[a.path]||''));if(cmd==='dir_files')return [[a.dir+'/Assets',0,0]];if(cmd==='blender_send')return false;return null;};
   P.writeFile=async(path,bytes)=>{window.__fs[path]=new TextDecoder().decode(bytes);};P.pickFolder=async()=>'C:/G';});
 await p.evaluate(()=>{const g=__gs;g.es.to='unreal';g.es.dirs.unreal='C:/Game';g.texCfg.model='none';g.texCfg.size=64;g.texCfg.engShader=true;g.texCfg.preset='urp';});
 const send=async(name,steps)=>{await p.evaluate(([n,s])=>{__gs.texCfg.name=n;__gs.doc.v3shade={kind:'toon',p:{toon:{steps:s}}};window.__x=__gs.exportTextures();},[name,steps]);};
 /* first asset: it defines the look */
 await send('Rock',3);await W(6000);
 let rec=JSON.parse(await p.evaluate(()=>window.__fs['C:/Game/gouache_project.gdata']));
 ok(rec.bases&&rec.bases.Toon&&rec.bases.Toon.steps===3,'the first asset sets the project\u2019s usual Toon look');
 /* same settings: no question */
 await send('Crate',3);await W(6000);
 ok(!(await p.evaluate(()=>(!!document.querySelector('#epVarName')&&!document.querySelector('#modal').hidden))),'the same settings do not ask anything');
 /* different settings: it asks, and a variant is saved */
 await send('Lamp',5);await W(3000);
 ok(await p.evaluate(()=>(!!document.querySelector('#epVarName')&&!document.querySelector('#modal').hidden)),'different settings ask what to do');
 await p.click('#dlgBody .seg button:nth-child(2)');await p.fill('#epVarName','Night');await p.click('#dlgOk');await W(6000);
 rec=JSON.parse(await p.evaluate(()=>window.__fs['C:/Game/gouache_project.gdata']));
 ok(rec.variants.Toon&&rec.variants.Toon.Night&&rec.variants.Toon.Night.steps===5&&rec.assets.Lamp.infos.Lamp?.variant==='Night'||Object.values(rec.assets.Lamp.infos)[0].variant==='Night','the settings are saved as the variant Night and Lamp uses it');
 let js=JSON.parse(await p.evaluate(()=>window.__fs['C:/Game/Content/Gouache/Lamp/gouache_unreal.gdata']||'{}'));
 ok(js.sets&&js.sets[0].variant==='Night'&&js.sets[0].lookKeys.includes('Bands'),'Unreal is told Lamp uses the Night variant and which settings belong to it');
 /* another asset with the variant's settings follows it without asking */
 await send('Torch',5);await W(6000);
 ok(!(await p.evaluate(()=>(!!document.querySelector('#epVarName')&&!document.querySelector('#modal').hidden))),'matching a variant needs no question');
 rec=JSON.parse(await p.evaluate(()=>window.__fs['C:/Game/gouache_project.gdata']));
 ok(Object.values(rec.assets.Torch.infos)[0].variant==='Night','…and Torch is recorded as using Night');
 /* change for everyone: assets that follow the usual look are updated */
 await send('Wall',2);await W(3000);
 await p.click('#dlgBody .seg button:nth-child(3)');await p.click('#dlgOk');await W(6000);
 rec=JSON.parse(await p.evaluate(()=>window.__fs['C:/Game/gouache_project.gdata']));
 ok(rec.bases.Toon.steps===2&&Object.values(rec.assets.Rock.infos)[0].sh.p.toon.steps===2&&Object.values(rec.assets.Lamp.infos)[0].sh.p.toon.steps===5,'Change for everyone updates the assets that follow the usual look, not the variant\u2019s');
 js=JSON.parse(await p.evaluate(()=>window.__fs['C:/Game/Content/Gouache/Wall/gouache_unreal.gdata']||'{}'));
 ok(js.updates&&js.updates.some(u=>u.asset==='Rock')&&js.updates.some(u=>u.asset==='Crate'),'Unreal is told to update Rock and Crate\u2019s parameters');
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,200));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
