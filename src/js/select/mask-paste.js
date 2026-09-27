/* ================= Pictures into masks =================
   Paste (Ctrl+V while a mask is being edited), drag a layer onto a mask thumbnail, or drop an image file on one.
   Light parts show the layer, dark and see-through parts hide it. */
const FS_TOMASK=`uniform sampler2D uOld; uniform sampler2D uSrc; uniform vec4 uRect;
void main(){ vec2 p=gl_FragCoord.xy; vec4 old=texelFetch(uOld,ivec2(p),0);
  if(p.x<uRect.x||p.y<uRect.y||p.x>uRect.x+uRect.z||p.y>uRect.y+uRect.w){ o=old; return; }
  vec4 s=texture(uSrc,(p-uRect.xy)/uRect.zw); float g=s.a>1e-6?dot(s.rgb/s.a,vec3(0.299,0.587,0.114))*s.a:0.0; o=vec4(vec3(g),1.0); }`;
let P_TOMASK=null;
/* the mask being edited (a layer's mask or the quick mask), or null */
function maskEditTarget(){const et=editTarget();return et&&et.isMask?et:null;}
/* a layer's (or group's) mask as an edit target, adding a white mask first when it has none */
function maskTargetOf(n){if(!n.mask){const a=doc.active;selectOnly(n);cmdAddMask(1);if(a&&a!==n)selectOnly(a);}if(!n.mask)return null;
  return {node:n,target:n.mask.target,isMask:true,L:{target:n.mask.target,lockAlpha:false,maskOf:n,maskObj:n.mask}};}
/* write a premultiplied picture (a target) into the mask at x,y,w,h (it is stretched to that size) */
function pictureIntoMask(et,src,x,y,w,h,label){if(!P_TOMASK)P_TOMASK=program(FS_TOMASK);
  const T=et.target,old=acquireD(T.depth);blit(T,old,0,0,doc.w,doc.h,0,0);
  fullRecord(et.L,label,()=>run(P_TOMASK,T,{uOld:old.tex,uSrc:src.tex,uRect:[x,y,w,h]}),[clamp(Math.floor(x),0,doc.w),clamp(Math.floor(y),0,doc.h),clamp(Math.ceil(x+w),0,doc.w),clamp(Math.ceil(y+h),0,doc.h)]);
  release(old);if(et.node)scheduleThumb(et.node);changedAll();requestRender(true);}
/* after pasting a part: select it and start Free transform so it can be moved and scaled (Enter places it) */
function transformPasted(x,y,w,h){if(x<=0&&y<=0&&x+w>=doc.w&&y+h>=doc.h)return;
  selRecord('Select pasted',fullRect(),()=>{clearTarget(sel.t);const r=[Math.max(0,x),Math.max(0,y),Math.min(doc.w,x+w),Math.min(doc.h,y+h)];
    bindTarget(sel.t);gl.enable(gl.SCISSOR_TEST);gl.scissor(r[0],r[1],r[2]-r[0],r[3]-r[1]);gl.clearColor(1,1,1,1);gl.clear(gl.COLOR_BUFFER_BIT);gl.disable(gl.SCISSOR_TEST);
    sel.active=true;sel.bb=r;});
  if(!sel.quick)freeTransform();}
/* Ctrl+V of our own copied pixels while a mask is edited */
function pasteClipIntoMask(et){pictureIntoMask(et,clip.t,clip.x,clip.y,clip.w,clip.h,'Paste into mask');transformPasted(clip.x,clip.y,clip.w,clip.h);
  toast('Pasted into the mask. Move or scale it, then press Enter.');}
/* an image file: decoded into a target of its own size */
async function fileTarget(file){const raw=await decodeFile(file),tex=uploadStraight(raw),t=makeTarget(raw.w,raw.h,8,false);premultInto(t,tex,[0,0],null);gl.deleteTexture(tex);return t;}
/* an image from another app pasted while a mask is edited: its own size, centred (scaled down to fit) */
async function pasteImageIntoMask(et,file){let t;try{t=await fileTarget(file);}catch(e){toast('Could not read the pasted image: '+(e.message||e));return;}
  const s=Math.min(1,doc.w/t.w,doc.h/t.h),w=Math.round(t.w*s),h=Math.round(t.h*s),x=Math.round((doc.w-w)/2),y=Math.round((doc.h-h)/2);
  pictureIntoMask(et,t,x,y,w,h,'Paste into mask');disposeTarget(t);transformPasted(x,y,w,h);toast('Pasted into the mask. Move or scale it, then press Enter.');}
/* an image file dropped on a mask thumbnail: stretched to fill the mask */
async function dropFileIntoMask(n,file){let t;try{t=await fileTarget(file);}catch(e){toast('Could not read '+file.name+': '+(e.message||e));return;}
  const et=maskTargetOf(n);if(!et){disposeTarget(t);return;}pictureIntoMask(et,t,0,0,doc.w,doc.h,'Image into mask');disposeTarget(t);renderLayers();
  toast(file.name+' is now the mask of “'+n.name+'” (stretched to fit). Filter › Tile repeats it.');}
/* a layer dragged onto a mask thumbnail (or Alt+dropped on a row): its picture becomes that mask */
function layerIntoMask(src,n){if(src===n){toast('A layer can’t become its own mask.');return;}if(!isLayer(src)){toast('Drag a layer (not a group) onto the mask.');return;}const t=mapT(src,'base');
  const et=maskTargetOf(n);if(!et)return;pictureIntoMask(et,t,0,0,doc.w,doc.h,'Layer into mask');renderLayers();
  toast('“'+src.name+'” copied into the mask of “'+n.name+'”.');}
/* image files dropped on the layer list: onto a mask thumbnail, or Alt+drop onto a row */
(l=>{const target=e=>{const r=e.target.closest&&e.target.closest('.lrow');if(!r||!r._node)return null;return (e.target.closest('.mthumb')||e.altKey)?r._node:null;};
  l.addEventListener('dragover',e=>{if(![...e.dataTransfer.types].includes('Files'))return;const n=target(e);if(n){e.preventDefault();e.stopPropagation();}});
  l.addEventListener('drop',e=>{const n=target(e),f=[...e.dataTransfer.files].find(f=>!isModelName(f.name));if(!n||!f)return;e.preventDefault();e.stopPropagation();dropFileIntoMask(n,f);});})($('#layerList'));
