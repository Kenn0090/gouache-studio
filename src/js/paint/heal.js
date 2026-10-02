/* ================= Heal brushes (0.24) =================
   Spot healing: paint over a flaw and it is replaced with texture from a clean spot nearby, found by itself.
   Healing brush: Alt+click where to copy from, then paint; the copy is blended into its surroundings.
   Both work like Photoshop's: the borrowed texture keeps its detail, but its colour and brightness are bent to
   match the edge of what you painted over. On a layer with several maps (a material) every map is healed with
   the same source, so colour, height, roughness… stay together. The stroke is painted like any other (selection,
   symmetry and the 3D mirror all shape it); the healing happens when you let go.
   How: S = the layer shifted by the offset; D = layer − S where it is known (outside the stroke), filled into
   the stroke smoothly with a pull-push pyramid; result = S + D inside the stroke. */
const heal={mode:'spot',aligned:true,sampleAll:true,src:null,off:null,start:null};
try{const s=JSON.parse(localStorage.getItem('gs.heal')||'{}');if(s.mode==='spot'||s.mode==='source')heal.mode=s.mode;if(s.aligned===false)heal.aligned=false;}catch(e){}
try{heal.sampleAll=JSON.parse(localStorage.getItem('gs.heal')||'{}').sampleAll!==false;}catch(e){}
function healSave(){try{localStorage.setItem('gs.heal',JSON.stringify({mode:heal.mode,aligned:heal.aligned,sampleAll:heal.sampleAll}));}catch(e){}}
const HL_GLSL=`uniform sampler2D uT; uniform sampler2D uM; uniform vec2 uOff; uniform int uWrap;
bool srcAt(ivec2 q, out vec4 s){ ivec2 sz=textureSize(uT,0); ivec2 r=q+ivec2(uOff);
  if(uWrap==1) r=ivec2(mod(vec2(r),vec2(sz))); else if(any(lessThan(r,ivec2(0)))||any(greaterThanEqual(r,sz))){ s=vec4(0); return false; }
  s=texelFetch(uT,r,0); return true; }
float wAt(float m){ return 1.0-smoothstep(0.0,0.3,m); }
`;
/* the stroke's coverage, times the selection */
const FS_HLMASK=`uniform sampler2D uStrokeTex; uniform sampler2D uSelTex; uniform int uUseSel; uniform float uOpacity;
void main(){ ivec2 q=ivec2(gl_FragCoord.xy); float m=texelFetch(uStrokeTex,q,0).a*uOpacity; if(uUseSel==1) m*=texelFetch(uSelTex,q,0).r; o=vec4(m); }`;
/* first step down: the known differences (weighted) or the weights */
const FS_HLPULL0=HL_GLSL+`uniform int uWhich;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy)*2, sz=textureSize(uT,0); vec4 a=vec4(0); float ws=0.0;
  for(int j=0;j<2;j++)for(int i=0;i<2;i++){ ivec2 q=min(p+ivec2(i,j),sz-1); vec4 s; if(!srcAt(q,s)) continue; float w=wAt(texelFetch(uM,q,0).r); a+=(texelFetch(uT,q,0)-s)*w; ws+=w; }
  o = uWhich==0 ? a*0.25 : vec4(ws*0.25); }`;
/* further steps down: a 2×2 average */
const FS_HLPULL=`uniform sampler2D uA;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy)*2, sz=textureSize(uA,0); vec4 a=vec4(0);
  for(int j=0;j<2;j++)for(int i=0;i<2;i++) a+=texelFetch(uA,min(p+ivec2(i,j),sz-1),0); o=a*0.25; }`;
/* back up: known where there is enough weight, else the coarser level */
const FS_HLPUSH=`uniform sampler2D uA; uniform sampler2D uB; uniform sampler2D uC; uniform int uHasC;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy); float w=texelFetch(uB,p,0).r; vec4 v=w>1e-6?texelFetch(uA,p,0)/w:vec4(0);
  if(uHasC==0){ o=v; return; } vec4 up=texture(uC,gl_FragCoord.xy*0.5/vec2(textureSize(uC,0))); o=mix(up,v,clamp(w*2.0,0.0,1.0)); }`;
/* the result, full size */
const FS_HLFINAL=HL_GLSL+`uniform sampler2D uC; uniform sampler2D uDst;
void main(){ ivec2 q=ivec2(gl_FragCoord.xy); vec4 t=texelFetch(uT,q,0),dst=texelFetch(uDst,q,0); float m=texelFetch(uM,q,0).r; vec4 s;
  if(m<=0.0||!srcAt(q,s)){ o=dst; return; }
  vec4 up=texture(uC,gl_FragCoord.xy*0.5/vec2(textureSize(uC,0))); vec4 d=mix(up,t-s,clamp(wAt(m)*2.0,0.0,1.0)); vec4 r=s+d;
  r.a=clamp(r.a,0.0,1.0); r.rgb=clamp(r.rgb,vec3(0.0),vec3(r.a)); o=mix(dst,r,m); }`;
