/* wiki screenshots for 0.26.1: rulers and guides, colour wheel, New document presets, layer locks */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const IMG=require('path').resolve(__dirname,'../../docs/wiki/images')+'/';
 await p.evaluate(()=>{localStorage.removeItem('gs.rulers');__gs.EXAMPLES[0].run();});await W(3000);
 await p.keyboard.press('Control+r');await W(200);
 await p.evaluate(()=>{__gs.doc.guides=[{o:'v',p:512},{o:'h',p:300}];});await W(400);
 await p.screenshot({path:IMG+'rulers.png',clip:{x:40,y:70,width:1100,height:600}});
 await p.evaluate(()=>{__gs.showPanel('layers');});await p.click('#lock_pos');await W(300);
 await p.locator('section[aria-labelledby="hLayers"]').screenshot({path:IMG+'layer-locks.png'});await p.click('#lock_pos');
 await p.evaluate(()=>{__gs.showPanel('color');__gs.setFG([.25,.55,.85]);});await p.click('#cmTab_wheel');await W(500);
 await p.locator('section[aria-labelledby="hColor"]').screenshot({path:IMG+'color-wheel.png'});
 await p.click('#cmTab_sliders');await p.click('#cmSliders .cmmodels button:has-text("CMYK")');await W(300);
 await p.locator('section[aria-labelledby="hColor"]').screenshot({path:IMG+'color-sliders.png'});await p.click('#cmTab_square');
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.selectOption('#modal select[aria-label=Preset]',{label:'A4'});await W(200);
 await p.locator('#modal .dialog').screenshot({path:IMG+'new-document.png'});await p.click('#dlgCancel');
 console.log(errs.join('\n'));console.log('shots done');await b.close();})();
