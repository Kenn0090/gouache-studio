/* ================= Blend brush: Soft blend and Wet smear (0.95) =================
   Kenn: "a better blend brush rather than a smudge". The Blend tool (S) now has two modes, chosen in its panel:
   - Soft blend: the colours under the brush are averaged into each other, in place, so edges melt into smooth gradients and nothing is dragged along.
   - Wet smear: the old pull-the-paint-along behaviour, now with bristle streaks (lanes across the stroke pull different distances).
   Brushes that came before have no mode and keep smearing; the ones named after blending (Blender, Soft blender, Stump blend) are soft. */
for(const set of library)for(const p of set.presets||[]){if(p.tool==='smudge'&&!('blendMode' in p))p.blendMode=/blend|blender/i.test(p.name)&&!/bristle/i.test(p.name)?'soft':'smear';}
PRESETS.push({name:'Soft blend',tool:'smudge',blendMode:'soft',size:70,hardness:.25,spacing:.06,strength:.55,charge:0,pSize:false,pOpacity:true},
  {name:'Wet smear',tool:'smudge',blendMode:'smear',size:56,hardness:.5,spacing:.05,strength:.7,charge:.05,streak:.35,pSize:false,pOpacity:true});
