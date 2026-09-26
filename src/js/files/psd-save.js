/* ================= PSD save ================= */
function BW(){let buf=new Uint8Array(1<<20),len=0;const ens=n=>{if(len+n>buf.length){let c=buf.length;while(len+n>c)c*=2;const nb=new Uint8Array(c);nb.set(buf.subarray(0,len));buf=nb;}};
  return {get length(){return len;},u8(v){ens(1);buf[len++]=v&255;},u16(v){ens(2);buf[len++]=(v>>8)&255;buf[len++]=v&255;},u32(v){ens(4);buf[len++]=(v>>>24)&255;buf[len++]=(v>>>16)&255;buf[len++]=(v>>>8)&255;buf[len++]=v&255;},
    str(s){for(let i=0;i<s.length;i++)this.u8(s.charCodeAt(i));},bytes(a){ens(a.length);buf.set(a,len);len+=a.length;},
    setU32(p,v){buf[p]=(v>>>24)&255;buf[p+1]=(v>>>16)&255;buf[p+2]=(v>>>8)&255;buf[p+3]=v&255;},out(){return buf.subarray(0,len);}};}
function packRow(src,off,n){const out=new Uint8Array(n+Math.ceil(n/128)+2);let o=0,i=0;
  while(i<n){let j=i+1;while(j<n&&j-i<128&&src[off+j]===src[off+i])j++;
    if(j-i>=3){out[o++]=(257-(j-i))&255;out[o++]=src[off+i];i=j;continue;}
    let k=i;while(k<n&&k-i<128){if(k+2<n&&src[off+k]===src[off+k+1]&&src[off+k]===src[off+k+2])break;k++;}if(k===i)k=i+1;
    out[o++]=k-i-1;for(let t=i;t<k;t++)out[o++]=src[off+t];i=k;}
  return out.subarray(0,o);}
function rleChannel(plane,W,H){const rows=[];let total=0;for(let y=0;y<H;y++){const r=packRow(plane,y*W,W);rows.push(r);total+=r.length;}
  const out=new Uint8Array(H*2+total);let o=H*2;rows.forEach((r,y)=>{out[y*2]=r.length>>8;out[y*2+1]=r.length&255;out.set(r,o);o+=r.length;});return out;}
