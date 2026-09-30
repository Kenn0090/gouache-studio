/* 0.39: Slope blur takes a picture as its slope */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(128,128,8,null,'t',false));await W(300);
 const r=await p.evaluate(async()=>{
   const g=__gs,N=g.TX_GEN.map(x=>x[0]);const src=g.txGenTarget(N[0],128);
   const it=g.fxdAllTex().find(x=>x.kind==='gen'&&x.id===N[1]);await g.txTarget(it);
   const go=v=>{const d=g.makeTarget(128,128,8,false);g.FX.slopeBlur.render(src,d,Object.assign(g.fxDefaults(g.FX.slopeBlur),v));const px=g.captureRegionNow(d,0,0,128,128).data;return Array.from(px.slice(0,4*4000));};
   const a=go({guide:'self'}),b=go({guide:'image',gimg:{kind:'gen',id:N[1],name:'x'}}),c=go({guide:'image',ginv:true,gimg:{kind:'gen',id:N[1],name:'x'}}),n=go({guide:'noise'});
   const diff=(x,y)=>{let s=0;for(let i=0;i<x.length;i++)s+=Math.abs(x[i]-y[i]);return s;};
   return {ab:diff(a,b),bc:diff(b,c),bn:diff(b,n),row:!!g.fxdGuideRow({guide:'image'},()=>{}).querySelector('#fxdLib')};});
 ok(r.ab>1000,'a picture as the slope gives a different result than its own slope '+JSON.stringify(r));
 ok(r.bc>1000,'Flip the slope changes the result');
 ok(r.row,'the picture row has a Choose from Textures button');
 /* the real dialog */
 await p.evaluate(()=>__gs.fxMenu('slopeBlur'));await W(700);
 const item=p.locator('#nothing');
 {
   await p.click('button.segb:has-text("A picture")');await W(300);
   ok(await p.evaluate(()=>{const g=document.querySelector('#fxdGuide');return !!g&&!g.hidden&&!!g.querySelector('#fxdDrop')&&!!g.querySelector('#fxdLib');}),'the dialog shows the drop box and the Textures button when A picture is chosen');
   await p.screenshot({path:'/tmp/slope39.png'});
   await p.click('#fxdLib');await W(800);
   ok(await p.evaluate(()=>document.querySelectorAll('.fxdpick .txtile').length>20),'the Textures picker lists the library');
 }
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
