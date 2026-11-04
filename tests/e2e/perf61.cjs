/* 0.61.1: painting does not make the page wait for the graphics card (no getTexParameter), makes no new textures per frame, and start-up is lazy */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{const C={tp:0,tex:0,fbo:0};window.__gl=C;const G=WebGL2RenderingContext.prototype;for(const [n,k] of [['getTexParameter','tp'],['texImage2D','tex'],['createFramebuffer','fbo']]){const o=G[n];G[n]=function(){C[k]++;return o.apply(this,arguments);};}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(1500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 // start-up: the 3D Paint lists are not drawn yet, and brush tips are made when used
 ok(await p.evaluate(()=>!document.querySelector('#matBody .mattile')&&!document.querySelector('#dcBody .mattile,#dcBody .dctile')),'the 3D Paint shelf lists wait until 3D Paint is opened');
 const tips=await p.evaluate(()=>{let n=0,made=0;for(const k of Object.keys(__gs.TIPS||{})){n++;if(__gs.TIPS[k]._tex!==undefined)made++;}return {n,made};});
 ok(tips.n>5&&tips.made<tips.n,'brush tips are made when first used ('+tips.made+' of '+tips.n+')');
 // painting on a large canvas with a layer: count graphics-card waits and new textures
 await p.evaluate(()=>{__gs.newDoc(2048,2048,8,[1,1,1],'perf',false);for(let i=0;i<3;i++)__gs.act('addLayer');});await p.waitForTimeout(1200);
 await p.evaluate(()=>{__gs.view.zoom=.4;__gs.requestRender(true);});await p.waitForTimeout(500);
 const box=await p.locator('#gl').boundingBox();
 const stroke=async()=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));const a=[box.x+v.x+400*v.z,box.y+v.y+500*v.z],c=[box.x+v.x+1200*v.z,box.y+v.y+1000*v.z];await p.mouse.move(a[0],a[1]);await p.mouse.down();for(let i=0;i<50;i++){const t=i/49;await p.mouse.move(a[0]+(c[0]-a[0])*t,a[1]+(c[1]-a[1])*t+Math.sin(t*9)*30);await p.waitForTimeout(6);}await p.mouse.up();await p.waitForTimeout(400);};
 await stroke();
 await p.evaluate(()=>{const C=window.__gl;C.tp=0;C.tex=0;C.fbo=0;});await stroke();
 const c=await p.evaluate(()=>({...window.__gl}));
 ok(c.tp===0,'a stroke never asks the graphics card for a texture setting ('+c.tp+' asks)');
 ok(c.tex<12&&c.fbo<12,'and makes no new textures or frame buffers per frame ('+c.tex+' textures, '+c.fbo+' buffers)');
 // programs compile in the background but all work when used
 ok(await p.evaluate(()=>Object.values(__gs.P||{}).length>20),'the graphics programs exist');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
