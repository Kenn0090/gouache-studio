/* ================= Encoders ================= */
function chunk(type,data){const out=new Uint8Array(12+data.length),dv=new DataView(out.buffer);dv.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=type.charCodeAt(i);out.set(data,8);dv.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;}
async function encodePNG16(W,H,st){const row=1+W*8,raw=new Uint8Array(row*H);
  for(let y=0;y<H;y++){let o=y*row+1;for(let i=y*W*4,e=i+W*4;i<e;i++){const q=st[i];raw[o++]=q>>8;raw[o++]=q&255;}}
  const z=await zlib(raw),ih=new Uint8Array(13),dv=new DataView(ih.buffer);dv.setUint32(0,W);dv.setUint32(4,H);ih[8]=16;ih[9]=6;
  return new Blob([new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',z),chunk('IEND',new Uint8Array(0))],{type:'image/png'});}
function canvasBlob(W,H,st,type,q,flatten){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),id=x.createImageData(W,H),d=id.data;
  if(flatten){for(let i=0;i<d.length;i+=4){const a=st[i+3]/255;d[i]=st[i]*a;d[i+1]=st[i+1]*a;d[i+2]=st[i+2]*a;d[i+3]=255;}}else d.set(st);
  x.putImageData(id,0,0);return new Promise((res,rej)=>c.toBlob(b=>{if(!b||b.type!==type)rej(new Error('This browser cannot encode '+type.split('/')[1].toUpperCase()+'.'));else res(b);},type,q));}
function encodeTGA(W,H,st,rle,alpha){const bpp=alpha?4:3,hdr=new Uint8Array(18);hdr[2]=rle?10:2;hdr[12]=W&255;hdr[13]=W>>8;hdr[14]=H&255;hdr[15]=H>>8;hdr[16]=bpp*8;hdr[17]=(alpha?8:0)|0x20;
  const body=new Uint8Array(W*H*bpp+H*(Math.ceil(W/128)+1)+16);let o=0;
  const put=i=>{const j=i*4;body[o++]=st[j+2];body[o++]=st[j+1];body[o++]=st[j];if(alpha)body[o++]=st[j+3];};
  const same=(i,j)=>{i*=4;j*=4;return st[i]===st[j]&&st[i+1]===st[j+1]&&st[i+2]===st[j+2]&&(!alpha||st[i+3]===st[j+3]);};
  for(let y=0;y<H;y++){const r=y*W;if(!rle){for(let x=0;x<W;x++)put(r+x);continue;}
    let x=0;while(x<W){let n=1;while(x+n<W&&n<128&&same(r+x,r+x+n))n++;
      if(n>=2){body[o++]=0x80|(n-1);put(r+x);x+=n;}
      else{n=1;while(x+n<W&&n<128&&!(x+n+1<W&&same(r+x+n,r+x+n+1)))n++;body[o++]=n-1;for(let k=0;k<n;k++)put(r+x+k);x+=n;}}}
  const foot=new Uint8Array(26);const sig='TRUEVISION-XFILE.';for(let i=0;i<sig.length;i++)foot[8+i]=sig.charCodeAt(i);
  return new Blob([hdr,body.subarray(0,o),foot],{type:'image/x-tga'});}
function enc565(r,g,b){return ((clamp(Math.round(r*31/255),0,31))<<11)|((clamp(Math.round(g*63/255),0,63))<<5)|clamp(Math.round(b*31/255),0,31);}
function encodeColorBlock(blk,allowTrans,out,o){
  const pts=[];let trans=false;for(let i=0;i<16;i++){if(allowTrans&&blk[i*4+3]<128){trans=true;continue;}pts.push(i);}
  const dv=new DataView(out.buffer,out.byteOffset+o,8);
  if(!pts.length){dv.setUint16(0,0,true);dv.setUint16(2,0,true);dv.setUint32(4,0xffffffff,true);return;}
  let mr=0,mg=0,mb=0;for(const i of pts){mr+=blk[i*4];mg+=blk[i*4+1];mb+=blk[i*4+2];}const n=pts.length;mr/=n;mg/=n;mb/=n;
  let xx=0,xy=0,xz=0,yy=0,yz=0,zz=0;for(const i of pts){const r=blk[i*4]-mr,g=blk[i*4+1]-mg,b=blk[i*4+2]-mb;xx+=r*r;xy+=r*g;xz+=r*b;yy+=g*g;yz+=g*b;zz+=b*b;}
  let v=[.577,.577,.577];for(let k=0;k<8;k++){const a=xx*v[0]+xy*v[1]+xz*v[2],b=xy*v[0]+yy*v[1]+yz*v[2],c=xz*v[0]+yz*v[1]+zz*v[2],l=Math.hypot(a,b,c);if(l<1e-9)break;v=[a/l,b/l,c/l];}
  let mn=Infinity,mx=-Infinity;for(const i of pts){const t=(blk[i*4]-mr)*v[0]+(blk[i*4+1]-mg)*v[1]+(blk[i*4+2]-mb)*v[2];if(t<mn)mn=t;if(t>mx)mx=t;}
  const ins=(mx-mn)/16;mn+=ins;mx-=ins;
  let c0=enc565(mr+v[0]*mx,mg+v[1]*mx,mb+v[2]*mx),c1=enc565(mr+v[0]*mn,mg+v[1]*mn,mb+v[2]*mn);
  if(!trans){if(c0<c1){const t=c0;c0=c1;c1=t;}}else if(c0>c1){const t=c0;c0=c1;c1=t;}
  const p0=dec565(c0),p1=dec565(c1);
  const pal=c0>c1?[p0,p1,p0.map((q,i)=>(2*q+p1[i])/3),p0.map((q,i)=>(q+2*p1[i])/3)]:[p0,p1,p0.map((q,i)=>(q+p1[i])/2),null];
  let idx=0;for(let i=0;i<16;i++){let best=0;
    if(trans&&blk[i*4+3]<128)best=3;
    else{let bd=Infinity;for(let k=0;k<4;k++){const c=pal[k];if(!c)continue;const d=(blk[i*4]-c[0])**2+(blk[i*4+1]-c[1])**2+(blk[i*4+2]-c[2])**2;if(d<bd){bd=d;best=k;}}}
    idx|=best<<(2*i);}
  dv.setUint16(0,c0,true);dv.setUint16(2,c1,true);dv.setUint32(4,idx>>>0,true);}
function encodeAlphaBlock(blk,out,o){let a0=0,a1=255;for(let i=0;i<16;i++){const a=blk[i*4+3];if(a>a0)a0=a;if(a<a1)a1=a;}
  out[o]=a0;out[o+1]=a1;const pal=[a0,a1];for(let k=1;k<7;k++)pal.push(((7-k)*a0+k*a1)/7);
  const ix=[];for(let i=0;i<16;i++){const a=blk[i*4+3];let best=0,bd=Infinity;if(a0!==a1)for(let k=0;k<8;k++){const d=Math.abs(a-pal[k]);if(d<bd){bd=d;best=k;}}ix.push(best);}
  for(let h=0;h<2;h++){let v=0;for(let k=0;k<8;k++)v|=ix[h*8+k]<<(3*k);out[o+2+h*3]=v&255;out[o+3+h*3]=(v>>8)&255;out[o+4+h*3]=(v>>16)&255;}}
function mipChain(w,h,px){const levels=[{w,h,px}];while(w>1||h>1){const nw=Math.max(1,w>>1),nh=Math.max(1,h>>1),n=new Uint8Array(nw*nh*4);
  for(let y=0;y<nh;y++)for(let x=0;x<nw;x++){let r=0,g=0,b=0,a=0;for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++){const sx=Math.min(w-1,x*2+dx),sy=Math.min(h-1,y*2+dy),i=(sy*w+sx)*4,al=px[i+3];r+=px[i]*al;g+=px[i+1]*al;b+=px[i+2]*al;a+=al;}
    const o=(y*nw+x)*4;if(a>0){n[o]=r/a+.5|0;n[o+1]=g/a+.5|0;n[o+2]=b/a+.5|0;}n[o+3]=a/4+.5|0;}
  levels.push({w:nw,h:nh,px:n});w=nw;h=nh;px=n;}return levels;}
async function encodeDDS(W,H,st,fmt,mips){
  const levels=mips?mipChain(W,H,st):[{w:W,h:H,px:st}],bb=fmt==='bc1'?8:16,parts=[];
  for(const L of levels){
    if(fmt==='rgba'){const b=new Uint8Array(L.w*L.h*4);for(let i=0;i<L.w*L.h;i++){b[i*4]=L.px[i*4+2];b[i*4+1]=L.px[i*4+1];b[i*4+2]=L.px[i*4];b[i*4+3]=L.px[i*4+3];}parts.push(b);continue;}
    const bw=Math.max(1,(L.w+3)>>2),bh=Math.max(1,(L.h+3)>>2),out=new Uint8Array(bw*bh*bb),blk=new Uint8Array(64);let o=0;
    for(let by=0;by<bh;by++){for(let bx=0;bx<bw;bx++){
      for(let k=0;k<16;k++){const x=Math.min(L.w-1,bx*4+(k&3)),y=Math.min(L.h-1,by*4+(k>>2)),i=(y*L.w+x)*4;blk[k*4]=L.px[i];blk[k*4+1]=L.px[i+1];blk[k*4+2]=L.px[i+2];blk[k*4+3]=L.px[i+3];}
      if(fmt==='bc3'){encodeAlphaBlock(blk,out,o);encodeColorBlock(blk,false,out,o+8);}else encodeColorBlock(blk,true,out,o);o+=bb;}
      if(by%64===63)await tick();}
    parts.push(out);}
  const hd=new DataView(new ArrayBuffer(128));hd.setUint32(0,0x20534444,true);hd.setUint32(4,124,true);
  hd.setUint32(8,0x1|0x2|0x4|0x1000|(mips?0x20000:0)|(fmt==='rgba'?0x8:0x80000),true);hd.setUint32(12,H,true);hd.setUint32(16,W,true);
  hd.setUint32(20,fmt==='rgba'?W*4:Math.max(1,(W+3)>>2)*Math.max(1,(H+3)>>2)*bb,true);hd.setUint32(28,levels.length,true);hd.setUint32(76,32,true);
  if(fmt==='rgba'){hd.setUint32(80,0x41,true);hd.setUint32(88,32,true);hd.setUint32(92,0x00ff0000,true);hd.setUint32(96,0x0000ff00,true);hd.setUint32(100,0x000000ff,true);hd.setUint32(104,0xff000000,true);}
  else{hd.setUint32(80,0x4,true);const cc=fmt==='bc1'?'DXT1':'DXT5';hd.setUint32(84,cc.charCodeAt(0)|cc.charCodeAt(1)<<8|cc.charCodeAt(2)<<16|cc.charCodeAt(3)<<24,true);}
  hd.setUint32(108,0x1000|(mips?0x400008:0),true);
  return new Blob([hd,...parts],{type:'image/vnd-ms.dds'});}
async function encodeTIFF(W,H,st,bits){const raw=new Uint8Array(W*H*4*(bits/8));
  if(bits===16)for(let i=0;i<st.length;i++){raw[i*2]=st[i]&255;raw[i*2+1]=st[i]>>8;}else raw.set(st);
  const comp=await zlib(raw);
  const E=[[256,4,1,W],[257,4,1,H],[258,3,4,'BPS'],[259,3,1,8],[262,3,1,2],[273,4,1,'DATA'],[277,3,1,4],[278,4,1,H],[279,4,1,comp.length],[284,3,1,1],[338,3,1,2]];
  const ifdLen=2+E.length*12+4,bpsOff=8+ifdLen,dataOff=bpsOff+8,hd=new DataView(new ArrayBuffer(dataOff));
  hd.setUint16(0,0x4949,true);hd.setUint16(2,42,true);hd.setUint32(4,8,true);hd.setUint16(8,E.length,true);
  E.forEach(([tag,type,count,val],i)=>{const p=10+i*12,v=val==='BPS'?bpsOff:val==='DATA'?dataOff:val;hd.setUint16(p,tag,true);hd.setUint16(p+2,type,true);hd.setUint32(p+4,count,true);if(type===3&&count===1)hd.setUint16(p+8,v,true);else hd.setUint32(p+8,v,true);});
  hd.setUint32(10+E.length*12,0,true);for(let k=0;k<4;k++)hd.setUint16(bpsOff+k*2,bits,true);
  return new Blob([hd,comp],{type:'image/tiff'});}
const _f32=new Float32Array(1),_u32=new Uint32Array(_f32.buffer);
function f2h(v){_f32[0]=v;const x=_u32[0],s=(x>>>16)&0x8000;let e=((x>>>23)&255)-112;const m=x&0x7fffff;
  if(e<=0){if(e<-10)return s;const mm=(m|0x800000)>>>(1-e);return s|((mm+0x1000)>>>13);}if(e>=31)return s|0x7c00;return s+(e<<10)+((m+0x1000)>>>13);}
function encodeEXR(W,H,px){const sc=px instanceof Float32Array?1:1/255,Hd=[];
  const u8=v=>Hd.push(v&255),i32=v=>{for(let k=0;k<4;k++)Hd.push((v>>>(8*k))&255);},f32=v=>{Hd.push(...new Uint8Array(new Float32Array([v]).buffer));},str=s=>{for(const c of s)Hd.push(c.charCodeAt(0));Hd.push(0);};
  const attr=(n,t,size,fn)=>{str(n);str(t);i32(size);fn();};
  i32(20000630);i32(2);
  attr('channels','chlist',73,()=>{for(const c of 'ABGR'){str(c);i32(1);u8(0);u8(0);u8(0);u8(0);i32(1);i32(1);}u8(0);});
  attr('compression','compression',1,()=>u8(0));
  attr('dataWindow','box2i',16,()=>{i32(0);i32(0);i32(W-1);i32(H-1);});
  attr('displayWindow','box2i',16,()=>{i32(0);i32(0);i32(W-1);i32(H-1);});
  attr('lineOrder','lineOrder',1,()=>u8(0));
  attr('pixelAspectRatio','float',4,()=>f32(1));
  attr('screenWindowCenter','v2f',8,()=>{f32(0);f32(0);});
  attr('screenWindowWidth','float',4,()=>f32(1));
  u8(0);
  const hl=Hd.length,lb=8+W*8,out=new Uint8Array(hl+H*8+H*lb),dv=new DataView(out.buffer);out.set(Hd);let off=hl+H*8;
  for(let y=0;y<H;y++){dv.setUint32(hl+y*8,off,true);dv.setInt32(off,y,true);dv.setInt32(off+4,W*8,true);let p=off+8;
    for(const ci of [3,2,1,0])for(let x=0;x<W;x++){const i=(y*W+x)*4,a=Math.min(1,px[i+3]*sc);let v;if(ci===3)v=a;else{const c=a>0?Math.min(1,Math.max(0,px[i+ci]*sc/a)):0;v=srgb2lin(c)*a;}dv.setUint16(p,f2h(v),true);p+=2;}
    off+=lb;}
  return new Blob([out],{type:'image/x-exr'});}
