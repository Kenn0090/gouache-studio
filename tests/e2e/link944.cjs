/* 0.94.4: sending to an engine adds the live link by itself and switches on what it needs (Kenn: fewer steps) */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const setup=async(files)=>p.evaluate(F=>{const P=__gs.platform;P.isDesktop=true;window.__fs=Object.assign({},F);window.__pings=[];
   P.invoke=async(cmd,a)=>{if(cmd==='dir_files')return Object.keys(window.__fs).filter(k=>k.startsWith(a.dir)&&!k.slice(a.dir.length+1).includes('/')).map(k=>[k,1,1]);
     if(cmd==='file_mtime')return window.__fs[a.path]!=null?1:0;if(cmd==='file_size')return (window.__fs[a.path]||'').length;if(cmd==='make_dir')return true;if(cmd==='blender_send'){window.__pings.push(a);return true;}return null;};
   P.readFile=async f=>new TextEncoder().encode(window.__fs[f]);P.writeFile=async(f,bytes)=>{window.__fs[f]=new TextDecoder().decode(bytes);};},files);
 /* Unreal */
 await setup({'C:/proj/Game.uproject':JSON.stringify({FileVersion:3,EngineAssociation:'5.4',Plugins:[{Name:'ModelingToolsEditorMode',Enabled:true}]},null,'\t')});
 await p.evaluate(()=>{__gs.es.to='unreal';__gs.es.dirs.unreal='C:/proj';__gs.es.live=true;});
 const r1=await p.evaluate(()=>__gs.elPing('unreal','C:/proj/Content/Gouache/Rock',[{name:'Rock.fbx'}],'Rock'));
 const fs1=await p.evaluate(()=>window.__fs);
 ok(!!fs1['C:/proj/Content/Python/gouache_link.py']&&/import gouache_link/.test(fs1['C:/proj/Content/Python/init_unreal.py']||''),'the first send to Unreal adds the link by itself');
 const up=JSON.parse(fs1['C:/proj/Game.uproject']);
 ok(up.Plugins.some(x=>x.Name==='PythonScriptPlugin'&&x.Enabled)&&up.Plugins.some(x=>x.Name==='EditorScriptingUtilities'&&x.Enabled)&&up.Plugins.some(x=>x.Name==='ModelingToolsEditorMode'),'…switches on the Python plug-ins in the .uproject and keeps the others');
 const r2=await p.evaluate(()=>__gs.elPing('unreal','C:/proj/Content/Gouache/Rock',[{name:'Rock.fbx'}],'Rock'));
 ok(r2===true&&await p.evaluate(()=>window.__pings.length===1&&JSON.parse(window.__pings[0].path).model==='Rock.fbx'),'the next send tells Unreal to set it up');
 ok(/_pending\(\)/.test(fs1['C:/proj/Content/Python/gouache_link.py']),'the Unreal link also runs setups sent while Unreal was closed');
 /* Godot */
 await setup({'C:/g/project.godot':'config_version=5\n\n[application]\n\nconfig/name="X"\n\n[editor_plugins]\n\nenabled=PackedStringArray("res://addons/other/plugin.cfg")\n'});
 await p.evaluate(()=>{__gs.es.to='godot';__gs.es.dirs.godot='C:/g';});
 await p.evaluate(()=>__gs.elPing('godot','C:/g/gouache/Rock',[{name:'Rock.fbx'}],'Rock'));
 const g=await p.evaluate(()=>window.__fs['C:/g/project.godot']);
 ok(/enabled=PackedStringArray\("res:\/\/addons\/other\/plugin\.cfg", "res:\/\/addons\/gouache_link\/plugin\.cfg"\)/.test(g),'Godot: the link plug-in is switched on next to the others '+JSON.stringify(g.slice(-120)));
 await setup({'C:/h/project.godot':'config_version=5\n'});await p.evaluate(()=>{__gs.es.dirs.godot='C:/h';});
 await p.evaluate(()=>__gs.elEnable('godot'));
 ok(/\[editor_plugins\]\n\nenabled=PackedStringArray\("res:\/\/addons\/gouache_link\/plugin\.cfg"\)/.test(await p.evaluate(()=>window.__fs['C:/h/project.godot'])),'…and gets its own section when the project has none');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
