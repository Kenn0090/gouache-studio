/* 0.65.1: pen pressure → Flow as its own choice, the pressure curve graph, the Skip back faces button in the 3D bar */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const c=await p.context().newCDPSession(p);const box=await p.locator('#gl').boundingBox();
 const send=(type,x,y,o={})=>c.send('Input.dispatchMouseEvent',Object.assign({type,x,y,pointerType:'pen',button:'none',buttons:0,clickCount:0},o));
 await p.evaluate(()=>__gs.newDoc(300,160,8,[1,1,1],'pf',false));await p.waitForTimeout(300);
 const pos=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 const pen=async(x0,y,x1,force)=>{const a=await pos(x0,y),d=await pos(x1,y);await send('mouseMoved',a[0],a[1]);await send('mousePressed',a[0],a[1],{button:'left',buttons:1,clickCount:1,force});for(let i=1;i<=12;i++)await send('mouseMoved',a[0]+(d[0]-a[0])*i/12,a[1],{button:'left',buttons:1,force});await send('mouseReleased',d[0],d[1],{button:'left',buttons:0,clickCount:1,force});await p.waitForTimeout(250);};
 const alphaAt=(x,y)=>p.evaluate(([x,y])=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base'));return d[(y*__gs.doc.w+x)*4+3];},[x,y]);
 const reset=()=>p.evaluate(()=>{Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,pFlow:false,buildup:false,curve:0,dual:null});__gs.ui.fg=[0,0,0];});
 await reset();await pen(40,40,200,.3);const a0=await alphaAt(120,40);ok(a0>240,'without pressure options the stroke is solid ('+a0+')');
 await reset();await p.evaluate(()=>{__gs.brush.pFlow=true;__gs.brush.spacing=.6;});await pen(40,80,200,.3);const a1=await alphaAt(120,80);await pen(40,120,200,1);const a2=await alphaAt(120,120);
 ok(a1<200&&a2>a1+40,'with Flow on, light pressure paints fainter than firm pressure ('+a1+' vs '+a2+')');
 await reset();await p.evaluate(()=>{__gs.brush.pOpacity=true;__gs.brush.curve=0;});await pen(40,20,200,.3);const a3=await alphaAt(120,20);ok(a3<200,'Opacity pressure still works ('+a3+')');
 // the settings panel
 await p.evaluate(()=>{__gs.showPanel('tool');});await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!document.getElementById('bPF')&&!!document.getElementById('bPO')&&!!document.getElementById('bCurveGraph')),'the panel has Size, Opacity and Flow pressure choices and the curve graph');
 await p.locator('#bCurveGraph').scrollIntoViewIfNeeded();const g=await p.locator('#bCurveGraph').boundingBox();
 await p.mouse.move(g.x+g.width/2,g.y+g.height*.5);await p.mouse.down();await p.mouse.move(g.x+g.width/2,g.y+g.height*.15,{steps:5});await p.mouse.up();
 const c1=await p.evaluate(()=>__gs.brush.curve);ok(c1>.3,'dragging the curve up makes the pen softer (curve '+c1+')');
 await p.mouse.move(g.x+g.width/2,g.y+g.height*.5);await p.mouse.down();await p.mouse.move(g.x+g.width/2,g.y+g.height*.9,{steps:5});await p.mouse.up();
 const c2=await p.evaluate(()=>__gs.brush.curve);ok(c2<-.3,'dragging it down makes it firmer (curve '+c2+')');
 await p.mouse.dblclick(g.x+g.width/2,g.y+g.height/2);ok(await p.evaluate(()=>__gs.brush.curve===0),'double-click makes it straight again');
 // 3D bar
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>!!document.getElementById('v3BackfacePaint')&&!document.getElementById('v3BackfacePaint').checked),'backface painting is in Settings and disabled by default');
 await p.evaluate(()=>{document.getElementById('v3Gear').click();document.getElementById('v3BackfacePaint').click();});await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.v3s().noBack===false),'Settings enables painting back faces');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
