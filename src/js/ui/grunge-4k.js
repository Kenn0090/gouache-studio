/* ================= Grunge at 4K (0.95.7, Kenn) =================
   The photo grunges that come with the app are 1K. Most of them are ambientCG scans (CC0); GR_SRC (made by build.mjs from
   scripts/lib-list.json) says which scan and which of its maps each one was made from, and how (invert, levels, gamma).
   File › Content… can fetch the 4K originals: each scan's 4K zip is downloaded, the one map taken out, turned grey and
   levelled exactly as the 1K build does, and kept as a 4096 px WebP in the add-ons store under 'g4k/<slug>'.
   txPhotoBytes looks there first, so a 4K grunge is used from then on (pictures already loaded stay 1K until the next start). */
const G4_MB=45e6;/* an ambientCG 4K-JPG zip is 10 to 80 MB */
const g4={have:null};
const g4List=()=>(typeof GR_SRC==='undefined'?[]:Object.keys(GR_SRC).filter(s=>TX_PHOTO.some(t=>t[0]===s)));
async function g4Refresh(){const h=new Set();for(const s of g4List()){try{if(await aiDB.info('g4k/'+s))h.add(s);}catch(e){}}g4.have=h;return h;}
const g4Missing=()=>g4List().filter(s=>!(g4.have&&g4.have.has(s)));
async function g4Cached(slug){if(prefs.grunge4k===false||typeof aiDB==='undefined')return null;try{const v=await aiDB.get('g4k/'+slug);return v&&v.buf?new Uint8Array(v.buf):null;}catch(e){return null;}}
/* the same maths as scripts/lib-build.cjs, at 4096 px */
async function g4Make(bytes,R){const bm=await createImageBitmap(new Blob([bytes]));const S=4096,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d',{willReadFrequently:true});
  x.drawImage(bm,0,0,S,S);bm.close&&bm.close();const id=x.getImageData(0,0,S,S),d=id.data,n=S*S,g=new Uint8Array(n),hist=new Uint32Array(256);
  for(let i=0;i<n;i++){let v=Math.round(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2]);if(R.inv)v=255-v;g[i]=v;hist[v]++;}
  const pct=pc=>{let s=0;const t=n*pc/100;for(let v=0;v<256;v++){s+=hist[v];if(s>=t)return v;}return 255;};
  const lo=pct(R.lo==null?.5:R.lo),hi=Math.max(lo+8,pct(R.hi==null?99.5:R.hi)),gm=R.g||1;
  for(let i=0;i<n;i++){let v=Math.min(1,Math.max(0,(g[i]-lo)/(hi-lo)));v=Math.pow(v,gm)*255+.5;d[i*4]=d[i*4+1]=d[i*4+2]=v;d[i*4+3]=255;}
  x.putImageData(id,0,0);const blob=await new Promise(r=>c.toBlob(r,'image/webp',.9));c.width=c.height=1;return new Uint8Array(await blob.arrayBuffer());}
async function g4Get(slug,setJob){const R=GR_SRC[slug];if(!R)throw new Error('no source');const id='g4'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);setJob&&setJob(id);
  let ab;try{ab=await platform.invoke('net_download',{id,url:'https://ambientcg.com/get?file='+R.id+'_4K-JPG.zip'});}finally{setJob&&setJob(null);}
  const buf=ab instanceof ArrayBuffer?ab:(ab&&ab.buffer)||new Uint8Array(ab).buffer,files=await miUnzip(buf),want='_'+R.ch.toLowerCase()+'.';
  const f=files.find(z=>z.name.toLowerCase().includes(want)&&/\.(jpe?g|png)$/i.test(z.name));if(!f)throw new Error(R.ch+' map missing');
  const raw=new Uint8Array(await f.arrayBuffer());
  const out=await g4Make(raw,R);await aiDB.put('g4k/'+slug,{buf:out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength),size:out.byteLength,v:1});if(g4.have)g4.have.add(slug);return out.byteLength;}
async function g4Back(){for(const s of g4List()){try{await aiDB.del('g4k/'+s);}catch(e){}}g4.have=new Set();toast('The grunge maps are back to the 1K ones that come with the app (from the next start).');}
