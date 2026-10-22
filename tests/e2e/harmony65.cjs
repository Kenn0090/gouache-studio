/* 0.65.1: colour harmony swatches and three-colour mixing in the Colour panel */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(()=>__gs.newDoc(200,120,8,[1,1,1],'h',false));await p.waitForTimeout(300);
 await p.evaluate(()=>__gs.showPanel('color'));await p.waitForTimeout(300);
 await p.fill('#hex','#ff0000');await p.press('#hex','Enter');
 ok(await p.evaluate(()=>!!document.getElementById('harmBox')),'the Colour panel has a Harmony and mixing section');
 await p.evaluate(()=>{const d=document.getElementById('harmBox');d.open=true;d.dispatchEvent(new Event('toggle'));});await p.waitForTimeout(300);
 const sw=()=>p.evaluate(()=>[...document.querySelectorAll('#harmBody .harmrow .harmsw')].map(b=>b.style.backgroundColor));
 const hex=c=>{const m=c.match(/\d+/g).map(Number);return '#'+m.map(v=>v.toString(16).padStart(2,'0')).join('');};
 let s=(await sw()).map(hex);ok(s.length===3&&s[0]==='#ff0000'&&s[1]==='#00ff00'&&s[2]==='#0000ff','Triadic from red: red, green, blue ('+s.join(' ')+')');
 await p.selectOption('#harmScheme','comp');await p.waitForTimeout(200);s=(await sw()).map(hex);ok(s.length===2&&s[1]==='#00ffff','Complementary: red and cyan ('+s.join(' ')+')');
 await p.selectOption('#harmScheme','split');ok((await sw()).length===3,'Split complementary has three');
 await p.selectOption('#harmScheme','tetra');ok((await sw()).length===4,'Tetradic has four');
 await p.selectOption('#harmScheme','ana');s=(await sw()).map(hex);ok(s.length===3&&s[1]==='#ff0000','Analogous: the colour and its neighbours ('+s.join(' ')+')');
 await p.selectOption('#harmScheme','mono');ok((await sw()).length===5,'Monochrome has five shades of the colour');
 await p.selectOption('#harmScheme','tri');await p.waitForTimeout(150);
 await p.evaluate(()=>document.querySelectorAll('#harmBody .harmrow .harmsw')[1].click());await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.toHex(__gs.ui.fg))==='#00ff00','clicking a swatch paints with it');
 ok((await sw()).map(hex)[0]==='#00ff00','and the harmony follows the new colour');
 await p.evaluate(()=>document.querySelectorAll('#harmBody .harmrow .harmsw')[2].dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true})));await p.waitForTimeout(150);
 ok(await p.evaluate(()=>__gs.toHex(__gs.ui.bg))!=='#ffffff','Shift+click sets the background colour');
 // mix three colours
 await p.evaluate(()=>document.getElementById('m3Reset').click());await p.waitForTimeout(200);
 for(const [i,hx] of [[0,'#ff0000'],[1,'#00ff00'],[2,'#0000ff']]){await p.fill('#hex',hx);await p.press('#hex','Enter');await p.evaluate(i=>document.getElementById('m3c'+i).click(),i);await p.waitForTimeout(150);}
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();});await p.waitForTimeout(200);await p.locator('#mix3').scrollIntoViewIfNeeded();const cv=await p.locator('#mix3').boundingBox();
 const pick=async(fx,fy)=>{await p.mouse.click(cv.x+cv.width*fx,cv.y+cv.height*fy);await p.waitForTimeout(150);return p.evaluate(()=>__gs.ui.fg.map(v=>Math.round(v*255)));};
 const mid=await pick(.5,.62);ok(Math.min(...mid)>20,'the middle of the triangle mixes all three colours ('+mid.join(',')+')');
 const nearA=await pick(.5,.07);ok(nearA[0]>nearA[1]+80&&nearA[0]>nearA[2]+80,'near corner 1 it is mostly its colour ('+nearA.join(',')+')');
 const nearB=await pick(.07,.9);ok(nearB[1]>nearB[0]+80,'near corner 2 it is mostly the second colour ('+nearB.join(',')+')');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
