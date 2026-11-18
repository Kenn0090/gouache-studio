/* 0.98.19 (Kenn's painting report: 0.4 s freezes in the first strokes after opening): the 3D Paint ready screen paints a faint test stroke
   (and a smoothing one) so the graphics driver finishes its programs, then undoes them: no paint, no history left. Ctrl drags have their own
   switches. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{window.__p3Ready=true;window.__p3rFrame=5000;try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(/warm-up/.test(m.text()))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(100);
 const t0=Date.now();let s;while(Date.now()-t0<150000){s=await p.evaluate(()=>({on:__gs.p3r.on,ran:__gs.p3r.warmRan,warm:__gs.p3r.warm}));if(!s.on)break;await p.waitForTimeout(500);}
 await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>{const g=__gs,L=g.doc.active,T=g.mapT(L,'base'),d=g.captureRegionNow(T,0,0,T.w,T.h).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i])n++;
   return {layer:L.name,painted:n,undo:g.hist.undo.length,redo:g.hist.redo.length,op:g.brush.opacity,undoNames:g.hist.undo.map(x=>x.label||x.name||'').join('|')};});
 console.log(JSON.stringify(s),JSON.stringify(r));
 ok(!s.on&&s.warm==='done','the ready screen finished with its test stroke');
 ok(s.ran>=1,'the test stroke ran on the model ('+s.ran+' passes)');
 ok(r.painted===0,'no paint is left on the layer ('+r.painted+' px)');
 ok(r.redo===0&&!/stroke|brush|paint/i.test(r.undoNames),'and no history is left ('+r.undoNames+')');
 ok(r.op===1||r.op===undefined||r.op>0.05,'the brush opacity is back ('+r.op+')');
 /* Ctrl + right-drag switch */
 const sz=await p.evaluate(()=>{__gs.prefs.ctrlRight=false;return __gs.brush.size;});const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.mouse.move(cx,cy);await p.keyboard.down('Control');await p.mouse.down({button:'right'});await p.mouse.move(cx+120,cy,{steps:4});await p.mouse.up({button:'right'});await p.keyboard.up('Control');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>__gs.brush.size)===sz,'with Ctrl + right-drag switched off the brush size stays');
 await p.evaluate(()=>{__gs.prefs.ctrlRight=undefined;});
 await p.mouse.move(cx,cy);await p.keyboard.down('Control');await p.mouse.down({button:'right'});await p.mouse.move(cx+120,cy,{steps:4});await p.mouse.up({button:'right'});await p.keyboard.up('Control');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>__gs.brush.size)!==sz,'switched on, it sets the size');
 ok(!errs.length,'no page errors '+[...new Set(errs)].slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
