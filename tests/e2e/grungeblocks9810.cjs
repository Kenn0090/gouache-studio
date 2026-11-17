const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1300,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(512,512,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const g=__gs;g.cmdAddLayer();const L=g.doc.active;const out={};
   for(const seed of [1,50,7,23]){const row=g.msAdd(L,'noise',{p:{type:'grunge',scale:40,contrast:1.5,level:0,seed,tri:false,inv:false,proj:'uv'}});g.msUpdate(L);
     const d=g.readRGBA8(L.mask.flat?L.mask.flat:L.mask.target);const n=512,cell=Math.round(n/40);let flat=0,tot=0;
     for(let cy=0;cy<n-cell;cy+=cell)for(let cx=0;cx<n-cell;cx+=cell){let lo=255,hi=0;for(let y=cy;y<cy+cell;y++)for(let x=cx;x<cx+cell;x++){const v=d[(y*n+x)*4];lo=Math.min(lo,v);hi=Math.max(hi,v);}tot++;if(hi-lo<2)flat++;}
     out[seed]=Math.round(flat/tot*1000)/10;g.msRemove(L,'m',row.id);}
   return out;});
 console.log('percent of cells with no variation at all:',JSON.stringify(r));
 ok(Object.values(r).every(v=>v<2),'no blocks of constant value (the hash is good)');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
