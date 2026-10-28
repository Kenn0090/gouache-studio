/* ================= Padding on export (0.80.2) =================
   Past the edges of the UV islands a texture holds whatever was painted there (often nothing), and mip-maps in an engine
   blend that into the islands' edges as seams. Padding (dilation) grows the islands' own colours outward by a number of
   pixels before saving, like Substance Painter's export padding. Modes (texCfg.pad):
   none · dilate (N px) · dilate+inf (N px, then the rest filled from the nearest island) · dilate+trans (N px, the rest
   transparent) · inf (everything filled). Where the islands are comes from the model's UVs (this texture set's part).
   Runs on the graphics card on each composited map before it is read back. */
const TEX_PAD_MODES=[['none','None (as painted)'],['dilate','Dilation'],['dilate+inf','Dilation + fill the rest'],['dilate+trans','Dilation + transparent'],['inf','Fill everything (infinite)']];
let P_TPAD=null;
function texPadProgs(){if(P_TPAD)return P_TPAD;
  P_TPAD={
    uv:prog3(VS_FILLPOS,'in vec3 vP; in vec3 vN; in vec4 vTan; void main(){ o=vec4(1.0); }'),
    /* start: straight colour and alpha */
    init:program(GL_ST+`uniform sampler2D uSrc; void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); o=vec4(st(c),c.a); }`),
    /* one step outward: a pixel outside the islands takes the average of its neighbours (at uStep) that are inside */
    col:program(`uniform sampler2D uW; uniform sampler2D uM; uniform int uStep;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uW,0); vec4 c=texelFetch(uW,p,0); if(texelFetch(uM,p,0).r>0.5){ o=c; return; }
  vec4 acc=vec4(0.0); float n=0.0; for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ if(i==0&&j==0) continue; ivec2 q=clamp(p+ivec2(i,j)*uStep,ivec2(0),s-1);
    if(texelFetch(uM,q,0).r>0.5){ acc+=texelFetch(uW,q,0); n+=1.0; } }
  o=n>0.0?acc/n:c; }`),
    msk:program(`uniform sampler2D uM; uniform int uStep;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uM,0); float m=texelFetch(uM,p,0).r; if(m<0.5){ for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){ if(texelFetch(uM,clamp(p+ivec2(i,j)*uStep,ivec2(0),s-1),0).r>0.5) m=1.0; } }
  o=vec4(vec3(m),1.0); }`),
    /* back to premultiplied; Transparent: nothing outside the grown islands */
    fin:program(`uniform sampler2D uW; uniform sampler2D uM; uniform int uTrans;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); vec4 c=texelFetch(uW,p,0); if(uTrans==1&&texelFetch(uM,p,0).r<0.5){ o=vec4(0.0); return; } o=vec4(c.rgb*c.a,c.a); }`)};
  return P_TPAD;}
/* padding needs a model with UVs (3D Paint, or the 3D view open in Paint) */
function texPadAvail(){const m=typeof v3!=='undefined'&&v3.mesh;return !!(m&&!m.noUV&&v3.gpu&&(ui.mode==='p3d'||v3.on));}
/* where the UV islands are, at the document's size (this texture set's triangles in 3D Paint) */
function texPadMask(){const m=v3.mesh,g=v3.gpu,R=ui.mode==='p3d'&&typeof p3Range==='function'?p3Range():{start:0,count:m.idx.length/3},uvs=(v3s().uvs)||1,P=texPadProgs();
  const t=makeTarget(doc.w,doc.h,8,false);clearTarget(t,[0,0,0,1]);
  for(let j=0;j<uvs;j++)for(let i=0;i<uvs;i++){useProg(P.uv,{uShift:[i,j],uUVs:uvs});bindTarget(t);gl.disable(gl.BLEND);gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,R.count*3,gl.UNSIGNED_INT,R.start*12);}
  gl.bindVertexArray(vao);return t;}
/* one export's padding: the mask is made once and freed at the end */
function texPadBegin(nw){if(!texCfg.pad||texCfg.pad==='none'||!texPadAvail())return null;return {mask:texPadMask(),px:Math.max(0,Math.round((texCfg.padPx??16)*doc.w/Math.max(1,nw)))};}
function texPadEnd(ctx){if(ctx&&ctx.mask)disposeTarget(ctx.mask);}
/* a padded copy of map target t (document size); the original is released when it was borrowed (owned=false) */
function texPadT(ctx,t,owned){if(!ctx||!t||t.w!==doc.w||t.h!==doc.h)return t;const P=texPadProgs(),mode=texCfg.pad,d=canFloat?16:doc.depth;
  let w1=acquireD(d),w2=acquireD(d),m1=acquireD(8),m2=acquireD(8);run(P.init,w1,{uSrc:t.tex});blit(ctx.mask,m1,0,0,doc.w,doc.h,0,0);
  const step=s=>{run(P.col,w2,{uW:w1.tex,uM:m1.tex,uStep:{int:s}});run(P.msk,m2,{uM:m1.tex,uStep:{int:s}});[w1,w2]=[w2,w1];[m1,m2]=[m2,m1];};
  const grow=mode==='inf'?0:ctx.px;for(let i=0;i<grow;i++)step(1);
  /* the rest: steps that double in length reach every pixel in a few passes */
  if(mode==='inf'||mode==='dilate+inf'){for(let s=1;s<Math.max(doc.w,doc.h)*2;s*=2)step(s);step(1);}
  const out=acquireD(t.depth||doc.depth);run(P.fin,out,{uW:w1.tex,uM:m1.tex,uTrans:{int:mode==='dilate+trans'?1:0}});
  release(w1);release(w2);release(m1);release(m2);if(!owned)release(t);return out;}
