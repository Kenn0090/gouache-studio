/* 0.94: the live link into Unity, Godot and Unreal (with a stand-in for the disk and the network) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__w={};window.__calls=[];window.__have=new Set();
   P.invoke=async(cmd,a)=>{window.__calls.push([cmd,a]);if(cmd==='file_mtime')return window.__have.has(a.path)?1:0;if(cmd==='blender_send')return window.__up===true;return null;};
   P.writeFile=async(path,bytes)=>{window.__w[path]=new TextDecoder().decode(bytes);window.__have.add(path);};});
 /* Unity */
 await p.evaluate(()=>{__gs.es.dirs.unity='C:/U';__gs.es.dirs.godot='C:/G';__gs.es.dirs.unreal='C:/R';});
 ok(!(await p.evaluate(()=>__gs.elInstalled('unity'))),'Unity: the link is not in the project yet');
 await p.evaluate(()=>__gs.elInstall('unity'));
 let w=await p.evaluate(()=>window.__w);
 ok(w['C:/U/Assets/Gouache/GouacheLink.cs']&&/HttpListener/.test(w['C:/U/Assets/Gouache/GouacheLink.cs'])&&/47651/.test(w['C:/U/Assets/Gouache/GouacheLink.cs']),'Unity: the link script is added');
 ok(/MonoImporter/.test(w['C:/U/Assets/Gouache/GouacheLink.cs.meta']||''),'Unity: with its settings file');
 ok(await p.evaluate(()=>__gs.elInstalled('unity')),'Unity: the link now shows as installed');
 /* Godot */
 await p.evaluate(()=>__gs.elInstall('godot'));
 w=await p.evaluate(()=>window.__w);
 ok(/\[plugin\]/.test(w['C:/G/addons/gouache_link/plugin.cfg']||'')&&/EditorPlugin/.test(w['C:/G/addons/gouache_link/plugin.gd']||'')&&/47652/.test(w['C:/G/addons/gouache_link/plugin.gd']||''),'Godot: plugin.cfg and plugin.gd are added');
 ok(/\\r\\n\\r\\n/.test(w['C:/G/addons/gouache_link/plugin.gd']||'')&&!/\\\\r/.test(w['C:/G/addons/gouache_link/plugin.gd']||''),'Godot: the line breaks are written for GDScript');
 /* Unreal: init_unreal.py is added when there is none, and left alone when there is */
 await p.evaluate(()=>__gs.elInstall('unreal'));
 w=await p.evaluate(()=>window.__w);
 ok(/register_slate_post_tick_callback/.test(w['C:/R/Content/Python/gouache_link.py']||'')&&w['C:/R/Content/Python/init_unreal.py']==='import gouache_link\n','Unreal: gouache_link.py and init_unreal.py are added');
 await p.evaluate(()=>{window.__w={};__gs.es.dirs.unreal='C:/R';});
 await p.evaluate(()=>__gs.elInstall('unreal'));
 w=await p.evaluate(()=>window.__w);
 ok(!w['C:/R/Content/Python/init_unreal.py']&&w['C:/R/Content/Python/gouache_link.py'],'Unreal: an existing init_unreal.py is not overwritten');
 /* telling the engine */
 await p.evaluate(()=>{window.__up=true;window.__calls=[];});
 const sent=await p.evaluate(async()=>{const ok=await __gs.elPing('unity','C:/U/Assets/Gouache/Rock',[{name:'Rock.fbx'},{name:'Body.mat'}],'rock');return {ok,c:window.__calls.filter(c=>c[0]==='blender_send').map(c=>c[1])};});
 ok(sent.ok&&sent.c[0].port===47651&&JSON.parse(sent.c[0].path).model==='Rock.fbx'&&JSON.parse(sent.c[0].path).name==='Rock','Unity: the engine is told the name and the model');
 await p.evaluate(()=>{window.__up=false;});
 ok(!(await p.evaluate(()=>__gs.elPing('unity','C:/U/x',[],'rock'))),'when the editor is not listening it says so and keeps the files');
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,200));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