/* a small copy of part of a target for the search: block average (uMax 0) or block maximum (uMax 1) */
const FS_HLDOWN=`uniform sampler2D uSrc; uniform vec2 uOrg; uniform int uSt; uniform int uMax;
void main(){ ivec2 sz=textureSize(uSrc,0), b=ivec2(uOrg)+ivec2(floor(gl_FragCoord.xy))*uSt; vec4 a=vec4(0); float n=0.0; int k=max(1,uSt/8);
  for(int j=0;j<uSt;j+=k)for(int i=0;i<uSt;i+=k){ vec4 v=texelFetch(uSrc,clamp(b+ivec2(i,j),ivec2(0),sz-1),0); if(uMax==1) a=max(a,v); else a+=v; n+=1.0; }
  o = uMax==1 ? a : a/n; }`;
let P_HL=null;
function hlProgs(){if(!P_HL)P_HL={mask:program(FS_HLMASK),pull0:program(FS_HLPULL0),pull:program(FS_HLPULL),push:program(FS_HLPUSH),fin:program(FS_HLFINAL),down:program(FS_HLDOWN)};return P_HL;}

/* ---- the source (healing brush) ---- */
function healSetSource(x,y,set){heal.src=[x,y];heal.srcSet=set==null?null:set;heal.off=null;healMarker();toast('Heal source set. Now paint where it should go.');}
/* the point where a stroke starts (document pixels), and the offset it copies from */
function healBegin(x,y,tool){heal.start=[x,y];
  if(tool!=='clone'&&heal.mode!=='source')return true;
  if(!heal.src){toast('Alt+click where to copy from first.');return false;}
  if(ui.mode==='p3d'&&heal.srcSet!=null&&typeof p3!=='undefined'&&heal.srcSet!==p3.cur){toast('The source is on another texture set. Alt+click on this one.');return false;}
  if(!heal.aligned||!heal.off)heal.off=[Math.round(heal.src[0]-x),Math.round(heal.src[1]-y)];return true;}
/* a small cross on the canvas where the copy comes from */
function healMarker(){let m=document.getElementById('healMark');const on=(ui.tool==='clone'||ui.tool==='heal'&&heal.mode==='source')&&heal.src&&!ui.cageFlat&&typeof view!=='undefined';
  if(!on){if(m)m.hidden=true;return;}
  if(!m){m=el('div',{id:'healMark',class:'healmark','aria-hidden':'true'});stage.appendChild(m);}
  let [x,y]=heal.src;if(stroke&&heal.off&&(stroke.o.tool==='heal'||stroke.o.tool==='clone')&&!stroke.space&&ptr&&ptr.mode==='paint'){x=ptr.rx+heal.off[0];y=ptr.ry+heal.off[1];}
  m.hidden=false;m.style.transform='translate('+(view.x+x*view.zoom-8)+'px,'+(view.y+y*view.zoom-8)+'px)';}

/* ---- spot healing: find a clean place nearby with texture like the edge of the stroke ---- */
function hlDown(src,x,y,w,h,st,max){const sw=Math.max(1,Math.ceil(w/st)),sh=Math.max(1,Math.ceil(h/st)),t=makeTarget(sw,sh,8,false);
  run(hlProgs().down,t,{uSrc:src.tex,uOrg:[x,y],uSt:{int:st},uMax:{int:max?1:0}});const d=captureRegionNow(t,0,0,sw,sh).data;disposeTarget(t);return {w:sw,h:sh,d};}
/* chamfer distance (in cells) to the nearest cell where on(i) is false */
function hlDist(w,h,on){const D=new Float32Array(w*h),B=1e9;for(let i=0;i<w*h;i++)D[i]=on(i)?B:0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(!D[i])continue;let v=D[i];if(x>0)v=Math.min(v,D[i-1]+1);if(y>0){v=Math.min(v,D[i-w]+1);if(x>0)v=Math.min(v,D[i-w-1]+1.414);if(x<w-1)v=Math.min(v,D[i-w+1]+1.414);}D[i]=v;}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;if(!D[i])continue;let v=D[i];if(x<w-1)v=Math.min(v,D[i+1]+1);if(y<h-1){v=Math.min(v,D[i+w]+1);if(x<w-1)v=Math.min(v,D[i+w+1]+1.414);if(x>0)v=Math.min(v,D[i+w-1]+1.414);}D[i]=v;}
  return D;}
