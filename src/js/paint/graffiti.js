/* ================= Graffiti brushes (0.88) =================
   Our own set (made from scratch): spray caps that throw fine dots with overspray mist, pressure for fat and skinny lines, drips that run
   when you hold the brush still, paint markers, a flick for splatter and a stencil edge. They lay paint on top like real paint (no mixing). */
/* a flat chisel nib whose two ends are frayed into fine hairs: held at a fixed angle it makes wildstyle ribbons that swing from thick to thin, with a fringe of
   fine streaks along the ragged edges */
const WILD_TIP=genTip('Wildstyle nib',512,128,(x,w,h,R)=>{x.fillRect(w*.04,h*.34,w*.92,h*.32);
  for(let i=0;i<190;i++){const px=w*.04+(i+R()*.9)/190*w*.92,tw=1+R()*2.4,up=h*.34*Math.pow(R(),1.7)*(R()<.8?1:.3),dn=h*.34*Math.pow(R(),1.7)*(R()<.8?1:.3);x.globalAlpha=.7+R()*.3;x.fillRect(px,h*.34-up,tw,up+2);x.fillRect(px,h*.66-2,tw,dn+2);}x.globalAlpha=1;});
const GRAFFITI=[
 ['Hardcore fat cap',{size:280,hardness:.25,flow:.7,spacing:.03,spray:1.5,sprayDen:1.7,sprayMist:.12,sprayVar:.35,sprayRing:.45,spraySwirl:.5,sprayFleck:.8,drip:.6,dripAuto:.7,dripWidth:1.4,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Hollow cone cap',{size:130,hardness:.3,flow:.7,spacing:.03,spray:.8,sprayDen:2.4,sprayMist:.1,sprayRing:.85,spraySwirl:.25,sprayFleck:.5,drip:.4,dripAuto:.4,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Spinning nozzle cap',{size:150,hardness:.3,flow:.7,spacing:.03,spray:.9,sprayDen:2.2,sprayMist:.1,sprayRing:.6,spraySwirl:1,sprayFleck:.5,drip:.4,dripAuto:.4,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Fat cap',{size:110,hardness:.3,flow:.7,spacing:.03,spray:.7,sprayDen:2.2,sprayMist:.08,sprayFleck:.45,drip:.5,dripAuto:.6,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Medium cap',{size:56,hardness:.4,flow:.75,spacing:.03,spray:.65,sprayDen:2.2,sprayMist:.06,sprayFleck:.4,drip:.35,dripAuto:.4,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Skinny cap',{size:20,hardness:.8,flow:.8,spacing:.04,spray:.6,sprayDen:2.6,sprayMist:.04,sprayFleck:.25,drip:.2,dripAuto:.15,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Outline cap',{size:38,hardness:.7,flow:.85,spacing:.04,spray:.65,sprayDen:3,sprayMist:.25,sprayFleck:.3,drip:.3,dripAuto:.3,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Calligraphy cap',{size:52,hardness:.7,roundness:.22,angle:35,flow:.75,spacing:.04,spray:.7,sprayDen:2.6,sprayMist:.08,sprayFleck:.25,drip:.25,dripAuto:.2,pSize:true,minSize:.1,pFlow:true,sprayPress:.6}],
 ['Soft fade cap',{size:170,hardness:.05,flow:.6,spacing:.03,spray:.9,sprayDen:1.4,sprayMist:.35,sprayFleck:.2,drip:0,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Stipple blob',{size:130,hardness:.2,flow:.8,spacing:.03,spray:.6,sprayDen:1.3,sprayMist:0,sprayFleck:.1,drip:0,pSize:false,pFlow:false}],
 ['Spray dot (dab)',{size:70,hardness:.3,flow:1,spacing:3,spray:.65,sprayDen:2.6,sprayMist:.1,sprayFleck:.7,drip:1.0,dripWidth:1.6,pSize:true,minSize:.5,pFlow:false}],
 ['Dry streak spray',{size:120,hardness:.55,roundness:.4,flow:.8,spacing:.03,spray:.8,sprayDen:1.8,sprayMist:0,grain:.85,sprayFleck:.15,drip:0,pSize:false,pFlow:false}],
 ['Spit cap',{size:60,hardness:.5,flow:.8,spacing:.05,spray:3,sprayDen:.5,sprayVar:.6,sprayMist:.04,sprayFleck:.4,drip:.15,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Clogged cap',{size:70,hardness:.3,flow:.75,spacing:.04,spray:1.2,sprayDen:1.1,sprayMist:.1,grain:.6,sprayFleck:.2,drip:.2,pSize:true,minSize:.05,pFlow:false,sprayPress:.7}],
 ['Chisel paint marker',{size:34,hardness:.95,roundness:.3,angle:40,flow:1,opacity:.95,spacing:.04,smoothing:.4,drip:.15,dripAuto:.2,pSize:false,buildup:false,spray:0}],
 ['Paint marker',{size:20,hardness:.95,flow:1,opacity:.95,spacing:.04,smoothing:.4,drip:.2,dripAuto:.2,pSize:false,buildup:false,spray:0}],
 ['Drippy mop marker',{size:70,hardness:.75,flow:1,opacity:.95,spacing:.04,smoothing:.4,drip:1.1,dripAuto:1.0,dripWidth:1.8,pSize:true,minSize:.6,buildup:false,spray:0}],
 ['Splatter flick',{size:150,hardness:.15,flow:1,spacing:.9,spray:5,sprayDen:.3,sprayVar:1,sprayMist:0,pSize:false,buildup:false,drip:0}],
 ['Wildstyle chisel (fringed)',{tip:WILD_TIP,size:210,angle:38,hardness:1,flow:1,opacity:1,spacing:.012,smoothing:.5,pSize:false,buildup:false,spray:0,drip:0,simP:'off'}],
 ['Wildstyle chisel (clean)',{size:120,angle:38,roundness:.14,hardness:1,flow:1,opacity:1,spacing:.012,smoothing:.5,pSize:false,buildup:false,spray:0,drip:0,simP:'off'}],
 ['Stencil edge',{size:44,hardness:1,flow:1,grain:.22,spacing:.04,smoothing:.1,pSize:false,buildup:false,spray:0,drip:0}]
].map(([name,s])=>Object.assign({name,tool:'brush',align3d:'wrap'/* (0.96.6) in 3D Paint: drips run down the view, as paint does */,tip:null,buildup:true,smoothing:.35,smoothCurve:true,pOpacity:false,simP:s.spray>0?'taper':'off'},s));
library.splice(4,0,{id:'graffiti',name:'Graffiti',builtin:true,presets:GRAFFITI,tips:[]});
/* Spray cap levels: one pass makes a grainy, see-through stipple that builds up slowly (no solid core), from a hairline to a huge cloud, with a hollow
   cone and swirl on the fatter caps. Press harder for a bigger, denser cloud; ease off for a fine mist. */
const CAP_LEVELS=[
 ['Cap level 1 · Skinny cream',{size:16,hardness:.8,spray:.7,sprayDen:2.0,sprayMist:.05,sprayRing:0,spraySwirl:0,sprayFleck:.12,flow:.55,spacing:.05}],
 ['Cap level 2 · Cream',{size:34,hardness:.75,spray:.7,sprayDen:2.0,sprayMist:.06,sprayRing:.2,spraySwirl:0,sprayFleck:.18,flow:.5,spacing:.05}],
 ['Cap level 3 · Medium',{size:64,hardness:.6,spray:.75,sprayDen:1.9,sprayMist:.07,sprayRing:.6,spraySwirl:.08,sprayFleck:.25,flow:.46,spacing:.05}],
 ['Cap level 4 · Fat cream',{size:110,hardness:.5,spray:.8,sprayDen:1.9,sprayMist:.08,sprayRing:.78,spraySwirl:.12,sprayFleck:.35,flow:.44,spacing:.055}],
 ['Cap level 5 · Fat',{size:190,hardness:.4,spray:.85,sprayDen:1.9,sprayMist:.1,sprayRing:.92,spraySwirl:.18,sprayVar:.2,sprayFleck:.5,flow:.42,spacing:.06}],
 ['Cap level 6 · Hardcore fat',{size:320,hardness:.3,spray:1.0,sprayDen:1.9,sprayMist:.12,sprayRing:1,spraySwirl:.25,sprayVar:.35,sprayFleck:.7,flow:.4,spacing:.06}]
].map(([name,s])=>Object.assign({name,tool:'brush',align3d:'wrap'/* (0.96.6) in 3D Paint: drips run down the view, as paint does */,tip:null,buildup:true,smoothing:.4,smoothCurve:true,pOpacity:false,pSize:true,minSize:.04,pFlow:false,sprayPress:.85,spraySolid:0,drip:0,dripAuto:0,simP:'taper'},s));
library.splice(5,0,{id:'caplevels',name:'Spray cap levels',builtin:true,presets:CAP_LEVELS,tips:[]});
