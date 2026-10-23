/* 0.62.1: a pen's side button pans the view (2D and 3D), also while hovering; the Pen and tablet test window */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);
 await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(()=>__gs.newDoc(400,300,8,[1,1,1],'pen',false));await p.waitForTimeout(400);
 const c=await p.context().newCDPSession(p);
 const send=(type,x,y,o={})=>c.send('Input.dispatchMouseEvent',Object.assign({type,x,y,pointerType:'pen',button:'none',buttons:0,clickCount:0},o));
 const vx=()=>p.evaluate(()=>__gs.view.x);
 const cx=700,cy=450;
 // side button down while touching (reported as a right click): pans
 let a=await vx();await send('mouseMoved',cx,cy);await send('mousePressed',cx,cy,{button:'right',buttons:2,clickCount:1});await send('mouseMoved',cx+60,cy+20,{button:'right',buttons:2});await send('mouseReleased',cx+60,cy+20,{button:'right',buttons:0,clickCount:1});
 let d=(await vx())-a;ok(Math.abs(d-60)<3,'the pen side button (right click) pans the canvas by '+d);
 // middle click as the pen reports it
 a=await vx();await send('mousePressed',cx,cy,{button:'middle',buttons:4,clickCount:1});await send('mouseMoved',cx-40,cy,{button:'middle',buttons:4});await send('mouseReleased',cx-40,cy,{button:'middle',buttons:0,clickCount:1});
 d=(await vx())-a;ok(Math.abs(d+40)<3,'a pen middle click pans by '+d);
 // hovering with the side button held (no tip contact, no pointerdown): moves the view, and stops when released
 a=await vx();await send('mouseMoved',cx,cy,{buttons:2});await send('mouseMoved',cx+30,cy+10,{buttons:2});await send('mouseMoved',cx+70,cy+10,{buttons:2});
 d=(await vx())-a;ok(Math.abs(d-70)<4,'hovering with the side button held pans by '+d);
 await send('mouseMoved',cx+70,cy+10,{buttons:0});const afterRelease=await vx();await send('mouseMoved',cx+120,cy+10,{buttons:0});ok(await vx()===afterRelease,'and it stops when the button is released');
 ok(await p.evaluate(()=>!document.getElementById('stage')||!document.getElementById('stage').classList.contains('panning')),'the panning cursor is gone');
 // a normal pen stroke (tip only) still paints and does not pan
 a=await vx();await send('mouseMoved',cx-100,cy);await send('mousePressed',cx-100,cy,{button:'left',buttons:1,clickCount:1});await send('mouseMoved',cx-40,cy,{button:'left',buttons:1});await send('mouseReleased',cx-40,cy,{button:'left',buttons:0,clickCount:1});
 ok(await vx()===a,'the pen tip does not pan');
 // turned off in Preferences
 await p.evaluate(()=>{__gs.prefs.penPan=false;});a=await vx();await send('mousePressed',cx,cy,{button:'right',buttons:2,clickCount:1});await send('mouseMoved',cx+60,cy,{button:'right',buttons:2});await send('mouseReleased',cx+60,cy,{button:'right',buttons:0,clickCount:1});
 ok(await vx()===a,'with the preference off the side button does nothing');await p.evaluate(()=>{delete __gs.prefs.penPan;});
 // Alt held with the pen's side button (as in Substance Painter, Alt + the tablet's 2nd button): pans too
 a=await vx();await send('mouseMoved',cx,cy,{modifiers:1});await send('mousePressed',cx,cy,{button:'right',buttons:2,clickCount:1,modifiers:1});await send('mouseMoved',cx+50,cy+10,{button:'right',buttons:2,modifiers:1});await send('mouseReleased',cx+50,cy+10,{button:'right',buttons:0,clickCount:1,modifiers:1});
 d=(await vx())-a;ok(Math.abs(d-50)<3,'Alt + the pen side button pans the canvas by '+d);
 // 3D
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 const cam=()=>p.evaluate(()=>{const c=__gs.v3.cam;return [c.tx,c.ty,c.tz].map(v=>Math.round(v*1000)/1000).join();});
 const hb=await p.locator('#v3Hit').boundingBox(),mx=hb.x+hb.width/2,my=hb.y+hb.height/2;
 let c0=await cam();await send('mouseMoved',mx,my);await send('mousePressed',mx,my,{button:'right',buttons:2,clickCount:1});await send('mouseMoved',mx+80,my+30,{button:'right',buttons:2});await send('mouseReleased',mx+80,my+30,{button:'right',buttons:0,clickCount:1});
 ok(await cam()!==c0,'3D: the side button moves the view');
 c0=await cam();await send('mouseMoved',mx,my,{buttons:2});await send('mouseMoved',mx+50,my+20,{buttons:2});await send('mouseMoved',mx+90,my+20,{buttons:2});
 ok(await cam()!==c0,'3D: hovering with the side button moves the view');await send('mouseMoved',mx+90,my+20,{buttons:0});
 c0=await cam();const z0=await p.evaluate(()=>JSON.stringify(Object.assign({},__gs.v3.cam,{tx:0,ty:0,tz:0})));
 await send('mouseMoved',mx,my,{modifiers:1});await send('mousePressed',mx,my,{button:'right',buttons:2,clickCount:1,modifiers:1});await send('mouseMoved',mx+70,my+25,{button:'right',buttons:2,modifiers:1});await send('mouseReleased',mx+70,my+25,{button:'right',buttons:0,clickCount:1,modifiers:1});await p.waitForTimeout(200);
 ok(await cam()!==c0,'3D: Alt + the pen side button moves the view');
 ok(z0===await p.evaluate(()=>JSON.stringify(Object.assign({},__gs.v3.cam,{tx:0,ty:0,tz:0}))),'and does not zoom or turn it');
 // the test window
 await p.evaluate(()=>__gs.act('penTest'));await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.getElementById('penPad')),'Help › Pen and tablet test opens');
 const pb=await p.locator('#penPad').boundingBox(),px=pb.x+40,py=pb.y+40;
 await send('mouseMoved',px,py);await send('mousePressed',px,py,{button:'left',buttons:1,clickCount:1});await send('mouseReleased',px,py,{button:'left',buttons:0,clickCount:1});
 await send('mousePressed',px,py,{button:'right',buttons:2,clickCount:1});await send('mouseReleased',px,py,{button:'right',buttons:0,clickCount:1});
 await send('mousePressed',px,py,{button:'middle',buttons:4,clickCount:1});await send('mouseReleased',px,py,{button:'middle',buttons:0,clickCount:1});
 const on=await p.evaluate(()=>[...document.querySelectorAll('#penSeen .penrow.on')].map(r=>r.textContent));
 ok(on.length>=4&&on.some(t=>/pen/.test(t))&&on.some(t=>/Tip/.test(t))&&on.some(t=>/right click/.test(t))&&on.some(t=>/middle click/.test(t)),'the test window ticks what it sees: '+on.join(' | '));
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
