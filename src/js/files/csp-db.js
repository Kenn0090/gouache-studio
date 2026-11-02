/* ================= Clip Studio Paint brushes (0.93.2) =================
   A .sut (one brush) or .sutg (a group of brushes) is an SQLite database: the table Node lists the brushes by name, Variant holds each brush's
   settings (size, hardness, spacing, rotation, spray, pen pressure flags, texture) and MaterialFile holds the pictures (tips and papers) as small
   tar archives whose data/material_0.layer is a PNG. Checked against a real .sutg. Only a small read-only SQLite reader is needed. */
function sqliteTables(u8,want){const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  if(u8.length<100||String.fromCharCode(...u8.subarray(0,15))!=='SQLite format 3')throw new Error('not an SQLite file');
  let ps=dv.getUint16(16);if(ps===1)ps=65536;const U=ps-u8[20],X=U-35,M=((U-12)*32/255|0)-23;
  const page=n=>(n-1)*ps;
  const vint=(p)=>{let v=0n,i=0;for(;i<8;i++){const b=u8[p+i];v=(v<<7n)|BigInt(b&127);if(!(b&128))return [Number(v),i+1];}v=(v<<8n)|BigInt(u8[p+8]);return [Number(v),9];};
  const cells=(root,out)=>{const base=page(root),off=root===1?100:0,type=u8[base+off],n=dv.getUint16(base+off+3);
    if(type===0x05){const hdr=base+off+12;for(let i=0;i<n;i++){const c=dv.getUint16(hdr+i*2);cells(dv.getUint32(base+c),out);}cells(dv.getUint32(base+off+8),out);return;}
    if(type!==0x0d)return;const hdr=base+off+8;
    for(let i=0;i<n;i++){let p=base+dv.getUint16(hdr+i*2);let r=vint(p);const P=r[0];p+=r[1];r=vint(p);const rowid=r[0];p+=r[1];
      let payload;if(P<=X)payload=u8.subarray(p,p+P);else{let K=M+((P-M)%(U-4));const local=K<=X?K:M;payload=new Uint8Array(P);payload.set(u8.subarray(p,p+local),0);let got=local,next=dv.getUint32(p+local);
        while(next&&got<P){const b=page(next),take=Math.min(U-4,P-got);payload.set(u8.subarray(b+4,b+4+take),got);got+=take;next=dv.getUint32(b);}}
      out.push([rowid,payload]);}};
  const record=(pl)=>{const pd=new DataView(pl.buffer,pl.byteOffset,pl.byteLength);let r=vintAt(pl,0);const hs=r[0];let p=r[1];const types=[];while(p<hs){r=vintAt(pl,p);types.push(r[0]);p+=r[1];}
    let q=hs;const vals=[];for(const t of types){let v=null;
      if(t===0)v=null;else if(t>=1&&t<=6){const len=[0,1,2,3,4,6,8][t];let x=0n;for(let k=0;k<len;k++)x=(x<<8n)|BigInt(pl[q+k]);if(len&&pl[q]&128)x-=1n<<BigInt(len*8);v=Number(x);q+=len;}
      else if(t===7){v=pd.getFloat64(q);q+=8;}else if(t===8)v=0;else if(t===9)v=1;
      else if(t>=12&&t%2===0){const len=(t-12)/2;v=pl.subarray(q,q+len);q+=len;}else if(t>=13){const len=(t-13)/2;v=new TextDecoder().decode(pl.subarray(q,q+len));q+=len;}
      vals.push(v);}return vals;};
  const vintAt=(a,p)=>{let v=0n,i=0;for(;i<8;i++){const b=a[p+i];v=(v<<7n)|BigInt(b&127);if(!(b&128))return [Number(v),i+1];}v=(v<<8n)|BigInt(a[p+8]);return [Number(v),9];};
  const master=[];cells(1,master);const out={};
  for(const [,pl] of master){const m=record(pl);if(m[0]!=='table'||(want&&!want.includes(m[1])))continue;
    const sql=m[4]||'',body=sql.slice(sql.indexOf('(')+1,sql.lastIndexOf(')')),defs=[];let d=0,cur='';for(const ch of body){if(ch==='(')d++;if(ch===')')d--;if(ch===','&&d===0){defs.push(cur);cur='';}else cur+=ch;}defs.push(cur);
    const cols=[],pk=[];for(const df of defs){const t=df.trim();if(/^(primary|unique|check|foreign|constraint)\b/i.test(t))continue;const nm=t.match(/^["`\[]?([^"`\]\s]+)["`\]]?/)[1];cols.push(nm);pk.push(/integer\s+primary\s+key/i.test(t));}
    const rows=[];const tmp=[];cells(m[3],tmp);for(const [rowid,pl2] of tmp){const v=record(pl2),o={};cols.forEach((c,i)=>{o[c]=pk[i]&&v[i]==null?rowid:v[i]===undefined?null:v[i];});rows.push(o);}
    out[m[1]]=rows;}
  return out;}
