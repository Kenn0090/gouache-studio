/* Guide pictures for 0.25 (docs/wiki/images/welcome.png, keyboard-shortcuts.png, mirror-bar.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require("path").resolve(__dirname,"../../docs/wiki/images")+"/";
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const W=ms=>p.waitForTimeout(ms||200);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug&welcome');await W(3500);
 await p.locator('#welcome .wcard').screenshot({path:OUT+'welcome.png'});console.log('shot welcome');
 await p.click('#wEx_cobble');await W(1500);
 await p.evaluate(()=>__gs.act('keys'));await W(300);await p.click('.kbcat[data-cat="tools-paint"]');await W(200);
 await p.locator('#modal .dialog').screenshot({path:OUT+'keyboard-shortcuts.png'});console.log('shot keys');await p.click('#dlgCancel');
 await p.click('#modeTabs [data-mode=p3d]');await W(1800);await p.click('#mir3_x');await p.click('#mir3More');await W(600);
 const bar=await p.locator('.v3bar').boundingBox();await p.screenshot({path:OUT+'mirror-bar.png',clip:{x:bar.x,y:bar.y,width:Math.min(900,bar.width),height:300}});console.log('shot mirror');
 /* shapes: corner bevel with segments, rounded whole shape (material view) */
 await p.click('#modeTabs [data-mode=paint]');await W(1200);
 await p.evaluate(()=>{__gs.newDoc(600,240,8,[.82,.8,.76],'shapes',false);});await W(400);
 await p.evaluate(()=>{__gs.setTool('shape');__gs.act('fit');});await W(300);
 const box=await p.locator('#gl').boundingBox(),scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:6});await p.mouse.up();await W(200);};
 const mk=async(kind,r,cb,bev)=>{await p.click('#brushBody .segb:text-is("'+kind+'")');await drag(...r);await p.evaluate(([cb,bev])=>{const L=__gs.doc.active;L.shape.fill=[.25,.45,.8];L.shape.cb=cb;L.shape.bevel=bev;__gs.renderShape(L);},[cb,bev]);};
 await mk('Rectangle',[30,40,190,200],{size:40,seg:1},{on:true,profile:'round',size:18,depth:.8,dir:'up',seg:3,full:false});
 await mk('Rectangle',[220,40,380,200],{size:40,seg:10},{on:true,profile:'round',size:18,depth:.8,dir:'up',seg:0,full:true});
 await mk('Star',[410,30,580,210],{size:10,seg:6},{on:true,profile:'round',size:18,depth:.8,dir:'up',seg:0,full:true});
 await p.evaluate(()=>{__gs.doc.view='material';__gs.refreshMapsUI&&__gs.refreshMapsUI();__gs.requestRender(true);});await W(800);
 {const a=await scr(0,0),c=await scr(600,240);await p.mouse.move(5,900);await p.screenshot({path:OUT+'shape-bevel.png',clip:{x:a[0],y:a[1],width:c[0]-a[0],height:c[1]-a[1]}});console.log('shot shape bevel');}
 await b.close();})();
