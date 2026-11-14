/* 0.95.7: generator rows take your own grunge texture (Textures item) instead of the built-in noise; Polygon fill follows symmetry */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'zone',false));await W(300);
 await p.evaluate(()=>{__gs.act('addLayer');__gs.setFG([.9,.1,.1]);__gs.act('fill');});await W(300);
 await p.evaluate(()=>__gs.msAdd(__gs.doc.active,'gen',{p:{g:'useWear',amount:.8,width:.5,breakup:.3,contrast:1.5,scale:6,seed:1,contactAmount:.9,inv:false}}));await W(500);
 const item=await p.evaluate(async()=>{await __gs.txLoad();const it=__gs.fxdAllTex().find(x=>x.kind==='photo')||__gs.fxdAllTex()[0];return it&&{kind:it.kind,id:it.id,name:it.name};});
 ok(!!item,'a Textures item to use');
 await p.evaluate(g=>{const A=__gs.doc.active,r=A.mask.stack.find(x=>x.kind==='gen');__gs.msEdit(A,r,x=>{x.p.cgimg=g;x.p.sgimg=g;x.p.gimg=g;x.p.gtri=true;x.p.ctri=true;x.p.stri=true;x.p.egimg=g;x.p.vgimg=g;x.p.fgimg=g;x.p.etri=true;x.p.metalScanAmount=.8;});},item);
 for(let i=0;i<40&&!(await p.evaluate(()=>{const r=__gs.doc.active.mask.stack.find(x=>x.kind==='gen');return !!__gs.msGrungeTex(r.p,'egimg')&&!!__gs.msGrungeTex(r.p,'cgimg')&&!!__gs.msGrungeTex(r.p,'sgimg');}));i++)await W(250);
 await p.evaluate(()=>{const A=__gs.doc.active;__gs.ui.msSel={L:A,where:'m',id:A.mask.stack.find(x=>x.kind==='gen').id};__gs.ui.editMask=true;__gs.showPanel('matEd');__gs.renderMatEd&&__gs.renderMatEd(true);});await W(500);
 ok(await p.evaluate(()=>!!document.getElementById('msCGrungePick')&&!!document.getElementById('msSGrungePick')&&!!document.getElementById('msCGrunge_t')&&!!document.getElementById('msCGrunge_tri')&&!!document.getElementById('ms_gtri')&&!!document.getElementById('msEGrunge_tri')&&!!document.getElementById('msVGrunge_a')&&!!document.getElementById('msFGrunge')),'Properties: Contact wear and Scan influence grunge pickers');
 ok(await p.evaluate(()=>{__gs.compositeMap('base');const A=__gs.doc.active,t=A.mask.target;return !!t&&__gs.gl.getError()===0;}),'the generator runs with both grunges and no GL error');
 /* Mask builder takes the zone grunges too */
 await p.evaluate(()=>{const A=__gs.doc.active,r=A.mask.stack.find(x=>x.kind==='gen');__gs.msEdit(A,r,x=>{x.p.g='builder';x.p.edgeWeight=1;x.p.positionWeight=0;});__gs.renderMatEd(true);});await W(600);
 ok(await p.evaluate(()=>!!document.getElementById('msEGrunge')&&!!document.getElementById('msVGrunge_a')&&!!document.getElementById('msFGrunge_tri')),'Mask builder: Edges, Cavities and Flat grunge by zone');
 ok(await p.evaluate(()=>{__gs.compositeMap('base');return __gs.gl.getError()===0;}),'the Mask builder runs with zone grunges and no GL error');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