/* a CSP material blob is a tar archive; the tip or paper is the PNG in data/material_0.layer */
function cspMaterialPng(b){if(!(b instanceof Uint8Array))return null;const oct=(s,e)=>parseInt(String.fromCharCode(...b.subarray(s,e)).replace(/[\0 ]+$/,'').trim()||'0',8);
  let p=0;while(p+512<=b.length){let e=p;while(e<p+100&&b[e])e++;const name=String.fromCharCode(...b.subarray(p,e));if(!name)break;const size=oct(p+124,p+136),d=p+512;
    if(/\.layer$/i.test(name)&&size>8&&b[d]===0x89&&b[d+1]===0x50)return b.subarray(d,d+size);p=d+Math.ceil(size/512)*512;}
  for(let i=b.length-8;i>=0;i--)if(b[i]===0x89&&b[i+1]===0x50&&b[i+2]===0x4e&&b[i+3]===0x47)return b.subarray(i);return null;}
/* the blob that names a material (UTF-16, little endian, like ".:98:04:4fa0…:data:material_0.layer") */
function cspBlobPath(b){if(!(b instanceof Uint8Array))return '';let s=-1;for(let i=0;i+3<b.length;i++)if(b[i]===0x2e&&b[i+1]===0&&b[i+2]===0x3a&&b[i+3]===0){s=i;break;}
  if(s<0)return '';let o='';for(let i=s;i+1<b.length;i+=2){const c=b[i]|(b[i+1]<<8);if(!c)break;o+=String.fromCharCode(c);}return o;}
const cspPress=b=>b instanceof Uint8Array&&b.length>=12&&((b[8]<<24|b[9]<<16|b[10]<<8|b[11])&0x10)!==0;
async function cspFromDb(u8,fileName,notes){const T=sqliteTables(u8,['Node','Variant','MaterialFile']),nodes=T.Node||[],vars=new Map((T.Variant||[]).map(v=>[v.VariantID,v])),mats=new Map((T.MaterialFile||[]).map(m=>[m.OriginalPath,m]));
  const presets=[],tips=[];let k=0;
  for(const nd of nodes){const v=vars.get(nd.NodeVariantID);if(!v||v.BrushSize==null||!(nd.NodeName||'').trim())continue;
    const mm=v.BrushSizeUnit===2,size=clamp(Math.round(mm?v.BrushSize*350/25.4:v.BrushSize),2,600),x={size,hardness:clamp((v.BrushHardness==null?100:v.BrushHardness)/100,0,1),opacity:clamp((v.Opacity==null?100:v.Opacity)/100,.05,1),flow:clamp((v.BrushFlow==null?100:v.BrushFlow)/100,.05,1),
      spacing:clamp((v.BrushInterval||1)/100,.01,1.5),roundness:clamp((v.BrushThickness==null?100:v.BrushThickness)/100,.05,1),angle:v.BrushRotation||0,angleJitter:clamp((v.BrushRotationRandomScale||0)/100,0,1),
      pSize:cspPress(v.BrushSizeEffector),pOpacity:cspPress(v.BrushOpacityEffector),pFlow:cspPress(v.BrushFlowEffector),minSize:.3,smoothing:.25};
    if(v.BrushUseSpray){const sp=mm?v.BrushSpraySize*350/25.4:v.BrushSpraySize;x.scatter=clamp(sp/Math.max(1,size),0,2);x.bothAxes=true;x.count=clamp(Math.round(v.BrushSprayDensity||1),1,8);}
    if(v.TextureImage&&cspBlobPath(v.TextureImage)){const tm=mats.get(cspBlobPath(v.TextureImage)),tpng=tm&&cspMaterialPng(tm.FileData);let tt=null;
      if(tpng){try{const im=await bzBitmap(tpng);tt=bzTexTipFromRGBA('Texture · '+nd.NodeName.trim()+' '+(tips.length+1),im.data,im.width,im.height);tips.push(tt);x.texKey='u:'+tt.name;x.texDepth=clamp((v.TextureDensity==null?100:v.TextureDensity)/100,0,1);x.texScale=clamp(Math.round(im.width*(v.TextureScale2||100)/100),16,1024);}catch(e){tt=null;}}
      if(!tt)x.grain=clamp(.35*(v.TextureDensity==null?100:v.TextureDensity)/100,.1,.9);}
    if(v.BrushUseIn&&v.BrushInLength>0){x.taperStart=Math.round(clamp(v.BrushInLengthUnit===2?v.BrushInLength*350/25.4:v.BrushInLength,0,400));x.pSize=true;}
    if(v.BrushUseOut&&v.BrushOutLength>0){x.taperEnd=Math.round(clamp(v.BrushOutLengthUnit===2?v.BrushOutLength*350/25.4:v.BrushOutLength,0,400));x.pSize=true;}
    let tip=null;if(v.BrushUsePatternImage){const m=mats.get(cspBlobPath(v.BrushPatternImageArray)),png=m&&cspMaterialPng(m.FileData);
      if(png){try{tip=bzTipAlpha(await bzBitmap(png));}catch(e){}}}
    k++;const nm=nd.NodeName.trim()||baseName(fileName)+' '+k;
    if(tip){const r=bzPresetFromTip(nm,tip,x);tips.push(r.tipObj);presets.push(r.preset);}
    else presets.push(Object.assign({},BRUSH_DEFAULTS,{name:nm,tool:'brush',tip:null},x));}
  if(presets.length){notes.add('Clip Studio settings read: size, hardness, opacity, flow, spacing, roundness, rotation, spray, pen pressure on or off, and the texture picture, and start and end tapering (approximated).');
    notes.add('Not applied: pressure curves, ink and water colour mixing.');}
  return {presets,tips,notes};}
