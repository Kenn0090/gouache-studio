/* ================= Packed shader pictures are freed when the shader stops using them (0.98.17) =================
   Georgian: "switched through different shaders ... video card memory leak" (dedicated memory up to 24 GB). Skin, Specular reflectivity, custom
   shaders and the metal/specular-level pair each make full-size packed copies of the texture set (chPackRun). They stayed after switching to a
   shader that no longer needs them, one set per texture set, and the skin's screen-size blur pictures stayed too. After each drawing of the
   3D view the copies no part of a drawn set asked for are released. */
{const f=chPackUniforms;chPackUniforms=function(U,T,sh,it){if(chFrame&&T&&T.base){let c=chPk.get(T);if(!c){chPk.set(T,c={});chPkAll.add(c);if(chPkGone)chPkGone.register(T,c);}if(!chFrame.has(c))chFrame.set(c,new Set());}
  return f.apply(this,arguments);};}
/* per frame: a texture set drawn this frame keeps only the copies some part of it asked for (a model can mix shaders, so not per part) */
{const d3=draw3D;draw3D=function(){const outer=!chFrame;if(outer)chFrame=new Map();
  try{return d3.apply(this,arguments);}
  finally{if(outer){const F=chFrame;chFrame=null;for(const [c,used] of F)for(const k in c)if(!used.has(k)&&c[k]){if(c[k].t)disposeTarget(c[k].t);delete c[k];}}}};}
/* every packed copy (all texture sets): a shader switch, a project closing or the memory sweep */
function chPackFreeAll(){for(const c of chPkAll)for(const k in c){if(c[k]&&c[k].t)disposeTarget(c[k].t);delete c[k];}}
function chPackBytes(){let b=0;for(const c of chPkAll)for(const k in c){const t=c[k]&&c[k].t;if(t)b+=t.w*t.h*4*4/3;}return b;}
/* the skin blur's screen-size pictures go once no skin is drawn */
{const f=skinBlurPass;skinBlurPass=function(F,C,list,common,flip,g){const any=list.some(it=>{const sh=it.sh||v3ShadeOf(doc);return it.count&&sh&&sh.kind==='skin';});
  if(!any){if(skb.F)skbFree();return;}return f.apply(this,arguments);};}
