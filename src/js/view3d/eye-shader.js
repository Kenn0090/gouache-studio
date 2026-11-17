/* ================= Eye shader (0.98.11, Kenn: "parallax material setup so I can mess around with an eye shader") =================
   A look for eyeballs, the 21st in the list (FS_3D: uSh 20, eyeUV). Give the eye its own texture set whose picture shows the
   iris and the white of the eye, laid flat (the iris in the middle, or wherever Iris centre says). The shader then:
     Parallax   reads the iris at its own depth below the clear cornea, so it shifts as you move round the eye
     Refraction bends the view going into the cornea (the iris looks bigger and shifts more at an angle)
     Pupil      opens and closes by stretching the painted iris, so one picture works for any pupil size
     Limbal ring dark ring round the iris;  Iris tint / White tint  colour the iris and the rest
     Cornea     a clear wet layer: its roughness is its own setting (low = bright, sharp reflections)
     Caustic    the bright crescent on the iris opposite the light
   Settings: uShP = centre x, centre y, iris radius, pupil (0.5 = as painted); uShQ = depth, refraction, limbal ring, cornea roughness;
   uShC = iris tint; uSkin = white of the eye tint; uShD = painted pupil size (share of the iris), caustic. */
SHADERS.push(['eye','Eye (iris parallax)']);
SH_DEF.eye={cx:.5,cy:.5,iris:.22,pupil:.5,pupilTex:.3,depth:.35,refract:.5,limbal:.5,gloss:.04,tint:[1,1,1],white:[1,1,1],caustic:.4};
SH_PRESETS.eye=[['human','Human',{iris:.22,pupil:.5,pupilTex:.3,depth:.35,refract:.5,limbal:.55,gloss:.04,caustic:.4}],['wide','Wide pupil',{iris:.22,pupil:.8,pupilTex:.3,depth:.35,refract:.5,limbal:.5,gloss:.04,caustic:.2}],['pin','Pin-point pupil',{iris:.22,pupil:.18,pupilTex:.3,depth:.35,refract:.5,limbal:.55,gloss:.04,caustic:.6}],['deep','Deep iris',{iris:.22,pupil:.5,pupilTex:.3,depth:.7,refract:.7,limbal:.6,gloss:.03,caustic:.5}],['doll','Doll / glass',{iris:.26,pupil:.45,pupilTex:.28,depth:.55,refract:.9,limbal:.2,gloss:.02,caustic:.8}],['flat','Flat (cartoon)',{iris:.25,pupil:.5,pupilTex:.3,depth:0,refract:0,limbal:0,gloss:.2,caustic:0}]];
{const f=shadeUniforms;shadeUniforms=function(sh,time){if(!sh||sh.kind!=='eye')return f.apply(this,arguments);
  const U=f({kind:'std',p:{}},time),P=shParams(sh);
  return Object.assign(U,{uSh:{int:20},uShP:[P.cx,P.cy,Math.max(.01,P.iris),P.pupil],uShQ:[P.depth,P.refract,P.limbal,P.gloss],uShC:(P.tint||[1,1,1]).slice(0,3),uSkin:[...(P.white||[1,1,1]).slice(0,3),0],uShD:[P.pupilTex,P.caustic,0]});};}
/* the iris centre can be clicked on the model: the next click on it sets Iris centre */
const eyeP={pick:false};
function eyePickArm(){eyeP.pick=true;toast('Click the middle of the iris on the model.');renderShading();
  const h=document.getElementById('v3Hit');if(!h)return;
  const on=e=>{if(e.button!==0)return;e.preventDefault();e.stopImmediatePropagation();window.removeEventListener('pointerdown',on,true);eyeP.pick=false;
    const r=v3PickAt(h,e);if(!r||!r.uv){toast('Click on the eye.');renderShading();return;}
    shadeEdit(d=>{d.p.eye=Object.assign({},shParams(d,'eye'),{cx:+r.uv[0].toFixed(4),cy:+r.uv[1].toFixed(4)});});renderShading();};
  window.addEventListener('pointerdown',on,true);}
function eyePanel(P,sl,colr,setP){const sub=t=>el('div',{class:'sub',text:t});const f2=v=>v.toFixed(2);
  return [el('p',{class:'note',text:'For eyeballs. The iris is read at its own depth under a clear cornea, so it shifts as you look round the eye. Put the iris in the middle of the eye’s picture, or use Pick on the model.'}),
    sub('Iris'),el('div',{class:'chips'},el('button',{class:'btn sm',id:'eyePick',type:'button',text:eyeP.pick?'Click the iris…':'Pick centre on model',onclick:eyePickArm}),
      el('button',{class:'btn sm',id:'eyeReset',type:'button',text:'Centre 0.5, 0.5',onclick:()=>{setP('cx',.5);setP('cy',.5);renderShading();}})),
    sl('cx','Iris centre across',0,1,.001,f2),sl('cy','Iris centre up',0,1,.001,f2),sl('iris','Iris size',.02,.6,.005,f2),sl('pupil','Pupil size',0,1,.01),sl('pupilTex','Pupil in the picture',.05,.8,.01,f2),
    sub('Depth'),sl('depth','Iris depth (parallax)',0,1.2,.01,f2),sl('refract','Cornea bending',0,1,.01),
    sub('Look'),sl('limbal','Dark ring round the iris'),colr('tint','Iris tint'),colr('white','White of the eye tint'),sl('caustic','Light crescent'),sl('gloss','Cornea roughness',0,.5,.005,v=>v.toFixed(3))];}