function healFindOffset(T,M,bb){const W=doc.w,H=doc.h;
  const bx0=clamp(Math.floor(bb[0]),0,W),by0=clamp(Math.floor(bb[1]),0,H),bx1=clamp(Math.ceil(bb[2]),0,W),by1=clamp(Math.ceil(bb[3]),0,H);if(bx1<=bx0||by1<=by0)return null;
  /* how thick the stroke is: the deepest point inside it, on a small copy */
  const st0=Math.max(1,Math.ceil(Math.max(bx1-bx0,by1-by0)/192)),m0=hlDown(M,bx0,by0,bx1-bx0,by1-by0,st0,true),D0=hlDist(m0.w,m0.h,i=>m0.d[i*4]>25);
  let hmax=0;for(let i=0;i<D0.length;i++)if(D0[i]<1e8)hmax=Math.max(hmax,D0[i]);if(!hmax)return null;
  const h=Math.max(2,hmax*st0),dists=[2.3,3.2,4.5,6.5].map(k=>k*h),ring=Math.max(2,h*.8),pad=Math.ceil(dists[3]+ring+4);
  const rx0=clamp(bx0-pad,0,W),ry0=clamp(by0-pad,0,H),rx1=clamp(bx1+pad,0,W),ry1=clamp(by1+pad,0,H),st=Math.max(1,Math.ceil(Math.max(rx1-rx0,ry1-ry0)/256));
  const mm=hlDown(M,rx0,ry0,rx1-rx0,ry1-ry0,st,true),tt=hlDown(T,rx0,ry0,rx1-rx0,ry1-ry0,st,false),w=mm.w,hh=mm.h,inM=i=>mm.d[i*4]>25;
  const Dout=hlDist(w,hh,i=>!inM(i)),ringC=Math.max(1,ring/st);
  const ringPx=[],maskPx=[];for(let y=0;y<hh;y++)for(let x=0;x<w;x++){const i=y*w+x;if(inM(i))maskPx.push(x,y);else if(Dout[i]<=ringC)ringPx.push(x,y);}
  if(!maskPx.length||!ringPx.length)return null;
  const ringStep=Math.max(1,Math.floor(ringPx.length/2/3000))*2,maskStep=Math.max(1,Math.floor(maskPx.length/2/3000))*2;let best=null;
  for(const dist of dists)for(let a=0;a<16;a++){const th=a/16*Math.PI*2,ox=Math.round(dist*Math.cos(th)/st),oy=Math.round(dist*Math.sin(th)/st);if(!ox&&!oy)continue;
    /* where the stroke would copy from: inside the picture, and not the stroke itself */
    let out=0,ov=0,nm=0;for(let k=0;k<maskPx.length;k+=maskStep){const x=maskPx[k]+ox,y=maskPx[k+1]+oy;nm++;if(x<0||y<0||x>=w||y>=hh){out++;continue;}if(inM(y*w+x))ov++;}
    if(out>nm*.02)continue;
    let n=0;const s=[0,0,0,0],q=[0,0,0,0];for(let k=0;k<ringPx.length;k+=ringStep){const x=ringPx[k],y=ringPx[k+1],x2=x+ox,y2=y+oy;if(x2<0||y2<0||x2>=w||y2>=hh)continue;const i=(y*w+x)*4,j=(y2*w+x2)*4;
      if(inM(y2*w+x2))continue;for(let c=0;c<4;c++){const d=(tt.d[i+c]-tt.d[j+c])/255;s[c]+=d;q[c]+=d*d;}n++;}
    if(n<4)continue;let v=0;for(let c=0;c<4;c++)v+=q[c]/n-(s[c]/n)*(s[c]/n);
    const score=v+ov/nm*.5+.0004*dist/h;if(!best||score<best.score)best={score,off:[ox*st,oy*st]};}
  return best&&best.off;}

