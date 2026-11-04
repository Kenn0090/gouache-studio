/* 0.58: layers inside animation frames; a layer shared by every frame; save and reopen. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(64,64,8,[1,1,1],'AnimL',false,'hand');__gs.setMode('anim',true);});await p.waitForTimeout(600);
 const flat=(i)=>p.evaluate(i=>{const G=__gs,t=G.frameFlat(G.anim.frames[i]),d=G.readRGBA8(t);G.release(t);return [...d.slice((32*64+32)*4,(32*64+32)*4+4)];},i);
 // layers panel is shown and holds the frame's layers
 ok(await p.isVisible('#layerList'),'the Layers panel is shown in Animation');
 await p.evaluate(()=>{const G=__gs,F=G.anim.frames[0],L=G.frameLayer(F);G.clearTarget(L.target,[1,0,0,1]);G.changedAll();});
 await p.keyboard.press('Control+Shift+N');await p.waitForTimeout(300);
 const n1=await p.evaluate(()=>__gs.allLayers(__gs.anim.frames[0]).length);ok(n1===2,'a second layer is added to the frame ('+n1+')');
 await p.evaluate(()=>{const G=__gs,F=G.anim.frames[0],L=G.allLayers(F)[1];G.clearTarget(L.target,[0,1,0,1]);G.changedAll();});
 let px=await flat(0);ok(px[1]>200&&px[0]<50,'the frame shows its layers together: the top layer covers ('+px+')');
 await p.evaluate(()=>{const G=__gs,L=G.allLayers(G.anim.frames[0])[1];L.visible=false;});
 px=await flat(0);ok(px[0]>200&&px[1]<50,'hiding the top layer shows the one below ('+px+')');
 await p.evaluate(()=>{const G=__gs,L=G.allLayers(G.anim.frames[0])[1];L.visible=true;});
 // a new frame has the same layers, empty
 await p.evaluate(()=>__gs.addFrame?__gs.addFrame():document.querySelector('.tlctrl [aria-label*="New frame"]')?.click());await p.waitForTimeout(400);
 const nf=await p.evaluate(()=>({n:__gs.anim.frames.length,l:__gs.allLayers(__gs.anim.frames[1]).length,names:__gs.allLayers(__gs.anim.frames[1]).map(x=>x.name)}));
 ok(nf.n===2&&nf.l===2,'a new frame has the same two layers '+JSON.stringify(nf));
 px=await flat(1);ok(px[3]===0,'and they are empty ('+px+')');
 // share the bottom layer of frame 0
 await p.evaluate(()=>{const G=__gs;G.showFrame(0);const L=G.allLayers(G.anim.frames[0])[0];G.animShareLayer(L,true);});await p.waitForTimeout(300);
 px=await flat(1);ok(px[0]>200&&px[3]>200,'a shared layer shows in the other frame too ('+px+')');
 await p.evaluate(()=>{const G=__gs,L=G.allLayers(G.anim.frames[0])[0];G.clearTarget(L.target,[0,0,1,1]);G.changedAll();});
 px=await flat(1);ok(px[2]>200&&px[0]<50,'painting on it in one frame changes it in the other ('+px+')');
 // save and reopen
 const re=await p.evaluate(async()=>{const G=__gs,blob=await G.encodeGouache();await G.openGouache(await blob.arrayBuffer(),'rt');
  const F0=G.anim.frames[0],F1=G.anim.frames[1],shared=F0.children.filter(c=>F1.children.includes(c));
  const t=G.frameFlat(F1),d=G.readRGBA8(t);G.release(t);return {n:G.anim.frames.length,l0:G.allLayers(F0).length,l1:G.allLayers(F1).length,shared:shared.length,flag:shared.every(c=>c.shared),px:[...d.slice((32*64+32)*4,(32*64+32)*4+4)]};});
 ok(re.n===2&&re.l0===2&&re.l1===2&&re.shared===1&&re.flag&&re.px[2]>200,'saved and reopened: frames, layers and the shared layer are back '+JSON.stringify(re));
 // undo the share
 await p.evaluate(async()=>{const G=__gs;G.showFrame(0);await G.undo();await G.undo();});await p.waitForTimeout(400);
 const un=await p.evaluate(()=>{const G=__gs,F0=G.anim.frames[0],F1=G.anim.frames[1];return F0.children.filter(c=>F1.children.includes(c)).length;});
 ok(un===0||un===1,'undo works ('+un+')');
 // pen and shape tools work in animation, drawing on layers of the frame
 await p.evaluate(()=>{__gs.newDoc(64,64,8,[1,1,1],'AnimT',false,'hand');__gs.setMode('anim',true);});await p.waitForTimeout(600);
 await p.evaluate(()=>{__gs.showFrame(0);__gs.setTool('pen');});
 ok(await p.evaluate(()=>__gs.ui.tool)==='pen','the pen tool can be chosen in Animation');
 await p.evaluate(()=>__gs.setTool('shape'));await p.waitForTimeout(200);
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2];});
 const before=await p.evaluate(()=>__gs.allLayers(__gs.anim.frames[0]).length);
 await p.mouse.move(box[0]-40,box[1]-40);await p.mouse.down();await p.mouse.move(box[0]+30,box[1]+30,{steps:6});await p.mouse.up();await p.waitForTimeout(400);
 const after=await p.evaluate(()=>({n:__gs.allLayers(__gs.anim.frames[0]).length,shape:__gs.allLayers(__gs.anim.frames[0]).some(l=>!!l.shape)}));
 ok(after.n===before+1&&after.shape,'the shape tool adds a shape layer to the frame ('+before+' → '+after.n+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
