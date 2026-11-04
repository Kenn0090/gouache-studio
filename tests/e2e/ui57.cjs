/* 0.57: Undo can cover layer actions (hide, opacity, blend, rename); the symmetry centre lights up on hover with a pop-out to reset it; the options bar has rays + reset;
   the unwrap Style list stays available. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>{__gs.newDoc(256,256,8,[1,1,1],'U57',false,'hand');});await p.waitForTimeout(300);
 for(let i=0;i<2;i++){await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);}
 // ---- layer undo
 const hist0=await p.evaluate(()=>__gs.hist.undo.length);
 await p.evaluate(()=>{__gs.prefs.undoSettings=true;});
 await p.waitForTimeout(700);
 await p.evaluate(()=>document.querySelectorAll('.eye')[0].click());await p.waitForTimeout(1200);
 const off1=await p.evaluate(()=>document.querySelectorAll('.eye')[0].classList.contains('off'));
 const h1=await p.evaluate(()=>__gs.hist.undo.length);
 ok(off1&&h1===hist0+1,'hiding a layer makes an Undo step ('+hist0+' -> '+h1+')');
 await p.keyboard.press('Control+z');await p.waitForTimeout(500);
 ok(!(await p.evaluate(()=>document.querySelectorAll('.eye')[0].classList.contains('off'))),'Undo shows the layer again');
 await p.keyboard.press('Control+Shift+z');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>document.querySelectorAll('.eye')[0].classList.contains('off')),'Redo hides it again');
 await p.evaluate(()=>{__gs.prefs.undoSettings=false;});await p.waitForTimeout(700);
 const h2=await p.evaluate(()=>__gs.hist.undo.length);
 await p.evaluate(()=>document.querySelectorAll('.eye')[1].click());await p.waitForTimeout(1200);
 ok((await p.evaluate(()=>__gs.hist.undo.length))===h2,'with the preference off, hiding adds no Undo step');
 // ---- symmetry handle
 await p.evaluate(()=>{__gs.setTool('brush');__gs.setSym('radial');});await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.querySelector('#obRays')),'options bar has a Rays box');
 await p.evaluate(()=>{const e=document.querySelector('#obRays');e.value='12';e.dispatchEvent(new Event('change',{bubbles:true}));});
 ok((await p.evaluate(()=>__gs.ui.sym.n))===12,'typing in the Rays box sets the rays');
 await p.evaluate(()=>{__gs.ui.sym.cx=.3;__gs.ui.sym.cy=.4;__gs.drawXfOverlay();});await p.waitForTimeout(300);
 const pt=await p.evaluate(()=>{const c=document.querySelector('.sym-centre');if(!c)return null;const r=c.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
 ok(!!pt,'the symmetry centre handle is drawn');
 if(pt){await p.mouse.move(pt[0]+60,pt[1]+60);await p.mouse.move(pt[0],pt[1],{steps:5});await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!!document.querySelector('.sym-centre.hot')&&!document.querySelector('#symPop').hidden),'hovering the centre lights it and opens the pop-out');
  await p.click('#symPopReset');await p.waitForTimeout(300);
  const c=await p.evaluate(()=>[__gs.ui.sym.cx,__gs.ui.sym.cy]);ok(Math.abs(c[0]-.5)<.001&&Math.abs(c[1]-.5)<.001,'Reset centre puts it back in the middle');}
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
