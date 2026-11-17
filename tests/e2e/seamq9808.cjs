const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:1024,layout:'3d'}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(1024,1024,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(400);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
 await p.evaluate(()=>{const g=__gs;g.v3s().model='sphere';g.v3.mesh=null;g.v3.dirty=true;g.requestRender(true);});await p.waitForTimeout(1500);
 const r=await p.evaluate(()=>{const g=__gs,n=1024,src=g.makeTarget(n,n,8,false),dA=g.makeTarget(n,n,8,false),dB=g.makeTarget(n,n,8,false);
   const px=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++){const d=Math.hypot(x-512,y-512),v=d<90?20:235;px.set([v,v,v,255],(y*n+x)*4);}
   g.writeRegion(src,0,0,n,n,px);
   const R=70;g.meshConnectedBlur(src,dA,R,R,false);g.readRGBA8(dA);const t0=performance.now();const okA=g.meshConnectedBlur(src,dA,R,R,false);g.readRGBA8(dA);const tA=performance.now()-t0;
   g.gaussian(src,dB,R*2.2);   /* plain wide blur for comparison */
   const a=g.readRGBA8(dA),b=g.readRGBA8(dB);
   /* roughness: the mean absolute second difference along a row through the middle of the blurred disc (a lattice makes it big) */
   const rough=arr=>{let s=0,c=0;for(let y=380;y<640;y+=8)for(let x=300;x<720;x++){const i=(y*n+x)*4;s+=Math.abs(arr[i-4]-2*arr[i]+arr[i+4]);c++;}return s/c;};
   return {okA,tA,seam:rough(a),plain:rough(b)};});
 console.log(JSON.stringify(r));
 ok(r.okA,'the seam-aware blur ran');
 ok(r.seam<Math.max(.6,r.plain*2.2),'the blur is smooth, no lattice (roughness '+r.seam.toFixed(2)+' against '+r.plain.toFixed(2)+' for a plain blur)');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
