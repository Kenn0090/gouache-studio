/* ================= Send to Photo / Send to Paint (0.97.9, Kenn) =================
   "A send to photo button for renders made, a 2D canvas send to photo, and vice versa for photo, although you shouldn't be able to send
   photos to 3D." A picture sent to Photo arrives as a new photo in the strip (a PNG kept in memory like any opened file) and Photo comes forward;
   a photo sent to Paint arrives as its developed, flattened picture, as a new layer in the open painting. Nothing goes from Photo to 3D Paint. */
async function phReceive(blob,name){
  if(ui.mode!=='photo'&&!setMode('photo',true))return false;
  const f=new File([blob],name||'Sent picture.png',{type:blob.type||'image/png'});
  await phAddFiles([f]);toast('Sent to Photo: “'+f.name+'”. Develop it here, then Send to Paint to bring it back.');return true;}
/* the painting as one flat picture (what you see, with the transparent parts kept) */
async function sendPaintToPhoto(){
  if(ui.mode!=='paint'&&ui.mode!=='anim'){toast('Switch to Paint to send the painting to Photo.');return;}
  if(stroke||preview||selLive){toast('Finish the current edit first.');return;}
  const t=compositeMap('base');let blob;try{const w=t.w,h=t.h,px=readRGBA8(t);blob=await pixelsToPNG(w,h,flipRows(px,w,h),true);}finally{release(t);}
  const nm=(doc.name||'Painting').replace(/\.[a-z0-9]+$/i,'');await phReceive(blob,nm+'.png');}
function flipRows(px,w,h){const o=new Uint8Array(w*h*4);for(let y=0;y<h;y++)o.set(px.subarray(y*w*4,(y+1)*w*4),(h-1-y)*w*4);return o;}
/* the developed photo at full size, flattened, as a new layer in the painting (the Photo panel's To Paint button does the same) */
async function sendPhotoToPaint(){
  const p=typeof phP==='function'?phP():null;if(!p){toast('Open a photo first.');return;}
  loadStart('Developing “'+p.name+'”');let c;try{c=await phRenderFull(p,{mode:'orig'});}finally{loadEnd();}
  const W=c.width,H=c.height,id=new Uint8Array(c.getContext('2d').getImageData(0,0,W,H).data.buffer.slice(0)),nm=(p.name||'Photo').replace(/\.[^.]+$/,'');
  withPaintDoc(()=>{const L=newLayerObj(nm);drawRawInto(L.target,{w:W,h:H,data:id,bits:8},true);structOp('Place edited photo',()=>{insertNode(L,doc.root);selectOnly(L);});});
  setMode('paint',true);toast('Sent to Paint as a new layer: “'+nm+'”.');}
