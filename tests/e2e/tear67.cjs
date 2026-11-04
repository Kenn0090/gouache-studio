/* 0.67: tear-off menus: tear off, use, fuse into one column, pull out again, fold, close, remembered */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(()=>__gs.newDoc(200,120,8,[1,1,1],'t',false));await p.waitForTimeout(300);
 const cols=()=>p.evaluate(()=>[...document.querySelectorAll('#tearHost .tearcol')].map(c=>[...c.querySelectorAll('.tearsec')].map(s=>s.dataset.m).join('+')));
 const menuBtn=name=>p.locator('#menus button',{hasText:new RegExp('^'+name+'$')});
 await menuBtn('Select').click();await p.waitForTimeout(250);
 ok(await p.evaluate(()=>!!document.querySelector('#menuPop .tearoff')),'a menu starts with a tear-off row');
 await p.click('#menuPop .tearoff');await p.waitForTimeout(300);
 ok((await cols()).join()==='Select'&&await p.evaluate(()=>document.getElementById('menuPop').hidden),'tearing off Select makes a window and closes the menu');
 ok(await p.evaluate(()=>document.querySelectorAll('#tearHost .tearcol .tearbody .mi').length>8),'the window holds the menu items');
 // use an item from the torn-off window
 await p.evaluate(()=>{__gs.selectAll&&0;});
 const before=await p.evaluate(()=>__gs.sel&&__gs.sel.active);
 await p.evaluate(()=>[...document.querySelectorAll('#tearHost .mi')].find(b=>b.dataset.act==='selAll').click());await p.waitForTimeout(300);
 ok(await p.evaluate(()=>__gs.sel.active)===true,'clicking an item in the torn-off window does what the menu item does (Select › All)');
 // a second menu, in its own window
 await menuBtn('Filter').click();await p.waitForTimeout(250);await p.click('#menuPop .tearoff');await p.waitForTimeout(300);
 ok((await cols()).length===2,'tearing off Filter makes a second window ('+(await cols()).join(' | ')+')');
 // fuse: drag Filter's grip onto the Select window
 const cb=await p.locator('#tearHost .tearcol').nth(0).boundingBox();
 const g=await p.locator('#tearHost .tearsec[data-m=Filter] .tgrip').boundingBox();
 await p.mouse.move(g.x+g.width/2,g.y+g.height/2);await p.mouse.down();await p.mouse.move(cb.x+100,cb.y+60,{steps:8});await p.mouse.move(cb.x+100,cb.y+cb.height-10,{steps:4});await p.mouse.up();await p.waitForTimeout(300);
 ok((await cols()).length===1&&(await cols())[0].split('+').sort().join('+')==='Filter+Select','dragging one menu onto the other fuses them into one column ('+(await cols()).join(' | ')+')');
 // fold
 await p.click('#tearHost .tearsec[data-m=Filter] .tname');await p.waitForTimeout(250);
 ok(await p.evaluate(()=>document.querySelectorAll('#tearHost .tearsec[data-m=Filter] .tearbody').length===0),'clicking a menu name folds it');
 await p.click('#tearHost .tearsec[data-m=Filter] .tname');await p.waitForTimeout(250);
 // pull Filter out into empty space
 const g2=await p.locator('#tearHost .tearsec[data-m=Filter] .tgrip').boundingBox();
 await p.mouse.move(g2.x+g2.width/2,g2.y+g2.height/2);await p.mouse.down();await p.mouse.move(700,300,{steps:10});await p.mouse.up();await p.waitForTimeout(300);
 ok((await cols()).length===2,'dragging a menu out to empty space makes its own window again');
 // remembered
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.tear')).length===2),'the windows are remembered');
 p.on('dialog',d=>d.accept());await p.reload();await p.waitForTimeout(4500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 ok((await cols()).length===2,'and are back after restarting');
 // close
 await p.click('#tearHost .tearsec[data-m=Filter] .tx');await p.waitForTimeout(250);ok((await cols()).length===1,'× closes a menu (and its window when empty)');
 await p.evaluate(()=>__gs.act('tearClear'));await p.waitForTimeout(200);ok((await cols()).length===0,'Window › Close all torn-off menus clears them');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
