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
/* (0.98.13, Kenn: "like Substance's Curvature generator") seven sizes, Sharp to Huge, instead of three. Same idea: the map is blurred at six growing sizes and
   each size's share (the difference between two neighbouring blurs) has its own strength; 100% each adds back up to the original, so nothing changes until a slider moves. */
const CB_KEYS=[['sharp','Sharp'],['fine','Fine'],['soft','Soft'],['medium','Medium'],['large','Large'],['big','Big'],['huge','Huge']];
const CB_SUBSTANCE={sharp:1,fine:.9,soft:.75,medium:.5,large:.25,big:.15,huge:.1};
const CB_NEW=['sharp','fine','soft','medium','large','huge'];
const FS_CBAND=`uniform sampler2D uT0; uniform sampler2D uT1; uniform sampler2D uT2; uniform sampler2D uT3; uniform sampler2D uT4; uniform sampler2D uT5; uniform sampler2D uT6; uniform vec4 uW0; uniform vec3 uW1; uniform vec2 uSz;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; float t0=texture(uT0,uv).r,t1=texture(uT1,uv).r,t2=texture(uT2,uv).r,t3=texture(uT3,uv).r,t4=texture(uT4,uv).r,t5=texture(uT5,uv).r,t6=texture(uT6,uv).r;
  float v=0.5+uW0.x*(t0-t1)+uW0.y*(t1-t2)+uW0.z*(t2-t3)+uW0.w*(t3-t4)+uW1.x*(t4-t5)+uW1.y*(t5-t6)+uW1.z*(t6-0.5); o=vec4(vec3(clamp(v,0.0,1.0)),1.0); }`;
let P_CBAND=null;
/* strengths for the seven sizes. Older settings had three (small, med, big): they spread over the seven. */
const cbOf=o=>{o=o||{};const g=k=>o[k]!=null?o[k]:null,legacy=!CB_NEW.some(k=>o[k]!=null)&&(o.med!=null||o.small!=null||o.big!=null),f=(k,alt)=>{const v=g(k);if(v!=null)return v;if(legacy&&alt!=null)return alt;return 1;};
  return {sharp:f('sharp',g('small')),fine:f('fine',g('small')),soft:f('soft',g('med')),medium:f('medium',g('med')),large:f('large',g('med')),big:g('big')!=null?o.big:1,huge:f('huge',g('big'))};};
/* the settings of the filters and converters (cbSharp…cbHuge, or the old cbBig / cbMed / cbSmall) as one object */
const cbFromV=v=>{v=v||{};const o={};for(const [k] of CB_KEYS){const x=v['cb'+k[0].toUpperCase()+k.slice(1)];if(x!=null)o[k]=x;}if(v.cbMed!=null)o.med=v.cbMed;if(v.cbSmall!=null)o.small=v.cbSmall;return o;};
function curvBandsOn(o){const w=cbOf(o);return CB_KEYS.some(([k])=>Math.abs(w[k]-1)>1e-3);}
/* the six blur sizes, as a share of the texture: .2%, .4%, .8%, 1.6%, 3.2%, 6.4%; `scale` moves them all */
function cbRadii(o,W,H){const s=Math.max(W,H),k=o&&o.scale!=null?o.scale:1;return [0,1,2,3,4,5].map(i=>Math.max(1+i*.5,s*.002*Math.pow(2,i)*k));}
/* a new doc-size target with the bands mixed (the caller releases it: pooled) */
function curvBands(src,o,depth){if(!src||!src.tex)return null;if(!P_CBAND)P_CBAND=program(FS_CBAND);const w=cbOf(o),W=doc.w,H=doc.h,d=depth||16;
  const c=acquireD(16),g=[0,1,2,3,4,5].map(()=>acquireD(16)),out=acquireD(d);
  try{copyScaled(src,c);const R=cbRadii(o,W,H);/* (0.98.10, Georgian: the blurs did not go over the UVs) on a model the blur walks across the seams */
    const bl=(from,to,r)=>{if(!(typeof meshConnectedBlur==='function'&&meshConnectedBlur(from,to,r/2.2*1.0,r/2.2*1.0,false)))gaussian(from,to,r);};
    for(let i=0;i<6;i++)bl(i?g[i-1]:c,g[i],i?Math.sqrt(R[i]*R[i]-R[i-1]*R[i-1]):R[0]);/* each blur continues from the last, so the sizes add up */
    run(P_CBAND,out,{uT0:c.tex,uT1:g[0].tex,uT2:g[1].tex,uT3:g[2].tex,uT4:g[3].tex,uT5:g[4].tex,uT6:g[5].tex,uW0:[w.sharp,w.fine,w.soft,w.medium],uW1:[w.large,w.big,w.huge],uSz:[W,H]});out.ver=(out.ver||0)+1;/* a new picture for anything that remembers per picture */}
  finally{release(c);g.forEach(release);}
  return out;}
