const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1300,height:800}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(1024,1024,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{const g=__gs,n=1024,tmpT=g.makeTarget(1024,1024,8,false),src=g.makeTarget(n,n,8,false),dA=g.makeTarget(n,n,8,false),dB=g.makeTarget(n,n,8,false);
   const px=new Uint8Array(n*n*4);let s=7;const rnd=()=>{s=(s*1103515245+12345)&0x7fffffff;return s/0x7fffffff;};
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=(y*n+x)*4,v=((x>>6)+(y>>6))%2?230:30,w=rnd()>.995?255:v;px.set([w,w,w,255],i);}
   g.writeRegion(src,0,0,n,n,px);
   const time=fn=>{const t0=performance.now();fn();g.readRGBA8(dA);return performance.now()-t0;};
   const radius=140,sigma=radius/2.2;
   /* the old way: one tap per pixel */
   const tOld=time(()=>{const R=Math.min(128,Math.ceil(sigma*3));g.run(g.P.blur,tmpT,{uSrc:src.tex,uDir:[1,0],uSigma:sigma,uRadius:{int:R}});g.run(g.P.blur,dA,{uSrc:tmpT.tex,uDir:[0,1],uSigma:sigma,uRadius:{int:R}});});
   const tNew=time(()=>{g.gaussian(src,dB,radius);});
   const a=g.readRGBA8(dA),b=g.readRGBA8(dB);let md=0,sd=0,n2=0;for(let i=0;i<a.length;i+=4){const d=Math.abs(a[i]-b[i]);md=Math.max(md,d);sd+=d;n2++;}
   return {tOld,tNew,maxDiff:md,meanDiff:sd/n2};});
 console.log(JSON.stringify(r));
 ok(r.tNew<r.tOld*.6,'the wide blur is much quicker ('+Math.round(r.tOld)+' ms -> '+Math.round(r.tNew)+' ms, SwiftShader)');
 ok(r.meanDiff<2.5&&r.maxDiff<14,'and looks the same as the exact blur (mean difference '+r.meanDiff.toFixed(2)+', largest '+r.maxDiff+' of 255)');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
