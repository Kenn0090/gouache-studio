const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* the big test model is made on the fly (136 MB, not kept in the repository) */
{const fs=require('fs'),f=__dirname+'/fixtures/big.obj';if(!fs.existsSync(f)){const N=1200,M=1000,out=fs.createWriteStream(f);let buf='o partA_high\n';const flush=()=>{out.write(buf);buf='';};
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){const th=i/N*2*Math.PI,ph=j/M*Math.PI;buf+='v '+(Math.sin(ph)*Math.cos(th)).toFixed(5)+' '+Math.cos(ph).toFixed(5)+' '+(Math.sin(ph)*Math.sin(th)).toFixed(5)+'\n';if(buf.length>1e6)flush();}
  for(let j=0;j<=M;j++)for(let i=0;i<=N;i++){buf+='vt '+(i/N).toFixed(5)+' '+(j/M).toFixed(5)+'\n';if(buf.length>1e6)flush();}
  buf+='vn 0 1 0\n';for(let j=0;j<M;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i+1,b=a+1,c=a+N+1,d=c+1;buf+='f '+a+'/'+a+'/1 '+c+'/'+c+'/1 '+d+'/'+d+'/1 '+b+'/'+b+'/1\n';if(buf.length>1e6)flush();}
  flush();out.end();require('child_process').execSync('sleep 2');}}
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(512,512,8,[.5,.5,.5],'Big',false));
 await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(400);
 const t0=Date.now();
 const fcP=p.waitForEvent('filechooser');await p.click('#bk_highLoad');const fc=await fcP;await fc.setFiles(__dirname+'/fixtures/big.obj');
 let seen=0;for(let i=0;i<600;i++){const s=await p.evaluate(()=>({h:!!__gs.bakeCfg.high,lb:!document.querySelector('#loadBox')?.hidden,msg:document.querySelector('#loadBox .lb-msg')?.textContent}));if(s.lb)seen++;if(s.h)break;await p.waitForTimeout(200);}
 const r=await p.evaluate(()=>{const h=__gs.bakeCfg.high;return {tris:h.tris,verts:h.verts,noUV:h.noUV,parts:h.partNames,uv0:[h.uv[0],h.uv[1]],mem:performance.memory?Math.round(performance.memory.usedJSHeapSize/1e6):0};});
 console.log('load ms',Date.now()-t0,'bar frames',seen,JSON.stringify(r));
 ok(r.tris===2400000&&!r.noUV&&seen>2,'big OBJ loads with a moving bar');
 // bake normal against it with low = sphere
 const t1=Date.now();await p.evaluate(async()=>{const C=__gs.bakeCfg;C.low=__gs.primMesh('sphere',0);C.ss=1;C.pad=2;C.front=3;C.back=3;for(const k in C.kinds)C.kinds[k]=k==='normal';await __gs.runBake(C.low,['normal']);});
 console.log('bake ms',Date.now()-t1,await p.evaluate(()=>Object.keys(__gs.bk.res)));
 ok(errs.length===0,'no errors '+errs.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
