/* ================= Sketch studio (0.91) =================
   Our own drawing kit: crispy pencils, graphite shading, crayons, magic markers, pens and ink. The pencils and crayons only mark the peaks of the paper
   (Paper tooth: the paper layer's grain, or sketch paper when there is none); the markers are see-through (a later stroke over an earlier one darkens
   it, one stroke never darkens itself) and streak out as they run dry. */
const CRAYON_TIP=genTip('Crayon nib',192,64,(x,w,h,R)=>{x.fillRect(w*.1,h*.2,w*.8,h*.6);
  for(let i=0;i<220;i++){const edge=R()<.5,px=w*.1+R()*w*.8,py=edge?(R()<.5?h*.2:h*.8):h*.2+R()*h*.6,l=2+R()*7,t=1+R()*3;x.globalAlpha=.5+R()*.5;
    if(edge)x.fillRect(px,py+(py<h/2?-t*R()*2:0),l,t*1.6);else x.fillRect(R()<.5?w*.1-l*.6:w*.9-l*.4,py,l,t);}
  for(let i=0;i<60;i++){x.globalAlpha=.25*R();x.fillRect(w*.1+R()*w*.8,h*.2+R()*h*.6,2+R()*6,1+R()*3);}x.globalAlpha=1;});
const SK_PEN={tool:'brush',tip:null,hardness:.9,flow:1,opacity:1,spacing:.03,smoothing:.35,smoothCurve:true,pSize:true,minSize:.45,pOpacity:true,buildup:true,simP:'speed',tooth:.85};
const SK_MARK=Object.assign({},WCS_MIX,{mixPick:0,mixWet:0,mixDry:0,mixUse:0,mixWC:.06,mixWCEdge:.45,mixWCPools:0,mixWCGran:.15,mixTooth:.4,mixLoad:.9,flow:.85,smoothing:.45,pSize:false,mixEven:true,hardness:.9,spacing:.03,simP:'off'});
const SK_GROUPS=[
 ['Sketch · Pencils',[
  ['HB pencil',{size:5,flow:.5,tooth:.9}],['2B pencil',{size:7,flow:.6,tooth:.85}],['4B pencil',{size:10,flow:.7,tooth:.8,hardness:.8}],['6B soft pencil',{size:14,flow:.8,tooth:.7,hardness:.6}],
  ['Mechanical pencil',{size:3,flow:.6,tooth:.6,minSize:.7}],['Carpenter pencil',{size:18,roundness:.3,angle:35,flow:.6,tooth:.85,pSize:false}],
  ['Hatching pencil',{tip:'graphite',size:40,angle:30,flow:.5,tooth:.8,spacing:.1,pSize:false}],['Cross-hatch pencil',{tip:'graphite',size:44,angleJitter:.28,flow:.5,tooth:.8,spacing:.35,pSize:false}],
  ['Soft coloured pencil',{size:6,flow:.55,tooth:1}],['Charcoal pencil',{tip:'charcoal',size:14,flow:.8,tooth:.9}]]],
 ['Sketch · Graphite shading',[
  ['Soft shader',{size:90,hardness:.05,flow:.2,tooth:.6,pOpacity:false,minSize:.5}],['Grainy shader',{size:70,hardness:.1,flow:.3,tooth:1,pOpacity:false}],['Smooth graphite',{size:100,hardness:.08,flow:.18,tooth:.15,pOpacity:false}],
  ['Scribble shading',{tip:'graphite',size:50,angleJitter:1,flow:.6,tooth:.8,spacing:.5,pSize:false}],['Hatch shader',{tip:'graphite',size:60,angle:35,flow:.55,tooth:.8,spacing:.12,pSize:false}],
  ['Stipple shader',{size:60,hardness:.3,flow:.9,tooth:0,spray:1.2,sprayDen:.45,pSize:false,pOpacity:false}],
  ['Stump blend',{tool:'smudge',size:50,hardness:.15,strength:.55,sampleAll:true,paintMix:0,spacing:.05,smoothing:.4,pSize:true,minSize:.5,pOpacity:false,buildup:false,tooth:0,simP:'off'}],
  ['Kneaded eraser',{tool:'erase',size:40,hardness:.2,flow:.25,tooth:.5,buildup:true,pOpacity:false,simP:'off'}]]],
 ['Sketch · Crayons',[
  ['Wax crayon',{tip:'crayon',size:24,angle:20,flow:.9,tooth:.8,pSize:false}],['Chunky crayon',{tip:'crayon',size:50,angle:15,flow:.9,tooth:.9,pSize:false}],['Soft crayon',{tip:'crayon',size:36,angle:20,flow:.6,tooth:.6,pSize:false}],
  ['Rough paper crayon',{tip:'crayon',size:30,angle:20,flow:.95,tooth:1,pSize:false}],['Sketch oil pastel',{size:28,hardness:.7,flow:1,tooth:.5,pSize:true,minSize:.6}],
  ['Crayon fill',{tip:'crayon',size:90,angle:10,flow:.9,tooth:.7,pSize:false,spacing:.05}],['Crayon hatch',{tip:'graphite',size:30,angle:35,flow:.9,tooth:.9,spacing:.12,pSize:false}],['Dry crayon',{tip:'crayon',size:30,angle:20,flow:.5,tooth:1,pSize:false}]]],
 ['Sketch · Magic markers',[
  ['Alcohol marker',Object.assign({},SK_MARK,{size:28,roundness:.35,angle:40})],['Magic chisel marker',Object.assign({},SK_MARK,{size:40,roundness:.22,angle:35})],
  ['Brush marker',Object.assign({},SK_MARK,{size:20,hardness:.6,pSize:true,minSize:.3})],['Fine tip marker',Object.assign({},SK_MARK,{size:6})],
  ['Highlighter',Object.assign({},SK_MARK,{size:36,roundness:.3,angle:30,mixLoad:.6})],
  ['Dry marker',Object.assign({},SK_MARK,{size:30,roundness:.35,angle:40,mixUse:.35,mixBristles:24,mixDryB:.55})],['Marker fade streak',Object.assign({},SK_MARK,{size:34,roundness:.4,angle:30,mixUse:.6,mixBristles:30,mixDryB:.7,pSize:true,minSize:.5})],
  ['Blender marker',Object.assign({},SK_MARK,{size:30,mixPick:.9,mixWet:1,mixLoad:.15,mixWC:.15,mixDry:25})]]],
 ['Sketch · Pens',[
  ['Ballpoint pen',{size:3,hardness:1,flow:.9,tooth:.4,smoothing:.4,minSize:.5}],['Ballpoint pen (soft)',{size:4,hardness:.9,flow:.7,tooth:.5,smoothing:.35,minSize:.4}],['Ballpoint scribble',{size:2.5,hardness:1,flow:.7,tooth:.5,smoothing:.12,minSize:.6}],
  ['Fineliner 0.3',{size:2,hardness:1,flow:1,tooth:0,smoothing:.5,pSize:false,pOpacity:false,buildup:false,simP:'off'}],['Fineliner 0.5',{size:3,hardness:1,flow:1,tooth:0,smoothing:.5,pSize:false,pOpacity:false,buildup:false,simP:'off'}],
  ['Fineliner 0.8',{size:5,hardness:1,flow:1,tooth:0,smoothing:.5,pSize:false,pOpacity:false,buildup:false,simP:'off'}],['Hatching pen',{size:2.5,hardness:1,flow:.9,tooth:.15,minSize:.3,spacing:.02}]]],
 ['Sketch · Ink',[
  ['G-pen ink',{size:12,hardness:1,flow:1,tooth:0,pOpacity:false,buildup:false,minSize:.03,curve:.35,smoothing:.55}],['Dip pen ink',{size:9,hardness:1,flow:1,tooth:0,pOpacity:false,buildup:false,minSize:.05,smoothing:.5}],
  ['Brush pen ink',{size:22,hardness:.9,flow:1,tooth:.15,pOpacity:false,buildup:false,minSize:.04,smoothing:.55}],['Textured ink',{size:12,hardness:.95,flow:1,tooth:.5,pOpacity:false,buildup:false,minSize:.05,smoothing:.5}]]],
 ['Sketch · Combo',[
  ['Combo · Clean inker',{size:8,hardness:1,flow:1,tooth:0,pOpacity:false,buildup:false,minSize:.06,smoothing:.6,simP:'taper'}],['Combo · Pencil line',{size:4,hardness:.9,flow:.55,tooth:.8,minSize:.5}]]]
];
(function(){const tipOf=k=>k==='crayon'?CRAYON_TIP:ART_TIPS[k]||null;
  SK_GROUPS.forEach(([name,list],gi)=>library.splice(13+gi,0,{id:'sketch'+gi,name,builtin:true,tips:[],presets:list.map(([n,s])=>{const base=s.mix?{tool:'brush'}:Object.assign({},SK_PEN);const p=Object.assign({name:n,ownTool:true},base,s);if(typeof s.tip==='string')p.tip=tipOf(s.tip);return p;})}));})();
