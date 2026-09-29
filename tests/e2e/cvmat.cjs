/* 0.27: Convert tab › Turn into material */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Bark photo',false));await W();
 await setFG('#b06a36');await p.evaluate(()=>{__gs.ui.bg=[.2,.27,.35];});
 await p.evaluate(()=>__gs.act('clouds'));await W(400);await p.click('#dlgOk');await W(300);
 await p.click('#modeTabs [data-mode=convert]');await W(1200);
 await p.evaluate(()=>{__gs.cv.make.rough=true;});await W(300);
 ok(await p.locator('#cvToMat').isVisible(),'the Convert tab has Turn into material…');
 await p.click('#cvToMat');await W(300);
 ok(await p.inputValue('#cvMatName')==='Bark photo','it suggests the picture’s name');
 const n0=await p.evaluate(()=>__gs.matLib.list.length);
 await p.click('#dlgOk');await W(3000);
 const r=await p.evaluate(()=>{const L=__gs.matLib.list,rec=L[L.length-1],A=__gs.doc.active;return {n:L.length,name:rec.name,ch:Object.keys(rec.imgs).sort().join(),on:Object.keys(rec.fill.maps).filter(k=>rec.fill.maps[k].on).sort().join(),
   mode:__gs.mode,layer:A&&A.name,fill:!!(A&&A.fill),baseImg:!!(A&&A._fillImg&&A._fillImg.base)};});
 ok(r.n===n0+1&&r.name==='Bark photo','saved in Materials '+JSON.stringify(r));
 ok(r.ch==='ao,base,height,normal,rough','with base colour, normal, height, AO and roughness pictures '+r.ch);
 ok(r.mode==='p3d'&&r.layer==='Bark photo'&&r.fill&&r.baseImg,'and added to 3D Paint as a material layer');
 const col=await p.evaluate(()=>{const A=__gs.doc.active,t=__gs.mapT(A,'base'),d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;let s=[0,0,0],n=0;for(let i=0;i<d.length;i+=4*13){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];n++;}return s.map(v=>Math.round(v/n));});
 ok(Math.abs(col[0]-col[2])>15,'its colour comes from the photo '+col);
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
