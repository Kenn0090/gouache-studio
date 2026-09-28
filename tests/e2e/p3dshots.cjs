/* Guide picture for 3D Paint (docs/wiki/images/p3d-tab.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require("path").resolve(__dirname,"../../docs/wiki/images")+"/";
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Base material');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});await p.click('#p3dBody .p3mat:has-text("Painted metal")');await W(400);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);Object.assign(__gs.v3.cam,{yaw:.6,pitch:.35});__gs.v3.dirty=true;});
 await p.click('#mir3_x');await W(200);
 await p.fill('#hex','#e8b040');await p.press('#hex','Enter');await p.evaluate(()=>{document.activeElement.blur();Object.assign(__gs.brush,{size:26,hardness:.9,smoothing:0,pSize:false,tip:null});});
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 for(const [a,b,c,d] of [[-40,-80,120,-60],[-20,10,140,40],[30,90,110,120]]){await p.mouse.move(cx+a,cy+b);await p.mouse.down();await p.mouse.move(cx+c,cy+d,{steps:14});await p.mouse.up();await W(300);}
 await p.mouse.move(cx+300,cy+250);await W(800);await p.screenshot({path:OUT+'p3d-tab.png'});console.log('shot p3d-tab');
 console.log(errs.length?'ERR '+errs[0]:'ALL PASSED');await b.close();})();
