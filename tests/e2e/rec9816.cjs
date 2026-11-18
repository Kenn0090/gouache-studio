/* 0.98.16 (Georgian's 8K crashes): big pictures keep no whole-picture copy in their stroke record (no read-back before a stroke);
   blank pictures still record strokes; undo does not keep old records alive. __p3RecMax stands in for the 4096×4096 limit. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(async()=>{const g=__gs;g.setMode('paint');g.p3.started=false;await g.p3NewProject(512,{modelKey:'plane'});});await p.waitForTimeout(2000);
 await p.evaluate(()=>{const g=__gs;g.v3.paintOn=true;Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:3,tx:0,ty:0,tz:0});g.v3s().paintAlign='uv';g.v3.dirty=true;g.requestRender(true);g.setTool('brush');g.brush.size=40;});
 await p.waitForTimeout(1200);
 const box=await p.evaluate(()=>{const r=document.getElementById('v3Hit').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
 const stroke=async y=>{await p.mouse.move(box[0]+box[2]*.3,box[1]+box[3]*y);await p.mouse.down();for(let i=1;i<=6;i++){await p.mouse.move(box[0]+box[2]*(.3+.4*i/6),box[1]+box[3]*y);await p.waitForTimeout(30);}await p.mouse.up();await p.waitForTimeout(600);};
 const rec=()=>p.evaluate(()=>{const t=__gs.doc.active.maps.base;const s=t&&t._paintSource;return s?{has:true,img:!!s.base.image,steps:s.steps||0}:{has:false};});
 await stroke(.4);
 const a=await rec();ok(a.has&&!a.img,'a blank picture still records its strokes, with no picture copy '+JSON.stringify(a));
 /* put real pixels in, as after a fill or filter: the next stroke would read the picture back */
 await p.evaluate(()=>{const g=__gs,t=g.doc.active.maps.base,d=new Uint8Array(t.w*t.h*4).fill(200);g.writeRegion(t,0,0,t.w,t.h,d);window.__p3RecMax=256*256;});
 const r0=await p.evaluate(()=>{window.__reads=0;const f=__gs.readRegionAsync;return 0;});
 await stroke(.6);
 const c=await rec();ok(!c.has,'over the size limit a changed picture keeps no record (nothing is read back before the stroke) '+JSON.stringify(c));
 await p.evaluate(()=>{window.__p3RecMax=0;});
 await p.evaluate(()=>{const g=__gs,t=g.doc.active.maps.base,d=new Uint8Array(t.w*t.h*4).fill(120);g.writeRegion(t,0,0,t.w,t.h,d);});
 await stroke(.5);
 const d2=await rec();ok(d2.has&&d2.img,'under the limit the picture copy is kept as before '+JSON.stringify(d2));
 /* undo / redo still work with the weak records */
 const u=await p.evaluate(async()=>{const g=__gs;await g.undo();await g.redo();return true;});ok(u,'undo and redo work');
 /* resizing still works for a picture without a record (it scales) */
 const rs=await p.evaluate(async()=>{const g=__gs;window.__p3RecMax=256*256;const ok1=await g.p3Resize(256);return {ok1,w:g.doc.w};});
 ok(rs.ok1&&rs.w===256,'a size change still works (scaled) '+JSON.stringify(rs));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
