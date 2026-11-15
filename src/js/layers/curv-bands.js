/* ================= Curvature detail: big shapes, medium shapes, small details (0.97.27, Georgian via Kenn) =================
   "You need to make some proper curvature controls to be able to tune up big shapes, medium and small shapes like in Substance."
   A curvature map holds everything at once: the broad roundness of a cheek, the ridge of a lip, and pores. It is split into three
   bands by blurring it twice (a little, then a lot):
     small details  = curvature − light blur        (pores, scratches, sharp creases)
     medium shapes  = light blur − strong blur       (lips, eyelids, panel edges)
     big shapes     = strong blur                    (cheeks, the skull, the broad forms)
   Each band has its own strength. At 100% each the three add back up to the original map exactly, so nothing changes until a
   slider moves; 0% takes that size out, 200%+ pushes it.
   Used by the mask generators (Edges, Cavities…) and the Bake tab's curvature map. */
const CB_KEYS=[['big','Big shapes'],['med','Medium shapes'],['small','Small details']];
const FS_CBAND=`uniform sampler2D uC; uniform sampler2D uA; uniform sampler2D uB; uniform vec3 uW; uniform vec2 uSz;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; float c=texture(uC,uv).r, a=texture(uA,uv).r, b=texture(uB,uv).r;
  float v=0.5+uW.z*(c-a)+uW.y*(a-b)+uW.x*(b-0.5); o=vec4(vec3(clamp(v,0.0,1.0)),1.0); }`;
let P_CBAND=null;
const cbOf=o=>({big:o&&o.big!=null?o.big:1,med:o&&o.med!=null?o.med:1,small:o&&o.small!=null?o.small:1});
function curvBandsOn(o){const w=cbOf(o);return Math.abs(w.big-1)>1e-3||Math.abs(w.med-1)>1e-3||Math.abs(w.small-1)>1e-3;}
/* the blur sizes, as a share of the texture: light (the edge of small details) and strong (the edge of big shapes); `scale` moves both */
function cbRadii(o,W,H){const s=Math.max(W,H),k=o&&o.scale!=null?o.scale:1;return [Math.max(1,s*.004*k),Math.max(2,s*.025*k)];}
/* a new doc-size target with the bands mixed (the caller releases it: pooled) */
function curvBands(src,o,depth){if(!src||!src.tex)return null;if(!P_CBAND)P_CBAND=program(FS_CBAND);const w=cbOf(o),W=doc.w,H=doc.h,d=depth||16;
  const c=acquireD(16),a=acquireD(16),b=acquireD(16),out=acquireD(d);
  try{if(src.w===W&&src.h===H)blit(src,c,0,0,W,H,0,0);else copyScaled(src,c);const [r1,r2]=cbRadii(o,W,H);gaussian(c,a,r1);gaussian(c,b,r2);
    run(P_CBAND,out,{uC:c.tex,uA:a.tex,uB:b.tex,uW:[w.big,w.med,w.small],uSz:[W,H]});out.ver=(out.ver||0)+1;/* a new picture for anything that remembers per picture */}
  finally{release(c);release(a);release(b);}
  return out;}
/* the sliders: three strengths and the size that splits them */
function curvBandsSliders(get,set,idp){const w=cbOf(get()),o=get()||{};
  const sl=(k,label)=>makeSlider({id:idp+k,label,min:0,max:4,step:.01,value:w[k],def:1,fmt:v=>Math.round(v*100)+'%',onInput:v=>set(k,v)}).el;
  return [...CB_KEYS.map(([k,l])=>sl(k,l)),makeSlider({id:idp+'scale',label:'Shape size',min:.25,max:4,step:.01,value:o.scale!=null?o.scale:1,def:1,fmt:v=>Math.round(v*100)+'%',onInput:v=>set('scale',v)}).el,
    el('p',{class:'note',text:'Big shapes: the broad forms. Medium: ridges and edges. Small: pores, scratches and sharp creases. 100% each is the map as baked; 0% takes that size out, higher pushes it. Shape size moves where small ends and big begins.'})];}
/* ---- mask generators: the curvature they read goes through the bands first (mask-stack.js msSource, once per row) ---- */
function cbGen(curv,p,ctx){if(!curv||!p||!curvBandsOn(p.cb))return curv;const out=curvBands(curv,p.cb,16);if(!out)return curv;ctx.tmp.push(out);return out;}
/* the card in the generator settings */
{const f=msRowEditor;msRowEditor=function(box,L,where,r){const out=f.apply(this,arguments);
  try{if(r&&r.kind==='gen'&&r.p&&!['light','linear','radial','comic','builder'].includes(r.p.g)&&!MS_PAINT_DAMAGE.includes(r.p.g)&&!box.querySelector('#msCb_big')){
      const kids=curvBandsSliders(()=>r.p.cb,(k,v)=>msEdit(L,r,row=>{row.p.cb=Object.assign({},row.p.cb||{},{[k]:v});},'Curvature detail'),'msCb_');
      const card=typeof mscCard==='function'?mscCard('curvbands','Curvature detail',kids):el('div',{},el('div',{class:'sub',text:'Curvature detail'}),...kids);
      const cards=box.querySelector('#msCards');if(cards)cards.prepend(card);else box.append(card);}}catch(e){console.warn('curvature detail',e);}
  return out;};}
/* ---- the Bake tab's curvature map: bake-tab.js bakeDerive splits the measured curvature before the maps are made ---- */
function cbBake(raw){const C=bakeCfg;if(!raw||!curvBandsOn(C.curvBands))return raw;const t=curvBands(raw,C.curvBands,16);if(!t)return raw;
  const o=makeTarget(doc.w,doc.h,16,false);blit(t,o,0,0,doc.w,doc.h,0,0);release(t);disposeTarget(raw);return o;}
