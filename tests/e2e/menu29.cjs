/* 0.29: the File menu follows the section */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);

 const fileItems=async()=>{await p.click('#menus button:text-is("File")');const t=await p.evaluate(()=>[...document.querySelectorAll('#menuPop .mi')].map(b=>b.textContent));await p.keyboard.press('Escape');await p.evaluate(()=>document.body.click());return t.join('|');};
 let f=await fileItems();ok(/Save as/.test(f)&&!/sprite sheet/.test(f)&&/Export as PSD/.test(f),'Paint: no animation items, PSD is there');
 await p.evaluate(()=>__gs.setMode('anim',true));await W(500);f=await fileItems();ok(/sprite sheet/.test(f),'Animation: sprite sheet items appear');
 await p.evaluate(()=>__gs.setMode('bake',true));await W(800);f=await fileItems();ok(/New document/.test(f)&&!/Export as PSD/.test(f)&&!/Place image/.test(f),'Bake: no PSD or Place image');
 await p.evaluate(()=>__gs.setMode('paint',true));await W(500);
 console.log(errs.join('\n'));console.log(fails?'FAILS '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);})();
