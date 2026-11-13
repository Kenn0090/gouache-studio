/* 0.97.12 (Kenn): remove smoothing groups / auto smooth groups by angle (Bake tab and 3D Paint) */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* a cube with hard edges (each face has its own corners and normals) and a few more faces on one side */
function cube(){const f=[[[0,0,1],[[0,0,1],[1,0,1],[1,1,1],[0,1,1]]],[[0,0,-1],[[1,0,0],[0,0,0],[0,1,0],[1,1,0]]],[[1,0,0],[[1,0,1],[1,0,0],[1,1,0],[1,1,1]]],[[-1,0,0],[[0,0,0],[0,0,1],[0,1,1],[0,1,0]]],[[0,1,0],[[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],[[0,-1,0],[[0,0,0],[1,0,0],[1,0,1],[0,0,1]]]];
 const v=[],vt=[],vn=[],fs=[];let k=1;for(const [n,q] of f){const b=k;for(const p of q){v.push('v '+p.join(' '));vt.push('vt '+(p[0]*.5)+' '+(p[1]*.5));vn.push('vn '+n.join(' '));k++;}
  fs.push('f '+b+'/'+b+'/'+b+' '+(b+1)+'/'+(b+1)+'/'+(b+1)+' '+(b+2)+'/'+(b+2)+'/'+(b+2),'f '+b+'/'+b+'/'+b+' '+(b+2)+'/'+(b+2)+'/'+(b+2)+' '+(b+3)+'/'+(b+3)+'/'+(b+3));}
 return [...v,...vt,...vn,...fs].join('\n');}
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:950}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
const r=await p.evaluate(txt=>{const G=__gs,m=G.parseOBJ(txt,'cube');
  const spread=n=>{/* how many different normals does one corner position have */const seen=new Map();for(let i=0;i<m.verts;i++){}return 0;};
  const dist=x=>{const s=new Set();for(let i=0;i<x.verts;i++){const k=[x.pos[i*3],x.pos[i*3+1],x.pos[i*3+2]].map(v=>v.toFixed(4)).join(',');if(k===[x.pos[0],x.pos[1],x.pos[2]].map(v=>v.toFixed(4)).join(','))s.add([x.nrm[i*3],x.nrm[i*3+1],x.nrm[i*3+2]].map(v=>v.toFixed(3)).join(','));}return s.size;};
  const all=G.meshRenormal(m,'all'),a30=G.meshRenormal(m,'angle',30),a100=G.meshRenormal(m,'angle',100),back=G.meshRenormal(all,'keep');
  const len=x=>{let ok=true;for(let i=0;i<x.verts;i++)if(Math.abs(Math.hypot(x.nrm[i*3],x.nrm[i*3+1],x.nrm[i*3+2])-1)>1e-3)ok=false;return ok;};
  return {orig:{v:m.verts,t:m.tris,n:dist(m)},all:{v:all.verts,n:dist(all),unit:len(all),tan:!!all.tan&&all.tan.length===all.verts*4},a30:{v:a30.verts,n:dist(a30),unit:len(a30)},a100:{v:a100.verts,n:dist(a100)},back:back===m,tris:[all.tris,a30.tris,a100.tris]};},cube());
console.log(JSON.stringify(r));
ok(r.orig.n===3&&r.orig.v===24,'the cube starts hard: three different normals meet at a corner');
ok(r.all.n===1&&r.all.v===24&&r.all.unit&&r.all.tan,'Smooth all: every copy of a corner shares one normal (diagonal), same points, tangents rebuilt');
ok(r.a30.n===3&&r.a30.unit,'Auto by 30°: the 90° edges stay hard (3 normals meet at a corner)');
ok(r.a100.n===1,'Auto by 100°: the cube edges smooth over');
ok(r.back,'File’s own gives the original back');
ok(r.tris.every(t=>t===12),'triangles stay the same');
/* the bake tab row */
await p.evaluate(txt=>{const G=__gs;G.setMode('bake');G.bakeSetModel('low',G.parseOBJ(txt,'cube'));},cube());await p.waitForTimeout(1500);
ok(await p.evaluate(()=>!!document.getElementById('bkSm_mode')),'the Bake tab has a Smoothing groups row');
await p.evaluate(()=>[...document.querySelectorAll('#bkSm_mode button')].find(b=>/Smooth all/.test(b.textContent)).click());await p.waitForTimeout(800);
ok(await p.evaluate(()=>__gs.bakeCfg.low.smMode==='all'),'Smooth all changes the bake low-poly');
await p.evaluate(()=>[...document.querySelectorAll('#bkSm_mode button')].find(b=>/Auto by angle/.test(b.textContent)).click());await p.waitForTimeout(800);
ok(await p.evaluate(()=>__gs.bakeCfg.low.smMode==='angle')&&await p.evaluate(()=>!!document.getElementById('bkSm_angle')),'Auto by angle shows its Angle slider');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
