/* 0.98: smaller projects (material layers as settings, Library pictures by name), lazy card previews,
   timelapse video quality, and Send to HandBrake (with a stand-in for the desktop app). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1500,height:900}});const p=await ctx.newPage();
 let libOff=false;
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return libOff?r.abort():r.fulfill({path:__dirname+'/../../assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:')||u.startsWith('blob:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 /* a stand-in for the desktop app: HandBrake is "installed", programs are "started", events can be sent */
 await p.addInitScript(()=>{window.__calls=[];window.__listen={};window.__hbFound={gui:'C:\\Program Files\\HandBrake\\HandBrake.exe',cli:'C:\\Tools\\HandBrakeCLI.exe'};
   window.__TAURI__={core:{invoke:async(cmd,args)=>{window.__calls.push([cmd,args]);
     if(cmd==='hb_find')return window.__hbFound;if(cmd==='cache_info')return {dir:'C:\\Cache',custom:false,spill_bytes:0,tree_bytes:0,free_bytes:1e11,ram_total:3.2e10,ram_avail:2e10};
     if(cmd==='recent_list')return [];return null;}},event:{listen:async(n,f)=>{window.__listen[n]=f;return ()=>{};}}};});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>!!window.__gs,null,{timeout:120000});await p.waitForTimeout(2000);
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();});
 /* ---- lazy cards ---- */
 ok(await p.evaluate(()=>document.querySelectorAll('#weldToolsBody .weld-card').length===0&&__gs.weldCardPics.size===0),'weld card pictures are not drawn while their panel is hidden');
 /* ---- a 3D Paint project with Library materials ---- */
 const r=await p.evaluate(async()=>{const g=__gs,W=ms=>new Promise(r=>setTimeout(r,ms));
  await g.p3NewProject(512,{});await W(1200);
  for(const rec of g.gmRecs.slice(0,2)){await g.gmApply(rec);await W(300);}await W(500);
  const sample=()=>{const t=g.compositeMap('base'),d=g.readRGBA8(t);g.release(t);let s=0;for(let i=0;i<d.length;i+=331)s=(s*31+d[i])>>>0;return s;};
  const tagged=g.allLayers().filter(l=>l.fill&&l._fillImg&&Object.values(l._fillImg).some(t=>g.lrRefOf(t))).length;
  const before=sample();
  const small=await (await g.encodeP3Project()).arrayBuffer();
  g.prefs.keepPics=true;const big=await (await g.encodeP3Project()).arrayBuffer();g.prefs.keepPics=undefined;
  g.p3.savedAt=g.p3Sig();await g.openP3Project(small,'small.gouache3d');await W(1200);const afterSmall=sample();
  const sizes=g.allLayers().filter(l=>l.fill&&l._fillImg&&Object.keys(l._fillImg).length).map(l=>Object.values(l._fillImg)[0].w);
  const again=await (await g.encodeP3Project()).arrayBuffer();
  g.p3.savedAt=g.p3Sig();await g.openP3Project(big,'big.gouache3d');await W(1200);const afterBig=sample();
  window.__small=small;
  return {tagged,before,afterSmall,afterBig,small:small.byteLength,big:big.byteLength,again:again.byteLength,sizes};});
 ok(r.tagged===2,'both material layers know their pictures came from the Library ('+r.tagged+')');
 ok(r.small<r.big/20&&r.small<400000,'the project is far smaller: '+Math.round(r.small/1024)+' KB instead of '+Math.round(r.big/1024)+' KB');
 ok(r.afterSmall===r.before,'the small project opens to exactly the same picture');
 ok(r.sizes.length===2&&r.sizes.every(w=>w>=512),'the Library pictures are back on the layers at full size ('+r.sizes+')');
 ok(Math.abs(r.again-r.small)<2000,'saving it again stays small ('+Math.round(r.again/1024)+' KB)');
 ok(r.afterBig===r.before,'“Keep every picture inside saved files” still opens to the same picture');
 /* the Library is not reachable: plain stand-ins, a message, and the names survive another save */
 const m=await p.evaluate(async()=>{const g=__gs,W=ms=>new Promise(r=>setTimeout(r,ms));
  const t=await g.lrPicture({lib:'no-such-material',ref:1,w:1024,h:1024},'base'),n=await g.lrPicture({lib:'no-such-material',ref:1},'normal');await W(1800);
  const ref=g.lrRefOf(t);return {w:t.w,ref:ref&&ref.lib,nw:n.w,toast:[...document.querySelectorAll('.toast,#toast,[role=status]')].map(e=>e.textContent).join(' | ')};});
 ok(m.w===4&&m.nw===4&&m.ref==='no-such-material','a Library material that is not on the computer gives a plain stand-in that keeps the material’s name '+JSON.stringify(m).slice(0,80));
 ok(/not on this computer/.test(m.toast),'and a message says so');
 /* Preferences has the switch */
 await p.evaluate(()=>__gs.dlgPrefs());await p.waitForTimeout(500);
 const nt=await p.evaluate(()=>document.querySelectorAll('#modal [role=tab]').length);let found=!!(await p.$('#pKeepPics'));
 for(let i=0;i<nt&&!found;i++){await p.evaluate(i=>document.querySelectorAll('#modal [role=tab]')[i].click(),i);await p.waitForTimeout(200);found=!!(await p.$('#pKeepPics'));}
 ok(found,'Preferences has “Keep every picture inside saved files”');
 if(found){await p.click('#pKeepPics');ok(await p.evaluate(()=>__gs.prefs.keepPics===true&&__gs.gfKeepPics()),'ticking it turns self-contained files on');await p.click('#pKeepPics');}
 await p.evaluate(()=>{const c=document.querySelector('#dlgCancel');if(c)c.click();});await p.waitForTimeout(300);
 /* ---- .gmat: exact pictures as lossless WebP ---- */
 await p.waitForFunction(()=>__gs.pxWebpExactNow()!==null&&__gs.pxWebpExactNow()!==undefined,null,{timeout:15000}).catch(()=>{});await p.waitForTimeout(500);
 const gm=await p.evaluate(async()=>{const g=__gs,n=256,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d',{willReadFrequently:true}),id=x.createImageData(n,n),d=id.data;
  for(let y=0;y<n;y++)for(let i=0;i<n;i++){const o=(y*n+i)*4;d[o]=128+Math.round(90*Math.sin(i*.13)*Math.cos(y*.07));d[o+1]=128+Math.round(90*Math.sin(y*.11+i*.02));d[o+2]=230+((i*7+y*3)%20);d[o+3]=255;}x.putImageData(id,0,0);
  const u=g.pxDataURL(c,'normal'),png=c.toDataURL('image/png'),lossy=g.pxDataURL(c,'base');
  const im=await new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src=u;});const c2=document.createElement('canvas');c2.width=c2.height=n;const x2=c2.getContext('2d',{willReadFrequently:true});x2.drawImage(im,0,0);const e=x2.getImageData(0,0,n,n).data;
  let same=true;for(let i=0;i<d.length;i++)if(e[i]!==d[i]){same=false;break;}
  return {exact:g.pxWebpExactNow(),type:u.slice(5,15),same,size:u.length,png:png.length,lossyType:lossy.slice(5,15)};});
 ok(gm.exact===true&&gm.type==='image/webp'&&gm.same,'a normal map goes into a .gmat as WebP and comes back pixel for pixel the same');
 ok(gm.size<gm.png,'and it is smaller than the PNG it replaces ('+gm.size+' < '+gm.png+')');
 ok(gm.lossyType==='image/webp','colour pictures are still high-quality WebP');
 /* ---- timelapse quality ---- */
 await p.click('#modeTabs [data-mode=paint]');await p.waitForTimeout(1500);
 /* ---- Painting report ---- */
 await p.evaluate(()=>{__gs.newDoc(800,800,8,[1,1,1],'Rep',false);});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>__gs.pr.on===false&&__gs.pr.hooked===false),'nothing is timed before a recording is started');
 await p.evaluate(()=>__gs.act('paintReport'));await p.waitForTimeout(400);await p.click('#dlgOk');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!document.querySelector('#prChip')&&__gs.pr.on),'Help › Painting report starts a recording with a Stop note');
 {const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height};});
  for(let k=0;k<2;k++){await p.mouse.move(box.x+box.w*.35,box.y+box.h*(.4+.1*k));await p.mouse.down();for(let i=0;i<15;i++)await p.mouse.move(box.x+box.w*(.35+.3*i/15),box.y+box.h*(.4+.1*k));await p.mouse.up();await p.waitForTimeout(300);}}
 await p.click('#prStop');await p.waitForTimeout(600);
 const rep=await p.evaluate(()=>({t:(document.querySelector('#prText')||{}).value||'',on:__gs.pr.on,chip:!!document.querySelector('#prChip'),copy:!!document.querySelector('#prCopy')}));
 ok(!rep.on&&!rep.chip&&rep.copy&&/PAINTING REPORT/.test(rep.t)&&/Document 800 × 800/.test(rep.t)&&/2 strokes/.test(rep.t),'Stop shows the report with the setup and the strokes counted');
 ok(/WORST STUTTERS/.test(rep.t)&&/brush dabs: \d+ ×/.test(rep.t)&&/putting the layers together/.test(rep.t),'it lists the stutters and how long each of the app’s steps took');
 await p.evaluate(()=>{const c=document.querySelector('#dlgCancel')||document.querySelector('#dlgOk');if(c)c.click();});await p.waitForTimeout(300);
 const t=await p.evaluate(async()=>{const g=__gs,q=k=>{g.tlr.cfg.vq=k;return g.tlBitrate(1280,720,30);};
  const s=q('small'),m=q('bal'),h=q('best');g.tlr.cfg.vq='bal';g.tlr.cfg.fmt='auto';
  const f=typeof VideoEncoder==='undefined'?null:await g.tlFormat(640,360,30,g.tlBitrate(640,360,30));
  return {s,m,h,old:Math.round(1280*720*30*.12),per:g.tlPerMinute(),fmt:f&&f.F&&f.F[0],codec:f&&f.codec,def:g.TL_VQ.map(x=>x[0])};});
 ok(t.s<t.m&&t.m<t.h&&t.m<t.old*.7,'Small < Balanced < Best, and Balanced asks for well under the old size ('+[t.s,t.m,t.h,t.old].map(v=>Math.round(v/1000)+'k').join(', ')+')');
 ok(t.per>0&&t.per<200,'the window can say how big a minute of video is (about '+t.per.toFixed(1)+' MB)');
 ok(t.fmt===null||!!t.codec,'Automatic finds a format this computer can make ('+t.fmt+', '+t.codec+')');
 await p.evaluate(()=>__gs.tlPop());await p.waitForTimeout(600);
 const pop=await p.evaluate(()=>{const e=document.querySelector('#tlPop');return e?{txt:e.textContent,q:[...e.querySelectorAll('select')].some(s=>[...s.options].some(o=>o.textContent==='Balanced')),auto:[...e.querySelectorAll('select')].some(s=>[...s.options].some(o=>/^Automatic/.test(o.textContent))),hb:!!e.querySelector('#hbFindBtn'),kind:!!e.querySelector('#hbKind'),tick:!!e.querySelector('#hbAuto'),est:(e.querySelector('#tlEst')||{}).textContent}:null;});
 ok(pop&&pop.q&&pop.auto&&/MB for each minute/.test(pop.est||''),'the timelapse settings have Video quality, Automatic format and a size estimate');
 ok(pop&&pop.hb&&pop.kind&&pop.tick,'and a HandBrake part: Find HandBrake, Compress as, and the after-every-timelapse tick');
 await p.waitForTimeout(400);
 ok(/HandBrake is ready/.test(await p.evaluate(()=>(document.querySelector('#hbState')||{}).textContent||'')),'it reports that HandBrake was found');
 await p.evaluate(()=>{const e=document.querySelector('#tlPop');if(e)e.remove();});
 /* ---- HandBrake: compress in the background, progress, done ---- */
 const h=await p.evaluate(async()=>{const g=__gs,W=ms=>new Promise(r=>setTimeout(r,ms));
  const vid={id:'vtest',name:'My timelapse',created:Date.now(),ext:'webm',blob:new Blob([new Uint8Array(4000000)]),frames:90,w:1280,h:720,fps:30,path:'C:\\TL\\my-timelapse-vtest.webm'};await g.tlPut('videos',vid);
  window.__calls.length=0;g.hb.cfg.kind='h265';g.hb.cfg.q=1;
  const started=await g.hbCompress(vid);const run=window.__calls.find(c=>c[0]==='hb_run');
  const chip0=(document.querySelector('#hbChip')||{}).textContent||'';
  window.__listen['hb-progress']({payload:{id:run[1].id,pct:42}});await W(50);const chip1=(document.querySelector('#hbChip')||{}).textContent||'';
  window.__listen['hb-done']({payload:{id:run[1].id,ok:true,size:1000000,msg:''}});await W(300);
  const after=await g.tlGet('videos','vtest'),chip2=!!document.querySelector('#hbChip');
  const toast=[...document.querySelectorAll('.toast,#toast,[role=status]')].map(e=>e.textContent).join(' | ');
  window.__calls.length=0;const opened=await g.hbOpen(vid);const launch=window.__calls.find(c=>c[0]==='launch_app');
  /* no command-line program */
  window.__hbFound={gui:window.__hbFound.gui,cli:null};window.__calls.length=0;const noCli=await g.hbCompress(vid);const ranAnyway=window.__calls.some(c=>c[0]==='hb_run');
  return {started,args:run&&run[1],chip0,chip1,chip2,hb:after&&after.hb,toast,opened,launch:launch&&launch[1],noCli,ranAnyway};});
 ok(h.started&&h.args&&h.args.cli.endsWith('HandBrakeCLI.exe')&&h.args.input.endsWith('.webm')&&h.args.output.endsWith('my-timelapse-vtest-small.mp4')&&h.args.kind==='h265'&&h.args.quality===1&&h.args.width===1280&&h.args.fps===30,'Compress starts HandBrake’s background program with the video, the choice and “-small.mp4” '+JSON.stringify(h.args&&[h.args.kind,h.args.quality,h.args.output]));
 ok(/compressing/.test(h.chip0)&&/42%/.test(h.chip1)&&!h.chip2,'a progress note shows the percentage and goes away when it is done');
 ok(h.hb&&h.hb.size===1000000&&/75% smaller/.test(h.toast),'the result is remembered and announced (4 MB → 1 MB, 75% smaller)');
 ok(h.opened&&h.launch&&h.launch.exe.endsWith('HandBrake.exe')&&h.launch.args[0].endsWith('.webm'),'Open in HandBrake starts the HandBrake window with the video');
 ok(h.noCli===false&&!h.ranAnyway,'without HandBrakeCLI nothing is started (and the message says where to get it)');
 ok(!errs.length,'no errors on the page '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
