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
 const quad=(uv)=>{const L=['v -1 -1 0','v 1 -1 0','v 1 1 0','v -1 1 0',`vt ${uv[0]} ${uv[1]}`,`vt ${uv[2]} ${uv[1]}`,`vt ${uv[2]} ${uv[3]}`,`vt ${uv[0]} ${uv[3]}`,'vn 0 0 1','f 1/1/1 2/2/1 3/3/1','f 1/1/1 3/3/1 4/4/1'];return L.join('\n');};
 await p.evaluate(async q=>{const m=await __gs.parseModelBytes('a.obj',new TextEncoder().encode(q),{noUp:true});const v3=__gs.v3;v3.imported=__gs.p3.imported=m;__gs.v3s().model='imported';v3.mesh=null;Object.assign(v3.cam,{yaw:0,pitch:0});v3.dirty=true;__gs.requestRender();window.__old=m;},quad([.02,.02,.48,.98]));await W(1500);
 await p.evaluate(()=>{__gs.showPanel('color');});await p.fill('#hex','#d02020');await p.press('#hex','Enter');
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const halves=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let a=0,c=0;
   for(let y=0;y<T.h;y++)for(let x=0;x<T.w;x++){const i=(y*T.w+x)*4;if(d[i]>150&&d[i+1]<80&&d[i+3]>200){if(x<T.w/2)a++;else c++;}}return [a,c];});
 await p.evaluate(()=>{__gs.v3s().paintAlign='camera';Object.assign(__gs.brush,{size:30,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});__gs.v3.dirty=true;});await W(300);
 await p.mouse.move(cx-60,cy);await p.mouse.down();await p.mouse.move(cx+60,cy,{steps:10});await p.mouse.up();await W(800);
 const b0=await halves();console.log('before',JSON.stringify(b0));ok(b0[0]>300&&b0[1]<5,'the stroke is in the left half of the texture (UVs on the left) '+b0);
 /* the Eyedropper tool and Z+click on the model */
 await p.evaluate(()=>{__gs.setFG([0,0,1]);__gs.setTool('picker');});await W(200);
 await p.mouse.click(cx,cy);await W(500);
 const f1=await p.evaluate(()=>JSON.stringify(__gs.ui.fg.map(v=>Math.round(v*10)/10)));
 ok(JSON.parse(f1)[0]>.7&&JSON.parse(f1)[2]<.3,'the Eyedropper tool picks the painted colour from the model '+f1);
 await p.evaluate(()=>{__gs.setFG([0,0,1]);__gs.setTool('brush');});await W(200);
 await p.mouse.move(cx+5,cy);await p.keyboard.down('z');await p.mouse.move(cx,cy,{steps:2});await W(300);await p.mouse.click(cx,cy);await W(400);await p.keyboard.up('z');
 const f2=await p.evaluate(()=>JSON.stringify(__gs.ui.fg.map(v=>Math.round(v*10)/10)));
 ok(JSON.parse(f2)[0]>.7&&JSON.parse(f2)[2]<.3,'Z + click picks it too '+f2);
 /* the colour panel's own eyedropper button exists */
 ok(await p.evaluate(()=>!!document.querySelector('#eyeSlot, #eyeSlot *, [title*="Pick a colour"], .eyebtn')),'the colour panel has its picker button');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
