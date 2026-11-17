const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1300,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(4096,4096,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(800);
 const r=await p.evaluate(()=>{const g=__gs,n=4096,src=g.makeTarget(n,n,8,false),dst=g.makeTarget(n,n,8,false);
   /* a vertical edge at x=2000: left black, right white; the blur must be one smooth ramp with no step at the tile borders (multiples of 512) */
   g.writeRegion(src,0,2040,n,16,(()=>{const a=new Uint8Array(n*16*4);for(let y=0;y<16;y++)for(let x=0;x<n;x++){const v=x<2000?0:255;a.set([v,v,v,255],(y*n+x)*4);}return a;})());
   g.scissorDo([0,2040,n,16],()=>g.run(g.P.blur,dst,{uSrc:src.tex,uDir:[1,0],uSigma:12,uRadius:{int:36}}));
   const d=g.captureRegionNow(dst,1900,2048,200,1).data,row=[];for(let x=0;x<200;x++)row.push(d[x*4]);
   let maxStep=0;for(let x=1;x<200;x++)maxStep=Math.max(maxStep,Math.abs(row[x]-row[x-1]));
   const outside=g.captureRegionNow(dst,100,2048,4,1).data[0];const above=g.captureRegionNow(dst,2000,100,1,1).data[0];
   return {maxStep,mid:row[100],outside,above};});
 console.log(JSON.stringify(r));
 ok(r.maxStep<20&&r.mid>100&&r.mid<160,'a blur on a 4096 picture, drawn in tiles, is one smooth ramp (largest step '+r.maxStep+')');
 ok(r.above===0,'only the area asked for (the scissor) was drawn, not the whole picture');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
