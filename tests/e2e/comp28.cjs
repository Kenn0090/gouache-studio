/* 0.28: smaller files: lossless packing, Smaller files (WebP for colour/grey maps), old files still open, packed .gmat */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(512,512,8,[1,1,1],'packtest',false,'pbr'));await W(300);
 /* a photo-like layer: soft gradients plus noise in colour, bumps in Height, a painted Normal and a mask */
 const setup=await p.evaluate(()=>{__gs.act('addLayer');const L=__gs.doc.active,g=__gs.gl;
   const pic=(fn)=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),id=x.createImageData(512,512);let s=7;const rnd=()=>(s=(s*16807)%2147483647)/2147483647;
     for(let y=0;y<512;y++)for(let X=0;X<512;X++){const i=(y*512+X)*4,v=fn(X,y,rnd);id.data.set(v,i);}x.putImageData(id,0,0);return c;};
   const up=(t,c)=>{g.bindTexture(g.TEXTURE_2D,t.tex);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,c);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);};
   up(L.maps.base,pic((x,y,r)=>[128+100*Math.sin(x/40)+r()*20|0,100+80*Math.cos(y/33)+r()*20|0,60+(x+y)/8+r()*20|0,255]));
   const H=__gs.ensureMapTarget(L,'height'),N=__gs.ensureMapTarget(L,'normal');
   const hd=H.depth;
   if(hd===8)up(H,pic((x,y)=>{const v=128+120*Math.sin(x/9)*Math.sin(y/11)|0;return [v,v,v,255];}));
   else{const f=new Float32Array(512*512*4);for(let i=0;i<512*512;i++){const x=i%512,y=i/512|0,v=.5+.45*Math.sin(x/9)*Math.sin(y/11);f.set([v,v,v,1],i*4);}g.bindTexture(g.TEXTURE_2D,H.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,512,512,g.RGBA,g.FLOAT,f);}
   up(N,pic((x,y)=>[128+60*Math.sin(x/7)|0,128+60*Math.cos(y/7)|0,230,255]));
   L.mask=__gs.makeMask(1);up(L.mask.target,pic((x,y)=>{const v=x<256?255:0;return [v,v,v,255];}));
   __gs.changedAll();return {hd,nd:N.depth,md:L.mask.target.depth};});
 console.log('depths',JSON.stringify(setup));
 const snap=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.maps&&l.maps.normal)||__gs.doc.active,rd=t=>Array.from(__gs.readRegion(t,0,0,512,512));
   return {b:rd(L.maps.base),n:rd(L.maps.normal),h:rd(L.maps.height),m:rd(L.mask.target)};});
 const A=await snap();
 const save=async small=>p.evaluate(async sm=>{__gs.prefs.smallFiles=sm?undefined:false;const b=await __gs.encodeGouache();return Array.from(new Uint8Array(b instanceof Blob?await b.arrayBuffer():b.buffer||b));},small);
 const diff=(a,b)=>{let m=0;for(let i=0;i<a.length;i++)m=Math.max(m,Math.abs(a[i]-b[i]));return m;};
 const open=async bytes=>{await p.evaluate(async a=>{await __gs.openGouache(new Uint8Array(a).buffer,'t.gouache');},bytes);await W(600);return snap();};
 const lossless=await save(false),small=await save(true);
 const B=await open(lossless);
 ok(diff(A.b,B.b)===0&&diff(A.n,B.n)===0&&diff(A.h,B.h)===0&&diff(A.m,B.m)===0,'lossless: every map and the mask come back exactly');
 const C=await open(small);
 const db=diff(A.b,C.b);ok(db>0&&db<40&&diff(A.n,C.n)===0&&diff(A.h,C.h)===0&&diff(A.m,C.m)===0,'Smaller files: colour close (max '+db+'), normal, height and mask exact');
 ok(small.length<lossless.length*.8,'Smaller files is smaller: '+lossless.length+' → '+small.length);
 /* an old file (pictures plainly deflated) still opens: rebuild one from the new file's parts */
 const old=await p.evaluate(async a=>{const buf=new Uint8Array(a),dv=new DataView(buf.buffer),hl=dv.getUint32(12,true),head=JSON.parse(new TextDecoder().decode(buf.subarray(16,16+hl))),data=16+hl;
   const parts=[];let off=0;const fix=async r=>{if(!r||r.o==null||!r.f)return;const [x,y,w,h]=r.r||[0,0,r.w,r.h],raw=await __gs.pxUnpack(buf.subarray(data+r.o,data+r.o+r.n),w,h,r.d||8,r.f);
       const z=new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());parts.push(z);r.o=off;r.n=z.length;off+=z.length;delete r.f;};
   const walk=async o=>{if(!o||typeof o!=='object')return;if(o.o!=null&&o.n!=null&&o.f){await fix(o);return;}for(const k in o)await walk(o[k]);};await walk(head);
   const hj=new TextEncoder().encode(JSON.stringify(head)),out=new Uint8Array(16+hj.length+off);out.set(buf.subarray(0,12));new DataView(out.buffer).setUint32(12,hj.length,true);out.set(hj,16);let q=16+hj.length;for(const z of parts){out.set(z,q);q+=z.length;}
   return Array.from(out);},lossless);
 const D=await open(old);ok(diff(A.b,D.b)===0&&diff(A.m,D.m)===0,'an older file (plain deflate) still opens exactly ('+old.length+' bytes)');
 /* .gmat: gzipped, and older plain JSON still reads */
 const g=await p.evaluate(async()=>{const b=await __gs.gmatBlob({kind:'material',name:'x',imgs:{}});const u=new Uint8Array(await b.arrayBuffer());const j1=await __gs.gmatParse(u),j2=await __gs.gmatParse(new TextEncoder().encode('{"kind":"material","name":"y"}'));return {gz:u[0]===0x1f&&u[1]===0x8b,n1:j1.name,n2:j2.name};});
 ok(g.gz&&g.n1==='x'&&g.n2==='y','.gmat files are gzipped; plain ones still open');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
