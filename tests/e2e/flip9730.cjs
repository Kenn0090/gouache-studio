/* 0.97.30 (Kenn: "when you're switching through the maps and channels with C or B you should see the names of the maps"):
   C / Shift+C in 3D Paint shows a label with the channel's name and its neighbours */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(3000);
 await p.mouse.move(300,400);await p.keyboard.press('c');await p.waitForTimeout(150);
 const a=await p.evaluate(()=>{const b=document.getElementById('flipLabel');const s=document.getElementById('p3ChannelView');return b&&{show:b.classList.contains('show'),name:b.querySelector('.flname').textContent,sel:s&&s.selectedOptions[0]&&s.selectedOptions[0].textContent,kind:b.querySelector('.flk').textContent,sides:b.querySelectorAll('.flside').length};});
 ok(a&&a.show,'label shows after C');ok(a&&a.kind==='Channel','says Channel');ok(a&&a.sel&&a.name===a.sel,'names the channel shown ('+(a&&a.name)+' / '+(a&&a.sel)+')');ok(a&&a.sides===2,'shows the previous and next');
 await p.keyboard.press('c');await p.waitForTimeout(150);
 const n2=await p.evaluate(()=>document.querySelector('#flipLabel .flname').textContent);ok(n2!==a.name,'next C names the next channel ('+n2+')');
 for(let i=0;i<30&&!(await p.evaluate(()=>document.getElementById('flipLabel').classList.contains('fade')));i++)await p.waitForTimeout(500);ok(await p.evaluate(()=>document.getElementById('flipLabel').classList.contains('fade')),'fades after a moment');
 ok(!errs.length,'no page errors '+errs.join('|'));await b.close();process.exit(fails?1:0);})();
