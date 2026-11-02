/* 0.93.3: straight line like Substance Painter: dotted preview while Shift is held, Shift+Ctrl snaps to 5 degrees; P is Path in 3D Paint */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(400,400,8,[1,1,1],'S',false,'hand');});await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=6;__gs.brush.hardness=1;__gs.brush.opacity=1;__gs.brush.flow=1;__gs.brush.pSize=false;__gs.brush.pOpacity=false;__gs.brush.smoothing=0;__gs.brush.spacing=.05;__gs.ui.fg=[0,0,0];});
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const px=(x,y)=>p.evaluate(([x,y])=>__gs.captureRegionNow(__gs.doc.root.children[__gs.doc.root.children.length-1].target,Math.round(x),Math.round(y),1,1).data[3],[x,y]);
 const near=async(x,y)=>{let m=0;for(const dx of [-2,0,2])for(const dy of [-2,0,2])m=Math.max(m,await px(x+dx,y+dy));return m;};
 let a=at(50,50),z=at(150,50);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:8});await p.mouse.up();await p.waitForTimeout(150);
 // preview
 await p.keyboard.down('Shift');let t=at(250,150);await p.mouse.move(t[0],t[1],{steps:3});await p.waitForTimeout(100);
 const lit=await p.evaluate(()=>{const c=document.getElementById('slPrev'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return n;});
 ok(lit>200,'holding Shift shows a dotted line from the last stroke to the pointer ('+lit+' px)');
 await p.mouse.down();await p.mouse.up();await p.waitForTimeout(200);await p.keyboard.up('Shift');
 ok(await near(200,100)>60,'Shift+click draws the straight line from the last end to the click');
 // snapped
 a=at(50,250);z=at(150,250);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:8});await p.mouse.up();await p.waitForTimeout(150);
 await p.keyboard.down('Control');await p.keyboard.down('Shift');t=at(300,330);await p.mouse.move(t[0],t[1],{steps:3});await p.mouse.down();await p.mouse.up();await p.waitForTimeout(250);await p.keyboard.up('Shift');await p.keyboard.up('Control');
 const len=Math.hypot(150,80),ang=Math.round(Math.atan2(80,150)/(Math.PI/36))*(Math.PI/36),ex=150+Math.cos(ang)*len,ey=250+Math.sin(ang)*len;
 ok(await near(ex,ey)>100&&await px(300,330)<60,'Shift+Ctrl snaps the angle to 5 degrees (ends at '+ex.toFixed(0)+','+ey.toFixed(0)+')');
 // keys
 const k=await p.evaluate(()=>({paint:[__gs.kbKeyOf('tool:pen'),__gs.kbKeyOf('tool:path')]}));ok(k.paint[0]==='P','in Paint, P is the Pen');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
