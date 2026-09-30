/* 0.39: Classic/Modern look, Beginner/Full level, launch screen */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});

 await p.addInitScript(()=>{try{localStorage.setItem('gs.matOpen','all');}catch(e){}});
 const url='file://'+require('path').resolve(__dirname,'../../dist-web/index.html');
 /* first launch: the launch screen asks (the debug flag skips it, so ask for it directly) */
 await p.goto(url+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,null,'t',false));await W(300);
 ok(await p.evaluate(()=>document.querySelectorAll('#tools .tool').length>10&&[...document.querySelectorAll('#tools .tool')].every(b=>b.offsetParent!==null)),'Full level shows all tools');
 await p.evaluate(()=>__gs.showSetup(false));await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#setup #suLook_classic')&&!!document.querySelector('#suLevel_beginner')&&!!document.querySelector('#suStart_p3d')&&!!document.querySelector('#suGo')),'the launch screen has Look, Level and Start in');
 await p.click('#suLook_classic');await p.click('#suLevel_beginner');await p.click('#suGo');await W(700);
 ok(await p.evaluate(()=>document.body.classList.contains('sharp')&&document.body.classList.contains('lv-beginner')),'Classic look and Beginner level apply');
 const vis=await p.evaluate(()=>[...document.querySelectorAll('#tools .tool')].filter(b=>b.offsetParent!==null).map(b=>b.dataset.tool));
 ok(vis.length<=7&&vis.includes('brush')&&!vis.includes('clone')&&!vis.includes('cage'),'Beginner hides the less-used tools '+vis.join(','));
 ok(await p.evaluate(()=>!!document.querySelector('#gsCard')),'a Getting started card shows');
 await p.click('#gsFull');await W(400);
 ok(await p.evaluate(()=>!document.body.classList.contains('lv-beginner')&&!document.querySelector('#gsCard')&&[...document.querySelectorAll('#tools .tool')].filter(b=>b.offsetParent!==null).length>10),'Show everything switches to Full');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
