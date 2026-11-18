/* 0.98.16 (Georgian: "crashed during autosaving"): saving holds less in the page's memory; texture sets not opened since the last
   save reuse that save's copy; autosave waits when the page's memory is high */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const OBJ=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 0 -1 0','v 1 -1 0','v 1 1 0','v 0 1 0','vt 0 0','vt 1 0','vt 1 1','vt 0 1',
 'usemtl Left','f 1/1 2/2 3/3','f 1/1 3/3 4/4','usemtl Right','f 5/1 6/2 7/3','f 5/1 7/3 8/4'].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const r=await p.evaluate(async obj=>{const g=__gs;g.setMode('paint');g.p3.started=false;const m=g.parseOBJ(obj,'two.obj');await g.p3NewProject(256,{modelKey:'imported',imported:m});g.p3SwitchSet(1,true);g.p3SwitchSet(0,true);
   const a=await g.encodeP3Project(),S=g.p3.sets.find((x,i)=>i!==g.p3.cur),cached=!!(S&&S._enc);
   const b2=await g.encodeP3Project(),same=S&&S._enc&&a.size===b2.size;
   const bufA=new Uint8Array(await a.arrayBuffer()),bufB=new Uint8Array(await b2.arrayBuffer());let eq=bufA.length===bufB.length;for(let i=0;eq&&i<bufA.length;i++)if(bufA[i]!==bufB[i])eq=false;
   g.p3SwitchSet(g.p3.sets.indexOf(S),true);const dropped=!S._enc;
   /* reopen the saved project: both sets come back */
   g.p3.savedAt=g.p3Sig();await g.openP3Project(await b2.arrayBuffer(),'two.gouache3d');
   return {sets:g.p3.sets.length,cached,same,eq,dropped,reopened:g.p3.sets.length};},OBJ);
 ok(r.cached,'a texture set that is not open keeps its saved copy');
 ok(r.same&&r.eq,'saving again reuses it: the file comes out the same');
 ok(r.dropped,'opening the set drops the copy (it may change now)');
 ok(r.reopened===2,'the saved project opens with both sets');
 const g2=await p.evaluate(async()=>{const g=__gs,real=performance.memory;let n=0;
   Object.defineProperty(performance,'memory',{configurable:true,get:()=>({usedJSHeapSize:3900*1048576,jsHeapSizeLimit:4192*1048576})});
   const r1=await g.autosaveNow(true),t=document.getElementById('toast').textContent;
   Object.defineProperty(performance,'memory',{configurable:true,get:()=>real});return {r1,t,high:g.sgHigh()};});
 ok(g2.r1===false&&/memory is nearly full/.test(g2.t),'autosave waits and says why when the page memory is nearly full');
 ok(!g2.high,'with normal memory autosave goes ahead');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
