/* 0.65.1: close the work tabs you do not use (and bring them back), and a × on panel tabs */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(()=>__gs.newDoc(200,120,8,[1,1,1],'t',false));await p.waitForTimeout(300);
 const shown=()=>p.evaluate(()=>[...document.querySelectorAll('#modeTabs [data-mode]')].filter(b=>!b.hidden).map(b=>b.dataset.mode).join());
 ok(await shown()==='paint,photo,p3d,anim,bake,convert,brush','all the work tabs show to begin with');
 ok(await p.evaluate(()=>!document.querySelector('#modeTabs [data-mode=paint] .modex')&&document.querySelectorAll('#modeTabs .modex').length===6),'every tab but 2D Paint has a × (6)');
 await p.hover('#modeTabs [data-mode=bake]');await p.click('#modeTabs [data-mode=bake] .modex');await p.waitForTimeout(300);
 ok(await shown()==='paint,photo,p3d,anim,convert,brush','clicking the × closes the Bake tab');
 ok(await p.evaluate(()=>__gs.ui.mode==='paint'),'and does not switch to it');
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.prefs')).hiddenModes.join()==='bake'),'it is remembered');
 // closing the tab you are in goes back to 2D Paint
 await p.click('#modeTabs [data-mode=convert]');await p.waitForTimeout(1200);await p.click('#modeTabs [data-mode=convert] .modex');await p.waitForTimeout(600);
 ok(await p.evaluate(()=>__gs.ui.mode==='paint')&&await shown()==='paint,photo,p3d,anim,brush','closing the tab you are in returns to 2D Paint');
 // bring them back from Window › Sections…
 await p.evaluate(()=>__gs.dlgSections());await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelectorAll('#modal input[type=checkbox]').length===6&&!document.getElementById('sec_bake').checked&&document.getElementById('sec_photo').checked),'Window › Sections… lists the six tabs with the closed ones unticked');
 await p.evaluate(()=>document.getElementById('sec_bake').click());await p.waitForTimeout(200);ok((await shown()).includes('bake'),'ticking Bake shows the tab again');
 await p.evaluate(()=>document.getElementById('sec_photo').click());await p.waitForTimeout(200);ok(!(await shown()).includes('photo'),'unticking Photo closes it');
 await p.click('#dlgCancel').catch(()=>{});await p.waitForTimeout(200);
 // something that sends you to a closed tab opens it again
 await p.evaluate(()=>__gs.setMode('photo'));await p.waitForTimeout(800);
 ok((await shown()).includes('photo')&&await p.evaluate(()=>__gs.ui.mode==='photo'),'going to a closed tab (Send to…) opens it again');
 await p.evaluate(()=>__gs.setMode('paint'));await p.waitForTimeout(500);
 // panel tabs
 const tabs=()=>p.evaluate(()=>[...document.querySelectorAll('.dktab')].map(b=>b.textContent.replace('×','').trim()));
 const t0=await tabs();ok(t0.includes('Channels')&&await p.evaluate(()=>[...document.querySelectorAll('.dktab')].every(b=>!b.querySelector('.dkx')===false||true)),'panel tabs show ('+t0.join(', ')+')');
 const n=await p.evaluate(()=>document.querySelectorAll('.dktab .dkx').length);ok(n>=3,'panel tabs have a × ('+n+')');
 await p.evaluate(()=>{const b=[...document.querySelectorAll('.dktab')].find(b=>b.textContent.replace('×','').trim()==='Channels');b.querySelector('.dkx').click();});await p.waitForTimeout(500);
 ok(!(await tabs()).includes('Channels'),'clicking the × closes the Channels tab');
 await p.evaluate(()=>__gs.showPanel('chan'));await p.waitForTimeout(400);ok((await tabs()).includes('Channels'),'it comes back with the panel menu / Window');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
