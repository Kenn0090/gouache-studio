/* 0.27: 0.28: Help menu, workspace follows the tab, Animation shortcuts, bake list */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();window.__opened=[];window.open=(u)=>{window.__opened.push(u);return null;};});
 /* Help menu */
 const help=p.locator('#menubar button,nav button,.menubar button',{hasText:/^Help$/}).first();
 ok(await help.count()===1,'there is a Help menu');
 await help.click();await W(200);
 const items=await p.evaluate(()=>[...document.querySelectorAll('#menuPop .mi,.menupop .mi')].map(b=>b.textContent));
 ok(['User guide','What’s new','Keyboard shortcuts','Report a problem','About'].every(w=>items.some(t=>t.includes(w))),'it has the guide, what’s new, shortcuts, report a problem and About '+JSON.stringify(items.map(t=>t.slice(0,20))));
 await p.locator('.mi',{hasText:'User guide'}).first().click();await W(200);
 ok(await p.evaluate(()=>window.__opened.some(u=>/docs\/wiki\/Home\.md$/.test(u))),'User guide opens the online guide');
 await p.evaluate(()=>__gs.act('whatsNew'));await W(300);
 ok(await p.evaluate(()=>/0\.27\.0/.test(document.querySelector('#dlgBody').textContent)&&document.querySelectorAll('#dlgBody .helpmd h3').length>10),'What’s new lists the versions');
 await p.click('#dlgCancel');await W(200);
 await p.evaluate(()=>__gs.act('about'));await W(300);
 ok(await p.evaluate(()=>/Gouache Studio \d+\.\d+/.test(document.querySelector('#dlgBody').textContent)),'About shows the version');
 await p.click('#dlgCancel');await W(200);
 await p.keyboard.press('F1');await W(200);ok(await p.evaluate(()=>window.__opened.length===2),'F1 opens the guide');
 /* each tab has its own workspace, and the drop-down follows the tab */
 const ws=()=>p.evaluate(()=>({ws:__gs.dk.ws,sel:document.querySelector('#wsSel').selectedOptions[0].textContent}));
 let w=await ws();ok(w.ws==='painting'&&w.sel==='Paint','Paint uses the Paint workspace '+JSON.stringify(w));
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);w=await ws();ok(w.ws==='texturing'&&w.sel==='3D Paint','3D Paint switches the drop-down to 3D Paint '+JSON.stringify(w));
 await p.click('#modeTabs [data-mode=anim]');await W(1000);w=await ws();ok(w.sel==='Animation','Animation → Animation '+JSON.stringify(w));
 await p.click('#modeTabs [data-mode=bake]');await W(1000);w=await ws();ok(w.sel==='Bake','Bake → Bake');
 await p.click('#modeTabs [data-mode=convert]');await W(1000);w=await ws();ok(w.sel==='Convert','Convert → Convert');
 /* picking another workspace while in a tab: that tab remembers it */
 await p.selectOption('#wsSel','minimal');await W(300);await p.click('#modeTabs [data-mode=paint]');await W(800);
 w=await ws();ok(w.sel==='Paint','back in Paint: Paint '+JSON.stringify(w));
 await p.click('#modeTabs [data-mode=convert]');await W(800);w=await ws();ok(w.ws==='minimal','Convert remembers the workspace picked there '+JSON.stringify(w));
 await p.click('#modeTabs [data-mode=paint]');await W(800);
 /* Bake: every map listed; Alt + click keeps only that one, again flips */
 await p.click('#modeTabs [data-mode=bake]');await W(1200);await p.evaluate(()=>__gs.showPanel('bake'));await W(300);
 const kinds=()=>p.evaluate(()=>Object.keys(__gs.bakeCfg.kinds).filter(k=>['normal','ao','curv','height','thick','wnormal','position','id'].includes(k)&&__gs.bakeCfg.kinds[k]).sort().join());
 ok(await p.locator('#bkList input[type=checkbox]').count()===8,'the Bake panel lists all 8 maps');
 await p.click('label[for=bkm_ao]',{modifiers:['Alt']});await W(300);
 ok(await kinds()==='ao','Alt + click: only AO '+await kinds());
 await p.click('label[for=bkm_ao]',{modifiers:['Alt']});await W(300);
 ok(await kinds()==='curv,height,id,normal,position,thick,wnormal','Alt + click again: everything but AO '+await kinds());
 ok(await p.evaluate(()=>!document.getElementById('bkm_ao').checked&&document.getElementById('bkm_curv').checked),'the ticks show it');
 await p.click('label[for=bkm_normal]');await W(200);ok(!(await kinds()).split(',').includes('normal'),'a plain click still just toggles one');
 /* the Material panel's channels too */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{__gs.showPanel('layers');});await p.locator('#layerList .lrow',{hasText:'Base material'}).first().click({position:{x:120,y:12}});await W(400);
 await p.evaluate(()=>__gs.showPanel('matEd'));await W(600);
 const ch=()=>p.evaluate(()=>{const f=__gs.doc.active.fill.maps;return [...document.querySelectorAll('#matEdBody input[id^=fl_on_]')].map(b=>b.id.slice(6)).filter(k=>f[k].on).sort().join();});
 await p.click('label[for=fl_on_rough]',{modifiers:['Alt']});await W(500);
 ok(await ch()==='rough','Material: Alt + click keeps only roughness '+await ch());
 await p.click('label[for=fl_on_rough]',{modifiers:['Alt']});await W(500);
 const c2=await ch();ok(!c2.split(',').includes('rough')&&c2.split(',').length>=4,'Alt + click again: every other channel on '+c2);
 await p.click('#modeTabs [data-mode=paint]');await W(800);
 /* Animation shortcuts */
 await p.click('#modeTabs [data-mode=anim]');await W(1200);
 const an=()=>p.evaluate(()=>({n:__gs.anim.frames.length,cur:__gs.anim.cur,play:!!__gs.playing}));
 const n0=(await an()).n;
 await p.keyboard.press('Control+f');await W(300);let a=await an();ok(a.n===n0+1&&a.cur===n0,'Ctrl+F adds a frame after the current one '+JSON.stringify(a));
 await p.evaluate(()=>{__gs.setFG([1,0,0]);});await p.keyboard.press('Alt+Backspace');await W(300);
 await p.keyboard.press('Control+d');await W(300);a=await an();ok(a.n===n0+2&&a.cur===n0+1,'Ctrl+D duplicates the frame');
 ok(await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.compOut());return d[0]>200&&d[1]<40;}),'…with its picture');
 await p.keyboard.press(',');await W(200);ok((await an()).cur===n0,', steps back');await p.keyboard.press('.');await W(200);ok((await an()).cur===n0+1,'. steps forward');
 const F=await p.evaluate(()=>__gs.anim.frames[__gs.anim.cur]);
 await p.keyboard.press('Control+Shift+ArrowLeft');await W(300);ok(await p.evaluate(()=>__gs.anim.cur)===n0,'Ctrl+Shift+Left moves the frame earlier');
 await p.keyboard.press('Space');await W(400);ok((await an()).play,'a tap on Space plays');await p.keyboard.press('Space');await W(300);ok(!(await an()).play,'…and stops');
 await p.keyboard.press('Delete');await W(300);ok((await an()).n===n0+1,'Delete removes the frame');
 await p.click('#modeTabs [data-mode=paint]');await W(800);
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
