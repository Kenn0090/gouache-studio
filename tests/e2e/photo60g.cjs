/* 0.60: Photo tab noise reduction */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const W=240,H=160,c=new OffscreenCanvas(W,H),x=c.getContext('2d'),im=x.createImageData(W,H);let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647;};
  for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const base=xx<W/2?60:190,i=(y*W+xx)*4,n=(rnd()-.5)*50,cn=(rnd()-.5)*30;im.data[i]=base+n+cn;im.data[i+1]=base+n;im.data[i+2]=base+n-cn;im.data[i+3]=255;}x.putImageData(im,0,0);
  await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'n.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const stat=async()=>p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,H=__gs.ph.out.h;const reg=(x0,x1)=>{let s=0,q=0,n=0,cs=0,cq=0;for(let y=10;y<H-10;y++)for(let x=x0;x<x1;x++){const i=(y*W+x)*4,v=d[i+1],c=d[i]-d[i+2];s+=v;q+=v*v;cs+=c;cq+=c*c;n++;}const m=s/n,cm=cs/n;return {m,sd:Math.sqrt(q/n-m*m),csd:Math.sqrt(cq/n-cm*cm)};};return {a:reg(10,W/2-10),b:reg(W/2+10,W-10)};});
 const s0=await stat();
 await p.evaluate(()=>{const n=__gs.phClone(__gs.phS());n.nr.lum=70;n.nr.col=70;__gs.phApply(n,'nr');});await p.waitForTimeout(600);
 const s1=await stat();
 ok(s1.a.sd<s0.a.sd*.6,'brightness noise drops ('+s0.a.sd.toFixed(1)+' → '+s1.a.sd.toFixed(1)+')');
 ok(s1.a.csd<s0.a.csd*.6,'colour noise drops ('+s0.a.csd.toFixed(1)+' → '+s1.a.csd.toFixed(1)+')');
 ok(Math.abs((s1.b.m-s1.a.m)-(s0.b.m-s0.a.m))<12,'the edge between the two halves stays ('+(s0.b.m-s0.a.m).toFixed(0)+' → '+(s1.b.m-s1.a.m).toFixed(0)+')');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
