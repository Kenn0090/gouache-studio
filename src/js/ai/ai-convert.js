/* ================= AI in the Convert tab: a height map from the photo's depth ================= */
const FS_DEPTHGREY=`uniform sampler2D uSrc; uniform vec2 uOut; void main(){ vec2 uv=gl_FragCoord.xy/uOut; o=vec4(vec3(texture(uSrc,uv).r),1.0); }`;
let cvDepthProg=null;
async function cvAiDepth(on){if(!on){cvS.aiDepth=false;cvChanged('height');buildConvertPanel();return;}
  if(!cvS.src){toast('Load a picture first.');buildConvertPanel();return;}
  if(!aiHas('engine')||!aiHas('depth')){toast('This needs the AI add-on (Depth). Opening File › AI add-ons…');dlgAddons();buildConvertPanel();return;}
  try{await aiBusy('Measuring depth',async prog=>{const img=aiPixels(cvS.src,1024);prog(.2);const d=await aiDepthRun(img);
    if(!cvDepthProg)cvDepthProg=program(FS_DEPTHGREY);const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,d.w,d.h,0,gl.RED,gl.UNSIGNED_BYTE,d.data);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const t=cvT('adepth',doc.w,doc.h,16);run(cvDepthProg,t,{uSrc:tex,uOut:[doc.w,doc.h]});gl.deleteTexture(tex);cvS.cache.depthT=t;cvS.aiDepth=true;});
    cvChanged('height');buildConvertPanel();}
  catch(err){console.warn(err);toast('The depth map failed: '+(err.message||err));buildConvertPanel();}}
