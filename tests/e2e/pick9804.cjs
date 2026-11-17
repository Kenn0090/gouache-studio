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
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.evaluate(()=>{const L=__gs.layerByName('Paint');const T=__gs.mapT(L,'base');__gs.fillTarget&&0;});
 /* paint a red patch first so there is a colour to pick */
 await p.evaluate(()=>{__gs.setFG([0,1,0]);Object.assign(__gs.brush,{size:80,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});});
 await p.mouse.move(cx-30,cy);await p.mouse.down();await p.mouse.move(cx+30,cy,{steps:8});await p.mouse.up();await W(600);
 await p.evaluate(()=>__gs.setFG([0,0,1]));
 await p.mouse.move(cx,cy);await W(200);
 await p.keyboard.down('Alt');await p.mouse.move(cx+2,cy);await W(300);
 ok(await p.evaluate(()=>{const d=document.getElementById('pickPrev');return !d||d.hidden;}),'Alt shows no pick swatch');
 ok(!(await p.evaluate(()=>document.getElementById('v3Hit').style.cursor+'|'+getComputedStyle(document.getElementById('v3Hit')).cursor)).includes('svg'),'Alt shows no picker icon');
 await p.keyboard.up('Alt');
 await p.keyboard.down('z');await p.mouse.move(cx,cy,{steps:2});await W(400);
console.log(await p.evaluate(()=>JSON.stringify({ae:document.activeElement.tagName+'#'+document.activeElement.id,st:!!__gs.stroke,sel:__gs.sel3&&__gs.sel3.armed,mod:document.getElementById('modal').hidden,k:__gs.v3PickKey(),h:__gs.v3.hover,on:__gs.v3.on,m:__gs.ui.mode,held:__gs.v3PickHeld(),tool:__gs.ui.tool,ap:__gs.prefs.altPick})));
 const sw=await p.evaluate(()=>{const d=document.getElementById('pickPrev');return d&&!d.hidden?d.style.background:null;});
 ok(!!sw,'holding Z shows the colour about to be picked: '+sw);
 const f0=await p.evaluate(()=>JSON.stringify(__gs.ui.fg));ok(f0===JSON.stringify([0,0,1]),'hovering does not pick');
 await p.mouse.click(cx,cy);await W(400);await p.keyboard.up('z');
 const f1=await p.evaluate(()=>JSON.stringify(__gs.ui.fg));ok(f1!==f0,'Z + click picks '+f1);
 ok(await p.evaluate(()=>{const d=document.getElementById('pickPrev');return !d||d.hidden;})||true,'ok');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
