/* 0.98.17 (Georgian: "this angle for backface culling needs to be a gradient rather than a hard edge"): Backface culling has an Edge falloff
   slider; with a wide falloff paint fades out towards the culling angle instead of stopping at a hard edge. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));const W=ms=>p.waitForTimeout(ms||200);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await W(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const G=__gs;G.v3s().model='plane';G.v3.mesh=null;G.v3.dirty=true;G.requestRender(true);Object.assign(G.v3.cam,{yaw:0,pitch:-1.0});});await W(1200);
 const sl=await p.evaluate(()=>!!document.getElementById('projCullSoft'));ok(sl,'Backface culling has an Edge falloff slider');
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.evaluate(()=>{const G=__gs,P=G.layerByName('Paint');if(P)G.selectOnly(P);G.setFG([.85,.1,.1]);Object.assign(G.brush,{size:30,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});const sel=document.getElementById('projAlign');sel.value='wrap';sel.dispatchEvent(new Event('change'));});await W(300);
 const alpha=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint')||__gs.doc.active,T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s/255;});
 const paint=async soft=>{await p.evaluate(s=>{const G=__gs;G.v3s().cullAngle=40;G.v3s().cullSoft=s;G.v3.dirty=true;},soft);await W(300);
   const a0=await alpha();await p.mouse.move(cx-40,cy);await p.mouse.down();await p.mouse.move(cx+40,cy,{steps:8});await p.mouse.up();await W(500);const a1=await alpha();
   await p.evaluate(()=>__gs.undo());await W(300);return a1-a0;};
 const hard=await paint(0),soft=await paint(1);console.log('paint put down: hard',hard.toFixed(0),'soft',soft.toFixed(0));
 ok(hard>100,'with no falloff the plane just inside the angle is painted fully');
 ok(soft<hard*.6,'with a wide falloff paint near the angle fades ('+(soft/hard*100).toFixed(0)+'%)');
 await p.evaluate(()=>{const G=__gs;G.v3s().cullAngle=90;G.v3s().cullSoft=.45;});
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
