/* ================= Import a material from textures (0.27) =================
   Kenn builds his library from free sites (ambientCG, Poly Haven, ShareTextures…). Each ships a material as a folder
   (or a .zip) of images named like Bricks_Color / _NormalGL / _Roughness / _Displacement, or Poly Haven's
   brick_diff_2k / _nor_gl_2k / _arm_2k (AO, roughness and metal packed in red, green and blue). Pick the folder,
   the files or the .zip: the images are sorted into channels by name and saved as a material in Materials. */
const MI_EXT=['png','jpg','jpeg','webp','tga','tif','tiff','bmp','exr'];
/* channel words, checked in this order (a file matches the first channel with one of its words) */
const MI_WORDS=[
  ['arm',['arm','orm']],
  ['normal',['normalgl','normaldx','normal','nor','nrm','norm','normalmap']],
  ['base',['basecolor','basecolour','albedo','diffuse','diff','color','colour','col','base']],
  ['rough',['roughness','rough','rgh']],
  ['gloss',['glossiness','gloss']],
  ['metal',['metalness','metallic','metal','met','mtl']],
  ['height',['displacement','disp','height','heightmap','bump','dsp']],
  ['ao',['ambientocclusion','ao','occlusion','occ']],
  ['emis',['emission','emissive','emit','emiss','glow']],
  ['opac',['opacity','alpha','transparency','cutout']]];
const MI_SKIP=['preview','thumb','thumbnail','sphere','cube','render','swatch','icon'];
const miTokens=n=>n.toLowerCase().replace(/\.[a-z0-9]+$/,'').split(/[^a-z0-9]+/).filter(Boolean);
/* which channel a file name is (or null), and whether a normal map is DirectX style (green down) */
function miChannel(name){const t=miTokens(name);if(t.some(w=>MI_SKIP.includes(w)))return null;
  for(const [k,words] of MI_WORDS)if(t.some(w=>words.includes(w))){
    if(k==='normal'){const dx=t.includes('normaldx')||t.includes('dx')||t.includes('directx');return {k,dx:dx&&!t.includes('gl')&&!t.includes('normalgl')};}
    return {k};}
  return null;}
/* the material's name: the words the files share, without channel, size and format words */
function miName(names,folder){if(folder)return folder;const lists=names.map(miTokens);if(!lists.length)return 'Material';
  const drop=new Set([].concat(...MI_WORDS.map(x=>x[1]),['gl','dx','png','jpg','jpeg','exr','tif','1k','2k','4k','8k','16k','map','tex','texture']));
  const first=lists[0].filter(w=>!drop.has(w)&&lists.every(l=>l.includes(w)));
  const nm=first.join(' ').trim()||baseName(names[0]).replace(/[_-]+/g,' ');return nm.charAt(0).toUpperCase()+nm.slice(1);}
/* a .zip's files (stored or deflated), as File objects */
async function miUnzip(buf){const d=new DataView(buf),u8=new Uint8Array(buf),out=[];let e=-1;
  for(let i=buf.byteLength-22;i>=Math.max(0,buf.byteLength-66000);i--)if(d.getUint32(i,true)===0x06054b50){e=i;break;}
  if(e<0)throw new Error('This .zip could not be read.');
  let n=d.getUint16(e+10,true),p=d.getUint32(e+16,true);const dec=new TextDecoder();
  while(n-->0&&d.getUint32(p,true)===0x02014b50){const meth=d.getUint16(p+10,true),csz=d.getUint32(p+20,true),nl=d.getUint16(p+28,true),xl=d.getUint16(p+30,true),cl=d.getUint16(p+32,true),off=d.getUint32(p+42,true);
    const name=dec.decode(u8.subarray(p+46,p+46+nl));p+=46+nl+xl+cl;
    if(name.endsWith('/')||!MI_EXT.includes(extOf(name)))continue;
    const lo=off+30+d.getUint16(off+26,true)+d.getUint16(off+28,true),raw=u8.subarray(lo,lo+csz);
    let data;if(meth===0)data=raw.slice();else if(meth===8)data=await streamThrough(raw,'deflate-raw',true);else continue;
    out.push(new File([data],name.split('/').pop()));}
  return out;}
/* choose: a folder (desktop and browser), or files / a .zip */
async function miPick(how){
  if(how==='folder'){
    if(platform.isDesktop){const dir=await platform.pickFolder();if(!dir)return null;const list=await platform.invoke('dir_files',{dir});
      const files=[];for(const [path] of list||[])if(MI_EXT.includes(extOf(path)))files.push(new File([await platform.readFile(path)],fileNameOf(path)));
      return {files,folder:fileNameOf(dir.replace(/[\\/]+$/,''))};}
    return await new Promise(res=>{const inp=el('input',{type:'file',hidden:true,multiple:true});inp.webkitdirectory=true;document.body.append(inp);
      inp.addEventListener('change',()=>{const fs=[...inp.files];inp.remove();const top=fs[0]&&fs[0].webkitRelativePath?fs[0].webkitRelativePath.split('/')[0]:'';res({files:fs.filter(f=>MI_EXT.includes(extOf(f.name))),folder:top});});
      inp.addEventListener('cancel',()=>{inp.remove();res(null);});inp.click();});}
  const fs=await pickFiles('image/*,.zip,.exr,.tga,.tif,.tiff',true,'Textures or a .zip',[...MI_EXT,'zip']);if(!fs.length)return null;let files=[],folder='';
  for(const f of fs){if(extOf(f.name)==='zip'){files.push(...await miUnzip(await f.arrayBuffer()));folder=folder||baseName(f.name).replace(/[_-]?(\d+k)?[_-]?(png|jpg|exr)?$/i,'').replace(/[_-]+/g,' ');}else files.push(f);}
  return {files,folder};}
