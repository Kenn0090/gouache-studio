/* 0.96.7 (Kenn): blend and smooth on the model follow mirror symmetry; the brush preview sits at the top of the Brush settings in 3D Paint. */
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
 ok(await p.evaluate(()=>{const q=__gs.library.flatMap(s=>s.presets).find(x=>x.name==='Square brush');return q&&q.spacing===0&&q.pSize===true&&q.tip&&/full/i.test(q.tip.name||'');}),'the Square brush is a full square with 0 spacing and pressure size');
 ok(await p.evaluate(()=>{const pw=document.querySelector('.prevwrap'),bb=document.getElementById('brushBody');return pw.parentNode===bb.parentNode&&bb.previousElementSibling===pw;}),'in 3D Paint the brush preview sits just above the brush settings');
 /* noisy paint on the Paint layer */
 await p.evaluate(()=>{const G=__gs,P=G.doc.root.children.find(n=>n.name==='Paint');G.selectOnly(P);const t=G.mapT(P,'base'),d=new Uint8Array(t.w*t.h*4);let s=7;const R=()=>(s=(s*1103515245+12345)&0x7fffffff)/0x7fffffff;
   for(let i=0;i<d.length;i+=4){const v=R()<.5?0:255;d[i]=v;d[i+1]=255-v;d[i+2]=0;d[i+3]=255;}G.writeRegion(t,0,0,t.w,t.h,d);G.changedAll&&G.changedAll();G.uvmBuild();});await W(600);
 const tv=()=>p.evaluate(()=>{const G=__gs,P=G.doc.root.children.find(n=>n.name==='Paint'),t=G.mapT(P,'base'),d=G.captureRegionNow(t,0,0,t.w,t.h).data;let L=0,R=0;
   for(let y=1;y<t.h-1;y++)for(let x=1;x<t.w-1;x++){const q=G.uvmPos(x+.5,y+.5);if(!q||Math.abs(q[1])>.5||Math.abs(q[0])<.15)continue;const i=(y*t.w+x)*4,v=Math.abs(d[i]-d[i+4])+Math.abs(d[i]-d[i+t.w*4]);if(q[0]<0)L+=v;else R+=v;}return {L,R};});
 const before=await tv();
 const hit=await (await p.$('#v3Hit')).boundingBox(),cx=hit.x+hit.width/2,cy=hit.y+hit.height/2,R=Math.min(hit.width,hit.height)*.2;
 const pass=async ctrl=>{for(let k=0;k<3;k++){await p.mouse.move(cx+R*.7,cy-R*.5);if(ctrl)await p.keyboard.down('Control');await p.mouse.down();await p.mouse.move(cx+R*.7,cy+R*.5,{steps:10});await p.mouse.up();if(ctrl)await p.keyboard.up('Control');await W(300);}await W(600);};
 await p.evaluate(()=>{const G=__gs;G.mir3.x=false;G.v3s().paintAlign='wrap';G.setTool('smudge');G.brush.size=90;G.brush.strength=1;});await W(300);
 await pass(false);const c0=await tv();const cl=1-c0.L/before.L,cr=1-c0.R/before.R;
 ok(cr>.01&&Math.abs(cl)<cr*.15,'without the mirror only the painted side blends (left '+(cl*100).toFixed(1)+'%, right '+(cr*100).toFixed(1)+'%)');
 await p.evaluate(()=>{const G=__gs;G.mir3.x=true;G.mir3.off=[0,0,0];});await W(300);
 await pass(false);const mid=await tv();let dl=1-mid.L/c0.L,dr=1-mid.R/c0.R;
 ok(dl>.005,'with Mirror X the same strokes now blend the other side too (left '+(dl*100).toFixed(1)+'%, right '+(dr*100).toFixed(1)+'%)');
 await p.evaluate(()=>{const G=__gs;G.v3s().paintAlign='uv';G.setTool('brush');G.brush.size=90;});await W(300);
 await pass(true);const end=await tv();dl=1-end.L/mid.L;dr=1-end.R/mid.R;
 ok(dl>.0005,'Ctrl smoothing (with UV alignment) also reaches the mirrored side (left '+(dl*100).toFixed(1)+'%, right '+(dr*100).toFixed(1)+'%)');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
