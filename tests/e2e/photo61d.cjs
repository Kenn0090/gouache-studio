/* 0.61.1: Relight is smooth (no steps): a smooth bowl as depth, lit from one side */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const W=640,H=480,c=new OffscreenCanvas(W,H),x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,W,H);
   await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'b.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 // a smooth bowl, kept as an old-style 8-bit staircase as well as the new float
 await p.evaluate(()=>{const w=130,h=98,f=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x/w-.5)*2,dy=(y/h-.5)*2,r=Math.min(1,Math.hypot(dx,dy));f[y*w+x]=Math.sqrt(1-r*r);}
   const u8=new Uint8Array(w*h);for(let i=0;i<w*h;i++)u8[i]=Math.round(f[i]*255);__gs.phP().depth={w,h,data:u8,f,v:1};});
 // the slope texture: a ramp gives an even slope
 const sl=await p.evaluate(()=>{const P=__gs.phP(),w=64,h=48,f=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)f[y*w+x]=x/(w-1);const keep=P.depth;P.depth={w,h,data:new Uint8Array(w*h),f,v:7};__gs.phDepthTex(P);const t=P._dtarget,d=__gs.captureRegionNow(t,0,0,t.w,t.h).data,i=((t.h>>1)*t.w+(t.w>>1))*4,j=((t.h>>1)*t.w+(t.w>>2))*4;const hf=h=>{const e=(h>>10)&31,m=h&1023;return e===0?m/1024*Math.pow(2,-14):Math.pow(2,e-15)*(1+m/1024);},out={rx:hf(d[i]),rx2:hf(d[j]),ar:P.pw/P.ph,depthMid:hf(d[i+2]),depthQ:hf(d[j+2])};P.depth=keep;P._dv=0;return out;});
 ok(Math.abs(sl.rx-1/sl.ar)<.04&&Math.abs(sl.rx2-1/sl.ar)<.04,'a plain ramp gives an even slope ('+sl.rx.toFixed(3)+', '+sl.rx2.toFixed(3)+', expected '+(1/sl.ar).toFixed(3)+')');
 ok(Math.abs(sl.depthMid-.5)<.03&&Math.abs(sl.depthQ-.25)<.03,'and the depth is carried in blue ('+sl.depthMid.toFixed(2)+', '+sl.depthQ.toFixed(2)+')');
 await p.evaluate(()=>{const R=__gs.phS().relight;R.on=true;R.x=.2;R.y=.3;R.z=.4;R.int=100;R.rad=70;R.amb=15;R.dep=80;__gs.phApply(__gs.phClone(__gs.phS()),'relight');});await p.waitForTimeout(800);
 const row=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,H=__gs.ph.out.h,y=Math.round(H*.5),r=[];for(let x=Math.round(W*.2);x<Math.round(W*.8);x++)r.push(d[(y*W+x)*4]);return r;});
 let s2=0,big=0;for(let i=1;i<row.length-1;i++){const dd=Math.abs(row[i-1]-2*row[i]+row[i+1]);s2+=dd;if(dd>3)big++;}
 console.log('row sample',row.filter((_,i)=>i%25===0).join(','));
 ok(s2/row.length<.8&&big<=2,'the lit surface has no steps (mean second difference '+(s2/row.length).toFixed(2)+', jumps over 3 levels: '+big+')');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
