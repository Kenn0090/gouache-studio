/* 0.52.3: New 3D Paint Project: after a mesh is chosen the built-in mesh list is off; an optional high-poly opens the Bake mesh maps window ready. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'x',false));await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 // the project dialog (File › New in 3D Paint)
 await p.evaluate(()=>{const m=document.getElementById('modal');if(m&&!m.hidden){const c=document.getElementById('dlgCancel');if(c)c.click();}});
 await p.evaluate(()=>__gs.act('new'));await W(800);
 ok(await p.evaluate(()=>!!document.getElementById('p3NewPipeline')),'the New 3D Paint Project window is open');
 ok(await p.evaluate(()=>!document.getElementById('p3NewModel').disabled),'the built-in mesh list works before a mesh is chosen');
 p.once('filechooser',fc=>fc.setFiles(OLD+'fixtures/low2.obj'));
 await p.locator('.p3newmesh button:has-text("Select")').click();await p.waitForFunction(()=>document.getElementById('p3NewModel').disabled,null,{timeout:20000}).catch(()=>{});
 ok(await p.evaluate(()=>{const e=document.getElementById('p3NewModel');return e.disabled&&e.value==='imported';}),'choosing a mesh switches the built-in mesh list off');
 p.once('filechooser',fc=>fc.setFiles(OLD+'fixtures/high2.obj'));
 await p.click('#p3NewHigh');await W(1500);
 const hn=await p.evaluate(()=>document.querySelector('.p3new').innerText);
 ok(/triangles/.test(hn)&&/High-poly/.test(hn),'the optional high-poly is chosen');
 await p.click('#dlgOk');await p.waitForSelector('#p3bkDlg',{timeout:30000}).catch(()=>{});await W(500);
 const st=await p.evaluate(()=>({bake:!!document.getElementById('p3bkDlg'),high:!!__gs.bakeCfg.high&&__gs.bakeCfg.high.name,mode:__gs.mode}));
 ok(st.mode==='p3d'&&st.bake&&!!st.high,'the Bake mesh maps window opens with the high-poly ready '+JSON.stringify(st));
 const txt=await p.evaluate(()=>document.getElementById('p3bkDlg')?document.getElementById('p3bkDlg').innerText:'');
 ok(/Use “/.test(txt),'and it offers to use that high-poly');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
