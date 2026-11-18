/* 0.98.16: work pictures of documents set aside are released, and come back when the document does; painting still works after */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const OBJ=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 0 -1 0','v 1 -1 0','v 1 1 0','v 0 1 0','vt 0 0','vt 1 0','vt 1 1','vt 0 1',
 'usemtl Left','f 1/1 2/2 3/3','f 1/1 3/3 4/4','usemtl Right','f 5/1 6/2 7/3','f 5/1 7/3 8/4'].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const r=await p.evaluate(async obj=>{const g=__gs;g.setMode('paint');g.p3.started=false;const m=g.parseOBJ(obj,'two.obj');await g.p3NewProject(256,{modelKey:'imported',imported:m});
   g.p3SwitchSet(1,true);g.p3SwitchSet(0,true);
   const before=g.gpuMemory().bytes,freed=g.auxSweep(),after=g.gpuMemory().bytes;
   const S1=g.p3.sets[1],a=S1.state.aux,anyLeft=Object.values(a).some(x=>x&&(x.strokeT||x.beforeT));
   /* back to set 1: its work pictures come back, and painting works */
   g.p3SwitchSet(1,true);const live=Object.values(g.aux).some(x=>x&&x.strokeT&&x.strokeT.tex);
   const L=g.doc.active,t=L.maps.base||g.ensureMapTarget(L,'base');
   g.beginStroke&&0;
   /* the Paint document while in 3D Paint */
   const pd=g.tabDocs.paint,pdLeft=pd&&Object.values(pd.aux).some(x=>x&&x.strokeT&&x.strokeT.tex);
   return {freedMB:Math.round(freed/1048576*10)/10,drop:before-after,anyLeft,live,pdLeft};},OBJ);
 console.log(JSON.stringify(r));
 ok(r.freedMB>0&&r.drop>0,'the sweep frees the work pictures of documents set aside');
 ok(!r.anyLeft,'a texture set not being painted keeps no work pictures');
 ok(r.live,'coming back to the set makes them again');
 ok(!r.pdLeft,'the Paint document keeps none while 3D Paint is open');
 /* paint a stroke on the model after coming back */
 await p.evaluate(()=>{const g=__gs;g.v3.paintOn=true;Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:3,tx:0,ty:0,tz:0});g.v3s().paintAlign='uv';g.v3.dirty=true;g.requestRender(true);g.setTool('brush');g.brush.size=30;g.ui.fg=[1,0,0];const P=g.paintLayers().find(L=>!L.fill);if(P)g.doc.active=P;g.v3s().paintAlign='camera';});
 await p.waitForTimeout(1200);
 const box=await p.evaluate(()=>{const r=document.getElementById('v3Hit').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
 await p.mouse.move(box[0]+box[2]*.3,box[1]+box[3]*.5);await p.mouse.down();for(let i=1;i<=8;i++){await p.mouse.move(box[0]+box[2]*(.3+.4*i/8),box[1]+box[3]*.5);await p.waitForTimeout(30);}await p.mouse.up();await p.waitForTimeout(800);
 const red=await p.evaluate(()=>{const g=__gs,t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data;g.release(t);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<80)n++;return n;});
 ok(red>50,'painting works after the work pictures came back ('+red+' red pixels)');
 /* back to Paint: its document works and composites */
 const pt=await p.evaluate(()=>{const g=__gs;g.setMode('paint',true);const t=g.compositeMap('base');const ok1=!!(t&&t.tex);g.release(t);return {ok1,mode:g.ui.mode};});
 ok(pt.ok1&&pt.mode==='paint','back in Paint, its document still works');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
