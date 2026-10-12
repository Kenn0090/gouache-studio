/* 0.60: Photo tab local adjustments (masks) */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));if(process.env.DBG)p.on('console',m=>console.log('C',m.text().slice(0,300)));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const c=new OffscreenCanvas(400,250),x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,400,250);x.fillStyle='#303030';x.fillRect(0,100,60,50);
  const blob=await c.convertToBlob({type:'image/png'});await __gs.phAddFiles([new File([blob],'g.png',{type:'image/png'})]);});await p.waitForTimeout(1200);
 const px=async(x,y)=>p.evaluate(([x,y])=>{const G=__gs;G.phViewTex();const d=G.readRGBA8(G.ph.out),W=G.ph.out.w;const i=(y*W+x)*4;return d[i];},[x,y]);
 const base=await px(200,20);
 // mapper round trip with a turn and a crop
 const rt=await p.evaluate(()=>{const s=__gs.phS();s.geo.angle=12;s.geo.crop=[.1,.1,.9,.8];s.geo.horiz=20;const M=__gs.phMapper();const sp=M.fwd(.3,.6),u=M.inv(sp[0],sp[1]);s.geo.angle=0;s.geo.crop=[0,0,1,1];s.geo.horiz=0;return [u[0],u[1]];});
 ok(Math.abs(rt[0]-.3)<1e-4&&Math.abs(rt[1]-.6)<1e-4,'the mask position maps back and forth '+rt);
 // linear gradient: darkens the top, fades out downward
 await p.evaluate(()=>{__gs.phNewMask('lin');const m=__gs.phSelMask();m.a=[.5,.0];m.b=[.5,.6];m.adj={exp:-2};__gs.phDirty&&0;});
 await p.evaluate(()=>{const G=__gs;G.phApply(G.phClone(G.phS()),'x');});await p.waitForTimeout(300);
 const top=await px(200,10),bot=await px(200,240);
 ok(top<base-40&&Math.abs(bot-base)<6,'a linear gradient darkens the top only ('+base+' → '+top+', bottom '+bot+')');
 // hide it
 await p.evaluate(()=>{__gs.phSelMask().on=false;__gs.phApply(__gs.phClone(__gs.phS()),'off');});await p.waitForTimeout(200);
 ok(Math.abs(await px(200,10)-base)<4,'switching the mask off restores the picture');
 // radial gradient: brightens the middle
 await p.evaluate(()=>{const G=__gs,s=G.phS();s.local=[];G.phNewMask('rad');const m=G.phSelMask();m.c=[.5,.5];m.r=[.2,.2];m.feather=30;m.adj={exp:1.5};G.phApply(G.phClone(s),'rad');});await p.waitForTimeout(300);
 const mid=await px(200,125),edge=await px(380,125);
 ok(mid>base+30&&Math.abs(edge-base)<4,'a radial gradient brightens its middle only ('+base+' → '+mid+', outside '+edge+')');
 // inverted
 await p.evaluate(()=>{const m=__gs.phSelMask();m.inv=true;__gs.phApply(__gs.phClone(__gs.phS()),'inv');});await p.waitForTimeout(300);
 const mid2=await px(200,125),edge2=await px(380,125);ok(Math.abs(mid2-base)<4&&edge2>base+30,'Invert swaps inside and outside');
 // brush: a stroke in the left part
 await p.evaluate(()=>{const G=__gs,s=G.phS();s.local=[];G.phNewMask('brush');const m=G.phSelMask();m.strokes=[{e:0,sz:.2,fe:20,fl:100,pts:[.2,.5,.3,.5]}];m.adj={exp:1.5};G.phApply(G.phClone(s),'brush');});await p.waitForTimeout(500);
 const inB=await px(100,125),outB=await px(320,125);ok(inB>base+25&&Math.abs(outB-base)<4,'a brushed area changes only where it was painted ('+inB+' / '+outB+')');
 // luminance range: only dark parts (the dark patch x 0-60 y 100-150 of 400x250 -> shown at the canvas size)
 await p.evaluate(()=>{const G=__gs,s=G.phS();s.local=[];G.phNewMask('rad');const m=G.phSelMask();m.c=[.5,.5];m.r=[5,5];m.feather=100;m.adj={exp:2};m.rng={kind:'lum',lo:0,hi:30,soft:10};G.phApply(G.phClone(s),'range');});await p.waitForTimeout(300);
 const W=await p.evaluate(()=>__gs.ph.out.w),H=await p.evaluate(()=>__gs.ph.out.h);
 const dark=await px(Math.round(W*.07),Math.round(H*.5)),light=await px(Math.round(W*.6),Math.round(H*.2));
 ok(dark>60&&Math.abs(light-base)<4,'a luminance range keeps the change to dark parts ('+dark+', light '+light+')');
 // saved with the photo, copy/paste group exists
 await p.evaluate(()=>__gs.phSidecarFlush());
 ok(await p.evaluate(()=>__gs.phP().s.local.length===1),'the mask stays in the photo’s settings');
 // overlay draws handles for a selected gradient
 await p.evaluate(()=>{const G=__gs,s=G.phS();s.local=[];G.phNewMask('lin');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelectorAll('#xfOv .phlmh').length>=2),'handles show on the picture');
 // panel lists it
 ok(await p.evaluate(()=>!!document.querySelector('.phlmrow')),'the Masks section lists it');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await p.screenshot({path:'/tmp/photo_masks.png'});
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
