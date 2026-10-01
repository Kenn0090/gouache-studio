/* Five authored library-based materials and matching, model-aware mask stacks. */
const SW_PIC=(id,tile,mode='multiply',op=1)=>{const r=SM_IMG(id,tile,false,mode,op);r[1].tri=true;return r;};
const SW_GEN=(g,amount,width,breakup,extra)=>SM_GEN(g,amount,width,breakup,Object.assign({contrast:2.4,scale:9,seed:17},extra||{}));
const SW_LIB=(name,slug,mask,adjust)=>SM_L(name,slug,[.5,.5,.5],{mask,libAdjust:Object.assign({proj:'tri',hStr:.15,tile:1.3},adjust||{})});
const SW_MASKS=[
 ['Workshop · Exposed metal',SM_M(SW_GEN('chips',.53,.38,.32),SW_PIC('worn-paint-2',1.7,'multiply',.65))],
 ['Workshop · Leather scuffs',SM_M(SW_GEN('edge',.50,.32,.25),SW_PIC('brush-smears',2.2,'multiply',.70))],
 ['Workshop · Faded wood',SM_M(SW_GEN('bleach',.52,.42,.30),SW_PIC('fine-brushed-lines',2.4,'multiply',.60))],
 ['Workshop · Damp recesses',SM_M(SW_GEN('dirt',.61,.65,.26),SW_PIC('grime',1.5,'multiply',.68))],
 ['Workshop · Armour edge highlights',SM_M(SW_GEN('edge',.76,.28,.13,{contrast:3.5}),SW_PIC('light-scratches',2.5,'multiply',.35))]
];
const SW_MATERIALS=[
 ['Workshop · Worn painted metal',[
  SW_LIB('Blue enamel paint','blue-painted-metal',null,{hStr:.10,tile:1.4}),
  SW_LIB('Exposed steel at chipped edges','polished-steel',SW_MASKS[0][1],{hStr:.04,tile:1.7}),
  SM_F('Rust in damaged areas',{base:{c:[.24,.075,.025]},rough:{v:.86},metal:{v:0},height:{v:.48}},{mask:SM_M(SW_GEN('dirt',.52,.5,.30),SW_PIC('rust-pits-2',2.0,'multiply',.8)),op:.62}),
  SM_F('Grease and embedded dirt',{base:{c:[.025,.022,.018]},rough:{v:.66},metal:{v:0}},{mask:SM_M(SW_GEN('dirt',.49,.45,.20),SW_PIC('fine-grime',2,'multiply',.7)),op:.65}),
  SM_F('Hairline surface scratches',{rough:{v:.47}},{mask:SM_M(SW_PIC('hairline-scratches',3,'normal',1)),op:.22})
 ]],
 ['Workshop · Weathered leather',[
  SW_LIB('Brown leather grain','worn-brown-leather',null,{hStr:.16,tile:1.8}),
  SM_F('Warm scuffed edges',{base:{c:[.30,.15,.067]},rough:{v:.76},height:{v:.49}},{mask:SW_MASKS[1][1],op:.72}),
  SM_F('Dirt caught in creases',{base:{c:[.028,.018,.012]},rough:{v:.9}},{mask:SM_M(SW_GEN('dirt',.60,.55,.25),SW_PIC('fine-grime',2,'multiply',.65)),op:.72}),
  SM_F('Fine leather fissures',{base:{c:[.055,.025,.012]},rough:{v:.88},height:{v:.48}},{mask:SM_M(SW_PIC('dry-cracks',3.2,'normal',1)),op:.20}),
  SM_F('Polished contact areas',{rough:{v:.36}},{mask:SM_M(SW_GEN('edge',.43,.22,.16)),op:.35})
 ]],
 ['Workshop · Aged wood',[
  SW_LIB('Old wood fibres','old-dark-wood',null,{hStr:.18,tile:1.2}),
  SM_F('Sun-faded fibres',{base:{c:[.27,.205,.125]},rough:{v:.88}},{mask:SW_MASKS[2][1],op:.48}),
  SM_F('Worn exposed grain',{base:{c:[.31,.22,.12]},rough:{v:.82}},{mask:SM_M(SW_GEN('edge',.52,.36,.30),SW_PIC('fine-brushed-lines',2.1,'multiply',.6)),op:.65}),
  SM_F('Damp dark recesses',{base:{c:[.035,.03,.018]},rough:{v:.72}},{mask:SW_MASKS[3][1],op:.7}),
  SM_F('Settled dusty fibres',{base:{c:[.22,.19,.135]},rough:{v:.95}},{mask:SM_M(SW_GEN('dust',.44,.35,.35),SW_PIC('dust',2,'multiply',.75)),op:.32})
 ]],
 ['Workshop · Abandoned concrete',[
  SW_LIB('Cast concrete aggregate','cast-concrete',null,{hStr:.20,tile:1.5}),
  SM_F('Weathered cracks',{base:{c:[.06,.06,.052]},rough:{v:.94},height:{v:.47}},{mask:SM_M(SW_PIC('cracks-2',1.5,'normal',1)),op:.38}),
  SM_F('Damp stains in recesses',{base:{c:[.08,.095,.068]},rough:{v:.63}},{mask:SW_MASKS[3][1],op:.64}),
  SM_F('Rain streaks',{base:{c:[.12,.13,.105]},rough:{v:.86}},{mask:SM_M(SW_PIC('leaks-3',1.5,'normal',1),SW_GEN('drips',.65,.5,.30)),op:.3}),
  SW_LIB('Patchy moss','thick-moss',SM_M(SW_GEN('moss',.43,.38,.32),SW_PIC('splotches',1.8,'multiply',.80)),{hStr:.10,tile:2.0}),
  SM_F('Dry exposed edges',{base:{c:[.41,.405,.35]},rough:{v:.92}},{mask:SM_M(SW_GEN('edge',.50,.30,.25)),op:.3})
 ]],
 ['Workshop · Stylized armour',[
  SM_F('Deep teal armour paint',{base:{c:[.045,.25,.32]},rough:{v:.42},metal:{v:.18}}),
  SM_F('Broad upper-plane colour',{base:{c:[.11,.36,.40]},rough:{v:.40},metal:{v:.18}},{mask:SM_M(['dir',{axis:'up',angle:65,soft:28,inv:false}]),op:.52}),
  SM_F('Clean readable edge accents',{base:{c:[.40,.75,.68]},rough:{v:.30},metal:{v:.22}},{mask:SW_MASKS[4][1],op:.86}),
  SM_F('Small chips reveal dark metal',{base:{c:[.095,.13,.145]},rough:{v:.33},metal:{v:.85}},{mask:SM_M(SW_GEN('chips',.43,.23,.18),SW_PIC('worn-paint-1',2.8,'multiply',.7)),op:.76}),
  SM_F('Controlled recess shading',{base:{c:[.01,.035,.045]},rough:{v:.62},metal:{v:.05}},{mask:SM_M(SW_GEN('dirt',.55,.48,.10,{contrast:2.8})),op:.74})
 ]]
];


