const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const box=await p.locator('#gl').boundingBox();
 const N=512;
 await p.evaluate(()=>__gs.newDoc(512,512,8,[1,1,1],'Conv2',false));await W();
 // a brick-like normal map (8-bit): bumps plus mortar lines
 await p.evaluate(async N=>{const c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');const im=x.createImageData(N,N);
  const B=[];let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647;};for(let i=0;i<20;i++)B.push([rnd()*N,rnd()*N,15+rnd()*40,rnd()<.5?-1:1]);
  const H=(X,y)=>{let h=0;for(const [bx,by,r,s] of B)h+=s*25*Math.exp(-((X-bx)**2+(y-by)**2)/(2*r*r));const u=X%128,v=y%64;h+=Math.min(u,128-u,v,64-v,8)*1.5;return h;};
  for(let y=0;y<N;y++)for(let X=0;X<N;X++){const dx=(H(X+1,y)-H(X-1,y))/2,dy=(H(X,y+1)-H(X,y-1))/2;const l=Math.hypot(dx,dy,1);const i=(y*N+X)*4;im.data[i]=Math.round((-dx/l*.5+.5)*255);im.data[i+1]=Math.round((dy/l*.5+.5)*255);im.data[i+2]=Math.round((1/l*.5+.5)*255);im.data[i+3]=255;}
  x.putImageData(im,0,0);const bl=await new Promise(r=>c.toBlob(r,'image/png'));await __gs.cvSourceFromFile(new File([bl],'bricks.png',{type:'image/png'}));},N);
 await p.click('#modeTabs [data-mode=convert]');await W(1500);
 ok(await p.evaluate(()=>__gs.cv.kind)==='normal','brick normal map detected as a normal map');
 await p.evaluate(()=>{__gs.cv.make.height=true;__gs.cv.tab='height';__gs.cvRes('height');});await W(300);
 // height: bricks higher than mortar, image edges not raised
 const hs=await p.evaluate(N=>{const d=__gs.readRGBA8(__gs.cv.res.height);const at=(x,y)=>d[(y*N+x)*4];let brick=0,mort=0,edge=0,mid=0,nb=0,nm=0,ne=0,nmid=0;
  for(let y=4;y<N-4;y+=2)for(let x=4;x<N-4;x+=2){const u=x%128,v=y%64,e=Math.min(u,128-u,v,64-v);if(e>=20){brick+=at(x,y);nb++;}else if(e<=1){mort+=at(x,y);nm++;}}
  for(let i=0;i<N;i+=4){edge+=at(i,1)+at(1,i)+at(i,N-2)+at(N-2,i);ne+=4;mid+=at(i,N>>1)+at(N>>1,i);nmid+=2;}
  return {brick:brick/nb,mort:mort/nm,edge:edge/ne,mid:mid/nmid};},N);
 ok(hs.brick-hs.mort>8,'height from the normal map: bricks above mortar '+JSON.stringify(hs));
 ok(hs.edge-hs.mid<25,'height from the normal map: image edges not raised '+JSON.stringify(hs));
 // AO has no rings: inside bricks away from bumps it stays almost flat
 await p.evaluate(()=>{__gs.cv.make.ao=true;__gs.cv.tab='ao';__gs.cvRes('ao');});await W(300);
 const ring=await p.evaluate(N=>{const d=__gs.readRGBA8(__gs.cv.res.ao);let dev=0,n=0;for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x%128,v=y%64;if(Math.min(u,128-u,v,64-v)<16)continue;dev+=255-d[(y*N+x)*4];n++;}return dev/n;},N);
 ok(ring<20,'AO inside the bricks has no dark rings (mean darkening '+ring.toFixed(1)+')');
 // grey source with gentle slopes: normal has no 8-bit stair-step ripples
 await p.evaluate(async N=>{const c=document.createElement('canvas');c.width=c.height=N;const x=c.getContext('2d');const im=x.createImageData(N,N);
  for(let y=0;y<N;y++)for(let X=0;X<N;X++){const h=100+40*Math.exp(-((X-256)**2+(y-256)**2)/(2*110*110));const i=(y*N+X)*4;im.data[i]=im.data[i+1]=im.data[i+2]=Math.round(h);im.data[i+3]=255;}
  x.putImageData(im,0,0);const bl=await new Promise(r=>c.toBlob(r,'image/png'));await __gs.cvSourceFromFile(new File([bl],'dome.png',{type:'image/png'}));},N);await W(800);
 await p.evaluate(()=>{__gs.cvSetKind('height');__gs.cv.tab='normal';__gs.cv.dirty.add('normal');__gs.cvRes('normal');});await W(300);
 const rip=await p.evaluate(N=>{const d=__gs.readRGBA8(__gs.cv.res.normal);let s=0,n=0;const y=200;for(let x=20;x<N-21;x++){const a=d[(y*N+x-1)*4],b=d[(y*N+x)*4],c=d[(y*N+x+1)*4];s+=Math.abs(a-2*b+c);n++;}return s/n;},N);
 ok(rip<1.5,'normal from a gentle 8-bit slope is smooth (ripple '+rip.toFixed(2)+')');
 // Bake model doesn't stay in Convert
 await p.evaluate(()=>{__gs.bakeCfg.low=__gs.primMesh('cube',0);});await p.click('#modeTabs [data-mode=bake]');await W(800);
 const bm=await p.evaluate(()=>__gs.v3.mesh===__gs.bakeCfg.low);await p.click('#modeTabs [data-mode=convert]');await W(800);
 const cm=await p.evaluate(()=>__gs.v3.mesh!==__gs.bakeCfg.low);ok(bm&&cm,'Convert shows its own model after Bake ('+bm+','+cm+')');
 // sent maps: clicking a group shows its map
 await p.evaluate(()=>{__gs.cvSetKind('photo');for(const k of ['normal','height','ao','curv','rough','metal','base'])__gs.cv.make[k]=k==='normal'||k==='ao';});await W(300);await p.click('#cvSend');await W(400);
 await p.click('#modeTabs [data-mode=paint]');await W(400);await p.evaluate(()=>__gs.setView('base'));await W(300);
 const row=p.locator('#layerList .lrow',{hasText:'Converted normal'});ok(/Nrm/.test(await row.textContent()),'group shows which map it holds');
 await row.click();await W(400);ok(await p.evaluate(()=>__gs.doc.view)==='normal','clicking a sent group shows its map');
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
