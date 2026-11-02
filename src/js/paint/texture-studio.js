/* ================= Texture studio (0.93) =================
   Our own pattern brushes (sprinkles, noise, hatch, grids, crackle, swirls, pointillism) and salt, speckle and splatter brushes.
   Each stroke fills its body with a pattern that stays put on the canvas; the marks grow fatter in the middle of the stroke and thin out into
   scattered pieces at its edges and tail (see uPat in the brush shader). */
const TX_BASE={patRamp:300,patDen:.85,tool:'brush',tip:null,hardness:.3,flow:1,opacity:1,spacing:.05,smoothing:.4,smoothCurve:true,pSize:false,pOpacity:false,pFlow:false,buildup:false,simP:'speed',tooth:0,minSize:.3};
const TX_GROUPS=[
 ['Texture · Patterns',[
  ['Sprinkles',{pattern:1,patSize:15,size:110}],['Tiny sprinkles',{pattern:2,patSize:11,size:100}],['Noise',{pattern:3,patSize:5,size:100}],['Static',{pattern:4,patSize:5,size:100}],
  ['Wavy lines',{pattern:5,patSize:10,size:100}],['Zig zag lines',{pattern:6,patSize:15,size:100}],['Brush hatch',{pattern:7,patSize:20,size:110}],['Brush grid',{pattern:8,patSize:13,size:110}],
  ['Sneaker crackle',{pattern:9,patSize:20,size:110}],['Swirly',{pattern:10,patSize:16,size:110}],['Pointillism light',{pattern:11,patSize:8,size:110,hardness:.45}],['Pointillism bold',{pattern:14,patSize:12,size:110,hardness:.45}]]],
 ['Texture · Salt and speckle',[
  ['Salt dust',{pattern:12,patSize:3.4,size:90,hardness:.12,patRamp:180}],['Fine salt spray',{pattern:12,patSize:2.3,size:110,hardness:.08,patRamp:200}],['Coarse salt',{pattern:12,patSize:6.5,size:90,hardness:.15,patRamp:160}],
  ['Snow flurry',{pattern:12,patSize:4.6,size:190,hardness:.05,patRamp:260}],['Speckle',{pattern:12,patSize:3.6,size:70,hardness:.4,patRamp:120}],['Powder trail',{pattern:12,patSize:2.8,size:130,hardness:.05,patRamp:360}],
  ['Salt splatter',{pattern:13,patSize:14,size:150,hardness:.08,patRamp:150}],['Fine salt splatter',{pattern:13,patSize:7,size:140,hardness:.08,patRamp:150}],['Spatter flick',{pattern:13,patSize:10,size:90,hardness:.05,patRamp:100}]]]];
TX_GROUPS.forEach(([name,list],gi)=>library.splice(20+gi,0,{id:'texstudio'+gi,name,builtin:true,tips:[],presets:list.map(([n,s])=>Object.assign({name:n,ownTool:true},TX_BASE,s))}));
