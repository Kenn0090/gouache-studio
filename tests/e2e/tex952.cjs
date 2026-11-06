/* 0.95.2 (Kenn: smaller 4K textures): grey material pictures kept in one channel; grey maps at 2K inside 4K materials */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1300,height:800}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{const g=__gs,N=512;
  /* a grey gradient picture for roughness */
  const mk=()=>{const t=g.makeTarget(N,N,8,true),d=new Uint8Array(N*N*4);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(y*N+x)*4,v=Math.round(x/(N-1)*255);d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;}g.writeRegion(t,0,0,N,N,d);return t;};
  const roughOf=L=>{const t=g.compositeMap('rough'),d=g.captureRegionNow(t,0,0,t.w,t.h).data,row=t.h>>1,o=[];for(const fx of [.1,.5,.9]){const i=(row*t.w+Math.round(fx*(t.w-1)))*4;o.push(d[i]);}g.release(t);return o;};
  if(!g.doc.maps.includes('rough'))g.doc.maps.push('rough');
  const L=g.cmdNewFillLayer();L.fill.maps.rough.on=true;L.fill.maps.rough.src='image';L._fillImg=L._fillImg||{};L._fillImg.rough=mk();
  g.prefs.monoGrey=false;g.fillRender(L);const before=roughOf(L),wasMono=!!L._fillImg.rough.mono;
  g.prefs.monoGrey=undefined;g.fillRender(L);const after=roughOf(L),img=L._fillImg.rough;
  const cap=Array.from(g.captureRegionNow(img,0,0,N,1).data.slice(4*256,4*256+4));
  const asy=Array.from((await g.readRegionAsync(img,0,0,N,1)).slice(4*256,4*256+4));
  const C=g.cloneNode(L),cImg=C._fillImg.rough;const rgba=g.makeTarget(N,N,8,true);g.blit(img,rgba,0,0,N,N,0,0);const back=Array.from(g.captureRegionNow(rgba,0,0,N,1).data.slice(4*256,4*256+4));const sm=g.makeTarget(64,64,8,false);g.copyScaled(img,sm);const sc=Array.from(g.captureRegionNow(sm,0,0,64,1).data.slice(4*32,4*32+4));
  /* grey maps at 2K in a 4K material */
  const file=async(name,col)=>{const c=new OffscreenCanvas(2600,8),x=c.getContext('2d');x.fillStyle=col;x.fillRect(0,0,2600,8);return new File([await c.convertToBlob({type:'image/png'})],name,{type:'image/png'});};
  const files=[await file('Mat_Color.png','#c08040'),await file('Mat_Roughness.png','#808080'),await file('Mat_Normal.png','#8080ff')];
  const on=await g.miBuild(files,'Mat',4096);g.prefs.grey2k=false;const off=await g.miBuild(files,'Mat',4096);g.prefs.grey2k=undefined;const small=await g.miBuild(files,'Mat',1024);
  return {wasMono,mono:!!img.mono,before,after,cap,asy,cloneMono:!!cImg.mono,back,sc,on:{b:on.imgs.base.w,r:on.imgs.rough.w,n:on.imgs.normal.w},off:off.imgs.rough.w,small:small.imgs.rough.w};});
 console.log(JSON.stringify(r));
 ok(!r.wasMono&&r.mono,'a grey material picture is kept in one channel once drawn');
 ok(r.before.every((v,i)=>Math.abs(v-r.after[i])<=1),'…and the roughness looks the same '+JSON.stringify([r.before,r.after]));
 ok(r.cap[0]===r.cap[1]&&r.cap[1]===r.cap[2]&&Math.abs(r.cap[0]-128)<=2&&r.cap[3]===255&&r.asy.join()===r.cap.join(),'reading it back (saving) gives the grey picture '+JSON.stringify([r.cap,r.asy]));
 ok(r.cloneMono&&r.back[0]===r.back[1]&&r.back[1]===r.back[2]&&Math.abs(r.back[0]-128)<=2,'copies keep one channel, and copying into a colour picture gives grey');
 ok(r.sc[0]===r.sc[1]&&r.sc[1]===r.sc[2]&&Math.abs(r.sc[0]-128)<=4,'a shrunk copy (thumbnails) is grey too '+JSON.stringify(r.sc));
 ok(r.on.b===2600&&r.on.n===2600&&r.on.r===2048,'4K material: colour and normal stay full size, roughness 2K '+JSON.stringify(r.on));
 ok(r.off===2600&&r.small===1024,'the switch off keeps roughness full size; a 1K material is unchanged');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
