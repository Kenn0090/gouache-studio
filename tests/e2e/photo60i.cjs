/* 0.60: Photo tab Auto upright */
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
 // verticals that lean in toward the top, like a building shot from below
 await p.evaluate(async()=>{const W=480,H=320,c=new OffscreenCanvas(W,H),x=c.getContext('2d');x.fillStyle='#ddd';x.fillRect(0,0,W,H);x.strokeStyle='#222';x.lineWidth=5;
  for(let xb=-40;xb<=520;xb+=60){x.beginPath();x.moveTo(W/2+(xb-W/2)*.78,0);x.lineTo(xb,H);x.stroke();}
  for(let y=30;y<H;y+=60){x.beginPath();x.moveTo(0,y);x.lineTo(W,y);x.stroke();}
  await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'b.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const fit=async(out)=>p.evaluate(o=>{const G=__gs;let t;if(o){G.phViewTex();t=G.ph.out;}else t=G.phP().psrc;const sm=G.phSmall(t,360),F=G.phUprightFit(sm.g,sm.w,sm.h);return F.v?{k:F.v.k,a:F.v.a}:null;},out);
 const f0=await fit(false);ok(f0&&Math.abs(f0.k)>.1,'the leaning verticals are measured ('+(f0&&f0.k.toFixed(3))+')');
 await p.evaluate(()=>__gs.phAutoUpright('vert'));await p.waitForTimeout(600);
 const f1=await fit(true),horiz=await p.evaluate(()=>__gs.phS().geo.horiz);
 ok(f1&&Math.abs(f1.k)<Math.abs(f0.k)*.35,'after Auto upright the verticals are nearly parallel ('+f0.k.toFixed(3)+' → '+(f1&&f1.k.toFixed(3))+', slider '+horiz+')');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
