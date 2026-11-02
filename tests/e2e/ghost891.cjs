/* 0.89.1: a watercolour stroke must not make the app forget what an earlier stroke left in the shared stroke buffer. Before the fix, that leftover showed up
   on screen over the layer being painted (while the pen was down), and it did not go away when layers were deleted. */
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
 await p.evaluate(()=>__gs.newDoc(600,600,8,[1,1,1],'Ghost',false,'hand'));await p.waitForTimeout(400);
 await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const use=(n,e)=>p.evaluate(([n,e])=>{__gs.setTool('brush');const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name===n);__gs.applyPreset(q);Object.assign(__gs.brush,e||{});__gs.ui.fg=[.9,.1,.1];},[n,e]);
 const drag=async(x0,y0,x1,y1)=>{const a=at(x0,y0),z=at(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:18});await p.mouse.up();await p.waitForTimeout(250);};
 const bufInk=(x0,y0,x1,y1)=>p.evaluate(([x0,y0,x1,y1])=>{const t=__gs.strokeTex();if(!t||t.w<10)return -1;let n=0;for(let x=x0;x<=x1;x+=4)for(let y=y0;y<=y1;y+=4){const d=__gs.captureRegionNow(t,x,y,1,1).data;if(d[3]>8)n++;}return n;},[x0,y0,x1,y1]);
 // 1) a normal brush stroke at the top-left: it stays in the stroke buffer until the next stroke clears it
 await use('Paint marker',{size:60,drip:0,dripAuto:0});await drag(60,100,260,100);
 const s1=await bufInk(40,60,300,140);ok(s1>10,'a normal stroke leaves its shape in the stroke buffer ('+s1+' samples)');
 // 2) a watercolour stroke somewhere else, 3) another normal stroke, somewhere else again
 await use('Flat wash',{size:90,drip:0});await drag(60,500,500,500);
 await use('Fan brush',{size:60});await drag(300,300,500,380);
 const ghost=await bufInk(40,60,300,140);
 console.log('stroke buffer ink where the first stroke was, after a watercolour stroke and another brush:',ghost);
 ok(ghost===0,'no leftover of the first stroke remains in the stroke buffer');
 // the same with the Oil mixer and a splatter-style watercolour brush
 await use('Paint marker',{size:60,drip:0,dripAuto:0});await drag(60,100,260,100);
 await use('Watercolour splatter',{size:120});await drag(100,450,500,450);
 await use('Skinny cap',{size:30});await drag(300,200,500,240);
 ok(await bufInk(40,60,300,140)===0,'the same holds after a watercolour splatter and a spray cap');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
