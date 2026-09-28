/* Baker speed and quality: AO and thickness on a bumpy high-poly (a few hundred thousand triangles),
   with anti-aliasing. Prints the time; checks the results are smooth (no banding or blotches) and sane.
   DIST=... points it at another build to compare. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
function bumpy(N){const v=[],f=[];for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=i/N*2-1,y=1-j/N*2,r=Math.hypot(x,y);
   const z=.18*Math.exp(-r*r*6)+.03*Math.sin(x*14)*Math.cos(y*11)+(Math.abs(x)<.12&&Math.abs(y+.55)<.3?.08:0);v.push('v '+x+' '+y+' '+z);}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i+1,b=a+1,c=a+N+1,d=c+1;f.push('f '+a+' '+c+' '+b,'f '+b+' '+c+' '+d);}return v.join('\n')+'\n'+f.join('\n');}
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:')||u.startsWith('blob:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,process.env.DIST||'../../dist-web','index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(384,384,8,[.5,.5,.5],'bakeperf',false));
 const N=+(process.env.N||220),txt=bumpy(N);
 const r=await p.evaluate(async txt=>{const C=__gs.bakeCfg;C.high=__gs.parseOBJ(txt,'high');C.ss=2;C.rays=64;C.pad=8;C.front=15;C.back=15;C.aoDist=25;C.thickDist=50;
   for(const k in C.kinds)C.kinds[k]=k==='ao'||k==='thick';
   /* the search tree first (timed on its own), then the bake */
   const t0=performance.now();await __gs.runBake(__gs.bakeViewModel(),['normal']);__gs.readRGBA8(__gs.mapT(__gs.layerByName('Baked normal'),'normal'));const t1=performance.now();
   await __gs.runBake(__gs.bakeViewModel(),['ao','thick']);
   const L=__gs.layerByName('Baked AO'),ao=__gs.readRGBA8(__gs.mapT(L,'ao'));const t2=performance.now();/* the read waits for the graphics card */
   const c=document.createElement('canvas');c.width=c.height=384;const id=c.getContext('2d').createImageData(384,384);id.data.set(ao);c.getContext('2d').putImageData(id,0,0);
   return {via:__gs.bvhVia,png:c.toDataURL(),tree:t1-t0,bake:t2-t1,ao:Array.from(ao.filter((_,i)=>i%4===0)),tris:C.high.tris,maps:__gs.doc.maps.join()};},txt);
 console.log('high-poly',r.tris,'triangles · normal bake (incl. tree) ms',r.tree.toFixed(0),'· AO + thickness ms',r.bake.toFixed(0));
 const W=384,A=r.ao,at=(x,y)=>A[y*W+x];
 /* flat corner area far from the bumps: should be near white and smooth */
 let s=0,n=0,dif=0;for(let y=8;y<60;y++)for(let x=8;x<60;x++){s+=at(x,y);n++;dif+=Math.abs(at(x+1,y)-at(x,y));}
 if(!process.env.DIST)ok(r.via==='worker','the search tree was built in a worker ('+r.via+')');
 console.log('corner mean',(s/n).toFixed(1),'pixel-to-pixel',(dif/n).toFixed(2));
 ok(s/n>150,'open areas stay light');
 /* just outside the raised block: darker than open areas, and not blotchy */
 let foot=0,fn=0,fd=0;for(let y=250;y<340;y++){for(const x of [162,222]){foot+=at(x,y);fn++;fd+=Math.abs(at(x,y+1)-at(x,y));}}
 console.log('beside the block',(foot/fn).toFixed(1),'pixel-to-pixel',(fd/fn).toFixed(2));
 ok(foot/fn<s/n-20,'AO is darker beside the raised block');
 ok(dif/n<6&&fd/fn<12,'smooth: little pixel-to-pixel noise');
 require('fs').writeFileSync(OUT+'bakeperf-ao'+(process.env.DIST?'-other':'')+'.png',Buffer.from(r.png.split(',')[1],'base64'));
 await p.evaluate(()=>{__gs.setView&&__gs.setView('ao');});await p.waitForTimeout(300);await p.screenshot({path:OUT+'bakeperf.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
