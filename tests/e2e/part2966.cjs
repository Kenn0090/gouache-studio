/* 0.96.6 (Kenn) part 2: mirror/radial with UV alignment; brushes with their own 3D Paint alignment (graffiti → Tangent | Wrap) and a 3D badge. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:880}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);await p.evaluate(()=>{__gs.useModel(__gs.primMesh('sphere',1));});await W(800);
 /* the lookup: a texture pixel → its point → mirrored in X → that point's texture pixel → back to the mirrored point */
 const L=await p.evaluate(()=>{const G=__gs;G.v3s().paintAlign='uv';G.mir3.x=true;G.mir3.off=[0,0,0];const U=G.uvmBuild();if(!U)return null;const errs=[];let n=0;
   for(let i=0;i<40;i++){const x=(.1+.8*((i*37)%40)/40)*G.doc.w,y=(.3+.4*((i*13)%40)/40)*G.doc.h;const p0=G.uvmPos(x,y);if(!p0)continue;const q=G.uvmUV([-p0[0],p0[1],p0[2]]);if(!q)continue;const p1=G.uvmPos(q[0],q[1]);if(!p1)continue;n++;errs.push(Math.hypot(p1[0]+p0[0],p1[1]-p0[1],p1[2]-p0[2]));}
   errs.sort((a,b)=>a-b);return {n,med:errs[errs.length>>1],max:errs[errs.length-1]};});
 ok(L&&L.n>20&&L.med<.03,'the mirrored spot is found on the model (median error '+(L&&L.med.toFixed(4))+' of a 2-unit model, '+(L&&L.n)+' points)');
 /* a real stroke with UV alignment and Mirror X: paint lands on both sides */
 await p.evaluate(()=>{const G=__gs;{const P=G.doc.root.children.find(n=>n.name==='Paint');if(P)G.selectOnly(P);}window.__lay=G.doc.active.name;G.setFG([1,0,0]);G.setTool('brush');G.brush.size=40;G.brush.opacity=1;G.brush.flow=1;});
 const hit=await (await p.$('#v3Hit')).boundingBox(),cx=hit.x+hit.width/2,cy=hit.y+hit.height/2,R=Math.min(hit.width,hit.height)*.18;
 await p.mouse.move(cx+R*.9,cy-R*.3);await p.mouse.down();await p.mouse.move(cx+R*.9,cy+R*.3,{steps:8});await p.mouse.up();await W(800);
 const S=await p.evaluate(()=>{const G=__gs,L=G.doc.active,t=G.mapT(L,'base'),d=G.captureRegionNow(t,0,0,t.w,t.h).data;let left=0,right=0;
   /* which side of the model each painted texel is on (from the position lookup) */
   for(let y=0;y<t.h;y++)for(let x=0;x<t.w;x++){const i=(y*t.w+x)*4;if(d[i+3]<128)continue;const q=G.uvmPos(x+.5,y+.5);if(!q)continue;if(q[0]<0)left++;else right++;}return {left,right,lay:L.name};});
 ok(S.left>5&&S.right>5&&Math.min(S.left,S.right)/Math.max(S.left,S.right)>.4,'with UV alignment and Mirror X, the stroke lands on both sides '+JSON.stringify(S));
 /* brushes with their own alignment */
 await p.evaluate(()=>__gs.mir3.x=false);
 const g=await p.evaluate(()=>{const G=__gs,gr=G.library.find(s=>s.id==='graffiti').presets[0],plain=G.library[0].presets.find(q=>!G.brushAlign3d(q));
   G.v3s().paintAlign='uv';delete G.v3s().userAlign;G.applyPreset(gr);const a1=G.v3s().paintAlign,t1=document.getElementById('toast').textContent;G.applyPreset(plain);const a2=G.v3s().paintAlign;return {a1,a2,t1,plain:plain.name};});
 ok(g.a1==='wrap'&&/Tangent \| Wrap/.test(g.t1),'picking a graffiti brush switches 3D Paint to Tangent | Wrap ('+g.t1+')');
 ok(g.a2==='uv','picking a plain brush puts your own UV setting back');
 await p.evaluate(()=>{__gs.renderLibrary();});await W(400);
 const badges=await p.evaluate(()=>document.querySelectorAll('.b3d').length);
 ok(badges>0,'brushes with their own alignment show a 3D badge in 3D Paint ('+badges+')');
 await p.click('#modeTabs [data-mode=paint]');await W(800);await p.evaluate(()=>__gs.renderLibrary());await W(300);
 ok(await p.evaluate(()=>document.querySelectorAll('.b3d').length)===0,'no 3D badges in the Paint tab');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
