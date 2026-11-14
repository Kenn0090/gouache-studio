/* 0.97.24: scratch types and the longer frequency range */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:950}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'scr',false));await p.waitForTimeout(300);
 await p.evaluate(()=>{__gs.act('addLayer');__gs.setFG([.9,.1,.1]);__gs.act('fill');__gs.msAdd(__gs.doc.active,'gen',{p:{g:'useWear',amount:1,width:.5,breakup:0,contrast:1.5,scale:6,seed:3,scratchAmount:.7,scratchReach:1,scratchScale:30,cavityProtection:0}});});
 await p.waitForTimeout(500);
 const setT=t=>p.evaluate(t=>{const A=__gs.doc.active,r=A.mask.stack.find(x=>x.kind==='gen');__gs.msEdit(A,r,x=>{x.p.scratchType=t;});},t);
 const read=()=>p.evaluate(()=>{const A=__gs.doc.active;__gs.compositeMap('base');const T=A.mask.target,d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let n=0,sum=0;const o=[];for(let i=0;i<d.length;i+=4){sum+=d[i];if(d[i]>80)n++;}for(let i=0;i<d.length;i+=4*61)o.push(d[i]);return {n,sum,o};});
 const out={};
 for(const t of ['fine','curved','dirty','gouge','hatch','swirl','hair']){await setT(t);await p.waitForTimeout(1200);await read();out[t]=await read();await p.waitForTimeout(300);}
 console.log(Object.entries(out).map(([k,v])=>k+':'+v.n).join(' '));
 ok(Object.values(out).every(v=>v.n>0),'every scratch type draws scratches');
 const diff=(a,c)=>a.o.reduce((s,v,i)=>s+Math.abs(v-c.o[i]),0)/a.o.length;
 for(const t of ['curved','dirty','gouge','hatch','swirl','hair'])ok(diff(out.fine,out[t])>2,t+' looks different from fine ('+diff(out.fine,out[t]).toFixed(1)+')');
 ok(out.dirty.n<out.fine.n*1.2&&out.hatch.n>out.fine.n,'dirty is broken up and cross-hatch has more strokes');
 await p.evaluate(()=>{const A=__gs.doc.active;__gs.ui.msSel={L:A,where:'m',id:A.mask.stack.find(x=>x.kind==='gen').id};__gs.ui.editMask=true;__gs.showPanel('matEd');__gs.renderMatEd(true);});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!document.getElementById('ms_scratchType')&&!!document.getElementById('ms_scratchLen')&&!!document.getElementById('ms_scratchThick')),'Properties: scratch type, length and thickness');
 ok(await p.evaluate(()=>__gs.gl.getError())===0&&errs.length===0,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
