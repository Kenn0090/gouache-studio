/* 0.41: Quick dupli, frame tools, seconds ruler and scrub, export frame rate and in-betweens (blend and motion) */
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
 await p.evaluate(()=>__gs.newDoc(128,96,8,[1,1,1],'a41',false));await W(300);
 await p.click('#modeTabs [data-mode=anim]');await W(300);
 const n=()=>p.evaluate(()=>({n:__gs.anim.frames.length,cur:__gs.anim.cur}));
 /* Quick dupli dialog */
 await p.click('button:text-is("Quick dupli…")');await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('qdN')&&document.querySelectorAll('#dlgBody .chip').length===7),'Quick dupli offers the 7 presets');
 await p.click('#dlgBody .chip:text-is("16")');await W(100);
 ok(await p.inputValue('#qdN')==='16','choosing a preset fills the number');
 await p.click('#dlgOk');await W(800);let s=await n();ok(s.n===17&&s.cur===16,'16 copies were added ('+JSON.stringify(s)+')');
 await p.keyboard.press('Control+z');await W(500);s=await n();ok(s.n===1,'one undo removes them all');
 await p.keyboard.press('Control+y');await W(500);s=await n();ok(s.n===17,'redo brings them back');
 await p.keyboard.press('Control+z');await W(500);
 /* Quick dupli at the end via the function, then tools */
 await p.evaluate(()=>__gs.quickDupli(3,'end'));await W(300);s=await n();ok(s.n===4,'quick dupli at the end');
 await p.evaluate(()=>{__gs.pingPongFrames();});await W(300);s=await n();ok(s.n===5,'ping-pong adds the reversed middle of the picked frames ('+s.n+')');
 await p.evaluate(()=>{__gs.repeatFrames(2);});await W(400);s=await n();ok(s.n===15,'repeat adds the whole range twice ('+s.n+')');
 await p.evaluate(()=>{__gs.setRangeHold(3);});await W(300);ok(await p.evaluate(()=>__gs.anim.frames.every(f=>f.hold===3)),'hold set for all frames');
 /* ruler */
 ok(await p.evaluate(()=>document.querySelectorAll('.tlruler .tlmark').length>=2&&!!document.querySelector('.tlruler .tlhead')),'the seconds ruler shows marks and a head');
 const rb=await p.locator('.tlruler').boundingBox();await p.mouse.click(rb.x+76*4+10,rb.y+8);await W(300);
 ok((await n()).cur===4,'clicking the ruler jumps to that frame');
 /* motion: a square moving right over two frames */
 const res=await p.evaluate(async()=>{
   const mk=(x)=>{const c=document.createElement('canvas');c.width=128;c.height=96;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(x,30,30,30);g.fillStyle='#e33';g.fillRect(x+6,36,8,8);return c;};
   const A0={frames:[{hold:1},{hold:1}],fps:12,tags:[]},full0=[mk(10),mk(50)];
   const out={};
   for(const mode of ['off','blend','motion']){const R=await __gs.buildRetimed(A0,full0,24,mode,()=>false);out[mode]={n:R.A.frames.length,fps:R.A.fps,mid:Array.from(R.full[1].getContext('2d').getImageData(0,0,128,96).data)};}
   return out;});
 const al=(d,x,y)=>d[(y*128+x)*4+3];
 ok(res.off.n===4&&res.off.fps===24,'2× rate makes 4 frames');
 console.log('alpha at (15,50)/(45,50)/(70,50): off',al(res.off.mid,15,50),al(res.off.mid,45,50),al(res.off.mid,70,50),'blend',al(res.blend.mid,15,50),al(res.blend.mid,45,50),al(res.blend.mid,70,50),'motion',al(res.motion.mid,15,50),al(res.motion.mid,45,50),al(res.motion.mid,70,50));
 ok(al(res.off.mid,15,50)===255&&al(res.off.mid,70,50)===0,'without in-betweens the square stays at its frame position');
 ok(Math.abs(al(res.blend.mid,15,50)-128)<8&&Math.abs(al(res.blend.mid,70,50)-128)<8,'blend fades between the two positions');
 ok(al(res.motion.mid,45,50)>200&&al(res.motion.mid,15,50)<60&&al(res.motion.mid,70,50)<60,'motion moves the square to the middle');
 /* the export window */
 await p.evaluate(()=>{});await p.click('button:text-is("Export…")');await W(500);
 ok(await p.evaluate(()=>!!document.getElementById('exRate')&&!!document.getElementById('exInter')),'the export window has frame rate and in-between choices');
 await p.selectOption('#exRate','60');await W(1500);
 ok((await p.textContent('#dlgBody')).includes('frames at 60 fps'),'choosing 60 fps remakes the frames');
 await p.selectOption('#exInter','blend');await p.waitForFunction(()=>document.getElementById('dlgBody').textContent.includes('blended'),null,{timeout:60000});
 ok((await p.textContent('#dlgBody')).includes('blended'),'blend in-betweens are made');
 await p.click('#dlgCancel');await W(200);
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
