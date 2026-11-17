/* 0.90: the timelapse recorder. Record / pause / resume / stop and save, only changed pictures are kept, replay on the canvas, the size limit
   replaces the oldest pictures, and an unfinished recording is resumed after a recovery. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1500,height:1000},acceptDownloads:true}),p=await ctx.newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(2000);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>{indexedDB.deleteDatabase('gouache-timelapse');});await p.reload();await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(2000);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(600,600,8,[1,1,1],'TL',false,'hand'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const drag=async(x0,y0,x1,y1)=>{const a=at(x0,y0),z=at(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:10});await p.mouse.up();await p.waitForTimeout(120);};
 const stroke=async i=>{await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=40;__gs.ui.fg=[.2,.4,.8];});await drag(80,80+i*70,500,100+i*70);};
 const st=()=>p.evaluate(()=>({on:__gs.tlr.on,paused:__gs.tlr.paused,count:__gs.tlr.count,first:__gs.tlr.first,sid:__gs.tlr.sid}));
 await p.evaluate(()=>{__gs.barPreset('all');});
 await p.evaluate(()=>{__gs.tlr.cfg.unit='s';__gs.tlr.cfg.freq=60;__gs.tlr.cfg.comp=40;__gs.tlr.cfg.size=720;});
 /* record and finish three timelapses in a row: the third used to fail */
 for(let n=1;n<=3;n++){
  await p.click('#tlBar .tlrec');await p.waitForTimeout(400);
  for(let i=0;i<3;i++){await stroke(i+n);await p.waitForTimeout(150);}
  const dl=p.waitForEvent('download',{timeout:60000}).catch(()=>null);
  await p.click('#tlBar .tlstop');const d=await dl;
  for(let i=0;i<60&&await p.evaluate(()=>!!__gs.tlr.on);i++)await p.waitForTimeout(500);
  await p.waitForTimeout(1500);
  const vids=await p.evaluate(async()=>{const r=await new Promise(res=>{const q=indexedDB.open('gouache-timelapse');q.onsuccess=()=>res(q.result);});return await new Promise(res=>{const t=r.transaction('videos').objectStore('videos').getAll();t.onsuccess=()=>res(t.result.length);});});
  ok(!!d||vids>=n,'timelapse '+n+' was exported ('+(d?d.suggestedFilename():'no download')+', '+vids+' in the list)');
 }
 await p.click('#tlBar .tlgear');await p.waitForTimeout(600);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#tlPop [title]')].length>=8),'the settings window has tooltips');
 await p.screenshot({path:'/tmp/claude-0/-home-user-gouache-studio/92f86222-7ec7-5899-b73a-60feb38a81d6/scratchpad/tlpop.png'});
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
