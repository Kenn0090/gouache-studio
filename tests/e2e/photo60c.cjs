/* 0.60: Photo tab Auto tone and Auto level */
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
 // a dark, flat picture: Auto tone should brighten it
 await p.evaluate(async()=>{const c=new OffscreenCanvas(320,200),x=c.getContext('2d'),g=x.createLinearGradient(0,0,320,0);g.addColorStop(0,'#101010');g.addColorStop(1,'#484848');x.fillStyle=g;x.fillRect(0,0,320,200);
  const blob=await c.convertToBlob({type:'image/png'});await __gs.phAddFiles([new File([blob],'dark.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const mean=async()=>p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out);let s=0,c=0;for(let i=0;i<d.length;i+=4*13){s+=d[i];c++;}return s/c;});
 const m0=await mean();await p.evaluate(()=>__gs.phAutoTone());await p.waitForTimeout(400);const m1=await mean();
 const s=await p.evaluate(()=>{const q=__gs.phS();return [q.exp,q.wh,q.bl,q.sh,q.hi,q.con];});
 ok(m1>m0+25,'Auto tone brightens a dark picture ('+m0.toFixed(0)+' → '+m1.toFixed(0)+') '+s);
 // a bright picture: Auto tone darkens it
 await p.evaluate(async()=>{const c=new OffscreenCanvas(320,200),x=c.getContext('2d');x.fillStyle='#e8e8e8';x.fillRect(0,0,320,200);x.fillStyle='#b0b0b0';x.fillRect(0,0,100,200);
  const blob=await c.convertToBlob({type:'image/png'});await __gs.phAddFiles([new File([blob],'bright.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 await p.evaluate(()=>__gs.phSelect&&0);
 const m2=await mean();await p.evaluate(()=>__gs.phAutoTone());await p.waitForTimeout(300);const m3=await mean();ok(m3<m2-10,'Auto tone darkens a very bright picture ('+m2.toFixed(0)+' → '+m3.toFixed(0)+')');
 // tilted lines: Auto level makes them horizontal
 await p.evaluate(async()=>{const c=new OffscreenCanvas(480,300),x=c.getContext('2d');x.fillStyle='#ddd';x.fillRect(0,0,480,300);x.translate(240,150);x.rotate(5*Math.PI/180);x.fillStyle='#222';for(let k=-4;k<=4;k++)x.fillRect(-300,k*30-3,600,6);
  const blob=await c.convertToBlob({type:'image/png'});await __gs.phAddFiles([new File([blob],'tilt.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const t0=await p.evaluate(()=>{const G=__gs,sm=G.phSmall(G.phP().psrc,360);return G.phTiltOf(sm.g,sm.w,sm.h);});
 ok(Math.abs(t0-5)<1.2,'the tilt of the lines is found ('+(t0||0).toFixed(2)+'°)');
 await p.evaluate(()=>__gs.phAutoLevel());await p.waitForTimeout(500);
 const t1=await p.evaluate(()=>{const G=__gs;G.phViewTex();const sm=G.phSmall(G.ph.out,360);return G.phTiltOf(sm.g,sm.w,sm.h);});
 ok(t1!=null&&Math.abs(t1)<1,'after Auto level the lines are level ('+(t1||0).toFixed(2)+'°, turned '+await p.evaluate(()=>__gs.phS().geo.angle)+'°)');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