/* ---- the healing itself ---- */
function hlPyramid(W,H){const lv=[];let w=W,h=H;while(w>2||h>2){w=Math.max(1,Math.ceil(w/2));h=Math.max(1,Math.ceil(h/2));const d=canFloat?16:8;lv.push({w,h,a:makeTarget(w,h,d,false),b:makeTarget(w,h,d,false),c:makeTarget(w,h,d,false)});if(lv.length>14)break;}return lv;}
function hlHealOne(T,M,off,lv,source){const PR=hlProgs(),old=acquireD(T.depth);blit(T,old,0,0,T.w,T.h,0,0);
  const U={uT:(source||old).tex,uM:M.tex,uOff:off,uWrap:{int:doc.wrap?1:0}};
  run(PR.pull0,lv[0].a,Object.assign({uWhich:{int:0}},U));run(PR.pull0,lv[0].b,Object.assign({uWhich:{int:1}},U));
  for(let k=1;k<lv.length;k++){run(PR.pull,lv[k].a,{uA:lv[k-1].a.tex});run(PR.pull,lv[k].b,{uA:lv[k-1].b.tex});}
  for(let k=lv.length-1;k>=0;k--)run(PR.push,lv[k].c,{uA:lv[k].a.tex,uB:lv[k].b.tex,uC:k<lv.length-1?lv[k+1].c.tex:dummy,uHasC:{int:k<lv.length-1?1:0}});
  run(PR.fin,T,Object.assign({uC:lv[0].c.tex,uDst:old.tex},U));return old;}
/* Never sample the temporary white stroke preview, and keep material data off the destination outside the stroke. */
function healVisibleMap(k){const st=stroke;stroke=null;try{return compositeMap(k);}finally{stroke=st;}}
/* called by endStroke for the heal tool, instead of the normal merge; returns the undo parts of the other maps */
function healApply(s,x0,y0,bw,bh,record){const L=s.L,W=doc.w,H=doc.h,parts=[];if(bw<=0||bh<=0)return {parts,ok:false};
  const M=acquireD(doc.depth);run(hlProgs().mask,M,Object.assign({uStrokeTex:strokeT.tex,uOpacity:s.o.healOpacity??s.o.opacity},selU(s.o)));
  const sample=heal.sampleAll&&!L.maskOf&&!L.quick,source=sample?healVisibleMap(doc.map):null;
  let off=heal.mode==='source'?heal.off:healFindOffset(source||L.target,M,[x0,y0,x0+bw,y0+bh]);
  if(!off){if(source)release(source);release(M);toast(heal.mode==='source'?'Alt+click where to copy from first.':'No clean area nearby to copy from. Try a smaller spot, or the Healing brush (Alt+click a source).');return {parts,ok:false};}
  const lv=hlPyramid(W,H),maps=!L.maskOf&&!L.quick&&L.maps?Object.keys(L.maps).filter(k=>{const t=L.maps[k];return t&&!t.empty&&t.tex;}):[];
  try{
    const primary=hlHealOne(L.target,M,off,lv,source);release(primary);
    for(const k of maps){const T=L.maps[k];if(T===L.target)continue;const src=sample?healVisibleMap(k):null;let old;
      try{old=hlHealOne(T,M,off,lv,src);if(record)parts.push({k,before:captureRegion(old,x0,y0,bw,bh),after:captureRegion(T,x0,y0,bw,bh)});}finally{if(src)release(src);if(old)release(old);}}
  }finally{for(const l of lv){disposeTarget(l.a);disposeTarget(l.b);disposeTarget(l.c);}if(source)release(source);release(M);}
  heal.last={off:off.slice()};return {parts,ok:true};}

/* ---- tool settings ---- */
function buildHealPanel(box){$('#brushTitle').textContent=heal.mode==='spot'?'Spot healing brush':'Healing brush';
  box.append(chk('hlSample','Sample visible layers',heal.sampleAll,v=>{heal.sampleAll=v;healSave();}));
  box.append(seg([['spot','Spot','Paint over a flaw: it takes clean texture from nearby by itself'],['source','Healing','Alt+click where to copy from, then paint']],heal.mode,v=>{heal.mode=v;healSave();buildBrushPanel();if(typeof buildOptBar==='function')buildOptBar();healMarker();},'Heal mode'));
  if(heal.mode==='source')box.append(el('div',{class:'chips'},chk('hlAl','Aligned',heal.aligned,v=>{heal.aligned=v;heal.off=null;healSave();})),
    el('p',{class:'note',text:heal.src?'Alt+click to pick a new source. Aligned: the source moves along with each stroke.':'Alt+click where to copy from (on the canvas or the model).'}));
  else box.append(el('p',{class:'note',text:'Paint over a spot. When you let go it is replaced with texture from nearby, blended into its edges.'}));
  box.append(el('p',{class:'note',text:'Every map of the layer is healed together (a material). Selections, symmetry and the 3D mirror shape the stroke.'}));}
