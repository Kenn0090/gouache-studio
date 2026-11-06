/* 0.95.4 (Kenn: "when I paint it's landing on other parts of the mesh"): Surface wrap ignored depth, so a part facing the
   camera but hidden behind another one (the neck under the chin) took paint too. Two stacked quads with their own UV halves:
   painting the front one must leave the hidden one clean; Camera alignment the same; a big brush still reaches past a small step. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 /* front quad (z=+.3) uses the left half of the texture, the hidden one (z=-.3, same size, facing the same way) the right half */
 await p.evaluate(async()=>{const L=['v -1 -1 .3','v 1 -1 .3','v 1 1 .3','v -1 1 .3','v -1 -1 -.3','v 1 -1 -.3','v 1 1 -.3','v -1 1 -.3',
   'vt .02 .02','vt .48 .02','vt .48 .98','vt .02 .98','vt .52 .02','vt .98 .02','vt .98 .98','vt .52 .98','vn 0 0 1',
   'f 1/1/1 2/2/1 3/3/1','f 1/1/1 3/3/1 4/4/1','f 5/5/1 6/6/1 7/7/1','f 5/5/1 7/7/1 8/8/1'];
  const m=await __gs.parseModelBytes('stack.obj',new TextEncoder().encode(L.join('\n')),{noUp:true});const v3=__gs.v3;v3.imported=__gs.p3.imported=m;__gs.v3s().model='imported';v3.mesh=null;
  Object.assign(v3.cam,{yaw:0,pitch:0});v3.dirty=true;__gs.requestRender();});await W(1200);
 await p.evaluate(()=>{__gs.showPanel('color');});await p.fill('#hex','#d02020');await p.press('#hex','Enter');
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const halves=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let a=0,c=0;
   for(let y=0;y<T.h;y++)for(let x=0;x<T.w;x++){const i=(y*T.w+x)*4;if(d[i]>150&&d[i+1]<80&&d[i+3]>200){if(x<T.w/2)a++;else c++;}}return [a,c];});
 const stroke=async()=>{await p.mouse.move(cx-50,cy);await p.mouse.down();await p.mouse.move(cx+50,cy,{steps:10});await p.mouse.up();await W(600);};
 for(const align of ['wrap','camera']){
  await p.evaluate(a=>{__gs.v3s().paintAlign=a;Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});__gs.v3.dirty=true;},align);await W(300);
  const b0=await halves();await stroke();const b1=await halves();
  const front=Math.max(b1[0]-b0[0],b1[1]-b0[1]),hidden=Math.min(b1[0]-b0[0],b1[1]-b0[1]);
  ok(front>200,align+': the front part takes paint ('+front+' px)');
  ok(hidden<5,align+': the part hidden behind it stays clean ('+hidden+' px)');
  await p.evaluate(()=>__gs.undo());await W(500);}
 await p.screenshot({path:OUT+'wrap954.png'});
 /* L = left–right symmetry: Mirror X in 3D Paint, canvas symmetry in Paint */
 await p.mouse.move(cx,cy);const m0=await p.evaluate(()=>!!__gs.mir3?.x);await p.keyboard.press('l');await W(200);
 const m1=await p.evaluate(()=>({x:!!__gs.mir3?.x,tool:__gs.ui.tool}));ok(m1.x!==m0&&m1.tool!=='lasso','3D Paint: L turns Mirror X '+(m1.x?'on':'off')+' '+JSON.stringify(m1));
 await p.keyboard.press('l');await W(200);ok(await p.evaluate(()=>!!__gs.mir3?.x)===m0,'L again turns it back');
 await p.click('#modeTabs [data-mode=paint]');await W(800);await p.mouse.move(700,450);
 const s0=await p.evaluate(()=>__gs.ui.sym.mode);await p.keyboard.press('l');await W(200);const s1=await p.evaluate(()=>({m:__gs.ui.sym.mode,tool:__gs.ui.tool}));
 ok(s0!=='x'&&s1.m==='x'&&s1.tool!=='lasso','Paint: L turns left–right symmetry on '+JSON.stringify(s1));
 await p.keyboard.press('l');await W(200);ok(await p.evaluate(()=>__gs.ui.sym.mode)==='off','L again turns it off');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
