/* 0.55.1: a Spec/Gloss project never gets Roughness or Metallic from materials (and a Metal/Rough one never gets Specular/Glossiness): they are converted as they arrive. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();if(/materials\/.*\.gmat/.test(u))return r.fulfill({path:require('path').resolve(__dirname,'../../assets/materials/')+'/'+decodeURIComponent(u.split('/materials/')[1])});return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3000);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'SG',false,'pbrsg'));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.p3NewProject(256,{setup:'pbr',workflow:'spec',startMaterial:'steel'});});await p.waitForTimeout(2500);
 const state=()=>p.evaluate(()=>{const G=__gs,bad=['rough','metal'];return {maps:G.doc.maps.join(),badFill:G.allLayers().filter(x=>x.fill).filter(x=>bad.some(k=>x.fill.maps[k]&&x.fill.maps[k].on)).map(x=>x.name),bad:G.doc.maps.filter(k=>bad.includes(k))};});
 // a plain material with roughness and metal values
 const v=await p.evaluate(()=>{const L=__gs.cmdNewFillLayer({name:'Chrome',maps:{base:{on:true,src:'value',c:[.8,.8,.8]},rough:{on:true,src:'value',v:.2},metal:{on:true,src:'value',v:1}}});const M=L.fill.maps;return {spec:M.spec.on,gloss:M.gloss.on,g:M.gloss.v,rough:M.rough.on,metal:M.metal.on,sc:M.spec.c};});
 ok(v.spec&&v.gloss&&!v.rough&&!v.metal,'a Metal/Rough material becomes Specular/Glossiness in a Spec/Gloss project');
 ok(Math.abs(v.g-.8)<.02&&v.sc[0]>.6,'with the matching values: glossiness '+v.g.toFixed(2)+', specular '+v.sc.map(x=>x.toFixed(2)));
 // a library material
 await p.evaluate(async()=>{const r=__gs.gmRecs.find(x=>/metal|steel|iron/i.test(x.name))||__gs.gmRecs[0];await __gs.gmApply(r);});await p.waitForTimeout(2500);
 let s=await state();ok(!s.badFill.length&&!s.bad.length,'a Library material adds no Roughness/Metallic ('+s.maps+')');
 // smart materials (value-only and Library-based)
 await p.evaluate(async()=>{const sm=__gs.smBuiltins();await __gs.smApply(sm[0]);});await p.waitForTimeout(3000);
 s=await state();ok(!s.badFill.length&&!s.bad.length,'a smart material is converted layer by layer ('+s.badFill.join(',')+')');
 await p.evaluate(async()=>{const sm=__gs.smBuiltins();await __gs.smApply(sm[sm.length-1]);});await p.waitForTimeout(4000);
 s=await state();ok(!s.badFill.length&&!s.bad.length,'and so is a Library-based one ('+s.badFill.join(',')+')');
 const pics=await p.evaluate(()=>__gs.allLayers().filter(x=>x.fill&&['spec','gloss'].some(k=>x.fill.maps[k]&&x.fill.maps[k].on&&x.fill.maps[k].src==='image')).length);
 ok(pics>=1,'Library pictures inside the smart material became Specular/Glossiness pictures ('+pics+' layers)');
 // the Material editor never lists them
 await p.click('text=Base material');await p.waitForTimeout(500);
 const t=await p.evaluate(()=>document.querySelector('#matEdSec').innerText);ok(!/Roughness|Metallic/.test(t),'the Material editor shows no Roughness or Metallic');
 // and the other way round: a Spec/Gloss material in a Metal/Rough project
 p.on('dialog',d=>d.accept());await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3000);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'MR',false,'pbr'));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.p3NewProject(256,{setup:'pbr',workflow:'metal',startMaterial:'steel'});});await p.waitForTimeout(2500);
 const w=await p.evaluate(()=>{const L=__gs.cmdNewFillLayer({name:'Plastic',maps:{base:{on:true,src:'value',c:[.5,.1,.1]},spec:{on:true,src:'value',c:[.04,.04,.04]},gloss:{on:true,src:'value',v:.7}}});const M=L.fill.maps;return {rough:M.rough.on,metal:M.metal.on,spec:M.spec.on,gloss:M.gloss.on,maps:__gs.doc.maps.join()};});
 ok(w.rough&&w.metal&&!w.spec&&!w.gloss&&!/spec|gloss/.test(w.maps),'a Spec/Gloss material in a Metal/Rough project becomes Roughness/Metallic ('+w.maps+')');
 ok(!errs.length,'no errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
