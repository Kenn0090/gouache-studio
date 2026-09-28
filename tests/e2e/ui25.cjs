/* 0.25: undo default, big brushes, each tool its own brush, mirror in the 3D bar, Stencils tab, shortcut groups, welcome screen, 3D Paint layer to Paint and back. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.removeItem('gs.heal');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 ok(await p.evaluate(()=>__gs.undoSteps()===30),'fewer undo steps by default (30 in the browser, 50 in the desktop app)');
 /* big brushes */
 await p.evaluate(()=>{__gs.setTool('brush');});await p.mouse.move(700,500);for(let i=0;i<80;i++)await p.keyboard.press(']');
 let sz=await p.evaluate(()=>__gs.brush.size);ok(sz===5000,'] grows the brush up to 5000 px '+sz);
 await p.evaluate(()=>{__gs.prefs.maxBrush=20000;});for(let i=0;i<20;i++)await p.keyboard.press(']');sz=await p.evaluate(()=>__gs.brush.size);ok(sz>5000,'…and past it with the Preferences setting '+sz);
 await p.evaluate(()=>{__gs.prefs.maxBrush=0;});
 /* each tool its own brush */
 await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=30;__gs.brush.opacity=.5;__gs.setTool('erase');__gs.brush.size=80;__gs.brush.opacity=1;__gs.setTool('brush');});
 let bs=await p.evaluate(()=>[__gs.brush.size,__gs.brush.opacity]);ok(bs[0]===30&&bs[1]===.5,'the brush keeps its own size and opacity '+bs);
 bs=await p.evaluate(()=>{__gs.setTool('erase');return [__gs.brush.size,__gs.brush.opacity];});ok(bs[0]===80&&bs[1]===1,'…and the eraser its own '+bs);
 await p.evaluate(()=>__gs.setTool('brush'));await p.evaluate(()=>__gs.showPanel('tool'));await W(200);
 await p.click('label[for=bShareTip]');await W(100);
 bs=await p.evaluate(()=>{__gs.brush.angle=40;__gs.setTool('erase');return [__gs.brush.angle,__gs.brush.size];});ok(bs[0]===40&&bs[1]===80,'All tools share the brush tip: the tip goes along, the size stays per tool '+bs);
 await p.evaluate(()=>__gs.setTool('brush'));await p.click('label[for=bShareTip]');
 ok(await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('gs.toolBrush'));return s.slots.erase.size===80;}),'each tool’s brush is remembered for next time');
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+" FAILED":"ALL PASSED");process.exit(fails?1:0);
})();
