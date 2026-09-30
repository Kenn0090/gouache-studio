/* 0.42: effect tracks with keyframes */
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(64,48,8,[1,1,1],'a42',false));await W(300);
 await p.click('#modeTabs [data-mode=anim]');await W(300);
 /* paint a dot on frame 1, make 4 frames */
 await p.evaluate(()=>{__gs.quickDupli(3,'end');});await W(300);
 await p.evaluate(()=>__gs.afxAdd('blur'));await W(300);
 ok(await p.evaluate(()=>__gs.afxList().length===1),'effect added');
 ok(await p.evaluate(()=>!!document.querySelector('.afxhead')),'effect row shown');
 const key=await p.evaluate(()=>{const d=Object.keys(__gs.afxList()[0].v).find(k=>typeof __gs.afxList()[0].v[k]==='number');return d;});
 await p.evaluate(k=>{__gs.afxSetKey(0,k,0,0,'lin');__gs.afxSetKey(0,k,3,30,'lin');},key);await W(200);
 const vals=await p.evaluate(k=>[0,1,2,3].map(f=>__gs.afxValue(__gs.afxList()[0],k,f)),key);
 ok(Math.abs(vals[0])<1e-6&&Math.abs(vals[3]-30)<1e-6&&Math.abs(vals[1]-10)<1e-6,'values blend between keys '+vals.join(','));
 await p.evaluate(()=>{const A=__gs.anim;A.cur=1;__gs.afxApply();});
 ok(await p.evaluate(k=>Math.abs(__gs.afxList()[0]._L.fx.stack[0].v[k]-10)<1e-6,key),'layer gets the frame value');
 const r=await p.evaluate(()=>__gs.afxRenderAll(__gs.anim).length);ok(r===4,'export renders every frame with effects');
 const sv=await p.evaluate(()=>__gs.afxLoad(JSON.parse(JSON.stringify(__gs.afxSave()))).length);ok(sv===1,'saves and loads');
 await p.keyboard.press('Control+z');await W(400);
 ok(await p.evaluate(()=>__gs.afxList().length===1),'undo after keys keeps the effect');
 /* 0.42.1: Dissolve, Glow, stepping an effect with Quick dupli */
 await p.evaluate(()=>{const A=__gs.anim,[w,h]=__gs.docWH(),d=new Uint8ClampedArray(w*h*4);for(let i=0;i<w*h;i++){d[i*4]=200;d[i*4+1]=40;d[i*4+2]=40;d[i*4+3]=255;}
   const tex=__gs.uploadStraight({w,h,data:d,bits:8});__gs.premultInto(A.frames[0].target,tex,[0,0],null);A.fxl=[];__gs.showFrame(0);});
 const alphaSum=async t=>p.evaluate(t=>{const A=__gs.anim;A.fxl=[];__gs.afxAdd('dissolve');const tr=__gs.afxList()[0];tr.v.t=t;const c=__gs.afxRenderAll(A)[0],d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s/(d.length/4)/255;},t);
 const a0=await alphaSum(0),a5=await alphaSum(.5),a1=await alphaSum(1);
 ok(a0>.95&&a1<.05&&a5>.1&&a5<.9,'dissolve erodes with Amount ('+[a0,a5,a1].map(x=>x.toFixed(2))+')');
 const g=await p.evaluate(()=>{const A=__gs.anim;A.fxl=[];__gs.afxAdd('vfxGlow');return __gs.afxRenderAll(A)[0].width;});ok(g===64,'glow renders');
 await p.evaluate(()=>{const A=__gs.anim;A.fxl=[];__gs.afxAdd('dissolve');});
 await p.evaluate(()=>{__gs.quickDupli(8,'after',{track:0,key:'t',from:0,to:1});});await W(300);
 const ks=await p.evaluate(()=>__gs.afxList()[0].keys.t.map(k=>k.f+':'+k.v));
 ok(ks.length===2&&ks[0]==='0:0'&&ks[1].startsWith('8:1'),'quick dupli stepped the effect '+ks);
 await p.evaluate(()=>{__gs.dlgQuickDupli();});await W(200);
 ok(await p.evaluate(()=>!!document.getElementById('qdTrack')),'Quick dupli offers the effect step');
 await p.click('#dlgCancel').catch(()=>{});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