/* the sliders: three strengths and the size that splits them */
function curvBandsSliders(get,set,idp){const w=cbOf(get()),o=get()||{};
  const objs={},sl=(k,label)=>{const m=makeSlider({id:idp+k,label,min:0,max:4,step:.01,value:w[k],def:1,fmt:v=>Math.round(v*100)+'%',onInput:v=>{if(o&&(o.med!=null||o.small!=null)&&!CB_NEW.some(q=>o[q]!=null))for(const q of CB_NEW)set(q,w[q]);set(k,v);}});objs[k]=m;return m.el;};
  /* (0.98.13, Kenn) Substance's own starting values for the seven sizes: 100, 90, 75, 50, 25, 15 and 10 % */
  const subs=el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',id:idp+'subst',text:'Substance default',title:'The starting values of Substance\u2019s Curvature generator (100, 90, 75, 50, 25, 15, 10 %)',onclick:()=>{for(const [k,v] of Object.entries(CB_SUBSTANCE)){set(k,v);if(objs[k]&&objs[k].set)try{objs[k].set(v);}catch(e){}}}}),
    el('button',{class:'btn sm',type:'button',id:idp+'flat',text:'All 100%',title:'Back to the map as baked',onclick:()=>{for(const [k] of CB_KEYS){set(k,1);if(objs[k]&&objs[k].set)try{objs[k].set(1);}catch(e){}}}}));
  return [subs,...CB_KEYS.map(([k,l])=>sl(k,l)),makeSlider({id:idp+'scale',label:'Shape size',min:.25,max:4,step:.01,value:o.scale!=null?o.scale:1,def:1,fmt:v=>Math.round(v*100)+'%',onInput:v=>set('scale',v)}).el,
    el('p',{class:'note',text:'Seven sizes, from Sharp (pores, scratches, creases) to Huge (the broad forms). 100% each is the map as baked; 0% takes that size out, higher pushes it. Shape size moves all the sizes together.'})];}
/* ---- mask generators: the curvature they read goes through the bands first (mask-stack.js msSource, once per row) ---- */
function cbGen(curv,p,ctx){if(!curv||!p||!curvBandsOn(p.cb))return curv;const out=curvBands(curv,p.cb,16);if(!out)return curv;ctx.tmp.push(out);return out;}
/* the card in the generator settings */
{const f=msRowEditor;msRowEditor=function(box,L,where,r){const out=f.apply(this,arguments);
  try{if(r&&r.kind==='gen'&&r.p&&!['light','linear','radial','comic'].includes(r.p.g)&&!MS_PAINT_DAMAGE.includes(r.p.g)&&!box.querySelector('#msCb_big')){
      const kids=curvBandsSliders(()=>r.p.cb,(k,v)=>msEdit(L,r,row=>{row.p.cb=Object.assign({},row.p.cb||{},{[k]:v});},'Curvature detail'),'msCb_');
      const card=typeof mscCard==='function'?mscCard('curvbands','Curvature detail',kids):el('div',{},el('div',{class:'sub',text:'Curvature detail'}),...kids);
      /* (Kenn) the Mask Builder: right under its curvature inputs */
      const cav=r.p.g==='builder'&&box.querySelector('#ms_cavityWeight'),row=cav&&(cav.closest('.srow,.slider,.frow')||cav.parentElement);
      const cards=box.querySelector('#msCards');if(row&&row.parentElement===box)row.after(card);else if(row)row.parentElement.after(card);else if(cards)cards.prepend(card);else box.append(card);}}catch(e){console.warn('curvature detail',e);}
  return out;};}
/* ---- the Bake tab's curvature map: bake-tab.js bakeDerive splits the measured curvature before the maps are made ---- */
function cbBake(raw,o){const C=bakeCfg;o=o||C.curvBands;if(!raw||!curvBandsOn(o))return raw;const t=curvBands(raw,o,16);if(!t)return raw;
  const n=makeTarget(doc.w,doc.h,16,false);blit(t,n,0,0,doc.w,doc.h,0,0);release(t);disposeTarget(raw);return n;}
/* in place, into a target of any depth (Convert tab, converters) */
function cbInto(t,o){if(!t||!curvBandsOn(o))return;const r=curvBands(t,o,t.depth);if(!r)return;blit(r,t,0,0,doc.w,doc.h,0,0);release(r);}