const SW_COMIC=p=>['gen',Object.assign(msGenDefaults('comic'),p)];
SW_MASKS.push(['Workshop · Comic halftone',SM_M(SW_COMIC({comicStyle:'dots',dotSize:.65,dots:36,lightAz:-40,lightEl:40}))]);
SW_MATERIALS.push(['Workshop · Comic book',[
 SM_F('Ochre paper colour',{base:{c:[.80,.36,.065]},rough:{v:.9},metal:{v:0}}),
 SM_F('Ink shadows',{base:{c:[.012,.022,.065]},rough:{v:1},metal:{v:0}},{mask:SM_M(SW_COMIC({comicStyle:'shadow',lightAz:-40,lightEl:40,width:0})),op:.92}),
 SM_F('Printed halftone',{base:{c:[.055,.04,.08]},rough:{v:1}},{mask:SW_MASKS[5][1],op:.80}),
 SM_F('Cream highlights',{base:{c:[1,.79,.38]},rough:{v:.88}},{mask:SM_M(['gen',Object.assign(msGenDefaults('light'),{lightAz:-40,lightEl:40,width:0,contrast:2,amount:.35})]),op:.50}),
 SM_F('Inked edge contours',{base:{c:[.006,.012,.03]},rough:{v:1}},{mask:SM_M(SW_GEN('edge',.64,.30,.06)),op:.70})
]]);
SM_LIB.push(...SW_MATERIALS);SMASK_LIB.push(...SW_MASKS);
