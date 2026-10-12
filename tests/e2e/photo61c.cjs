/* 0.61: depth map, Lens blur and Relight in the Photo tab, with the real model */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.haveAll()){console.log('SKIP no AI model files');return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(async()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;await __gs.aiInstall('engine');await __gs.aiInstall('depth');});
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 // a receding floor of checks (near at the bottom) with a bright post in the foreground, so the depth varies
 await p.evaluate(async()=>{const W=320,H=240,c=new OffscreenCanvas(W,H),x=c.getContext('2d');const g=x.createLinearGradient(0,0,0,H*.45);g.addColorStop(0,'#bcd6f2');g.addColorStop(1,'#e8eef4');x.fillStyle=g;x.fillRect(0,0,W,H*.45);
   for(let row=0;row<14;row++){const y0=H*.45+Math.pow(row/14,1.8)*H*.55,y1=H*.45+Math.pow((row+1)/14,1.8)*H*.55,n=4+row*2;for(let i=0;i<n;i++){x.fillStyle=(i+row)%2?'#6a5238':'#b09470';x.fillRect(i*W/n,y0,W/n+1,y1-y0+1);}}
   x.fillStyle='#d8d8d8';x.fillRect(150,120,26,110);
   await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'d.png',{type:'image/png'})]);});await p.waitForTimeout(1200);
 const px=async(x,y)=>p.evaluate(([x,y])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]];},[x,y]);
 const lap=async(x0,y0,w,h)=>p.evaluate(([x0,y0,w,h])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w;let s=0;for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w-1;x++){const i=(y*W+x)*4;s+=Math.abs(d[i]-d[i+4]);}return s/(w*h);},[x0,y0,w,h]);
 ok(await p.evaluate(()=>!!document.getElementById('phs_lens')&&!!document.getElementById('phs_relight')),'Lens blur and Relight sections exist');
 ok(await p.evaluate(()=>__gs.phDepthEnsure()),'a depth map is made');
 const dm=await p.evaluate(()=>{const d=__gs.phP().depth;return {w:d.w,h:d.h};});
 const nearD=await p.evaluate(()=>__gs.phDepthAt(160,235)),farD=await p.evaluate(()=>__gs.phDepthAt(160,110)),skyD=await p.evaluate(()=>__gs.phDepthAt(20,20));
 ok(nearD>farD+8,'the floor in front is nearer than the floor far away ('+nearD.toFixed(0)+' vs '+farD.toFixed(0)+', sky '+skyD.toFixed(0)+', map '+dm.w+'×'+dm.h+')');
 // lens blur: focus on the near floor; the far floor gets soft
 const sharpFar0=await lap(200,125,100,20),sharpNear0=await lap(200,215,100,20);
 await p.evaluate(()=>{const L=__gs.phS().lens;L.on=true;L.focus=Math.round(__gs.phDepthAt(160,235));L.range=10;L.amount=100;__gs.phApply(__gs.phClone(__gs.phS()),'lens');});await p.waitForTimeout(600);
 const sharpFar1=await lap(200,125,100,20),sharpNear1=await lap(200,215,100,20);
 ok(sharpFar1<sharpFar0*.7&&sharpNear1>sharpNear0*.8,'far parts get soft while the focus stays sharp (far '+sharpFar0.toFixed(1)+' → '+sharpFar1.toFixed(1)+', near '+sharpNear0.toFixed(1)+' → '+sharpNear1.toFixed(1)+')');
 // depth view
 await p.evaluate(()=>{__gs.ph.showDepth=true;__gs.phApply(__gs.phClone(__gs.phS()),'d');});await p.waitForTimeout(400);
 const dn=await px(160,235),df=await px(160,110);ok(dn[0]>df[0]+8&&dn[0]===dn[2],'Show the depth map draws it in grey ('+dn+' vs '+df+')');
 await p.evaluate(()=>{__gs.ph.showDepth=false;const s=__gs.phS();s.lens.on=false;__gs.phApply(__gs.phClone(s),'off');});await p.waitForTimeout(400);
 // relight: a light at the left of the floor brightens the left more than the right
 const l0=await px(60,200),r0=await px(260,200);
 await p.evaluate(()=>{const R=__gs.phS().relight;R.on=true;R.x=.15;R.y=.8;R.z=.3;R.int=120;R.rad=40;R.amb=20;__gs.phApply(__gs.phClone(__gs.phS()),'relight');});await p.waitForTimeout(600);
 const l1=await px(60,200),r1=await px(260,200);
 ok((l1[0]-l0[0])>(r1[0]-r0[0])+10,'a light on the left lights the left side more ('+l0+' → '+l1+', right '+r0+' → '+r1+')');
 ok(await p.evaluate(()=>document.querySelectorAll('#xfOv .phlmh').length>=1),'the light has a handle on the picture');
 // export keeps them
 await p.evaluate(()=>{const s=__gs.phS();s.lens.on=true;__gs.phApply(__gs.phClone(s),'both');});await p.waitForTimeout(300);
 const ex=await p.evaluate(async()=>{const c=await __gs.phRenderFull(__gs.phP(),{mode:'orig'});return [c.width,c.height];});ok(ex[0]===320,'export works with both on '+ex);
 await p.evaluate(()=>__gs.phSidecarFlush());
 ok(await p.evaluate(()=>!!JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('gs.ph.')))).dp),'the depth map is saved with the photo');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await p.screenshot({path:'/tmp/photo_depth.png'});
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
