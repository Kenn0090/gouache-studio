/* 0.90: the timelapse recorder. Record / pause / resume / stop and save, only changed pictures are kept, replay on the canvas, the size limit
   replaces the oldest pictures, and an unfinished recording is resumed after a recovery. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
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
 // the bar
 const bar=await p.evaluate(()=>({has:!!document.querySelector('#tlBar'),rec:!!document.querySelector('#tlBar .tlrec'),play:!!document.querySelector('#tlBar .tlplay'),sel:!!document.querySelector('#tlBar .tlsel'),stop:!!document.querySelector('#tlBar .tlstop'),folder:!!document.querySelector('#tlBar .tlfolder'),gear:!!document.querySelector('#tlBar .tlgear')}));
 ok(Object.values(bar).every(Boolean),'the recorder bar has record, replay, a list, stop, folder and settings buttons '+JSON.stringify(bar));
 // fast pictures for the test: 60 a second
 await p.evaluate(()=>{__gs.tlr.cfg.unit='s';__gs.tlr.cfg.freq=60;__gs.tlr.cfg.comp=40;__gs.tlr.cfg.size=720;});
 await p.click('#tlBar .tlrec');await p.waitForTimeout(500);
 let s=await st();ok(s.on&&!s.paused&&s.count>=1,'Record starts a recording and takes the first picture ('+s.count+')');
 ok(await p.evaluate(()=>document.querySelector('#tlBar .tlrec').textContent==='❚❚'),'while recording the record button is a pause button');
 ok(await p.evaluate(()=>document.querySelector('#tlBar .tldot').classList.contains('blink')),'the red dot blinks while recording');
 // idle: no new pictures when nothing changes
 const idle0=(await st()).count;await p.waitForTimeout(900);ok((await st()).count===idle0,'no new pictures are taken while nothing changes ('+idle0+')');
 for(let i=0;i<4;i++){await stroke(i);await p.waitForTimeout(150);}
 s=await st();ok(s.count>=idle0+4,'every change to the canvas gets a picture ('+idle0+' to '+s.count+')');
 // pause
 await p.click('#tlBar .tlrec');await p.waitForTimeout(200);s=await st();ok(s.on&&s.paused,'the button pauses the recording');const pc=s.count;
 await stroke(4);await p.waitForTimeout(500);ok((await st()).count===pc,'nothing is taken while paused');
 await p.click('#tlBar .tlrec');await p.waitForTimeout(500);ok((await st()).count>pc&&!(await st()).paused,'it resumes and takes a picture of the change');
 // the whole canvas, at the chosen size
 const frame=await p.evaluate(async()=>{const r=await new Promise(res=>{const q=indexedDB.open('gouache-timelapse');q.onsuccess=()=>res(q.result);});const t=r.transaction('frames').objectStore('frames').getAll();return await new Promise(res=>{t.onsuccess=()=>res(t.result.map(f=>({w:f.w,h:f.h,size:f.blob.size,type:f.blob.type})));});});
 console.log('pictures:',frame.length,JSON.stringify(frame[0]));ok(frame.length>=6&&frame[0].w===600&&frame[0].h===600&&frame.every(f=>f.size>100),'the pictures are of the whole canvas ('+frame[0].w+' × '+frame[0].h+')');
 // crash: the recording is left unfinished; recovery resumes it
 const sid=(await st()).sid,cnt=(await st()).count;
 await p.evaluate(()=>{clearTimeout(__gs.tlr.timer);__gs.tlr.on=false;__gs.tlr.paused=false;__gs.tlr.sess&&(__gs.tlr.sess.state='progress');});
 const left=await p.evaluate(()=>__gs.tlSessions().then(l=>l.map(x=>({id:x.id,state:x.state,count:x.count}))));ok(left.some(x=>x.id===sid&&x.state==='progress'),'an unfinished recording is kept in storage ('+JSON.stringify(left)+')');
 await p.evaluate(()=>__gs.tlAfterRecover());await p.waitForTimeout(700);s=await st();ok(s.on&&s.sid===sid&&s.count>=cnt-1,'after a recovery the same recording resumes and keeps its pictures ('+s.count+')');
 await stroke(6);await p.waitForTimeout(400);
 // stop and save: the video is made and kept
 const dl=p.waitForEvent('download',{timeout:60000}).catch(()=>null);
 await p.click('#tlBar .tlstop');await p.waitForFunction(()=>__gs.tlVideos().then(v=>v.length>0).then(x=>{window.__vid=x;return x;})&&window.__vid,null,{timeout:90000}).catch(()=>{});
 await p.waitForTimeout(1500);
 const vids=await p.evaluate(()=>__gs.tlVideos().then(v=>v.map(x=>({name:x.name,frames:x.frames,size:x.blob.size,type:x.blob.type,ext:x.ext,w:x.w,h:x.h}))));
 console.log('videos:',JSON.stringify(vids));
 ok(vids.length===1&&vids[0].size>1000&&vids[0].frames>=6,'Stop & Save makes a video from the pictures ('+(vids[0]&&vids[0].frames)+' pictures, '+(vids[0]&&vids[0].ext)+')');
 const d=await dl;ok(!!d,'the finished video is offered to be saved'+(d?' as '+d.suggestedFilename():''));
 s=await st();ok(!s.on,'recording has stopped');
 ok((await p.evaluate(()=>__gs.tlSessions().then(l=>l.length)))===0,'the pictures are cleared out once the video is made');
 // replay on the canvas
 await p.waitForTimeout(500);await p.click('#tlBar .tlplay');await p.waitForTimeout(800);
 const rp=await p.evaluate(()=>{const v=document.querySelector('#tlReplay video');return {has:!!v,src:!!(v&&v.src),paused:v&&v.paused};});
 ok(rp.has&&rp.src,'Replay shows the timelapse on the canvas');
 await p.evaluate(()=>__gs.tlReplayClose());ok(await p.evaluate(()=>!document.querySelector('#tlReplay')),'the replay closes');
 // the settings window
 await p.click('#tlBar .tlgear');await p.waitForTimeout(300);ok(await p.evaluate(()=>!!document.querySelector('#tlPop #tlFreq, #tlPop [id=tlFreq]')&&!!document.querySelector('#tlPop select')),'the settings window has the pictures-per-unit slider and the format list');
 // size limit (on a new recording): over the limit, the oldest pictures give way
 await p.click('#tlBar .tlrec');await p.waitForTimeout(500);for(let i=0;i<4;i++){await stroke(i);await p.waitForTimeout(150);}
 const before=(await st()).first;await p.evaluate(()=>{__gs.prefs.tlMaxMB=50;__gs.tlr.bytes=300*1048576;});await stroke(5);await p.waitForTimeout(600);
 const after=await st();console.log('first picture kept:',before,'->',after.first);ok(after.first>before,'over the size limit, the oldest pictures give way');
 await p.evaluate(()=>{delete __gs.prefs.tlMaxMB;});
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
