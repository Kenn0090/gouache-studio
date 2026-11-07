/* 0.95.7: photo grunges can be fetched at 4K (File › Content…). Checks: every ambientCG grunge has a source; the 4K
   processing of a real scan matches the 1K grunge that ships; a kept 4K picture is used in place of the 1K one.
   Needs G4_JPG = a 4K ambientCG Leaking012A Roughness jpg (skipped otherwise). */
const {chromium}=require('playwright'),path=require('path'),fs=require('fs');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1300,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const s=await p.evaluate(()=>({n:Object.keys(__gs.GR_SRC).length,list:__gs.g4List().length,leak:__gs.GR_SRC['leaks-2'],sw:__gs.GR_SRC['swirled-smears']}));
 ok(s.list>=60&&s.leak&&s.leak.id==='Leaking012A'&&s.leak.inv&&s.sw&&s.sw.id==='Smear008','sources known for '+s.list+' photo grunges '+JSON.stringify(s.leak));
 const jpg=process.env.G4_JPG;
 if(jpg&&fs.existsSync(jpg)){
   const r=await p.evaluate(async b64=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<u.length;i++)u[i]=bin.charCodeAt(i);
     const out=await __gs.g4Make(u,__gs.GR_SRC['leaks-2']);const bm=await createImageBitmap(new Blob([out]));const W=bm.width;
     const g=async (bytes)=>{const im=await createImageBitmap(new Blob([bytes]));const c=new OffscreenCanvas(128,128),x=c.getContext('2d');x.drawImage(im,0,0,128,128);const d=x.getImageData(0,0,128,128).data,a=new Float32Array(128*128);for(let i=0;i<a.length;i++)a[i]=d[i*4];return a;};
     const A=await g(out),B=await g(await __gs.txPhotoBytes('leaks-2'));const m=v=>v.reduce((s,x)=>s+x,0)/v.length,ma=m(A),mb=m(B);let sab=0,sa=0,sb=0;for(let i=0;i<A.length;i++){sab+=(A[i]-ma)*(B[i]-mb);sa+=(A[i]-ma)**2;sb+=(B[i]-mb)**2;}
     return {W,cor:sab/Math.sqrt(sa*sb),ma,mb};},fs.readFileSync(jpg).toString('base64'));
   ok(r.W===4096,'the 4K grunge is 4096 px wide ('+r.W+')');
   ok(r.cor>.95&&Math.abs(r.ma-r.mb)<20,'it matches the 1K grunge that ships (correlation '+r.cor.toFixed(3)+', mean '+r.ma.toFixed(0)+' vs '+r.mb.toFixed(0)+')');
 } else console.log('SKIP 4K processing (set G4_JPG)');
 const u=await p.evaluate(async()=>{const fake=new Uint8Array([1,2,3,4,5]);await __gs.aiDB.put('g4k/dust',{buf:fake.buffer,size:5,v:1});const got=await __gs.txPhotoBytes('dust');await __gs.aiDB.del('g4k/dust');const back=await __gs.txPhotoBytes('dust');return [got.length,back.length];});
 ok(u[0]===5&&u[1]>100,'a kept 4K grunge is used in place of the 1K one, and removing it goes back '+u);
 /* the Content window shows the row (pretend to be the desktop app) */
 await p.evaluate(()=>{__gs.platform.isDesktop=true;__gs.dlgContent(false);});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!document.getElementById('ctG4')&&!!document.getElementById('ctG4On')&&/Grunge maps at 4K/.test(document.getElementById('ctG4').textContent)),'File › Content… has a Grunge maps at 4K row');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
