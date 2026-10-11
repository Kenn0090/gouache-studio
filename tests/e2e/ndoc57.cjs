/* 0.57: New document in numbered sections, big preset tiles, Storyboard template; Bake/Convert have no tool column. */
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
 await p.evaluate(()=>__gs.act('new'));await p.waitForTimeout(400);
 ok(await p.evaluate(()=>document.querySelectorAll('.dlg-new .dsec').length===3),'three boxed sections');
 await p.screenshot({path:'/tmp/ndoc1.png'});
 await p.click('.dfields .chips .chip:has-text("2048")');await p.waitForTimeout(150);
 ok((await p.inputValue('#dW'))==='2048','a size button fills in the size');
 await p.click('#dlgBody .chip:text("Storyboard")');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!document.querySelector('#dSbBox').hidden),'Storyboard shows its options');
 ok((await p.inputValue('#dW'))==='11'||(await p.inputValue('#dW'))==='11.000'||+(await p.inputValue('#dW'))===11,'Storyboard picks a Letter landscape page ('+await p.inputValue('#dW')+')');
 await p.screenshot({path:'/tmp/ndoc2.png'});
 await p.selectOption('#dSbLayout','4');await p.waitForTimeout(100);
 await p.click('#dlgOk');await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>{const L=[];(function w(n){for(const c of n.children||[]){L.push([c.name,!!c.lockAll]);w(c);}})(__gs.doc.root);return {L,w:__gs.doc.w,h:__gs.doc.h};});
 ok(r.L.some(x=>x[0]==='Storyboard frames'&&x[1])&&r.L.some(x=>x[0]==='Sketch'),'document has a locked frames layer and a Sketch layer '+JSON.stringify(r));
 const ink=await p.evaluate(()=>{const F=[];(function w(n){for(const c of n.children||[]){if(c.name==='Storyboard frames')F.push(c);w(c);}})(__gs.doc.root);const d=__gs.captureRegionNow(F[0].target,0,0,F[0].target.w,F[0].target.h).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>128)n++;return n;});
 ok(ink>2000,'frames are drawn ('+ink+' opaque pixels)');
 // tools column in Bake and Convert
 for(const m of ['bake','convert','paint']){await p.evaluate(mm=>__gs.setMode(mm,true),m);await p.waitForTimeout(600);
  const vis=await p.evaluate(()=>{const t=document.querySelector('#tools');return t&&t.getBoundingClientRect().width>0;});
  ok(m==='paint'?vis:!vis,'tool column '+(m==='paint'?'is shown in Paint':'is gone in '+m));}
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
