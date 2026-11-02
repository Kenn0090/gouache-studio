/* ================= Graffiti brushes (0.88) =================
   Our own set (made from scratch): spray caps that throw fine dots with overspray mist, pressure for fat and skinny lines, drips that run
   when you hold the brush still, paint markers, a flick for splatter and a stencil edge. They lay paint on top like real paint (no mixing). */
const GRAFFITI=[
 ['Fat cap',{size:110,hardness:.3,flow:.7,spacing:.03,spray:.7,sprayDen:2.2,sprayMist:.08,sprayFleck:.45,drip:.5,dripAuto:.6,pSize:true,minSize:.45,pFlow:true}],
 ['Medium cap',{size:56,hardness:.4,flow:.75,spacing:.03,spray:.65,sprayDen:2.2,sprayMist:.06,sprayFleck:.4,drip:.35,dripAuto:.4,pSize:true,minSize:.4,pFlow:true}],
 ['Skinny cap',{size:20,hardness:.8,flow:.8,spacing:.04,spray:.6,sprayDen:2.6,sprayMist:.04,sprayFleck:.25,drip:.2,dripAuto:.15,pSize:true,minSize:.4,pFlow:true}],
 ['Outline cap',{size:38,hardness:.7,flow:.85,spacing:.04,spray:.65,sprayDen:3,sprayMist:.25,sprayFleck:.3,drip:.3,dripAuto:.3,pSize:true,minSize:.5,pFlow:true}],
 ['Calligraphy cap',{size:52,hardness:.7,roundness:.22,angle:35,flow:.75,spacing:.04,spray:.7,sprayDen:2.6,sprayMist:.08,sprayFleck:.25,drip:.25,dripAuto:.2,pSize:false,pFlow:true}],
 ['Soft fade cap',{size:170,hardness:.05,flow:.6,spacing:.03,spray:.9,sprayDen:1.4,sprayMist:.35,sprayFleck:.2,drip:0,pSize:true,minSize:.5,pFlow:true}],
 ['Stipple blob',{size:130,hardness:.2,flow:.8,spacing:.03,spray:.6,sprayDen:1.3,sprayMist:0,sprayFleck:.1,drip:0,pSize:false,pFlow:false}],
 ['Spray dot (dab)',{size:70,hardness:.3,flow:1,spacing:3,spray:.65,sprayDen:2.6,sprayMist:.1,sprayFleck:.7,drip:1.0,dripWidth:1.6,pSize:true,minSize:.5,pFlow:false}],
 ['Dry streak spray',{size:120,hardness:.55,roundness:.4,flow:.8,spacing:.03,spray:.8,sprayDen:1.8,sprayMist:0,grain:.85,sprayFleck:.15,drip:0,pSize:false,pFlow:false}],
 ['Spit cap',{size:60,hardness:.5,flow:.8,spacing:.05,spray:3,sprayDen:.5,sprayVar:.6,sprayMist:.04,sprayFleck:.4,drip:.15,pSize:true,minSize:.5,pFlow:true}],
 ['Clogged cap',{size:70,hardness:.3,flow:.75,spacing:.04,spray:1.2,sprayDen:1.1,sprayMist:.1,grain:.6,sprayFleck:.2,drip:.2,pSize:true,minSize:.5,pFlow:true}],
 ['Chisel paint marker',{size:34,hardness:.95,roundness:.3,angle:40,flow:1,opacity:.95,spacing:.04,smoothing:.4,drip:.15,dripAuto:.2,pSize:false,buildup:false,spray:0}],
 ['Paint marker',{size:20,hardness:.95,flow:1,opacity:.95,spacing:.04,smoothing:.4,drip:.2,dripAuto:.2,pSize:false,buildup:false,spray:0}],
 ['Drippy mop marker',{size:70,hardness:.75,flow:1,opacity:.95,spacing:.04,smoothing:.4,drip:1.1,dripAuto:1.0,dripWidth:1.8,pSize:true,minSize:.6,buildup:false,spray:0}],
 ['Splatter flick',{size:150,hardness:.15,flow:1,spacing:.9,spray:5,sprayDen:.3,sprayVar:1,sprayMist:0,pSize:false,buildup:false,drip:0}],
 ['Stencil edge',{size:44,hardness:1,flow:1,grain:.22,spacing:.04,smoothing:.1,pSize:false,buildup:false,spray:0,drip:0}]
].map(([name,s])=>Object.assign({name,tool:'brush',tip:null,buildup:true,smoothing:.35,smoothCurve:true,pOpacity:false},s));
library.splice(4,0,{id:'graffiti',name:'Graffiti',builtin:true,presets:GRAFFITI,tips:[]});
