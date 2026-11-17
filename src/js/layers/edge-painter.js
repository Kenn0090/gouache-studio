/* ================= Metal edge wear, Painter-style (0.98.13, Kenn: "rework our Edge wear to match") =================
   Painter's Metal Edge Wear has a short list of controls. Most of them are things our Edge wear generator already does under other names; this card shows
   them under Painter's names at the top of an Edge wear row, so the same settings work the same way. It edits the generator's own settings (no second copy):
     Wear Level = Amount · Wear Contrast = Contrast · Grunge Amount = Grunge breakup · Grunge Scale = Grunge scale · Edges Smoothness = Edge growth
     Ambient Occlusion Masking = Cavity protection · Curvature Weight = Edge strength · Micro Details = more of the Sharp curvature band (pores, scratches). */
const MEW_DEFAULTS={amount:.75,contrast:1.5,breakup:.3,scale:4,edgeGrow:.3,cavityProtection:.5,edgeStrength:1};
function mewSliders(L,r){const p=r.p,S=(id,label,key,min,max,step,fmt,def)=>makeSlider({id,label,min,max,step,value:p[key]??(key in EDGE_DEF?EDGE_DEF[key]:def),def,fmt,onInput:x=>msEdit(L,r,q=>{q.p[key]=x;},'Edge wear')}).el,pct=x=>Math.round(x*100)+'%';
  const micro=makeSlider({id:'mew_micro',label:'Micro Details',min:0,max:3,step:.01,value:Math.max(0,((typeof cbOf==='function'?cbOf(p.cb).sharp:1)-1)),def:0,fmt:pct,
    onInput:x=>msEdit(L,r,q=>{q.p.cb=Object.assign({},q.p.cb||{},{sharp:1+x});},'Edge wear')}).el;
  return [el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',id:'mew_defaults',text:'Painter defaults',title:'Wear 75%, contrast, grunge 30% at a scale of 4, smoothness, AO masking 50%',
      onclick:()=>{msEdit(L,r,q=>{Object.assign(q.p,MEW_DEFAULTS);},'Edge wear');if(typeof renderMatEd==='function')renderMatEd(true);}})),
    S('mew_amount','Wear Level','amount',0,1,.01,pct,.5),S('mew_contrast','Wear Contrast','contrast',.3,4,.05,x=>x.toFixed(2),1.5),
    S('mew_breakup','Grunge Amount','breakup',0,1,.01,pct,.5),S('mew_scale','Grunge Scale','scale',.5,40,.5,x=>String(x),6),
    S('mew_grow','Edges Smoothness','edgeGrow',0,1,.01,pct),S('mew_ao','Ambient Occlusion Masking','cavityProtection',0,1,.01,pct),
    S('mew_curv','Curvature Weight','edgeStrength',0,2,.01,pct),micro];}
{const f=msRowEditor;msRowEditor=function(box,L,where,r){const out=f.apply(this,arguments);
  try{if(r&&r.kind==='gen'&&r.p&&r.p.g==='edge'&&!box.querySelector('#mew_amount')){const kids=mewSliders(L,r),card=typeof mscCard==='function'?mscCard('mew','Metal edge wear (Painter-style)',kids):el('div',{},el('div',{class:'sub',text:'Metal edge wear'}),...kids);
      const cards=box.querySelector('#msCards');if(cards)cards.prepend(card);else box.prepend(card);}}catch(e){console.warn('metal edge wear',e);}
  return out;};}
