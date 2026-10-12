/* ================= AI in the Paint tab: Select subject, Select sky, Remove selection ================= */
const aiPS={on:false,pts:[],E:null};
let aiGreyProg=null;
function aiPaintOK(){if(ui.mode!=='paint'){toast('Open the Paint tab for this.');return false;}return true;}
function aiPaintNeed(parts){const miss=parts.filter(i=>!aiHas(i));if(!miss.length)return false;toast('This needs the AI add-on. Opening File › AI add-ons…');dlgAddons();return true;}
function aiPaintImage(){const R=renderNodesMap(doc.root.children,'base');try{return aiPixels(R,1024);}finally{release(R);}}
/* a grey mask picture (0..255, w×h) becomes the selection */
function aiSelFromMask(m,label,mode){if(!aiGreyProg)aiGreyProg=program(FS_DEPTHGREY);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,m.w,m.h,0,gl.RED,gl.UNSIGNED_BYTE,m.data);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const t=acquireS();try{run(aiGreyProg,t,{uSrc:tex,uOut:[doc.w,doc.h]});applyShape(t,mode||'new',fullRect(),label);}finally{release(t);gl.deleteTexture(tex);}}
async function aiPaintSubject(){if(!aiPaintOK()||aiPaintNeed(['engine','sam']))return;aiPS.on=true;aiPS.pts=[];aiPS.E=null;stage.classList.add('phpicking');toast('Click the subject. Click more to add, Alt+click to take away. Esc or Enter when done.');}
function aiPaintStop(){if(!aiPS.on)return;aiPS.on=false;aiPS.E=null;stage.classList.remove('phpicking');}
async function aiPaintClick(e,ix,iy){if(ix<0||iy<0||ix>=doc.w||iy>=doc.h)return;
  try{await aiBusy('Selecting',async prog=>{if(!aiPS.E){const img=aiPaintImage();aiPS.E=await aiSamEmbed(img);aiPS.E.img=img;}prog(.6);const E=aiPS.E;aiPS.pts.push({x:ix/doc.w*E.w,y:iy/doc.h*E.h,pos:!e.altKey});
    const m=await aiSamMask(E,aiPS.pts,E.w,E.h);aiSelFromMask(m,'Select subject');});}
  catch(err){console.warn(err);toast('Select subject failed: '+(err.message||err));}}
async function aiPaintSky(){if(!aiPaintOK()||aiPaintNeed(['engine','sam']))return;
  try{await aiBusy('Finding the sky',async prog=>{const img=aiPaintImage(),E=await aiSamEmbed(img);E.img=img;prog(.6);const r=await aiSkyMask(E,img.w,img.h);if(!r){toast('No clear sky found.');return;}aiSelFromMask(r.mask,'Select sky');});}
  catch(err){console.warn(err);toast('Select sky failed: '+(err.message||err));}}
async function aiPaintRemove(){if(!aiPaintOK()||aiPaintNeed(['engine','lama']))return;if(!sel.active||!sel.bb){toast('Select what to remove first (Select subject, or any selection tool).');return;}
  const et=editTarget();if(!et||et.isMask||!et.L){toast('Pick a normal layer to remove from.');return;}
  try{await aiBusy('Removing',async prog=>{const R=renderNodesMap(doc.root.children,'base');let img;try{img=aiPixels(R,2048);}finally{release(R);}
    const sd=aiPixels(sel.t,2048),hole=new Uint8Array(img.w*img.h);let x0=img.w,y0=img.h,x1=0,y1=0;
    for(let y=0;y<img.h;y++)for(let x=0;x<img.w;x++){const i=y*img.w+x;if(sd.data[i*4]>127){hole[i]=255;if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}}
    if(x1<x0){toast('The selection is empty.');return;}
    const patch=await aiInpaintPatch(img,hole,[x0,y0,x1+1,y1+1],prog);
    if(!phPatchProg)phPatchProg=program(FS_PHPATCH);const tex=uploadStraight({w:512,h:512,data:patch.rgba});
    try{fullRecord(et.L,'Remove (AI)',()=>{run(phPatchProg,et.target,{uP:tex,uR:patch.rect,uSz:[et.target.w,et.target.h]},{blend:'over'});},selRect(et));}finally{gl.deleteTexture(tex);}
    requestRender(true);});}
  catch(err){console.warn(err);toast('Remove failed: '+(err.message||err));}}
window.addEventListener('keydown',e=>{if(aiPS.on&&(e.key==='Escape'||e.key==='Enter')){aiPaintStop();e.preventDefault();e.stopImmediatePropagation();}},true);
