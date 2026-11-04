/* 0.59: perspective guides: window, points can be moved, strokes snap to the lines, the guides are saved. */
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
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(256,256,8,[1,1,1],'Persp',false,'hand');});await p.waitForTimeout(400);
 const scr=async(x,y)=>{const box=await p.locator('#gl').boundingBox();const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 await p.evaluate(()=>__gs.act('perspDlg'));await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.querySelector('#dlgTitle').textContent)==='Perspective guides','View › Perspective guides opens the window');
 await p.click('#pspBody .segb:text-is("1 point")');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!__gs.doc.persp&&__gs.doc.persp.vps.length===1&&__gs.doc.persp.on),'one vanishing point is made');
 ok(await p.evaluate(()=>document.querySelectorAll('#xfOv .persp-vp').length)===1,'the point and its lines are drawn on the canvas');
 await p.evaluate(()=>{const P=__gs.doc.persp;P.vps[0]=[128,128];__gs.drawXfOverlay();__gs.closeDialog();});await p.waitForTimeout(200);
 // draw towards the point, slightly off the line: the stroke lands on the line
 await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.tip=null;__gs.brush.size=6;__gs.brush.hardness=1;__gs.brush.pSize=false;__gs.brush.smoothing=0;__gs.brush.endInk=0;__gs.setFG([0,0,0]);});
 const a=await scr(240,40),c=await scr(150,106),o=await scr(130,128);
 await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:12});await p.mouse.move(o[0],o[1]+0,{steps:8});await p.mouse.up();await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(L.target||__gs.mapT(L,'base')),W=__gs.doc.w;let maxDev=0,n=0;
  const sx=240,sy=40,ex=128,ey=128,dx=ex-sx,dy=ey-sy,len=Math.hypot(dx,dy);
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){if(d[(y*W+x)*4]<100&&d[(y*W+x)*4+3]>200){n++;const dev=Math.abs((x-sx)*dy-(y-sy)*dx)/len;if(dev>maxDev)maxDev=dev;}}return {n,maxDev};});
 ok(r.n>50&&r.maxDev<=4.5,'a stroke drawn towards the point runs on the guide line (pixels '+r.n+', farthest from the line '+r.maxDev.toFixed(1)+' px)');
 // saved and reopened
 const re=await p.evaluate(async()=>{const G=__gs,blob=await G.encodeGouache();await G.openGouache(await blob.arrayBuffer(),'P');return G.doc.persp&&G.doc.persp.vps&&G.doc.persp.vps.length;});
 ok(re===1,'the guides are saved with the document');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
