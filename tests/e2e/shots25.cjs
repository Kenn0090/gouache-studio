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
 await b.close();})();
