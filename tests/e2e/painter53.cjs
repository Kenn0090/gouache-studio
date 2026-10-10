/* 0.53: Substance Painter style controls on the 3D view: Ctrl+right-drag size/hardness, Ctrl+left-drag flow/rotation, F1–F6, N, stencil Shift snap. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'x',false));await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{__gs.setTool('brush');__gs.v3.paintOn=true;Object.assign(__gs.brush,{size:40,hardness:.5,flow:.4,angle:0,opacity:1});});await W(300);
 const bb=await p.locator('#v3Hit').boundingBox();const cx=bb.x+bb.width/2,cy=bb.y+bb.height/2;
 const undo0=await p.evaluate(()=>__gs.hist.undo.length);
 // Ctrl + right-drag: size and hardness
 await p.mouse.move(cx,cy);await p.keyboard.down('Control');await p.mouse.down({button:'right'});await p.mouse.move(cx+60,cy-20,{steps:4});await p.mouse.move(cx+120,cy-40,{steps:4});await W(200);
 const during=await p.evaluate(()=>{const c=document.querySelector('.pcadj');return {shown:!!c&&!c.hidden,label:c?c.querySelector('.pclbl').textContent:'',size:__gs.brush.size,hard:__gs.brush.hardness};});
 await p.mouse.up({button:'right'});await p.keyboard.up('Control');await W(300);
 const after=await p.evaluate(()=>({hidden:document.querySelector('.pcadj').hidden,size:__gs.brush.size,hard:__gs.brush.hardness}));
 ok(during.shown&&/Size \d+ px · Hardness/.test(during.label),'a ring and label show while adjusting: '+during.label);
 ok(after.size>=40*1.9&&after.size<=40*2.3&&after.hard>.5+.15&&after.hard<.5+.25,'right moves size up (×~2.1) and up moves hardness up '+JSON.stringify(after));
 ok(after.hidden,'the ring goes away on release');
 // Ctrl + left-drag: flow and rotation
 await p.mouse.move(cx,cy);await p.keyboard.down('Control');await p.mouse.down();await p.mouse.move(cx+40,cy+20,{steps:4});await p.mouse.move(cx+80,cy+40,{steps:4});await W(200);
 const d2=await p.evaluate(()=>document.querySelector('.pcadj .pclbl').textContent);
 await p.mouse.up();await p.keyboard.up('Control');await W(300);
 const fr=await p.evaluate(()=>({flow:__gs.brush.flow,angle:__gs.brush.angle}));
 ok(/Flow \d+% · Rotation/.test(d2)&&fr.flow>.6&&fr.flow<.75&&fr.angle!==0,'Ctrl + left-drag changes flow and rotation '+JSON.stringify(fr)+' '+d2);
 ok(await p.evaluate(()=>__gs.hist.undo.length)===undo0,'and nothing was painted by either drag');
 // F keys
 const key=async k=>{await p.mouse.move(cx,cy);await p.keyboard.press(k);await W(300);};
 await key('F2');ok(await p.evaluate(()=>__gs.p3.layout)==='3d','F2: 3D only');
 await key('F3');ok(await p.evaluate(()=>__gs.p3.layout)==='2d','F3: 2D only');
 await key('F1');ok(await p.evaluate(()=>__gs.p3.layout)==='split','F1: 3D and 2D');
 const l0=await p.evaluate(()=>document.getElementById('work').classList.contains('p3left'));await key('F4');const l1=await p.evaluate(()=>document.getElementById('work').classList.contains('p3left'));
 ok(l0!==l1,'F4 swaps the two sides '+l0+' → '+l1);await key('F4');
 await key('F6');ok(await p.evaluate(()=>!!__gs.v3s().ortho),'F6: orthographic');await key('F5');ok(await p.evaluate(()=>!__gs.v3s().ortho),'F5: perspective');
 // the same drags on the flat texture (the canvas side of Split)
 await p.evaluate(()=>{Object.assign(__gs.brush,{size:40,hardness:.5});__gs.prefs.painterControls=true;});
 const gb=await p.locator('#gl').boundingBox(),fx=gb.x+gb.width*.82,fy=gb.y+gb.height*.5;const u2=await p.evaluate(()=>__gs.hist.undo.length);
 await p.mouse.move(fx,fy);await p.keyboard.down('Control');await p.mouse.down({button:'right'});await p.mouse.move(fx+60,fy-20,{steps:4});await p.mouse.move(fx+120,fy-40,{steps:4});await W(200);
 const fl=await p.evaluate(()=>{const c=document.querySelector('.pcadj');return {shown:!!c&&!c.hidden,parent:c&&c.parentNode.id,size:__gs.brush.size,hard:__gs.brush.hardness};});
 await p.mouse.up({button:'right'});await p.keyboard.up('Control');await W(300);
 ok(fl.shown&&fl.parent==='stage'&&fl.size>70&&fl.hard>.6,'Ctrl + right-drag on the flat texture too '+JSON.stringify(fl));
 ok(await p.evaluate(()=>__gs.hist.undo.length)===u2,'without painting');
 // the switch in Preferences turns the drags off
 await p.evaluate(()=>{__gs.prefs.painterControls=false;});
 const s0=await p.evaluate(()=>__gs.brush.size);await p.mouse.move(cx,cy);await p.keyboard.down('Control');await p.mouse.down({button:'right'});await p.mouse.move(cx+100,cy,{steps:4});await p.mouse.up({button:'right'});await p.keyboard.up('Control');await W(200);
 ok(await p.evaluate(()=>__gs.brush.size)===s0,'with the preference off Ctrl + right-drag leaves the brush alone');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
