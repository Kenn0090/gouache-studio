const {chromium}=require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(pts)=>{const a=await scr(...pts[0]);await p.mouse.move(a[0],a[1]);await p.mouse.down();for(const q of pts.slice(1)){const c=await scr(...q);await p.mouse.move(c[0],c[1],{steps:12});}await p.mouse.up();await p.waitForTimeout(250);};
 await p.evaluate(()=>__gs.newDoc(500,300,8,[1,1,1],'viz',false));await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 for(const [i,[g,e]] of [[0,0],[.85,.6]].entries()){
  await p.evaluate(([g,e])=>{__gs.setTool('brush');const pr=__gs.library.flatMap(s=>s.presets).find(x=>x.name==='Watercolour glaze');__gs.applyPreset(pr);Object.assign(__gs.brush,{glaze:g,edgeSat:e,size:70,opacity:.7});__gs.ui.fg=[.12,.35,.75];},[g,e]);
  const x0=20+i*250;await drag([[x0,40],[x0+120,150],[x0+30,260]]);await drag([[x0+100,60],[x0+60,200]]);
  await p.evaluate(()=>{__gs.ui.fg=[.85,.2,.25];});await drag([[x0+20,200],[x0+160,230]]);
 }
 await p.evaluate(()=>{__gs.view.zoom=1;__gs.view.x=10;__gs.view.y=10;__gs.drawView&&__gs.drawView();});await p.waitForTimeout(500);await p.screenshot({path:'out/viz68.png',clip:{x:box.x,y:box.y,width:540,height:330}});await b.close();})();
