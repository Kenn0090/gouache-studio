/* 0.98.3: normal maps in .gmat files as two lossy grey pictures: much smaller, same look */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1200,height:800}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs&&__gs.pxNormalURL);
 await p.waitForTimeout(3500);
 const r=await p.evaluate(async()=>{const n=512,c=document.createElement('canvas');c.width=c.height=n;const x=c.getContext('2d',{willReadFrequently:true}),id=x.createImageData(n,n),d=id.data;
  let v=1;for(let y=0;y<n;y++)for(let X=0;X<n;X++){const i=(y*n+X)*4;v=(v*1103515245+12345)>>>0;const noise=((v>>>16)&255)/255-.5;
   const nx=Math.sin(X*.05)*.5+noise*.06,ny=Math.cos(y*.04)*.5+noise*.06,nz=Math.sqrt(Math.max(0,1-nx*nx-ny*ny));d[i]=Math.round((nx*.5+.5)*255);d[i+1]=Math.round((ny*.5+.5)*255);d[i+2]=Math.round((nz*.5+.5)*255);d[i+3]=255;}
  x.putImageData(id,0,0);const png=c.toDataURL('image/png'),u=__gs.pxNormalURL(c);if(!u)return {noUrl:true};
  const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('bad'));i.src=u;});
  const out=__gs.pxNormalRead(img,n,n);let mx=0,sum=0;for(let i=0;i<out.length;i+=4){for(let k=0;k<3;k++){const e=Math.abs(out[i+k]-d[i+k]);mx=Math.max(mx,e);sum+=e;}}
  return {pngLen:png.length,urlLen:u.length,mx,mean:sum/(n*n*3)};});
 console.log(JSON.stringify(r));
 ok(!r.noUrl,'the browser made the two-picture WebP');
 ok(r.urlLen<r.pngLen*.5,'it is much smaller than the PNG ('+r.urlLen+' vs '+r.pngLen+')');
 ok(r.mx<=24&&r.mean<2,'the normals come back close to the original (max '+r.mx+', mean '+(r.mean||0).toFixed(2)+' of 255)');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
