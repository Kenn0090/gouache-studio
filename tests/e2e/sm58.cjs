/* 0.58: a smart mask with a photo grunge picture applies without reading the picture back; a new fill layer in 3D Paint is a blank mid-grey base. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);
 const r=await p.evaluate(async()=>{const G=__gs,W=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('.welcome')?.remove();G.newDoc(512,512,8,[1,1,1],'S',false,'hand');await W(300);
  const rec=G.smaskBuiltins().find(r=>r.name==='Water stains'),L=G.doc.active,t0=performance.now();await G.smMaskApply(rec);const ms=performance.now()-t0;G.msUpdate(L);await W(100);
  const d=G.captureRegionNow(L.mask.target,0,0,512,512).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];
  const rows=L.mask.stack.map(r=>r.kind+(r.t?':pic':''));return {ms,s,rows};});
 ok(r.rows.includes('image:pic')&&r.s>1e6,'the smart mask has its picture and a real mask '+JSON.stringify(r));
 ok(r.ms<2500,'applying it is quick ('+Math.round(r.ms)+' ms)');
 await p.evaluate(()=>{__gs.setMode('p3d',true);});await p.waitForTimeout(2500);
 await p.click('#lFill');await p.waitForTimeout(500);
 const f=await p.evaluate(()=>{const L=__gs.doc.active;return L&&L.fill?{base:L.fill.maps.base.c,rough:L.fill.maps.rough.v,metal:L.fill.maps.metal.v,on:[L.fill.maps.base.on,L.fill.maps.rough.on]}:null;});
 ok(f&&f.base.every(v=>Math.abs(v-.5)<.01)&&Math.abs(f.rough-.2)<.01&&f.metal===0,'a new fill layer in 3D Paint is mid-grey, 20% roughness, not metal '+JSON.stringify(f));
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
