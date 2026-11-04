/* 0.95: the Blend tool has Soft blend (melts colours together in place) and Wet smear (drags paint along, with streaks). */
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
 await p.evaluate(()=>__gs.closeWelcome());await p.waitForTimeout(300);
 const box=await p.locator('#gl').boundingBox();
 ok(await p.evaluate(()=>['Soft blend','Wet smear'].every(n=>!!__gs.PRESETS.find(x=>x.name===n))),'Soft blend and Wet smear presets exist');
 const patches=async()=>{for(const [x,c] of [[250,[1,0,0]],[390,[0,0,1]]]){await p.evaluate(c=>{__gs.setFG(c);__gs.brush.lineBlend=false;__gs.brush.tip=null;__gs.brush.size=140;__gs.brush.hardness=1;__gs.brush.flow=1;__gs.brush.opacity=1;__gs.brush.smoothing=0;__gs.brush.correction=0;__gs.brush.lazy=0;__gs.setTool('brush');},c);
   await p.mouse.move(box.x+x,box.y+300);await p.mouse.down();await p.mouse.move(box.x+x,box.y+330,{steps:6});await p.mouse.up();await p.waitForTimeout(500);}};
 const px=(x,y)=>p.evaluate(([sx,sy])=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,v=__gs.view,ix=Math.round((sx-v.x)/v.zoom),iy=Math.round((sy-v.y)/v.zoom);return Array.from(d.slice((iy*W+ix)*4,(iy*W+ix)*4+4));},[x,y]);
 await patches();
 const row=await p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,v=__gs.view,iy=Math.round((320)/v.zoom-v.y/v.zoom);let lastRed=-1,firstBlue=-1;for(let x=0;x<W;x++){const r=d[(iy*W+x)*4],bl=d[(iy*W+x)*4+2],g=d[(iy*W+x)*4+1];if(r>200&&bl<50&&g<50)lastRed=x;if(bl>200&&r<50&&g<50&&firstBlue<0)firstBlue=x;}return {lastRed,firstBlue,zoom:v.zoom,vx:v.x};});
 console.log('row',JSON.stringify(row));const EX=Math.round(((row.lastRed+row.firstBlue)/2)*row.zoom+row.vx);
 const before={edge:await px(EX,320),far:await px(EX-110,320),farB:await px(EX+110,320)};console.log('before',JSON.stringify(before),'edge x',EX);
 /* soft blend across the join */
 await p.evaluate(()=>{__gs.applyPreset(__gs.PRESETS.find(x=>x.name==='Soft blend'));__gs.brush.size=70;__gs.brush.strength=.9;__gs.brush.spacing=.05;});await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.brush.blendMode==='soft'),'Soft blend sets the soft mode');
 await p.mouse.move(box.x+EX,box.y+300);await p.mouse.down();for(let k=0;k<3;k++){await p.mouse.move(box.x+EX,box.y+345,{steps:8});await p.mouse.move(box.x+EX,box.y+300,{steps:8});}await p.mouse.up();await p.waitForTimeout(250);
 const soft={edge:await px(EX,320),far:await px(EX-110,320),farB:await px(EX+110,320),nearL:await px(EX-20,320),nearR:await px(EX+20,320)};console.log('soft',JSON.stringify(soft));
 ok(row.lastRed>0&&row.firstBlue>row.lastRed,'a red patch and a blue patch with a hard edge '+JSON.stringify(row));
 ok(soft.edge[0]>50&&soft.edge[2]>50,'the join is now a mix of red and blue '+JSON.stringify(soft.edge));
 ok(soft.far[0]>240&&soft.far[2]<15&&soft.farB[2]>240&&soft.farB[0]<15,'far from the brush nothing changed');
 /* start again; wet smear drags red into the blue */
 await p.keyboard.press('Control+z');await p.waitForTimeout(250);
 await p.evaluate(()=>{__gs.applyPreset(__gs.PRESETS.find(x=>x.name==='Wet smear'));__gs.brush.size=60;__gs.brush.strength=1;});await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.brush.blendMode==='smear'),'Wet smear sets the smear mode');
 await p.mouse.move(box.x+EX-120,box.y+310);await p.mouse.down();await p.mouse.move(box.x+EX+140,box.y+310,{steps:25});await p.mouse.up();await p.waitForTimeout(250);
 const sm={a:await px(EX+18,310),b:await px(EX+30,310)};console.log('smear',JSON.stringify(sm));
 ok(sm.a[0]>40||sm.b[0]>40||sm.a[1]>40||sm.b[1]>40,'the smear drags red into the blue area '+JSON.stringify(sm));
 /* the panel has the mode switch */
 await p.evaluate(()=>{__gs.setTool('smudge');__gs.showPanel('brushes');});await p.waitForTimeout(300);
 ok(await p.locator('[aria-label="Blend mode"]').count()===1,'the Blend panel has the mode switch');
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('|'));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