/* the images → a library record (pictures at most `max` pixels across) */
async function miBuild(files,folder,max){const found={},names=[];
  for(const f of files){const c=miChannel(f.name);if(!c)continue;
    /* two candidates for one channel: prefer an OpenGL normal, then the larger file */
    const cur=found[c.k];if(cur&&!(c.k==='normal'&&cur.dx&&!c.dx)&&!(cur.f.size<f.size&&!(c.k==='normal'&&!cur.dx&&c.dx)))continue;found[c.k]={f,dx:c.dx};}
  if(!Object.keys(found).length)throw new Error('No texture names were recognised (Color, Roughness, Normal, Displacement…).');
  const pix={};
  for(const k in found){const {f,dx}=found[k];names.push(f.name);let t;try{t=await fileTarget(f);}catch(e){toast('Skipped '+f.name+': '+(e.message||e));continue;}
    const s=Math.min(1,(max||1e9)/Math.max(t.w,t.h)),w=Math.max(1,Math.round(t.w*s)),h=Math.max(1,Math.round(t.h*s));
    let src=t;if(s<1){src=makeTarget(w,h,8,false);copyScaled(t,src);disposeTarget(t);}
    const d=captureRegionNow(src,0,0,w,h).data;disposeTarget(src);
    /* the pictures come premultiplied; texture channels are opaque, so this only matters for colour with alpha */
    if(k==='normal'&&dx)for(let i=0;i<d.length;i+=4)d[i+1]=255-d[i+1];
    pix[k]={w,h,data:new Uint8Array(d.buffer.slice(0))};}
  /* packed AO/rough/metal, and gloss (the opposite of roughness) */
  const grey=(src,ch,inv)=>{const o=new Uint8Array(src.data.length);for(let i=0;i<o.length;i+=4){const v=inv?255-src.data[i+ch]:src.data[i+ch];o[i]=o[i+1]=o[i+2]=v;o[i+3]=255;}return {w:src.w,h:src.h,data:o};};
  if(pix.arm){if(!pix.ao)pix.ao=grey(pix.arm,0);if(!pix.rough)pix.rough=grey(pix.arm,1);if(!pix.metal)pix.metal=grey(pix.arm,2);delete pix.arm;}
  if(pix.gloss&&!pix.rough)pix.rough=grey(pix.gloss,0,true);delete pix.gloss;
  const fill=fillDefaults();for(const k in fill.maps)fill.maps[k].on=false;
  for(const k in pix){if(!fill.maps[k]){delete pix[k];continue;}Object.assign(fill.maps[k],{on:true,src:'image',name:found[k]?found[k].f.name:k,tile:1,rot:0});}
  if(!fill.maps.rough.on)Object.assign(fill.maps.rough,{on:true,src:'value',v:.6});
  if(!fill.maps.metal.on)Object.assign(fill.maps.metal,{on:true,src:'value',v:0});
  if(fill.maps.height&&fill.maps.height.on)fill.hStr=1;
  const name=miName(names,folder);
  return {id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name,t:Date.now(),fill,imgs:pix};}
function dlgMatFromTextures(){let max=2048;
  const note=el('p',{class:'note',text:'Pick a material you downloaded (ambientCG, Poly Haven, ShareTextures…): its folder, its images, or the .zip. The images are sorted by name (Color, Roughness, Metalness, NormalGL, Displacement, AO, ARM…) and saved in Materials.'});
  const size=seg([[1024,'1K'],[2048,'2K'],[4096,'4K'],[0,'Full size']],max,v=>{max=+v;},'Picture size');
  const go=async how=>{closeDialog();let got;try{got=await miPick(how);}catch(e){toast(e.message||String(e));return;}if(!got||!got.files.length){if(got)toast('No images found there.');return;}
    toast('Importing '+got.files.length+' images…');await tick();
    try{const rec=await miBuild(got.files,got.folder,max);matLib.list.push(rec);store.put(rec,'materials');renderMats();
      const ch=Object.keys(rec.imgs).map(k=>MAP_DEFS[k]?MAP_DEFS[k].label:k).join(', ');toast('Saved “'+rec.name+'” in Materials ('+ch+'). Click it to add it to a layer.');}
    catch(e){console.error(e);toast('Import failed: '+(e.message||e));}};
  openDialog({title:'Material from textures',body:el('div',{class:'dlg-grid'},note,el('div',{class:'sub',text:'Picture size (smaller keeps projects light)'}),size,
    el('div',{class:'chips'},el('button',{class:'btn',id:'miFolder',text:'Choose a folder…',onclick:()=>go('folder')}),el('button',{class:'btn',id:'miFiles',text:'Choose images or a .zip…',onclick:()=>go('files')}))),okLabel:null,cancelLabel:'Close'});}
