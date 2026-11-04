/* 0.58: Gasa Pen is the starting brush; the zoom tool drags; marquee and lasso have their shapes in the tool menu; no Maps panel for a base-only document. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const name=await p.evaluate(()=>document.querySelector('#optBar')?.innerText||'');
 ok(/Gasa Pen/.test(name),'the app starts with the Gasa Pen brush ('+name.slice(0,60).replace(/\n/g,' ')+')');
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'N',false,'hand'));await p.waitForTimeout(500);
 ok(/Gasa Pen/.test(await p.evaluate(()=>document.querySelector('#optBar')?.innerText||'')),'and so does a new document');
 ok(!(await p.evaluate(()=>!!document.querySelector('#dock #mapsSec'))),'a hand-painted document has no Maps panel');
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'N2',false,'pbr'));await p.waitForTimeout(600);
 ok(await p.evaluate(()=>!!document.querySelector('#dock #mapsSec')),'a PBR document has it');
 // zoom drag
 await p.evaluate(()=>__gs.setTool('zoom'));
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
 const z0=await p.evaluate(()=>__gs.view.zoom);
 await p.mouse.move(box[0],box[1]);await p.mouse.down();await p.mouse.move(box[0]+120,box[1],{steps:8});await p.mouse.up();
 const z1=await p.evaluate(()=>__gs.view.zoom);ok(z1>z0*1.5,'dragging right zooms in ('+z0.toFixed(2)+' → '+z1.toFixed(2)+')');
 await p.mouse.move(box[0],box[1]);await p.mouse.down();await p.mouse.move(box[0]-120,box[1],{steps:8});await p.mouse.up();
 const z2=await p.evaluate(()=>__gs.view.zoom);ok(z2<z1/1.5,'dragging left zooms out ('+z2.toFixed(2)+')');
 await p.mouse.click(box[0],box[1]);const z3=await p.evaluate(()=>__gs.view.zoom);ok(z3>z2*1.8,'a click still zooms in ('+z3.toFixed(2)+')');
 // marquee menu
 await p.evaluate(()=>__gs.setTool('brush'));
 await p.click('.tool[data-tool="marquee"] .tool-arrow');await p.waitForTimeout(200);
 await p.click('.tool-menu-item[data-tool-choice="marquee:ellipse"]');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.ui.marquee==='ellipse'&&__gs.ui.tool==='marquee'),'the marquee tool menu picks the ellipse');
 await p.click('.tool[data-tool="lasso"] .tool-arrow');await p.waitForTimeout(200);
 await p.click('.tool-menu-item[data-tool-choice="lasso:poly"]');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.ui.lasso==='poly'&&__gs.ui.tool==='lasso'),'the lasso tool menu picks the polygon');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