async function encodePSD(){
  const W=doc.w,H=doc.h,b16=doc.depth===16,bits=b16?16:8,N=W*H,recs=[],empty=new Uint8Array(0);
  const emptyChans=()=>[-1,0,1,2].map(id=>({id,comp:0,data:empty}));
  const encLayer=async L=>{const st=toStraight(readPremult(L.target),bits),chans=[];
    for(const [id,ci] of [[-1,3],[0,0],[1,1],[2,2]]){
      if(b16){const pl=new Uint8Array(N*2);for(let i=0,j=ci;i<N;i++,j+=4){pl[i*2]=st[j]>>8;pl[i*2+1]=st[j]&255;}chans.push({id,comp:2,data:await zlib(pl)});}
      else{const pl=new Uint8Array(N);for(let i=0,j=ci;i<N;i++,j+=4)pl[i]=st[j];chans.push({id,comp:1,data:rleChannel(pl,W,H)});}}
    await tick();return chans;};
  const encMask=async m=>{const px=readPremult(m.target),sc=px instanceof Float32Array?1:1/255;
    if(b16){const pl=new Uint8Array(N*2);for(let i=0;i<N;i++){const v=Math.round(clamp(px[i*4]*sc,0,1)*65535);pl[i*2]=v>>8;pl[i*2+1]=v&255;}return {id:-2,comp:2,data:await zlib(pl)};}
    const pl=new Uint8Array(N);for(let i=0;i<N;i++)pl[i]=Math.round(clamp(px[i*4]*sc,0,1)*255);return {id:-2,comp:1,data:rleChannel(pl,W,H)};};
  const withMask=async(n,ch)=>{if(n.mask)ch.push(await encMask(n.mask));return ch;};
  const walkSave=async g=>{for(let i=0;i<g.children.length;i++){const n=g.children[i];
    if(n.type==='group'){recs.push({kind:'end',name:'</Layer group>',chans:emptyChans()});await walkSave(n);recs.push({kind:'group',n,name:n.name,chans:await withMask(n,emptyChans())});}
    else recs.push({kind:'layer',n,name:n.name,clipped:!!clipBaseOf(g.children,i),chans:await withMask(n,await encLayer(n))});}};
  await walkSave(doc.root);
  const w=BW();
  w.str('8BPS');w.u16(1);for(let i=0;i<6;i++)w.u8(0);w.u16(b16?3:4);w.u32(H);w.u32(W);w.u16(bits);w.u16(3);
  w.u32(0);w.u32(0);
  const lmPos=w.length;w.u32(0);
  const layerInfo=()=>{w.u16((b16?recs.length:-recs.length)&0xffff);
    recs.forEach(r=>{const n=r.n,full=r.kind==='layer';
      if(full){w.u32(0);w.u32(0);w.u32(H);w.u32(W);}else{w.u32(0);w.u32(0);w.u32(0);w.u32(0);}
      w.u16(r.chans.length);for(const c of r.chans){w.u16(c.id&0xffff);w.u32(c.data.length+2);}
      const key=r.kind==='end'?'norm':r.kind==='group'?(n.mode<0?'pass':PSD_KEYS[n.mode]||'norm'):(PSD_KEYS[n.mode]||'norm');
      const vis=r.kind==='end'?true:n.visible,op=r.kind==='end'?1:n.opacity;
      w.str('8BIM');w.str(key);w.u8(Math.round(clamp(op,0,1)*255));w.u8(r.clipped?1:0);w.u8((full&&n.lockAlpha?1:0)|(vis?0:2)|(full?0:0x18));w.u8(0);
      const exPos=w.length;w.u32(0);const exStart=w.length;
      if(n&&n.mask&&r.kind!=='end'){w.u32(20);w.u32(0);w.u32(0);w.u32(H);w.u32(W);w.u8(255);w.u8(n.mask.enabled?0:2);w.u8(0);w.u8(0);}else w.u32(0);
      w.u32(0);
      const ascii=r.name.replace(/[^\x20-\x7e]/g,'?').slice(0,255),nStart=w.length;w.u8(ascii.length);w.str(ascii);while((w.length-nStart)%4)w.u8(0);
      const uname=r.name.slice(0,255);w.str('8BIM');w.str('luni');const lp=w.length;w.u32(0);const us=w.length;w.u32(uname.length);for(let k=0;k<uname.length;k++)w.u16(uname.charCodeAt(k));while((w.length-us)%4)w.u8(0);w.setU32(lp,w.length-us);
      if(r.kind==='group'){w.str('8BIM');w.str('lsct');w.u32(12);w.u32(n.open?1:2);w.str('8BIM');w.str(key);}
      else if(r.kind==='end'){w.str('8BIM');w.str('lsct');w.u32(4);w.u32(3);}
      w.setU32(exPos,w.length-exStart);});
    for(const {chans} of recs)for(const c of chans){w.u16(c.comp);w.bytes(c.data);}};
  if(!b16){const lp=w.length;w.u32(0);const s0=w.length;layerInfo();while((w.length-s0)%4)w.u8(0);w.setU32(lp,w.length-s0);w.u32(0);}
  else{w.u32(0);w.u32(0);w.str('8BIM');w.str('Lr16');const lp=w.length;w.u32(0);const s0=w.length;layerInfo();while((w.length-s0)%4)w.u8(0);w.setU32(lp,w.length-s0);}
  w.setU32(lmPos,w.length-lmPos-4);
  composite();dirtyComp=false;const cs=toStraight(readPremult(compOut),bits);
  if(!b16){w.u16(1);const rows=[];for(let ci=0;ci<4;ci++){const pl=new Uint8Array(N);for(let i=0;i<N;i++)pl[i]=cs[i*4+ci];for(let y=0;y<H;y++)rows.push(packRow(pl,y*W,W));}
    for(const r of rows)w.u16(r.length);for(const r of rows)w.bytes(r);}
  else{w.u16(0);for(let ci=0;ci<3;ci++){const pl=new Uint8Array(N*2);for(let i=0;i<N;i++){const a=cs[i*4+3]/65535,v=Math.round(cs[i*4+ci]*a+65535*(1-a));pl[i*2]=v>>8;pl[i*2+1]=v&255;}w.bytes(pl);}}
  return new Blob([w.out()],{type:'image/vnd.adobe.photoshop'});
}
