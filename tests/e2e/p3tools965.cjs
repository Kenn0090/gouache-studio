/* 0.96.5 (Kenn): 3D Paint shows only tools that work on the model (keys too), Hand/Zoom/Eyedropper work on the model,
   colours and gradients can be picked from anywhere on the screen, polygon fill highlight is orange. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:880}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}
   window.EyeDropper=class{open(){return Promise.resolve({sRGBHex:'#ff0000'});}};});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const vis=()=>p.evaluate(()=>[...document.querySelectorAll('#tools .tool')].filter(b=>b.offsetParent).map(b=>b.dataset.tool));
 const paintTools=await vis();
 ok(['move','marquee','lasso','wand','pen'].every(t=>paintTools.includes(t)),'Paint keeps Move, Marquee, Lasso, Wand and Pen');
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{__gs.useModel(__gs.primMesh('sphere',1));});await W(600);
 const t3=await vis();const off=['move','bucket','gradient','gbucket','marquee','lasso','wand','pen','crop','cage','array','shape'];
 ok(!t3.some(t=>off.includes(t))&&['brush','pfill','picker','hand','zoom','path','text'].every(t=>t3.includes(t)),'3D Paint shows only tools that work on the model '+t3.join(' '));
 await p.evaluate(()=>__gs.setTool('brush'));await p.mouse.move(400,450);
 const keys={};for(const k of ['v','g','w','m','p']){await p.evaluate(()=>__gs.setTool('brush'));await p.keyboard.press(k);await W(150);keys[k]=await p.evaluate(()=>__gs.ui.tool);}
 ok(!Object.values(keys).some(t=>['move','bucket','gradient','gbucket','wand','marquee','pen','lasso'].includes(t)),'their keys do nothing in 3D Paint '+JSON.stringify(keys));
 ok(await p.evaluate(()=>{__gs.setTool('move');return __gs.ui.tool!=='move';}),'and they cannot be chosen there');
 /* Eyedropper on the model */
 const hit=await (await p.$('#v3Hit')).boundingBox(),cx=hit.x+hit.width/2,cy=hit.y+hit.height/2;
 await p.evaluate(()=>{__gs.setFG([0,0,1]);__gs.setTool('picker');});await W(200);
 await p.mouse.click(cx,cy);await W(400);
 const fg=await p.evaluate(()=>__gs.ui.fg.map(v=>+v.toFixed(2)));
 ok(Math.abs(fg[0]-fg[1])<.05&&Math.abs(fg[1]-fg[2])<.05&&fg[0]>.2,'the Eyedropper picks the grey base colour off the model '+fg);
 /* Hand and Zoom on the model */
 const c0=await p.evaluate(()=>({...__gs.v3.cam}));
 await p.evaluate(()=>__gs.setTool('hand'));await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx+60,cy+20,{steps:5});await p.mouse.up();await W(200);
 const c1=await p.evaluate(()=>({...__gs.v3.cam}));
 ok(Math.abs(c1.yaw-c0.yaw)<1e-6&&Math.hypot(c1.tx-c0.tx,c1.ty-c0.ty,c1.tz-c0.tz)>.01,'Hand drag moves the view without turning it');
 await p.evaluate(()=>__gs.setTool('zoom'));await p.mouse.move(cx,cy);await p.mouse.down();await p.mouse.move(cx,cy+60,{steps:5});await p.mouse.up();await W(200);
 const c2=await p.evaluate(()=>({...__gs.v3.cam}));
 ok(c2.dist>c1.dist*1.1&&Math.abs(c2.yaw-c1.yaw)<1e-6,'Zoom drag zooms '+c1.dist.toFixed(2)+' → '+c2.dist.toFixed(2));
 /* Eyedropper chosen again: picks from the screen */
 await p.evaluate(()=>{__gs.setFG([0,0,0]);__gs.setTool('picker');__gs.setTool('picker');});await W(300);
 ok(await p.evaluate(()=>__gs.toHex(__gs.ui.fg))==='#ff0000','choosing the Eyedropper again picks a colour from anywhere on the screen');
 /* a gradient dragged across the screen (screen copy faked: red on the left, blue on the right) */
 await p.evaluate(()=>{window.__screenGrab=async()=>{const w=200,h=100,d=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const k=(y*w+x)*4;if(x<100){d[k]=255;}else{d[k+2]=255;}d[k+3]=255;}return {w,h,data:d};};
   window.__got=null;__gs.screenGrabPick('line',cols=>{window.__got=__gs.sgStops(cols);});});
 await p.waitForSelector('#sgrabOv');await W(200);
 await p.mouse.move(420,440);await p.mouse.down();await p.mouse.move(980,440,{steps:6});await p.mouse.up();await W(300);
 const g=await p.evaluate(()=>window.__got);
 ok(g&&g.length>=2&&g[0].c[0]>.9&&g[0].c[2]<.1&&g[g.length-1].c[2]>.9&&g[g.length-1].c[0]<.1,'a line dragged across the screen becomes a gradient, red to blue in the drag order '+JSON.stringify(g&&g.map(s=>[+s.p.toFixed(2),s.c.map(v=>+v.toFixed(1))])));
 ok(await p.evaluate(()=>!document.getElementById('sgrabOv')),'the screen copy goes away after the drag');
 /* the Gradient tool and Gradient map have the button (Gradient tool in Paint) */
 await p.click('#modeTabs [data-mode=paint]');await W(800);await p.evaluate(()=>__gs.setTool('gradient'));await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('gPickScreen')),'the Gradient tool has Pick from screen');
 ok(await p.evaluate(()=>{__gs.setTool('move');return __gs.ui.tool==='move';}),'Move still works in Paint');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
