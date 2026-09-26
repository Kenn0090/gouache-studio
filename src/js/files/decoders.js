/* ================= Decoders ================= */
function loadImageEl(file){return new Promise((res,rej)=>{const url=URL.createObjectURL(file);const img=new Image();
  img.onload=()=>res({w:img.naturalWidth,h:img.naturalHeight,el:img,bits:8});img.onerror=()=>{URL.revokeObjectURL(url);rej(new Error('“'+file.name+'” could not be read as an image.'));};img.src=url;});}
function decodeTGA(buf){
  const d=new Uint8Array(buf);if(d.length<18)throw new Error('This TGA file is truncated.');
  const idLen=d[0],cmType=d[1],type=d[2],cmLen=d[5]|d[6]<<8,cmBits=d[7],w=d[12]|d[13]<<8,h=d[14]|d[15]<<8,bpp=d[16],desc=d[17];
  if(![1,2,3,9,10,11].includes(type))throw new Error('Unsupported TGA image type ('+type+').');
  if(!w||!h)throw new Error('This TGA has no pixels.');
  const gray=type===3||type===11,mapped=type===1||type===9,rle=type>=9;
  const rd=(o,bits)=>{if(bits===8&&gray)return [d[o],d[o],d[o],255];if(bits===16&&gray)return [d[o],d[o],d[o],d[o+1]];
    if(bits===15||bits===16){const v=d[o]|d[o+1]<<8;return [((v>>10)&31)*255/31|0,((v>>5)&31)*255/31|0,(v&31)*255/31|0,255];}
    if(bits===24)return [d[o+2],d[o+1],d[o],255];if(bits===32)return [d[o+2],d[o+1],d[o],d[o+3]];throw new Error('Unsupported TGA pixel depth ('+bits+' bits).');};
  let p=18+idLen;let pal=null;
  if(cmType===1){const cb=Math.ceil(cmBits/8);pal=[];for(let i=0;i<cmLen;i++){pal.push(rd(p,cmBits));p+=cb;}}
  const bytes=Math.ceil(bpp/8),n=w*h,vals=new Array(n);
  const px=o=>mapped?(pal[d[o]|(bytes>1?d[o+1]<<8:0)]||[0,0,0,255]):rd(o,bpp);
  if(!rle){for(let i=0;i<n;i++){vals[i]=px(p);p+=bytes;}}
  else{let i=0;while(i<n&&p<d.length){const c=d[p++],cnt=(c&127)+1;if(c&128){const v=px(p);p+=bytes;for(let k=0;k<cnt&&i<n;k++)vals[i++]=v;}else{for(let k=0;k<cnt&&i<n;k++){vals[i++]=px(p);p+=bytes;}}}}
  const out=new Uint8Array(n*4),top=!!(desc&0x20),right=!!(desc&0x10);let anyA=false;
  for(let i=0;i<n;i++){const fx=i%w,fy=(i/w)|0,x=right?w-1-fx:fx,y=top?fy:h-1-fy,o=(y*w+x)*4,v=vals[i]||[0,0,0,0];out[o]=v[0];out[o+1]=v[1];out[o+2]=v[2];out[o+3]=v[3];if(v[3])anyA=true;}
  if(!anyA)for(let i=3;i<out.length;i+=4)out[i]=255;
  return {w,h,data:out,bits:8};
}
function dec565(c){const r=(c>>11)&31,g=(c>>5)&63,b=c&31;return [(r<<3)|(r>>2),(g<<2)|(g>>4),(b<<3)|(b>>2)];}
function decodeDDS(buf){
  const dv=new DataView(buf);if(buf.byteLength<128||dv.getUint32(0,true)!==0x20534444)throw new Error('This is not a DDS file.');
  const h=dv.getUint32(12,true),w=dv.getUint32(16,true),pf=dv.getUint32(80,true),fc=dv.getUint32(84,true),bits=dv.getUint32(88,true);
  const cc=String.fromCharCode(fc&255,fc>>8&255,fc>>16&255,fc>>>24);let off=128,fmt=null;
  if(pf&4){if(cc==='DXT1')fmt='bc1';else if(cc==='DXT2'||cc==='DXT3')fmt='bc2';else if(cc==='DXT4'||cc==='DXT5')fmt='bc3';
    else if(cc==='DX10'){const g=dv.getUint32(128,true);off=148;fmt={71:'bc1',72:'bc1',74:'bc2',75:'bc2',77:'bc3',78:'bc3',28:'rgba',29:'rgba',87:'bgra',91:'bgra'}[g];
      if(!fmt)throw new Error('This DDS uses DXGI format '+g+(g>=97&&g<=99?' (BC7)':g>=80&&g<=84?' (BC4/BC5)':'')+', which cannot be opened yet. BC1, BC2, BC3 and uncompressed RGBA are supported.');}
    else throw new Error('Unsupported DDS compression “'+cc+'”.');}
  else if(pf&0x40||pf&0x2)fmt='masked';else throw new Error('Unsupported DDS pixel format.');
  const out=new Uint8Array(w*h*4),src=new Uint8Array(buf);
  if(fmt==='rgba'||fmt==='bgra'){for(let i=0;i<w*h;i++){const s=off+i*4,o=i*4;if(fmt==='rgba'){out[o]=src[s];out[o+1]=src[s+1];out[o+2]=src[s+2];}else{out[o]=src[s+2];out[o+1]=src[s+1];out[o+2]=src[s];}out[o+3]=src[s+3];}return {w,h,data:out,bits:8};}
  if(fmt==='masked'){const bpp=bits/8,m=[92,96,100,104].map(k=>dv.getUint32(k,true)),hasA=!!(pf&1);
    const ch=(v,mask)=>{if(!mask)return 255;let sh=0;while(!((mask>>>sh)&1))sh++;const mx=mask>>>sh;return Math.round(((v&mask)>>>sh)*255/mx);};
    for(let i=0;i<w*h;i++){const s=off+i*bpp;let v=0;for(let k=0;k<bpp;k++)v|=src[s+k]<<(8*k);v>>>=0;const o=i*4;
      if(pf&0x2&&!(pf&0x40)){const g=ch(v,m[0]);out[o]=out[o+1]=out[o+2]=g;}else{out[o]=ch(v,m[0]);out[o+1]=ch(v,m[1]);out[o+2]=ch(v,m[2]);}out[o+3]=hasA?ch(v,m[3]):255;}
    return {w,h,data:out,bits:8};}
  const bw=Math.max(1,(w+3)>>2),bh=Math.max(1,(h+3)>>2),bb=fmt==='bc1'?8:16;let p=off;
  for(let by=0;by<bh;by++)for(let bx=0;bx<bw;bx++){
    let alpha=null;
    if(fmt==='bc2'){alpha=[];for(let i=0;i<8;i++){alpha.push((src[p+i]&15)*17,(src[p+i]>>4)*17);}}
    else if(fmt==='bc3'){const a0=src[p],a1=src[p+1],pal=[a0,a1];if(a0>a1)for(let k=1;k<7;k++)pal.push(((7-k)*a0+k*a1)/7|0);else{for(let k=1;k<5;k++)pal.push(((5-k)*a0+k*a1)/5|0);pal.push(0,255);}
      alpha=[];for(let half=0;half<2;half++){const b=p+2+half*3,v=src[b]|src[b+1]<<8|src[b+2]<<16;for(let k=0;k<8;k++)alpha.push(pal[(v>>(3*k))&7]);}}
    const cp=fmt==='bc1'?p:p+8,c0=src[cp]|src[cp+1]<<8,c1=src[cp+2]|src[cp+3]<<8,e0=dec565(c0),e1=dec565(c1);
    const four=fmt!=='bc1'||c0>c1;
    const cols=[e0.concat(255),e1.concat(255),four?e0.map((v,i)=>(2*v+e1[i])/3|0).concat(255):e0.map((v,i)=>(v+e1[i])/2|0).concat(255),four?e0.map((v,i)=>(v+2*e1[i])/3|0).concat(255):[0,0,0,0]];
    const idx=src[cp+4]|src[cp+5]<<8|src[cp+6]<<16|src[cp+7]<<24;
    for(let k=0;k<16;k++){const x=bx*4+(k&3),y=by*4+(k>>2);if(x>=w||y>=h)continue;const c=cols[(idx>>>(2*k))&3],o=(y*w+x)*4;out[o]=c[0];out[o+1]=c[1];out[o+2]=c[2];out[o+3]=alpha?alpha[k]:c[3];}
    p+=bb;}
  return {w,h,data:out,bits:8};
}
function decodeTIFF(buf){
  needLib('UTIF','TIFF');const ifds=UTIF.decode(buf);if(!ifds.length)throw new Error('This TIFF has no images.');
  const img=ifds[0];UTIF.decodeImage(buf,img,ifds);const w=img.width,h=img.height;
  const t=(k,d)=>img[k]?img[k][0]:d;const bps=t('t258',8),spp=t('t277',1),photo=t('t262',2),planar=t('t284',1);
  if(bps===16&&planar===1&&(photo===1||photo===2)){const s=img.data,n=w*h,out=new Uint16Array(n*4),dv=new DataView(s.buffer,s.byteOffset,s.byteLength);
    for(let i=0;i<n;i++){const b=i*spp*2,o=i*4;if(spp>=3){out[o]=dv.getUint16(b,true);out[o+1]=dv.getUint16(b+2,true);out[o+2]=dv.getUint16(b+4,true);out[o+3]=spp>=4?dv.getUint16(b+6,true):65535;}
      else{const g=dv.getUint16(b,true);out[o]=out[o+1]=out[o+2]=photo===0?65535-g:g;out[o+3]=spp===2?dv.getUint16(b+2,true):65535;}}
    return {w,h,data:out,bits:16};}
  const rgba=UTIF.toRGBA8(img);return {w,h,data:new Uint8Array(rgba.buffer,rgba.byteOffset,rgba.length),bits:8};
}
function unpackBits(src,p,outLen){const out=new Uint8Array(outLen);let o=0;while(o<outLen&&p<src.length){const n=src[p++];if(n<128){for(let k=0;k<=n&&o<outLen;k++)out[o++]=src[p++];}else if(n>128){const v=src[p++];for(let k=0;k<257-n&&o<outLen;k++)out[o++]=v;}}return {data:out,next:p};}
