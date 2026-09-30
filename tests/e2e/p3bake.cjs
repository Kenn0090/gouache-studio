/* 0.24: Bake mesh maps inside 3D Paint: the window, per texture set, mesh maps refresh their users, fine-tune in the Bake tab, send to the Paint canvas. */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const waitIdle=async()=>{for(let i=0;i<900;i++){if(await p.evaluate(()=>!__gs.bk.busy&&!__gs.bk.regionBusy))return;await W(100);}};
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{const o='v -2 -1 0\nv -0.1 -1 0\nv -0.1 1 0\nv -2 1 0\nv 0.1 -1 0\nv 2 -1 0\nv 2 1 0\nv 0.1 1 0\nv 0.1 -1 0.6\nv 2 -1 0.6\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Left\nf 1/1 2/2 3/3 4/4\nusemtl Right\nf 5/1 6/2 7/3 8/4\nf 5/1 9/2 10/3 6/4\n';
   __gs.useModel(__gs.parseOBJ(o,'two_low.obj'));const C=__gs.bakeCfg;C.high=null;C.cage=null;C.ss=1;C.pad=2;C.aoDist=100;C.match=false;});await W(1200);
 let s=await p.evaluate(()=>__gs.p3.sets.map(S=>S.name));ok(s.join()==='Left,Right','two texture sets '+s);
 /* a layer whose mask reads the AO mesh map (nothing baked yet) */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.msAdd(L,'mesh',{p:{k:'ao',inv:false}});});await W(300);
 const maskAvg=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.msUpdate(L);const d=__gs.readRGBA8(L.mask.target);let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=d[i];n++;}return s/n;});
 const before=await maskAvg();
 await p.evaluate(()=>__gs.showPanel('p3d'));await W(200);
 await p.evaluate(()=>__gs.showPanel('p3bake'));await p.click('#p3BakeBtn');await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#p3bkDlg')&&document.querySelectorAll('#p3bkDlg input[id^=p3bkSet]').length===2&&!!document.querySelector('#p3bkLoadHigh')),'Bake mesh maps… opens the window: maps, size, high-poly, texture sets');
 for(const k of ['normal','ao','curv','height','thick','wnormal','position','id']){const on=k==='ao';if(await p.isChecked('#p3bk_'+k)!==on)await p.click('label[for=p3bk_'+k+']');}
 await p.click('#p3bkDlg .seg button:has-text("512")').catch(()=>{});
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#p3bkDlg .seg button')].find(x=>x.textContent==='Draft');if(b)b.click();});
 /* 128 px for speed: pick through the size row's first option by setting the set size small */
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#p3bkDlg .seg button')].find(x=>/^Same as the set/.test(x.textContent));if(b)b.click();});
 await p.click('#dlgOk');await W(500);await waitIdle();await W(800);
 s=await p.evaluate(()=>({mode:__gs.mode,mm:Object.keys(__gs.doc.meshMaps||{}),mats:__gs.bk.byMat&&Object.keys(__gs.bk.byMat),size:__gs.bakeCfg.size}));
 ok(s.mode==='p3d'&&s.mm.includes('ao')&&s.mats&&s.mats.join()==='Left,Right','the bake runs without leaving 3D Paint, one bake per texture set '+JSON.stringify(s));
 const after=await maskAvg();ok(Math.abs(after-before)>2,'a mask reading the AO mesh map updates with the bake ('+before.toFixed(1)+' → '+after.toFixed(1)+')');
 const mmAvg=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.doc.meshMaps.ao);let s=0,n=0;for(let i=0;i<d.length;i+=4){s+=d[i];n++;}return s/n;});
 const m1=await mmAvg();await p.click('#p3dBody .p3set:has-text("Right")');await W(500);const m2=await mmAvg();
 ok(Math.abs(m1-m2)>1,'each set got its own bake ('+m1.toFixed(1)+' / '+m2.toFixed(1)+')');
 /* only one set ticked */
 await p.evaluate(()=>__gs.showPanel('p3bake'));await p.click('#p3BakeBtn');await W(300);await p.click('label[for=p3bkSet0]');await p.click('#dlgOk');await W(500);await waitIdle();await W(800);
 ok(await p.evaluate(()=>__gs.bk.byMat&&Object.keys(__gs.bk.byMat).join()==='Right'),'unticking a set bakes only the others');
 /* send to the Paint canvas */
 await p.evaluate(()=>__gs.showPanel('p3bake'));await W(200);await p.click('#p3BakePaint');await W(600);
 ok(await p.evaluate(()=>__gs.inPaint(()=>__gs.allLayers().some(L=>/Baked AO/.test(L.name)))),'Send to the Paint canvas puts the bake in the painting as a layer');
 /* fine-tune in the Bake tab: the results wait there */
 await p.click('#modeTabs [data-mode=bake]');await W(1000);
 s=await p.evaluate(()=>({mode:__gs.mode,res:Object.keys(__gs.bk.res),w:__gs.doc.w,low:__gs.bakeCfg.low&&__gs.bakeCfg.low.name}));
 ok(s.mode==='bake'&&s.res.includes('ao')&&s.low==='two_low.obj','the Bake tab has the bake and the model, ready to fine-tune '+JSON.stringify(s));
 await p.click('#modeTabs [data-mode=p3d]');await W(800);
 ok(await p.evaluate(()=>__gs.p3.sets.length===2&&!!__gs.doc.meshMaps.ao),'back in 3D Paint, everything is still there');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
