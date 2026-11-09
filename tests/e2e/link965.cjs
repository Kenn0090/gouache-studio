/* 0.96.4 (Kenn): two-way links. Things sent TO Gouache (model, high-poly, textures, camera) and the Roblox live-link data. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:880}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 /* fake files on disk: two OBJ boxes (the second bigger) and two textures */
 await p.evaluate(async()=>{const G=__gs,F={};const box=(s,n)=>{let t='';const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];for(const q of v)t+='v '+q.map(x=>x*s).join(' ')+'\n';t+='vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\n';
     const f=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]];for(let r=0;r<n;r++)for(const q of f)t+='f '+q.map((i,j)=>(i+1)+'/'+(j+1)).join(' ')+'\n';return new TextEncoder().encode(t);};
   F['/in/box.obj']=box(1,1);F['/in/box2.obj']=box(3,2);
   const png=async col=>{const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle=col;x.fillRect(0,0,32,32);return new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer());};
   F['/in/base.png']=await png('#c03020');F['/in/rough.png']=await png('#808080');
   G.platform.readFile=async p=>{if(!F[p])throw new Error('no file '+p);return F[p];};G.platform.invoke=async()=>0;});
 await p.evaluate(()=>__gs.linkInbox({from:'blender',kind:'model',name:'Box',file:'/in/box.obj'}));
 for(let i=0;i<60&&await p.evaluate(()=>__gs.linkIn.busy);i++)await W(250);await W(600);
 const a=await p.evaluate(()=>({mode:__gs.ui.mode,tris:__gs.p3.imported&&__gs.p3.imported.tris,src:__gs.p3.imported&&__gs.p3.imported.srcPath}));
 ok(a.mode==='p3d'&&a.tris===12&&a.src==='/in/box.obj','a model sent from Blender starts a 3D Paint project with it '+JSON.stringify(a));
 /* paint something, then the changed model arrives: the painting stays */
 await p.evaluate(()=>{const G=__gs,L=G.cmdAddLayer();G.clearTarget(G.mapT(L,'base'),[0,0,1,1]);});await W(300);
 const n0=await p.evaluate(()=>__gs.doc.root.children.length);
 await p.evaluate(()=>__gs.linkInbox({from:'blender',kind:'model',name:'Box',file:'/in/box2.obj'}));
 for(let i=0;i<60&&await p.evaluate(()=>__gs.linkIn.busy);i++)await W(250);await W(600);
 const b2=await p.evaluate(()=>({tris:__gs.p3.imported.tris,n:__gs.doc.root.children.length}));
 ok(b2.tris===24&&b2.n===n0,'a changed model replaces the old one and keeps the layers '+JSON.stringify(b2));
 await p.evaluate(()=>__gs.linkInbox({from:'unity',kind:'material',name:'Brick',textures:{base:'/in/base.png',rough:'/in/rough.png'}}));
 for(let i=0;i<60&&await p.evaluate(()=>__gs.linkIn.busy);i++)await W(250);await W(400);
 const c=await p.evaluate(()=>{const L=__gs.doc.active;return {name:L&&L.name,fill:!!(L&&L.fill),base:L&&L.fill&&L.fill.maps.base.src,rough:L&&L.fill&&L.fill.maps.rough.src,kept:__gs.matLib.list.some(r=>r.name==='Brick')};});
 ok(c.name==='Brick'&&c.fill&&c.base==='image'&&c.rough==='image'&&c.kept,'textures sent from Unity become a material layer and are kept in Materials '+JSON.stringify(c));
 await p.evaluate(()=>__gs.linkInbox({from:'blender',kind:'camera',camera:{eye:[0,-6,0],target:[0,0,0],fov:40,zup:true}}));await W(500);
 const d=await p.evaluate(()=>({...__gs.v3.cam,fov:__gs.v3s().fov,fitS:__gs.p3.imported.fitS}));
 ok(Math.abs(d.yaw)<1e-3&&Math.abs(d.pitch)<1e-3&&Math.abs(d.dist-6*d.fitS)<1e-3&&d.fov===40,'Blender’s view (looking along +Y in Z up) becomes the 3D view, scaled like the model '+JSON.stringify(d));
 await p.evaluate(()=>__gs.linkInbox({from:'unreal',kind:'high',name:'HP',file:'/in/box2.obj'}));
 for(let i=0;i<60&&await p.evaluate(()=>__gs.linkIn.busy);i++)await W(250);await W(600);
 const e=await p.evaluate(()=>({mode:__gs.ui.mode,high:__gs.bakeCfg.high&&__gs.bakeCfg.high.tris}));
 ok(e.mode==='bake'&&e.high===24,'a high-poly goes to the Bake tab '+JSON.stringify(e));
 /* Roblox: the preset and the live-link data */
 const r=await p.evaluate(async()=>{const G=__gs,pr=G.TEX_PRESETS.roblox;const c=document.createElement('canvas');c.width=c.height=8;c.getContext('2d').fillRect(0,0,8,8);
   const png=new Uint8Array(await (await new Promise(r=>c.toBlob(r,'image/png'))).arrayBuffer());
   const m=G.parseObjText?null:null;const M=G.bakeCfg.high;
   const info=await G.rbxPublish('Crate',{Crate:[{suffix:'Color',name:'Crate_Color.png',data:png}]},M);
   const mesh=G.rbxPut.mem[info.parts[0].mesh],dv=new DataView(mesh.buffer,mesh.byteOffset);const nv=dv.getUint32(0,true),nt=dv.getUint32(4,true);
   const latest=JSON.parse(new TextDecoder().decode(G.rbxPut.mem['roblox-latest']));
   return {outs:pr.outs.map(o=>o.s).join(),max:pr.max,parts:info.parts.length,nt,nv,len:mesh.length,want:8+nv*32+nt*12,img:G.rbxPut.mem[info.parts[0].maps.Color].length,latest:latest.id===info.id,scale:info.scale};});
 ok(r.outs==='Color,Normal,Roughness,Metalness'&&r.max===1024,'the Roblox preset writes the four SurfaceAppearance maps at most 1024 px');
 ok(r.parts===1&&r.nt===24&&r.len===r.want&&r.img===8*8*4&&r.latest,'Roblox live-link data: mesh and raw pictures for the Studio plug-in '+JSON.stringify(r));
 const t=await p.evaluate(()=>({un:/def send\(/.test(__gs.EL_UNREAL)&&/ToolMenus/.test(__gs.EL_UNREAL),us:/MenuItem\("Gouache\/Send/.test(__gs.EL_UNITY_SEND),bl:/GOUACHE_PT_panel/.test(__gs.BLENDER_ADDON)&&/47660/.test(__gs.BLENDER_ADDON),rb:/CreateMeshPartAsync/.test(__gs.RBX_PLUGIN)&&/SurfaceAppearance/.test(__gs.RBX_PLUGIN)}));
 ok(t.un&&t.us&&t.bl&&t.rb,'Unreal, Unity, Blender and Roblox plug-ins can send to / receive from Gouache '+JSON.stringify(t));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