/* the toolbar button (after the blend tool) */
(function(){const bar=$('#tools'),sm=bar&&bar.querySelector('.tool[data-tool="smudge"]');if(!sm)return;
  const b=el('button',{class:'tool','data-tool':'heal',title:'Healing brush (J): spot or Alt+click source','aria-label':'Healing brush','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><rect x="2.8" y="8.6" width="18.4" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx=".8" transform="rotate(-45 12 12)"/><path d="M11 11.2h.01M13 12.8h.01"/></svg>';
  b.addEventListener('click',()=>setTool('heal'));sm.after(b);})();

/* ================= Clone stamp (0.24) =================
   Alt+click where to copy from, then paint: the copy appears as you paint (no blending into the edges, unlike
   the healing brush). It shares the source (and Aligned) with the healing brush. Every map of the layer is
   cloned together; selection, symmetry and the 3D mirror shape the stroke. Opacity sets how strongly it covers. */
const FS_CLONE=`uniform sampler2D uT; uniform sampler2D uStrokeTex; uniform sampler2D uSelTex; uniform int uUseSel; uniform vec2 uOff; uniform int uWrap; uniform float uOpacity;
void main(){ ivec2 q=ivec2(gl_FragCoord.xy), sz=textureSize(uT,0); vec4 t=texelFetch(uT,q,0); float m=texelFetch(uStrokeTex,q,0).a*uOpacity; if(uUseSel==1) m*=texelFetch(uSelTex,q,0).r;
  ivec2 r=q+ivec2(uOff); if(uWrap==1) r=ivec2(mod(vec2(r),vec2(sz))); else if(any(lessThan(r,ivec2(0)))||any(greaterThanEqual(r,sz))){ o=t; return; }
  o=mix(t,texelFetch(uT,r,0),m); }`;
let P_CLONE=null;
const strokeLive=o=>o.tool==='smudge'||o.tool==='clone';
/* at the start of a clone stroke: a copy of every map as it was (the primary map's copy is beforeT) */
function cloneBegin(s){const L=s.L,maps=[];
  if(!L.maskOf&&!L.quick&&L.maps)for(const k of Object.keys(L.maps)){const T=L.maps[k];if(!T||T.empty||!T.tex||T===L.target)continue;const old=acquireD(T.depth);blit(T,old,0,0,T.w,T.h,0,0);maps.push({k,T,old});}
  s.clone={maps,off:heal.off.slice()};}
/* redraw the copy where the stroke has been so far */
function cloneUpdate(){const s=stroke;if(!s||!s.clone)return;s.cloneDirty=false;if(!P_CLONE)P_CLONE=program(FS_CLONE);
  const U=Object.assign({uStrokeTex:strokeT.tex,uOff:s.clone.off,uWrap:{int:doc.wrap?1:0},uOpacity:s.o.opacity},selU(s.o));
  run(P_CLONE,s.L.target,Object.assign({uT:beforeT.tex},U));for(const m of s.clone.maps)run(P_CLONE,m.T,Object.assign({uT:m.old.tex},U));
  if(s.L.maskOf||s.L.quick)return;s.L.lookVer=(s.L.lookVer||0)+1;}
/* at the end: the undo parts of the other maps */
function cloneEnd(s,x0,y0,bw,bh,record){cloneUpdate();const parts=[];
  for(const m of s.clone.maps){if(record&&bw>0&&bh>0)parts.push({k:m.k,before:captureRegion(m.old,x0,y0,bw,bh),after:captureRegion(m.T,x0,y0,bw,bh)});release(m.old);}
  s.clone=null;return parts;}
function buildClonePanel(box){$('#brushTitle').textContent='Clone stamp';
  box.append(el('div',{class:'chips'},chk('clAl','Aligned',heal.aligned,v=>{heal.aligned=v;heal.off=null;healSave();})),
    el('p',{class:'note',text:heal.src?'Alt+click to pick a new source. Aligned: the source moves along with each stroke. The healing brush uses the same source.':'Alt+click where to copy from (on the canvas or the model), then paint.'}),
    el('p',{class:'note',text:'Every map of the layer is copied together (a material). Selections, symmetry and the 3D mirror shape the stroke.'}));}
(function(){const h=document.querySelector('#tools .tool[data-tool="heal"]');if(!h)return;
  const b=el('button',{class:'tool','data-tool':'clone',title:'Clone stamp (Y): Alt+click a source, then paint','aria-label':'Clone stamp','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><path d="M9.5 3.5h5v5.2c0 1.2 1 2.1 2.2 2.1h1.3a1.5 1.5 0 0 1 1.5 1.5V15H5v-2.7a1.5 1.5 0 0 1 1.5-1.5h1.3c1.2 0 1.7-.9 1.7-2.1z"/><path d="M5 18h14M7 21h10"/></svg>';
  b.addEventListener('click',()=>setTool('clone'));h.after(b);})();
