/* 0.43: fire/smoke/sparks generators and VFX helpers */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(64,96,8,[1,1,1],'a43',false));await W(300);
 await p.click('#modeTabs [data-mode=anim]');await W(300);
 const cnt=c=>{const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let a=0;for(let i=3;i<d.length;i+=4)a+=d[i];return a/255;};
 const NAMES=['fire','smoke','sparks','explosion','lightning','magic orb','shockwave','rain','snow','blood splat','ripples','slash','impact burst','dust puff','energy beam','bubbles','portal','sparkles','muzzle flash'];
 for(let k=0;k<19;k++){
   const r=await p.evaluate(k=>{const A=__gs.anim;A.frames.length=1;A.cur=0;const o=__gs.vfxOpts(k);o.n=6;o.replace=true;__gs.vfxGenerate(o);
     const f=A.frames.map(F=>{const c=__gs.frameCanvasOf(F),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let a=0;for(let i=3;i<d.length;i+=4)a+=d[i];return Math.round(a/255);});
     const f0=__gs.frameCanvasOf(A.frames[0]).getContext('2d').getImageData(0,0,64,96).data,f1=__gs.frameCanvasOf(A.frames[2]).getContext('2d').getImageData(0,0,64,96).data;let d=0;for(let i=3;i<f0.length;i+=4)if(Math.abs(f0[i]-f1[i])>8)d++;
     return {n:A.frames.length,f,d};},k);
   ok(r.n===6&&r.f.some(x=>x>20),NAMES[k]+' makes 6 frames with pictures ('+r.f+')');ok(r.d>20,NAMES[k]+' frames move ('+r.d+' pixels differ)');}
 /* shaped by the painted frame */
 const sh=await p.evaluate(()=>{const A=__gs.anim;A.frames.length=1;A.cur=0;const w=64,h=96,d=new Uint8ClampedArray(w*h*4);for(let y=60;y<80;y++)for(let x=20;x<44;x++){const i=(y*w+x)*4;d[i]=255;d[i+1]=255;d[i+2]=255;d[i+3]=255;}
   const tex=__gs.uploadStraight({w,h,data:d,bits:8});__gs.premultInto(A.frames[0].target,tex,[0,0],null);
   {const o=__gs.vfxOpts(0);o.n=3;o.useBase=true;__gs.vfxGenerate(o);}return A.frames.length;});
 ok(sh===4,'fire shaped by the painted frame adds frames');
 /* spin */
 await p.evaluate(()=>{__gs.anim.cur=0;__gs.spinFrames(8,360);});await W(200);ok((await p.evaluate(()=>__gs.anim.frames.length))===12,'spin adds 8 frames');
 /* seamless loop */
 const before=await p.evaluate(()=>__gs.anim.frames.length);await p.evaluate(()=>{__gs.anim.cur=0;__gs.seamlessLoop(2);});await W(300);
 ok((await p.evaluate(()=>__gs.anim.frames.length))===before-2,'seamless loop drops the faded frames');
 await p.keyboard.press('Control+z');await W(400);ok((await p.evaluate(()=>__gs.anim.frames.length))===before,'undo brings them back');
 /* cut into a grid opens the sheet dialog */
 await p.evaluate(()=>{__gs.cutFrameGrid();});await W(500);
 ok(await p.evaluate(()=>!!document.getElementById('slcols')),'cut into a grid opens the cell dialog');
 await p.click('#dlgCancel').catch(()=>{});await W(200);
 /* the menu and dialog */
 ok(await p.evaluate(()=>!!document.querySelector('select[aria-label="VFX"]')),'VFX menu on the timeline');
 await p.evaluate(()=>__gs.dlgGenerate(18));await W(600);ok(await p.evaluate(()=>!!document.getElementById('vgPal')&&!!document.getElementById('vg_rot')&&document.querySelectorAll('#dlgBody input[type=range]').length>=8),'muzzle flash window opens with rotation and game-VFX controls');await p.click('#dlgCancel').catch(()=>{});
 /* muzzle flash rotation really changes the generated sprite */
 const mr=await p.evaluate(()=>{const o=__gs.vfxOpts(18),A=[];for(const r of [0,90]){o.rot=r;const T=__gs.makeTarget(64,96,8);__gs.vfxGenInto(T,o,.18,null);A.push(__gs.readRGBA8(T));}let d=0;for(let i=0;i<A[0].length;i+=4)d+=Math.abs(A[0][i+3]-A[1][i+3]);return d;});
 ok(mr>4000,'muzzle flash rotation turns the sprite ('+mr+' alpha difference)');
 /* the loop is exact: time 1 looks like time 0 */
 const lp=await p.evaluate(()=>{const out=[];for(const k of [0,1,2,5,7,8,10,14,15,16,17]){const o=__gs.vfxOpts(k);const T=[0,1].map(t=>{const x=__gs.makeTarget(64,96,8);__gs.vfxGenInto(x,o,t,null);return __gs.readRGBA8(x);});
   let d=0;for(let i=0;i<T[0].length;i++)d=Math.max(d,Math.abs(T[0][i]-T[1][i]));out.push(d);}return out;});
 ok(lp.every(d=>d<=2),'generators loop exactly ('+lp+')');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
