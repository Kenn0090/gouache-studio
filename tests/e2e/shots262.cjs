/* wiki screenshot for 0.26.2: document tabs */
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
 await p.evaluate(()=>__gs.EXAMPLES[0].run());await W(3000);
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.selectOption('#modal select[aria-label=Preset]',{label:'Square post'});await p.click('#dlgOk');await W(600);
 await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=60;__gs.setFG([.3,.5,.9]);});
 {const box=await p.locator('#gl').boundingBox();await p.mouse.move(box.x+300,box.y+300);await p.mouse.down();await p.mouse.move(box.x+700,box.y+420,{steps:10});await p.mouse.up();await W(400);}
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.selectOption('#modal select[aria-label=Preset]',{label:'A4'});await p.click('#dlgOk');await W(600);
 await p.locator('#docTabs .dtab').nth(1).click();await W(500);
 await p.screenshot({path:IMG+'doc-tabs.png',clip:{x:0,y:0,width:1140,height:400}});
 console.log(errs.join('\n'));console.log('shots done');await b.close();})();
