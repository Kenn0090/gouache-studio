/* 0.46: rotate / flip the view, flip or turn the canvas, flip a layer, hotkeys */
const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{__gs.closeWelcome&&__gs.closeWelcome();__gs.newDoc(200,100,8,[1,1,1],'v46',false);__gs.prefs.tipCursor=false;});await p.waitForTimeout(400);
 const scr=(x,y)=>p.evaluate(([x,y])=>{const r=document.querySelector('#stage').getBoundingClientRect(),q=__gs.toScreen(x,y);return [r.left+q[0],r.top+q[1]];},[x,y]);
 const colAt=async(x,y)=>{const [sx,sy]=await scr(x,y);await p.waitForTimeout(150);const buf=await p.screenshot({clip:{x:Math.round(sx)-2,y:Math.round(sy)-2,width:5,height:5}});
   return p.evaluate(async b64=>{const bm=await createImageBitmap(await (await fetch('data:image/png;base64,'+b64)).blob()),c=document.createElement('canvas');c.width=c.height=5;const g=c.getContext('2d');g.drawImage(bm,0,0);return [...g.getImageData(2,2,1,1).data];},buf.toString('base64'));};
 const isRed=c=>c[0]>180&&c[1]<90&&c[2]<90;
 const dab=async(x,y)=>{const [sx,sy]=await scr(x,y);await p.mouse.move(sx,sy);await p.mouse.down();await p.mouse.move(sx+1,sy);await p.mouse.up();};
 await p.evaluate(()=>{__gs.setFG([1,0,0]);__gs.brush.size=14;__gs.brush.hardness=1;__gs.brush.opacity=1;__gs.brush.flow=1;__gs.setTool('brush');});
 await dab(30,25);await dab(80,25);
 ok(isRed(await colAt(30,25)),'plain view: dab drawn at 30,25');
 // round trip and drawing through a turned + flipped view
 const rt=await p.evaluate(()=>{__gs.vxSet(33*Math.PI/180,true);const r=document.querySelector('#stage').getBoundingClientRect(),q=__gs.toScreen(120,40),i=__gs.toImage(r.left+q[0],r.top+q[1]);return i;});
 ok(Math.abs(rt[0]-120)<1e-6&&Math.abs(rt[1]-40)<1e-6,'toImage undoes toScreen under 33° turn and flip');
 ok(isRed(await colAt(30,25)),'turned + flipped view still shows the dab where the maths says');
 await dab(140,60);
 await p.evaluate(()=>__gs.vxSet(0,false));await p.waitForTimeout(200);
 ok(isRed(await colAt(140,60)),'a stroke made in the turned view lands at the right place');
 // view flip action
 await p.evaluate(()=>__gs.fit&&0);await p.keyboard.press('Alt+h');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.view.flip===true),'Alt+H flips the view');
 ok(isRed(await colAt(30,25)),'flipped view shows the dab');
 await p.keyboard.press('Alt+h');await p.keyboard.press('Alt+.');await p.keyboard.press('Alt+.');
 ok(await p.evaluate(()=>Math.abs(__gs.view.rot-30*Math.PI/180)<1e-6),'Alt+. twice turns the view 30°');
 await p.keyboard.press('Alt+0');ok(await p.evaluate(()=>__gs.view.rot===0&&!__gs.view.flip),'Alt+0 straightens the view');
 // hold R and drag
 const st=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];});
 await p.keyboard.down('r');await p.mouse.move(st[0]+100,st[1]);await p.mouse.down();await p.mouse.move(st[0],st[1]+100,{steps:5});await p.mouse.up();await p.keyboard.up('r');
 ok(await p.evaluate(()=>Math.abs(Math.abs(__gs.view.rot)-Math.PI/2)<.06),'hold R and drag turns the view a quarter turn');
 await p.keyboard.press('Alt+0');
 // flip layer: two dabs at x=30 and x=80 -> flipped about 55 => 80 and 30 swap sides; add a third dab to see asymmetry
 await dab(40,70);  // now content x range ~ 23..87 ; mirror about its centre
 const L=await p.evaluate(()=>{const g=__gs;return {w:g.doc.w,h:g.doc.h};});
 await p.keyboard.press('Control+Alt+h');await p.waitForTimeout(400);
 ok(isRed(await colAt(160,70)),'Ctrl+Alt+H flips the layer left-right (full layer: dab moved from 40 to 160)');
 ok(!isRed(await colAt(40,70)),'old place is empty');
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);
 ok(isRed(await colAt(40,70)),'undo puts the flip back');
 // canvas turn 90 clockwise: top-left dab goes to top-right
 await p.evaluate(()=>__gs.canvasXf('cw'));await p.waitForTimeout(400);
 const d=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);ok(d[0]===100&&d[1]===200,'canvas is now 100 x 200');
 ok(isRed(await colAt(100-1-25,30)),'clockwise turn: dab at (30,25) is now at (74,30)');
 await p.evaluate(()=>__gs.canvasXf('ccw'));await p.waitForTimeout(300);
 ok(isRed(await colAt(30,25)),'counter-clockwise turn brings it back');
 await p.evaluate(()=>__gs.canvasXf('fh'));await p.waitForTimeout(300);
 ok(isRed(await colAt(200-1-30,25)),'flip canvas left-right mirrors the dab');
 await p.evaluate(()=>__gs.canvasXf('fv'));await p.waitForTimeout(300);
 ok(isRed(await colAt(200-1-30,100-1-25)),'flip canvas top-bottom mirrors it again');
 // keyboard: warp hotkey
 await p.keyboard.press('Control+Alt+t');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!__gs.xf&&!!__gs.xf.warp),'Ctrl+Alt+T starts Transform warp');
 await p.keyboard.press('Escape');
 // menu entries exist
 const labels=await p.evaluate(()=>Object.values(window.MENUS||{}).length);
 console.log('errors:',errs.slice(0,3));
 ok(errs.length===0,'no page errors');
 await b.close();process.exit(fails?1:0);
})();
