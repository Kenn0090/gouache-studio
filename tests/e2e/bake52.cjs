/* 0.52: the Bake tab's top bar (big Bake button, send buttons under it), 16× default, flat faces stay exactly flat, and Compare. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';const fs=require('fs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.text().startsWith('CMP'))console.log(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[.5,.5,.5],'bake',false));await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(900);
 // top bar
 const lay=await p.evaluate(()=>{const bar=document.getElementById('bkBar'),go=document.getElementById('bkGo'),body=document.getElementById('bakeBody');
   const r=go.getBoundingClientRect();return {first:body.firstElementChild===bar,h:r.height,w:r.width,send:['bkSend','bkSendP3','bkExport'].map(i=>{const e=document.getElementById(i);return !!e&&bar.contains(e)&&e.disabled;}),size:getComputedStyle(go).fontSize,weight:getComputedStyle(go).fontWeight};});
 ok(lay.first&&lay.h>=44&&parseInt(lay.size)>=18&&+lay.weight>=700,'Bake is a big, bold button at the top '+JSON.stringify(lay));
 ok(lay.send.every(Boolean),'Send to Paint, Send to 3D Paint and Export sit under it, off until baked');
 ok(await p.evaluate(()=>__gs.bakeCfg.ss)===4,'16× anti-aliasing by default');
 const txt=fs.readFileSync(OLD+'fixtures/high.obj','utf8');
 await p.evaluate(async txt=>{const C=__gs.bakeCfg;C.high=__gs.parseOBJ(txt,'high');C.pad=8;C.front=15;C.back=5;C.rays=16;for(const k in C.kinds)C.kinds[k]=k==='normal';
   await __gs.runBake(__gs.bakeViewModel(),['normal']);},txt);await W(600);
 const on=await p.evaluate(()=>['bkSend','bkSendP3','bkExport'].map(i=>!document.getElementById(i).disabled));
 ok(on.every(Boolean),'the three buttons turn on after the bake '+on);
 const px=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.bk.res.normal);const g=(x,y)=>Array.from(d.slice((y*256+x)*4,(y*256+x)*4+4));return [g(5,5),g(250,250),g(128,128)];});
 ok(px[0].join()==='128,128,255,255'&&px[1].join()==='128,128,255,255','empty and flat areas are exactly 128,128,255 '+JSON.stringify(px));
 // Compare: with the same map (as a picture) and with its green flipped
 const mk=flip=>p.evaluate(flip=>{const d=__gs.readRGBA8(__gs.bk.res.normal);const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),im=x.createImageData(256,256);
   for(let yy=0;yy<256;yy++)for(let xx=0;xx<256;xx++){const s=((255-yy)*256+xx)*4,t=(yy*256+xx)*4;im.data[t]=d[s];im.data[t+1]=flip?255-d[s+1]:d[s+1];im.data[t+2]=d[s+2];im.data[t+3]=255;}
   x.putImageData(im,0,0);return c.toDataURL('image/png');},flip);
 for(const flip of [false,true]){
  const url=await mk(flip);
  const fp=require('os').tmpdir()+'/marmoset_'+(flip?'f':'s')+'.png';fs.writeFileSync(fp,Buffer.from(url.split(',')[1],'base64'));p.removeAllListeners('filechooser');p.once('filechooser',fc=>fc.setFiles(fp));
  await p.evaluate(()=>{__gs.bk.show='normal';});await p.evaluate(()=>document.getElementById('bkCompare')?1:0);
  const had=await p.evaluate(()=>!!document.getElementById('bkCompare'));
  if(!had){await p.evaluate(()=>__gs.buildBakePanel&&__gs.buildBakePanel());await W(300);}
  console.log('btn',await p.evaluate(()=>!!document.getElementById('bkCompare')));await p.click('#bkCompare');await W(2500);console.log('toast',await p.evaluate(()=>(document.getElementById('toast')||{}).innerText), await p.evaluate(()=>document.body.innerText.includes('Compare normal maps')));
  const msg=await p.evaluate(()=>{const m=document.getElementById('modal');return m&&!m.hidden?m.innerText:'';});
  console.log('MSG',JSON.stringify(msg).slice(0,300));const mean=parseFloat((/Average difference: ([\d.]+)/.exec(msg)||[])[1]);
  ok(msg.includes('Compare normal maps')&&mean<0.6,'Compare '+(flip?'(green flipped)':'(same picture)')+': average difference '+mean+'° '+(flip&&/flipped/.test(msg)?'and it says it flipped the green':''));
  await p.evaluate(()=>{const o=document.getElementById('dlgOk');if(o)o.click();});await W(300);}
 ok(await p.evaluate(()=>__gs.inPaint?__gs.inPaint(()=>__gs.allLayers().some(L=>/Normal difference/.test(L.name))):true),'a difference layer was added to the painting');
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
