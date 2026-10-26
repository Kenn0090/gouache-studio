/* Dual-brush state transitions, live library picker and frame accounting. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const hardware=process.env.GS_DUAL_GPU==='1',b=await chromium.launch({channel:'msedge',headless:true,args:hardware?['--use-gl=angle','--use-angle=d3d11']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1440,height:950}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs).catch(e=>{console.log(errors);throw e;});await p.evaluate(()=>__gs.closeWelcome());
 const reset=await p.evaluate(()=>{const G=__gs;G.newDoc(160,100);G.cmdAddLayer();const L=G.doc.active;
  const draw=d=>{G.clearTarget(L.target);const o={...G.brush,tool:'brush',color:[0,0,0],size:30,spacing:.02,opacity:1,flow:1,pSize:false,tip:null,dual:d};G.beginStroke(L,30,50,1,o);G.addPoint(130,50,1);G.endStroke(false);return Array.from(G.readRGBA8(L.target));};
  const plain=draw(null),dual={on:true,tipKey:'b:sponge',size:20,spacing:150,scatter:80,count:1,mode:0,amount:100};const masked=draw(dual),off=draw({...dual,on:false}),none=draw(null),missing=draw({...dual,tipKey:'u:removed tip'});
  return {changed:plain.some((v,i)=>v!==masked[i]),off:plain.every((v,i)=>v===off[i]),none:plain.every((v,i)=>v===none[i]),missing:plain.every((v,i)=>v===missing[i])};});
 ok(reset.changed,'dual brush changes actual stroke pixels');ok(reset.off,'disabling dual brush restores the exact plain stroke');ok(reset.none,'switching to a preset without dual brush restores plain painting');ok(reset.missing,'a missing secondary tip safely restores plain painting');
 for(const kind of ['pressure','knockout','random','symmetry','wrapped','16-bit','buildup','tint','erase','smudge']){
  const result=await p.evaluate(kind=>{const G=__gs;G.newDoc(160,100,kind==='16-bit'?16:8,[.4,.3,.2],'Batch comparison',kind==='wrapped');G.cmdAddLayer();const L=G.doc.active;
   const draw=batch=>{G.clearTarget(L.target,kind==='smudge'?[.2,.3,.4,1]:undefined);G.dualWork.enabled=batch;
    const o={...G.brush,tool:kind==='smudge'?'smudge':kind==='erase'?'erase':'brush',color:[.8,.2,.1],size:32,spacing:.01,opacity:.8,flow:.7,pSize:true,minSize:.15,tip:G.TIPS.sponge,roundness:.7,angle:25,angleJitter:.3,sizeJitter:.2,scatter:.1,count:2,bothAxes:true,randFlipX:true,buildup:kind==='buildup',hueJitter:kind==='tint'?.2:0,sym:kind==='symmetry'?{mode:'xy',cx:.5,cy:.5}:null,dual:{on:true,tipKey:'b:sponge',size:20,spacing:150,scatter:80,count:1,mode:kind==='knockout'?1:0,amount:75,random:kind==='random'}};
    let seed=31;const rand=Math.random;Math.random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
    const n=G.runStat.n,bat=G.dualWork.batches;try{G.beginStroke(L,20,50,.15,o);G.addPoint(80,60,.7);G.addPoint(145,40,1);G.endStroke(false);}finally{Math.random=rand;}
    return {data:Array.from(G.captureRegionNow(L.target,0,0,160,100).data),calls:G.runStat.n-n,batches:G.dualWork.batches-bat};};
   const old=draw(false),fast=draw(true);G.dualWork.enabled=true;let max=0;for(let i=0;i<old.data.length;i++)max=Math.max(max,Math.abs(old.data[i]-fast.data[i]));return {max,calls:[old.calls,fast.calls],batches:fast.batches};},kind);
  ok(result.max===0,kind+' matches unbatched stroke pixels exactly ('+JSON.stringify(result)+')');
  if(kind==='pressure')ok(result.batches>0&&result.calls[1]<result.calls[0]/5,'dense strokes reduce graphics submissions by over 80%');
  if(['buildup','tint','smudge'].includes(kind))ok(result.batches===0,kind+' keeps its compatible ordered path');
 }
 const cache=await p.evaluate(()=>{const G=__gs;G.newDoc(160,100);G.cmdAddLayer();let reads=0;const dual={on:true,get tipKey(){reads++;return 'b:sponge';},size:20,spacing:150,scatter:80,count:1,mode:0,amount:100};const o={...G.brush,tool:'brush',color:[0,0,0],size:32,spacing:.01,pSize:false,tip:null,dual};G.beginStroke(G.doc.active,20,50,1,o);G.addPoint(140,50,1);G.endStroke(false);return reads;});
 ok(cache===1,'secondary tip lookup runs once for a low-spacing stroke ('+cache+')');
 await p.evaluate(()=>{const G=__gs;G.setTool('brush');G.brush.dual=null;G.showPanel('tool');G.buildBrushPanel();});
 await p.locator('#dualBox summary').click();await p.locator('#bDualOn').check();
 ok(await p.locator('#bDualTip canvas').count()===await p.evaluate(()=>__gs.library.reduce((n,s)=>n+s.presets.length,0)),'alpha grid contains every brush in the current main library');
 ok(await p.locator('#bDualTip select').count()===0,'the secondary picker uses thumbnail buttons');
 await p.evaluate(()=>{const G=__gs,A=new Uint8Array(256),B=new Uint8Array(256);for(let i=0;i<256;i++){A[i]=(i%16)<8?255:0;B[i]=(i/16|0)<8?255:0;}const a=G.makeTip('Same tip name',16,16,A),b=G.makeTip('Same tip name',16,16,B);G.addSet({id:'dual-test',name:'Live dual test',tips:[a,b],presets:[{name:'Twin tip',tip:a,size:16},{name:'Twin tip',tip:b,size:16}]});window.dualPrimary={tip:G.brush.tip,size:G.brush.size};});
 await p.locator('#bDualSearch').fill('Twin tip');ok(await p.locator('#bDualTip button').count()===2,'imported brushes appear immediately, with searchable thumbnails');
 await p.locator('#bDualTip button').nth(1).click();
 const chosen=await p.evaluate(()=>{const G=__gs,t=G.dualTip(G.brush.dual),set=G.library.find(s=>s.id==='dual-test');return {right:t===set.tips[1],primary:G.brush.tip===dualPrimary.tip&&G.brush.size===dualPrimary.size,selected:document.querySelectorAll('#bDualTip [aria-pressed="true"]').length};});
 ok(chosen.right&&chosen.primary&&chosen.selected===1,'selection identifies duplicate names and leaves the primary brush intact');
 const saved=await p.evaluate(async()=>{const G=__gs,set=G.library.find(s=>s.id==='dual-test');set.presets.push({name:'Remembered dual',dual:{...G.brush.dual},size:24});await G.store.put(G.serializeSet(set));return G.brush.dual.tipKey;});
 await p.reload();await p.waitForFunction(()=>window.__gs&&__gs.library.some(s=>s.id==='dual-test'));await p.evaluate(()=>__gs.closeWelcome());
 ok(await p.evaluate(key=>{const G=__gs,set=G.library.find(s=>s.id==='dual-test'),preset=set.presets.find(p=>p.name==='Remembered dual');G.applyPreset(preset);return G.brush.dual.tipKey===key&&G.dualTip(G.brush.dual)===set.tips[1];},saved),'saved dual selection resolves the same alpha after library reload');
 await p.evaluate(()=>{const G=__gs,key=G.brush.dual.tipKey;G.applyPreset(G.library[0].presets[0]);G.brush.dual={on:true,tipKey:key,size:20,spacing:150,scatter:80,count:1,amount:100};G.showPanel('tool');G.buildBrushPanel();G.removeSet(G.library.find(s=>s.id==='dual-test'));});
 ok(await p.locator('#bDualSelected').textContent()==='Tip unavailable — choose a brush'&&await p.locator('#bDualTip [aria-pressed="true"]').count()===0,'removed brushes disappear immediately and unavailable selection is explicit');
 const roundName=await p.evaluate(()=>__gs.library.flatMap(s=>s.presets).find(p=>!p.tip).name);await p.locator('#bDualSearch').fill(roundName);await p.locator('#bDualTip button').first().click();
 ok(await p.evaluate(()=>!!__gs.dualTip(__gs.brush.dual)?.alpha),'procedural round brushes are available as secondary alphas');
 // Sample actual user input and committed undo, then exercise the actual toggle.
 await p.evaluate(()=>{const G=__gs;G.newDoc(300,160);G.cmdAddLayer();G.brush.pSize=false;G.brush.smoothing=0;G.brush.size=32;G.ui.fg=[0,0,0];G.brush.dual={on:true,tipKey:'b:sponge',size:20,spacing:150,scatter:80,count:1,amount:100};G.buildBrushPanel();});
 const drag=async()=>{const q=await p.evaluate(()=>{const r=document.getElementById('gl').getBoundingClientRect(),v=__gs.view;return {x:r.x+v.x+40*v.zoom,y:r.y+v.y+80*v.zoom,end:r.x+v.x+260*v.zoom};});await p.mouse.move(q.x,q.y);await p.mouse.down();await p.mouse.move(q.end,q.y,{steps:12});await p.mouse.up();};
 await drag();const pixels=()=>p.evaluate(()=>Array.from(__gs.readRGBA8(__gs.doc.active.target)));const drawn=await pixels();await p.evaluate(()=>__gs.undo());const undone=await pixels();await p.evaluate(()=>__gs.redo());const redone=await pixels();
 ok(drawn.some((n,i)=>i%4===3&&n>0)&&undone.every(n=>n===0)&&drawn.every((n,i)=>n===redone[i]),'real dual-brush pointer strokes retain exact undo and redo');
 await p.locator('#bDualOn').uncheck();await p.evaluate(()=>__gs.cmdAddLayer());await drag();ok(await p.evaluate(()=>__gs.readRGBA8(__gs.doc.active.target).some((n,i)=>i%4===3&&n>0)),'painting works after turning dual brush off with the actual checkbox');
 const cadence=await p.evaluate(()=>{const G=__gs;G.perf.on=false;G.perfCadence.length=0;const now=performance.now();for(let i=0;i<=120;i++)G.perfFrame(now-1000+i*1000/120,0,0,0);G.perfUpdate();const rate=G.perfStatusRate(now);G.perfCadence.length=0;G.perfCadence.push(now);const slow=G.perfStatusRate(now);G.perfCadence.length=0;G.perfUpdate();return {rate,slow,text:document.getElementById('stFps').textContent};});
 ok(cadence.rate===120&&cadence.slow===1&&cadence.text==='Idle','FPS accounting supports 1–120 Hz, runs without diagnostics and reports idle without continuous redraws');
 await p.setViewportSize({width:1440,height:1100});await p.evaluate(()=>{const G=__gs;G.showPanel('tool');document.getElementById('bDualOn').click();G.dkMove('brushes',{float:{x:500,y:30}});const f=G.dk.L.floats.at(-1);f.w=410;f.h=1020;G.dkApply(G.dk.L,true);document.getElementById('dualBox').scrollIntoView({block:'end'});});
 fs.mkdirSync(path.resolve(__dirname,'../../out/dual-brush-feedback'),{recursive:true});await p.locator('#dualBox').screenshot({path:path.resolve(__dirname,'../../out/dual-brush-feedback/picker.png')});
 await p.evaluate(async()=>{const G=__gs;G.setMode('p3d',true);G.p3.savedAt=G.p3Sig();await G.p3NewProject(128,{modelKey:'plane'});G.useModel(G.primMesh('plane',1));Object.assign(G.v3.cam,{yaw:0,pitch:0,dist:3.2,tx:0,ty:0,tz:0});Object.assign(G.v3s(),{disp:0,uvs:1,paintAlign:'camera'});G.v3.paintOn=true;G.setView('base');G.setTool('brush');G.setFG([.8,.2,.1]);Object.assign(G.brush,{size:60,opacity:.8,flow:1,spacing:.01,hardness:1,pSize:false,pOpacity:false,pFlow:false,tip:null,grain:0,smoothing:0,lazy:0,hueJitter:0,satJitter:0,valJitter:0,pickup:0,wet:0,glaze:0,edgeSat:0,dual:{on:true,tipKey:'b:sponge',size:20,spacing:150,scatter:80,count:1,amount:100}});G.composite();G.v3.mapsDirty=true;G.v3Refresh();});
 const draw3D=async enabled=>{const before=await p.evaluate(enabled=>{__gs.dualWork.enabled=enabled;return __gs.dualWork.batches;},enabled),r=await p.locator('#v3Hit').boundingBox(),y=r.y+r.height/2;await p.mouse.move(r.x+r.width*.4,y);await p.mouse.down();await p.mouse.move(r.x+r.width*.6,y,{steps:12});await p.mouse.up();return p.evaluate(before=>{const G=__gs,t=G.mapT(G.doc.active,'base');return {pixels:Array.from(G.captureRegionNow(t,0,0,t.w,t.h).data),batches:G.dualWork.batches-before,error:G.gl.getError()};},before);};
 const slow3=await draw3D(false);await p.evaluate(()=>__gs.undo());const fast3=await draw3D(true);
 ok(fast3.batches>0&&slow3.pixels.some((n,i)=>i%4===3&&n>0)&&slow3.pixels.every((n,i)=>n===fast3.pixels[i]),'real projected 3D strokes retain exact pixels with fewer submissions');
 ok(fast3.error===0&&slow3.error===0,'projected dual strokes leave no graphics errors');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
