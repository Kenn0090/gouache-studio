/* 0.25: splash, welcome screen and examples, File menu (where files are saved), autosave and recovery. */
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
 const W=ms=>p.waitForTimeout(ms||150);
 const URL='file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug&welcome';
 await p.addInitScript(()=>{const t=setInterval(()=>{const s=document.querySelector('#splash .spver');if(s){window.__splash=s.textContent;clearInterval(t);}},5);});
 await p.goto(URL);
 ok(await p.evaluate(()=>/Version \d/.test(window.__splash||'')),'a splash with the version shows while loading');
 await W(2500);
 ok(await p.evaluate(()=>!document.getElementById('splash')&&!!document.querySelector('#welcome #wNew')&&!!document.querySelector('#wEx_cobble')&&!!document.querySelector('#wEx_p3metal')),'then the welcome screen: New, Open, examples');
 ok(await p.evaluate(()=>__gs.doc.name==='Untitled'&&!__gs.allLayers().some(L=>L.name==='Mortar')),'the app starts blank (no cobblestone document)');
 await p.click('#wEx_cobble');await W(1500);
 ok(await p.evaluate(()=>!document.getElementById('welcome')&&__gs.allLayers().some(L=>L.name==='Mortar')),'the Cobblestone tile opens as an example');
 /* where it is saved */
 ok(await p.evaluate(()=>/Not saved/.test(document.getElementById('stFile').textContent)),'the status bar says the file is not saved yet');
 await p.click('#menus button:has-text("File")');await W(200);
 ok(await p.evaluate(()=>/Downloads folder/.test(document.querySelector('#menuPop .mfile').textContent)&&[...document.querySelectorAll('#menuPop .mi')].some(b=>/Welcome screen/.test(b.textContent))),'the File menu says where files go, and has the welcome screen');
 await p.keyboard.press('Escape');await p.mouse.click(5,500);await W(100);
 /* autosave keeps a recovery copy, offered back at the next start */
 await p.evaluate(()=>{__gs.act('addLayer');__gs.doc.active.name='Autosaved layer';});await W(200);
 ok(await p.evaluate(()=>__gs.autosaveNow(true)),'autosave writes a recovery copy when there are changes');
 const rs=await p.evaluate(async()=>(await __gs.asRecoveries()).map(r=>r.kind+':'+r.name));ok(rs.includes('paint:Cobblestone tile'),'…kept in the browser '+rs);
 await p.goto(URL);await W(3200);
 ok(await p.evaluate(()=>!!document.querySelector('#wRecover .wrrow')),'next start: the welcome screen offers the unsaved work');
 await p.click('#wRecover .wrrow button:has-text("Recover")');await W(2000);
 ok(await p.evaluate(()=>__gs.allLayers().some(L=>L.name==='Autosaved layer')),'Recover brings it back');
 await p.evaluate(()=>__gs.showWelcome());await W(300);await p.click('#wEx_p3metal');await W(3000);
 ok(await p.evaluate(()=>__gs.mode==='p3d'&&__gs.allNodes().some(n=>/gun metal/i.test(n.name))&&__gs.allNodes().some(n=>/dust/i.test(n.name))),'the 3D Paint example opens with Gun metal and Dust');
 /* turning the welcome screen off */
 await p.evaluate(()=>__gs.showWelcome());await W(300);await p.click('label[for=wShow]');await W(100);
 ok(await p.evaluate(()=>__gs.prefs.noWelcome===true),'“Show this at start-up” can be turned off');
 await p.keyboard.press('Escape');await W(100);ok(await p.evaluate(()=>!document.getElementById('welcome')),'Esc closes it');
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
