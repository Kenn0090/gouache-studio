/* 0.61: Remove (LaMa) in the Photo tab, with the real model */
const {chromium}=require('playwright');const env=require('./ai-env.cjs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!env.haveAll()){console.log('SKIP no AI model files');return;}
 const {srv,url}=await env.start();
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.prefs',JSON.stringify({aiDevice:'cpu'}));}catch(e){}});
 await p.goto(url+'/?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.evaluate(async()=>{__gs.AI.urlFix=(u,f)=>location.origin+'/aimodels/'+f.n;await __gs.aiInstall('engine');await __gs.aiInstall('lama');});
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const W=320,H=240,c=new OffscreenCanvas(W,H),x=c.getContext('2d'),g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,'#4a6a3a');g.addColorStop(1,'#7a9a5a');x.fillStyle=g;x.fillRect(0,0,W,H);
   x.fillStyle='#d02020';x.beginPath();x.arc(160,120,20,0,7);x.fill();
   await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'r.png',{type:'image/png'})]);});await p.waitForTimeout(1200);
 const px=async(x,y)=>p.evaluate(([x,y])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]];},[x,y]);
 const before=await px(160,120),around=await px(160,170);
 ok(before[0]>180&&before[1]<60,'the red thing is there ('+before+')');
 ok(await p.evaluate(()=>!!document.getElementById('phs_remove')),'there is a Remove section');
 await p.evaluate(()=>{__gs.ph.rm.size=.2;return __gs.phRmRun([[.5,.5]]);});await p.waitForTimeout(800);
 const after=await px(160,120);
 ok(Math.abs(after[0]-before[0])>60&&after[0]<150&&after[1]>70,'it is filled with what is around ('+before+' → '+after+')');
 ok(await p.evaluate(()=>__gs.phS().rm.length)===1,'one removal is listed');
 const far=await px(40,40);ok(Math.abs(far[0]-74)<12,'the rest of the picture is untouched ('+far+')');
 await p.evaluate(()=>__gs.phUndo());await p.waitForTimeout(500);
 const undone=await px(160,120);ok(undone[0]>180,'Undo brings it back ('+undone+')');
 await p.evaluate(()=>__gs.phRedo());await p.waitForTimeout(500);
 ok((await px(160,120))[0]<150,'Redo takes it out again');
 // export at full size also has it removed
 const ex=await p.evaluate(async()=>{const c=await __gs.phRenderFull(__gs.phP(),{mode:'orig'});const d=c.getContext('2d').getImageData(Math.round(c.width/2),Math.round(c.height/2),1,1).data;return [c.width,c.height,d[0],d[1],d[2]];});
 ok(ex[2]<150&&ex[3]>70,'the exported picture has it removed too ('+ex+')');
 await p.evaluate(()=>__gs.phSidecarFlush());
 ok(await p.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>k.startsWith('gs.ph.')))).rmp||{}).length)===1,'the patch is saved with the photo');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await p.screenshot({path:'/tmp/photo_remove.png'});
 await b.close();srv.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
