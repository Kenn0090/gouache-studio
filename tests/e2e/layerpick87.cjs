/* 0.87: Ctrl+click on the canvas selects the layer that owns the pixel; Ctrl+Alt+click duplicates it (with a selection, only the selected part);
   Ctrl+Alt+Shift+E stamps everything visible into a new layer and keeps the others. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(300,300,8,[1,1,1],'Pick',false,'hand'));await p.waitForTimeout(400);
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const names=()=>p.evaluate(()=>__gs.doc.root.children.map(c=>c.name));
 const active=()=>p.evaluate(()=>__gs.doc.active&&__gs.doc.active.name);
 const paint=async(col,cx,cy)=>{await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
   await p.evaluate(c=>{const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name==='Pixel pencil')||__gs.library.flatMap(x=>x.presets)[0];__gs.applyPreset(q);Object.assign(__gs.brush,{size:70,hardness:1,opacity:1,flow:1,smoothing:0,smoothCurve:false,pSize:false});__gs.ui.fg=c;},col);
   const a=at(cx-25,cy),z=at(cx+25,cy);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:12});await p.mouse.up();await p.waitForTimeout(150);return active();};
 const red=await paint([1,0,0],80,150),blue=await paint([0,0,1],220,150);
 console.log('layers',await names());
 // select the Background, then Ctrl+click the red square: the red layer becomes active
 await p.evaluate(()=>{__gs.doc.active=__gs.doc.root.children[0];});
 await p.keyboard.down('Control');let a=at(80,150);await p.mouse.click(a[0],a[1]);await p.keyboard.up('Control');await p.waitForTimeout(200);
 ok(await active()===red,'Ctrl+click on the red square selects the red layer ('+await active()+')');
 await p.keyboard.down('Control');a=at(220,150);await p.mouse.click(a[0],a[1]);await p.keyboard.up('Control');await p.waitForTimeout(200);
 ok(await active()===blue,'Ctrl+click on the blue square selects the blue layer');
 // Ctrl+Alt+click duplicates the layer under the pointer
 const n0=(await names()).length;
 await p.keyboard.down('Control');await p.keyboard.down('Alt');a=at(80,150);await p.mouse.click(a[0],a[1]);await p.keyboard.up('Alt');await p.keyboard.up('Control');await p.waitForTimeout(250);
 const n1=await names();ok(n1.length===n0+1,'Ctrl+Alt+click adds one layer ('+n1.join(', ')+')');
 ok((await active()).startsWith(red),'the copy of the red layer is selected ('+await active()+')');
 const alphaAt=(x,y)=>p.evaluate(([x,y])=>__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3],[x,y]);
 ok(await alphaAt(80,150)>200,'the copy has the red paint');
 // with a selection only the selected part is copied
 await p.keyboard.press('m');await p.waitForTimeout(100);
 const s0=at(200,110),s1=at(220,190);await p.mouse.move(s0[0],s0[1]);await p.mouse.down();await p.mouse.move(s1[0],s1[1],{steps:6});await p.mouse.up();await p.waitForTimeout(250);
 await p.keyboard.down('Control');await p.keyboard.down('Alt');a=at(215,150);await p.mouse.click(a[0],a[1]);await p.keyboard.up('Alt');await p.keyboard.up('Control');await p.waitForTimeout(300);
 const nm=await active();console.log('active after selection duplicate:',nm);
 ok(/selection/.test(nm),'a copy made with a selection is named (selection)');
 ok(await alphaAt(210,150)>200&&await alphaAt(240,150)<10,'only the selected part of the blue square was copied (inside '+await alphaAt(210,150)+', outside '+await alphaAt(240,150)+')');
 // the cursor changes while the shortcut keys are held
 const cur=()=>p.evaluate(()=>document.querySelector('#stage canvas, #gl')?.style.cursor||'');
 await p.mouse.move(...at(150,40));await p.keyboard.down('Control');await p.waitForTimeout(100);const c1=await cur();await p.keyboard.down('Alt');await p.waitForTimeout(100);const c2=await cur();await p.keyboard.up('Alt');await p.keyboard.up('Control');await p.waitForTimeout(100);
 ok(/svg/.test(c1)&&/svg/.test(c2)&&c1!==c2,'the cursor shows a move-cross with Ctrl, and a different one with Ctrl+Alt');
 // stamp visible
 const n2=(await names()).length;await p.keyboard.press('Control+Alt+Shift+E');await p.waitForTimeout(400);
 const n3=await names();ok(n3.length===n2+1&&n3[n3.length-1]==='Stamped visible','Ctrl+Alt+Shift+E adds a "Stamped visible" layer on top ('+n3[n3.length-1]+')');
 ok(n3.includes(red)&&n3.includes(blue),'the layers below are kept');
 ok(await alphaAt(80,150)>200&&await alphaAt(220,150)>200,'the stamped layer shows both squares');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
