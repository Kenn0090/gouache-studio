/* 0.94.3: the files sent to Unity, Godot and Unreal had errors in the real engines (Kenn tried all three).
   Checked here against what broke: a comment split over two lines in the Unity shader, a lost backslash in GouacheAssign.cs,
   Godot .tres values written as vec2/vec3, the Godot link's _build() clashing with EditorPlugin._build(),
   and the Unreal script's wires (a Vector Parameter's colour output has no name, so "RGB" never connected).
   The full checks (real Godot 4.3/4.5, DXC with Unity's shader library, Unreal API stand-in) were run by hand. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const r=await p.evaluate(()=>{const g=__gs,dec=x=>new TextDecoder().decode(x.data),kinds=['std','panner','retro','toon','halfcel','ink','fur','hologram'],info={};
   for(const k of kinds)info['S_'+k]={sh:{kind:k,p:{}},tex:{BaseColor:{name:'R_BaseColor.png'},ORM:{name:'R_ORM.png'}},alpha:false};
   g.es.to='godot';const gd=g.eshFiles('godot','Rock',info,1024).map(x=>[x.name,dec(x)]);
   g.es.to='unity';g.texCfg.unityRP='urp';const un=g.eshFiles('unity','Rock',info,1024).map(x=>[x.name,dec(x)]);
   g.texCfg.unityRP='builtin';const bi=g.eshFiles('unity','Rock',info,1024).map(x=>[x.name,dec(x)]);g.texCfg.unityRP='urp';
   return {gd,un,bi,ver:g.ESH_MASTER_VER};});
 const tres=r.gd.filter(([n])=>n.endsWith('.tres'));
 ok(tres.length>5&&tres.every(([,t])=>!/=\s*vec[234]\(/.test(t)),'Godot .tres files use Vector2/Vector3/Color values, not vec2/vec3');
 ok(tres.some(([n,t])=>/S_panner/.test(n)&&/scroll_speed = Vector2\(/.test(t)),'…the Panner speed is a Vector2');
 const strip=s=>s.replace(/(HLSLINCLUDE|HLSLPROGRAM|CGPROGRAM|CGINCLUDE)[\s\S]*?(ENDHLSL|ENDCG)/g,'').replace(/\/\/[^\n]*/g,'');
 for(const [lab,files] of [['URP',r.un],['Built-in',r.bi]]){const sh=files.find(([n])=>n.endsWith('.shader'));const bad=strip(sh[1]).split('\n').filter(l=>l.trim()&&!/^\s*([A-Za-z_\[\]{}"])/.test(l));
   ok(!bad.length,'Unity '+lab+' shader: every line outside the code blocks is ShaderLab '+JSON.stringify(bad.slice(0,2)));
   ok(new RegExp('gouache-master '+r.ver).test(sh[1])&&r.ver>=3,'…stamped with master version '+r.ver);}
 const cs=r.un.find(([n])=>n.endsWith('GouacheAssign.cs'))[1];
 ok(cs.includes("Replace('\\\\', '/')"),'GouacheAssign.cs: the backslash survives (a C# error there stops every script in the project)');
 const link=await p.evaluate(()=>__gs.EL_GODOT).catch(()=>null);
 if(link!==null)ok(!/func _build\(/.test(link)&&/func _build_ready\(/.test(link),'Godot link: no _build() clash with EditorPlugin');
 const stale=await p.evaluate(async()=>{const P=__gs.platform,keep=P.readFile;const T={'a.shader':'// gouache-master 2\nShader','b.shader':'// gouache-master 3\nShader','c.cs':"x.Replace('\\', '/')",'d.cs':"x.Replace('\\\\', '/')"};
   P.readFile=async f=>new TextEncoder().encode(T[f]);const o={};for(const f in T)o[f]=await __gs.eshStale(f);P.readFile=keep;return o;}).catch(e=>String(e));
 ok(stale&&stale['a.shader']&&!stale['b.shader']&&stale['c.cs']&&!stale['d.cs'],'broken shared files from before are replaced without asking '+JSON.stringify(stale));
 const fs=require('fs'),py=fs.readFileSync(__dirname+'/../../assets/addons/gouache_unreal_setup.py','utf8');
 ok(/def out_pin/.test(py)&&!/MEL\.connect_material_expressions\(a, ao, b, bi\)/.test(py),'Unreal script: colour outputs connect by their real (empty) name');
 ok(/"UVs"/.test(py)&&/T_Gouache_/.test(py)&&/normalize\(L\.xyz\)/.test(py)&&/FAILED/.test(py),'…UV wires, matching default textures, light direction as float3, and wires that fail are reported');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
