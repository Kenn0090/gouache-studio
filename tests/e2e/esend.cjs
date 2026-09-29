/* 0.27: Send an export straight into Blender, Unity, Godot or Unreal (desktop, with a stand-in for the disk) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* the browser version only explains */
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);
 ok(await p.locator('#txSend').count()===0&&await p.evaluate(()=>/desktop app/.test(document.querySelector('#dlgBody').textContent)),'the browser version says sending needs the desktop app');
 await p.click('#dlgCancel');await W(200);
 /* pretend to be the desktop app */
 await p.evaluate(()=>{const P=__gs.platform;window.__calls=[];window.__written=[];P.isDesktop=true;
   P.invoke=async(cmd,a)=>{window.__calls.push([cmd,a]);if(cmd==='dir_files')return a.dir.includes('godotproj')?[[a.dir+'/project.godot',0,0]]:[[a.dir+'/readme.txt',0,0]];if(cmd==='blender_send')return window.__blenderUp;return null;};
   P.writeFile=async(path,bytes)=>{window.__written.push(path);};P.pickFolder=async()=>window.__pick;P.openDialog=async()=>'C:/Program Files/Blender/blender.exe';});
 /* Unity: files go into the project's Assets/Gouache/<name> */
 await p.evaluate(()=>{const g=__gs;g.es.to='unity';g.es.dirs.unity='C:/Games/MyUnity';g.texCfg.name='Rock';g.texCfg.preset='urp';g.texCfg.model='glb';g.texCfg.size=128;});
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);
 ok(await p.locator('#txSend').inputValue()==='unity'&&await p.locator('#dlgOk').textContent()==='Export and send','the export window has Send to (Unity chosen)');
 await p.click('#dlgOk');await W(4000);
 let r=await p.evaluate(()=>({mk:window.__calls.filter(c=>c[0]==='make_dir').map(c=>c[1].path),w:window.__written.map(x=>x.split('/').slice(-2).join('/'))}));
 ok(r.mk.includes('C:/Games/MyUnity/Assets/Gouache/Rock'),'Unity: the folder Assets/Gouache/Rock is made '+JSON.stringify(r.mk));
 ok(r.w.some(x=>x==='Rock/Rock.glb')&&r.w.some(x=>/Rock\/Rock_Albedo\.png/.test(x)),'…and the model and textures are written there '+JSON.stringify(r.w));
 /* Godot: a folder that isn't a Godot project is refused */
 await p.evaluate(()=>{__gs.es.to='godot';__gs.es.dirs.godot='';window.__pick='C:/stuff/notaproject';});
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);await p.click('#esProject');await W(300);
 ok(await p.evaluate(()=>!__gs.es.dirs.godot),'Godot: a folder without project.godot is refused');
 await p.evaluate(()=>{window.__pick='C:/games/godotproj';});await p.click('#esProject');await W(500);
 ok(await p.evaluate(()=>__gs.es.dirs.godot==='C:/games/godotproj'),'…a Godot project folder is kept');
 ok(await p.evaluate(()=>__gs.esSub('godot','Rock').join('/')==='gouache/Rock'&&__gs.esSub('unreal','Rock').join('/')==='Content/Gouache/Rock'),'Godot and Unreal get their own folders');
 await p.click('#dlgCancel').catch(()=>{});await W(200);
 /* Blender listening: the model is handed over */
 await p.evaluate(()=>{const g=__gs;g.es.to='blender';g.es.dirs.blender='C:/exports';window.__blenderUp=true;window.__calls=[];});
 await p.evaluate(()=>__gs.esAfter('C:/exports',[{name:'Rock.glb'},{name:'Rock_BaseColor.png'}],'Rock'));await W(200);
 r=await p.evaluate(()=>window.__calls.filter(c=>c[0]==='blender_send').map(c=>c[1]));
 ok(r.length===1&&r[0].path==='C:/exports/Rock.glb'&&r[0].port===47650,'Blender with the add-on gets the .glb '+JSON.stringify(r));
 /* Blender not listening: started with the model */
 await p.evaluate(()=>{window.__blenderUp=false;window.__calls=[];window.__written=[];__gs.es.blender='C:/Program Files/Blender/blender.exe';});
 await p.evaluate(()=>__gs.esAfter('C:/exports',[{name:'Rock.glb'}],'Rock'));await W(200);
 r=await p.evaluate(()=>({l:window.__calls.filter(c=>c[0]==='launch_app').map(c=>c[1]),w:window.__written}));
 ok(r.l.length===1&&r.l[0].exe.endsWith('blender.exe')&&r.l[0].args[0]==='--python'&&r.w[0]==='C:/exports/_gouache_open.py','otherwise Blender is started with a script that opens the model '+JSON.stringify(r));
 /* the add-on can be saved */
 await p.evaluate(()=>{window.__written=[];window.__pick='C:/addons';__gs.dlgExportTextures();});await W(300);
 ok(await p.locator('#esAddon').isVisible(),'Blender: Save the Blender add-on… is offered');
 await p.click('#esAddon');await W(300);ok(await p.evaluate(()=>window.__written[0]==='C:/addons/gouache_link.py'),'the add-on is saved');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
