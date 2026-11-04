/* 0.95: the Line blend brush: a strip from the press point to the pen, a gradient between the colours under its two ends. */
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
 const box=await p.locator('#gl').boundingBox();
 ok(await p.evaluate(()=>!!__gs.PRESETS.find(x=>x.name==='Line blend')),'there is a Line blend preset');
 /* a red patch left, a blue patch right, with the normal brush */
 const dab=async(x,y,rgb)=>{await p.evaluate(c=>{__gs.setFG(c);__gs.brush.lineBlend=false;__gs.brush.size=140;__gs.brush.hardness=1;__gs.brush.flow=1;__gs.brush.opacity=1;__gs.brush.smoothing=0;__gs.brush.correction=0;__gs.brush.lazy=0;__gs.setTool('brush');},rgb);
   await p.mouse.move(box.x+x,box.y+y);await p.mouse.down();await p.mouse.move(box.x+x+4,box.y+y+2,{steps:2});await p.mouse.up();await p.waitForTimeout(150);};
 await dab(250,300,[1,0,0]);await dab(650,300,[0,0,1]);
 const px=(x,y)=>p.evaluate(([sx,sy])=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,v=__gs.view,ix=Math.round((sx-v.x)/v.zoom),iy=Math.round((sy-v.y)/v.zoom);return {ix,iy,c:Array.from(d.slice((__gs.doc.h-1-iy>=0?(iy*W+ix)*4:0),(iy*W+ix)*4+4))};},[x,y]);
 const left=await px(250,300),right=await px(650,300);console.log('red',JSON.stringify(left.c),'blue',JSON.stringify(right.c));
 ok(left.c[0]>200&&left.c[2]<60,'left patch is red');ok(right.c[2]>200&&right.c[0]<60,'right patch is blue');
 /* line blend across, in a clear band below the patches */
 await p.evaluate(()=>{const pr=__gs.PRESETS.find(x=>x.name==='Line blend');__gs.applyPreset(pr);__gs.brush.size=60;__gs.brush.sampleAll=false;});await p.waitForTimeout(200);
 await p.mouse.move(box.x+250,box.y+300);await p.mouse.down();await p.mouse.move(box.x+450,box.y+300,{steps:10});await p.mouse.move(box.x+650,box.y+300,{steps:10});
 const live=await px(450,300);console.log('live mid',JSON.stringify(live.c));
 await p.mouse.up();await p.waitForTimeout(300);
 const q1=await px(330,300),mid=await px(450,300),q3=await px(570,300);console.log('strip',JSON.stringify([q1.c,mid.c,q3.c]));
 ok(q1.c[0]>mid.c[0]&&mid.c[0]>q3.c[0]-1&&q1.c[2]<mid.c[2]&&mid.c[2]<q3.c[2],'red fades to blue along the strip: '+JSON.stringify([q1.c.slice(0,3),mid.c.slice(0,3),q3.c.slice(0,3)]));
 ok(mid.c[0]>60&&mid.c[2]>60,'the middle is a mix of both');
 /* undo takes it back */
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);
 const un=await px(450,300);ok(un.c[3]<30||(un.c[0]<30&&un.c[2]<30)||un.c[0]!==mid.c[0],'undo removes the strip '+JSON.stringify(un.c));
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('|'));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
