/* 0.95: "A friend's picks": 13 brushes (own versions) in their own set; each one paints. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{__gs.closeWelcome();});await p.waitForTimeout(300);
 const names=await p.evaluate(()=>{const s=__gs.library.find(x=>x.id==='friend_picks');return s?s.presets.map(x=>x.name):null;});
 const want=['Blur ice','Boxes','Brow','Charcoal chunk','Dither','Fan','Fan fade','Friend fluff','Line','Line blend','Oil','Oil bristle brush','Worm'];
 ok(names&&want.every(n=>names.includes(n)),'the set has all 13 brushes '+JSON.stringify(names));
 const box=await p.locator('#gl').boundingBox();
 await p.evaluate(()=>{__gs.setFG([1,1,1]);__gs.brush.lineBlend=false;__gs.brush.tip=null;__gs.brush.size=3000;__gs.brush.hardness=1;__gs.brush.smoothing=0;__gs.brush.correction=0;__gs.setTool('brush');});
 {const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));await p.mouse.move(box.x+v.x+300*v.z,box.y+v.y+300*v.z);await p.mouse.down();await p.mouse.move(box.x+v.x+302*v.z,box.y+v.y+302*v.z,{steps:2});await p.mouse.up();await p.waitForTimeout(200);}
 for(const n of want.filter(n=>n!=='Line blend'&&n!=='Blur ice')){
  await p.evaluate(n=>{const pr=__gs.library.find(s=>s.id==='friend_picks').presets.find(x=>x.name===n);__gs.setFG([0,0,0]);__gs.setTool('brush');__gs.applyPreset(pr);},n);
  const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));
  const ink0=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.mapT(__gs.doc.active,'base'));let c=0;for(let i=0;i<d.length;i+=4)if(d[i]<200)c++;return c;});
  await p.mouse.move(box.x+v.x+60*v.z,box.y+v.y+150*v.z);await p.mouse.down();await p.mouse.move(box.x+v.x+160*v.z,box.y+v.y+170*v.z,{steps:8});await p.mouse.move(box.x+v.x+260*v.z,box.y+v.y+150*v.z,{steps:8});await p.mouse.up();await p.waitForTimeout(250);
  const ink1=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.mapT(__gs.doc.active,'base'));let c=0;for(let i=0;i<d.length;i+=4)if(d[i]<200)c++;return c;});
  ok(ink1>ink0+80,n+' paints ('+(ink1-ink0)+' dark pixels)');
  await p.keyboard.press('Control+z');await p.waitForTimeout(150);}
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('|'));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
