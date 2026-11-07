/* ================= (0.95.6) More smart materials and smart masks, and an update of the old ones =================
   Kenn: weapons & armour, sci-fi, fantasy & characters, stylised/hand-painted, plus the staples every texturing app has
   (painted steel, chrome, rubber, plastic, forged iron, silver, aluminium…), using many more of the photo grunges and the
   mixed grunges made with the Grunge Mixer's maths (TX_MIXED). The old built-ins are upgraded when they are listed:
   generator masks get Distort and a Warp row (uneven, irregular breakup instead of an even band), and plain wear/dirt
   layers get a little height so chips and grime catch the light. */
/* a generator row with its own blend mode and strength */
const SM_GENM=(mode,op,...a)=>{const r=SM_GEN(...a);return [r[0],r[1],mode,op];};
const SM_EMIS=(name,c,glow,o)=>SM_F(name,{base:{c},emis:{c:glow},rough:{v:.4},metal:{v:0}},o);
/* a hand-painted material: a flat fill plus the Hand-painted look as a content effect (its preset is filled in when listed) */
const SM_HP=(name,preset,base)=>SM_F(name,{base:{c:base||[.6,.6,.6]},rough:{v:.7},metal:{v:0}},{cfx:[{kind:'filter',on:true,mode:'normal',op:1,fx:'handPaint',maps:'all',name:'Hand-painted look',v:{preset,own:true}}]});
SM_LIB.push(
  /* ---- weapons & armour ---- */
  ['Handled Gunmetal',[SM_L('Gunmetal','gunmetal',[.2,.21,.22]),
    SM_L('Worn edges','polished-steel',[.7,.71,.72],{mask:SM_M(SM_GEN('edge',.52,.45,.6),SM_IMG('mix-blade-scratches',2,false,'multiply',.85))}),
    SM_F('Grip polish',{rough:{v:.18}},{mask:SM_M(SM_IMG('mix-handled-wear',1,false,'normal',1),SM_GENM('multiply',.8,'edge',.4,.6,.5)),op:.7}),
    SM_F('Grime',{base:{c:[.07,.065,.06]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.55,.5),SM_IMG('weathered-grime',1,false,'multiply',.85)),op:.75})]],
  ['Blued Steel',[SM_L('Blued steel','blued-steel',[.12,.14,.2]),
    SM_L('Bare steel edges','scratched-steel',[.6,.6,.62],{mask:SM_M(SM_GEN('edge',.5,.42,.6),SM_IMG('scraped-steel',1,false,'multiply',.8))}),
    SM_F('Oily prints',{rough:{v:.15}},{mask:SM_M(SM_IMG('greasy-prints',1,false,'normal',1)),op:.55}),
    SM_F('Fine rust',{base:{c:[.32,.14,.06]},rough:{v:.85},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.42,.5,.55),SM_IMG('rust-pits-4',2,false,'multiply',.9)),op:.6})]],
  ['Battle-Worn Plate',[SM_L('Plate','hammered-iron',[.38,.38,.4]),
    SM_L('Bright gashes','polished-steel',[.75,.75,.77],{mask:SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('mix-battle-damage',1,false,'max',.8))}),
    SM_F('Dents and nicks',{height:{v:.4},rough:{v:.35}},{mask:SM_M(SM_IMG('mix-bullet-nicks',1,false,'normal',1)),op:.8}),
    SM_F('Soot',{base:{c:[.05,.05,.05]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('soot',.5,.55,.5),SM_IMG('mix-scorch',1,false,'multiply',.9)),op:.7}),
    SM_L('Rust','rusty-steel',[.36,.2,.1],{mask:SM_M(SM_GEN('dirt',.45,.5,.5),SM_IMG('rust-pits-6',2,false,'multiply',.9)),op:.75})]],
  /* ---- sci-fi ---- */
  ['Sci-fi Hull Paint',[SM_L('Hull paint','white-plastic',[.82,.83,.84]),
    SM_L('Chipped to metal','scratched-steel',[.55,.56,.58],{mask:SM_M(SM_GEN('chips',.5,.5,.55),SM_IMG('scraped-chipped-coating',1,false,'multiply',1))}),
    SM_F('Panel grime',{base:{c:[.12,.12,.13]},rough:{v:.85},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.55,.5),SM_IMG('mix-panel-grime',1,false,'multiply',.9)),op:.75}),
    SM_F('Leaks',{base:{c:[.2,.18,.15]},rough:{v:.8},metal:{v:0}},{mask:SM_M(SM_IMG('leaks-6',1,false,'normal',1),SM_GENM('max',.4,'dirt',.45,.5,.5)),op:.5})]],
  ['Anodised Aluminium',[SM_L('Anodised','black-anodised',[.1,.1,.12]),
    SM_L('Bright scratched edges','brushed-aluminium',[.75,.76,.78],{mask:SM_M(SM_GEN('edge',.5,.4,.55),SM_IMG('hairline-scratches',2,false,'multiply',.85))}),
    SM_F('Fingerprints',{rough:{v:.55}},{mask:SM_M(SM_IMG('thumb-prints',1,false,'normal',1)),op:.45})]],
  ['Glowing Trim',[SM_L('Dark metal','smooth-dark-steel',[.15,.16,.17]),
    SM_EMIS('Glow in the grooves',[.05,.55,.8],[.15,.85,1],{mask:SM_M(SM_GEN('dirt',.6,.35,.2,{contrast:3}))}),
    SM_L('Worn edges','satin-silver',[.7,.7,.72],{mask:SM_M(SM_GEN('edge',.5,.4,.55),SM_IMG('micro-scratches',2,false,'multiply',.8)),op:.8})]],
  /* ---- fantasy & characters ---- */
  ['Ornate Gold',[SM_L('Gold','polished-gold',[.95,.72,.3]),
    SM_L('Tarnish','dark-bronze',[.3,.22,.12],{mask:SM_M(SM_GEN('dirt',.55,.6,.5),SM_IMG('mix-ornate-tarnish',1,false,'multiply',.9))}),
    SM_F('Polished highlights',{rough:{v:.12}},{mask:SM_M(SM_GEN('edge',.5,.45,.5)),op:.8})]],
  ['Enchanted Iron',[SM_L('Iron','dark-iron',[.2,.2,.22]),
    SM_EMIS('Arcane glow',[.4,.15,.7],[.6,.25,1],{mask:SM_M(SM_GEN('dirt',.6,.4,.3,{contrast:2.5}),SM_IMG('mix-painterly',1,false,'multiply',.7))}),
    SM_L('Silvered edges','satin-silver',[.75,.75,.78],{mask:SM_M(SM_GEN('edge',.5,.45,.6),SM_IMG('mix-blade-scratches',2,false,'multiply',.8))})]],
  ['Weathered Skin',[SM_F('Skin',{base:{c:[.72,.5,.4]},rough:{v:.55},metal:{v:0},height:{v:.5}}),
    SM_F('Pores',{height:{v:.44},rough:{v:.62}},{mask:SM_M(SM_NOISE('dots',40,2,-.1)),op:.8}),
    SM_F('Sun damage',{base:{c:[.62,.4,.3]}},{mask:SM_M(SM_IMG('mix-sun-bleach',1,true,'normal',1)),op:.35}),
    SM_F('Redness',{base:{c:[.72,.36,.32]}},{mask:SM_M(SM_GEN('dirt',.45,.55,.6)),op:.45}),
    SM_F('Grime',{base:{c:[.2,.14,.1]},rough:{v:.75}},{mask:SM_M(SM_GEN('dirt',.4,.5,.6),SM_IMG('fine-grime',1,false,'multiply',.8)),op:.35})]],
  /* ---- stylised / hand-painted ---- */
  ['Stylised Wood',[SM_HP('Stylised wood','Old wood',[.45,.3,.18])]],
  ['Stylised Stone',[SM_HP('Stylised stone','Rock',[.5,.5,.52])]],
  ['Stylised Steel',[SM_HP('Stylised steel','Steel',[.55,.6,.68])]],
  ['Stylised Gold',[SM_HP('Stylised gold','Gold',[.88,.64,.2])]],
  ['Stylised Leather',[SM_HP('Stylised leather','Leather',[.45,.28,.17])]],
  /* ---- the staples every texturing app has ---- */
  ['Painted Steel Worn',[SM_L('Painted steel','green-painted-metal',[.25,.35,.25]),
    SM_L('Chipped through','scratched-steel',[.55,.55,.57],{mask:SM_M(SM_GEN('chips',.5,.5,.55),SM_IMG('scraped-and-cracked-paint',1,false,'multiply',1))}),
    SM_F('Dirt',{base:{c:[.14,.12,.09]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.5,.55,.5),SM_IMG('dirt',1,false,'multiply',.9)),op:.65})]],
  ['Smudged Chrome',[SM_L('Chrome','chrome',[.9,.9,.92]),
    SM_F('Smudges',{rough:{v:.35}},{mask:SM_M(SM_IMG('greasy-swirls',1,false,'normal',1)),op:.6}),
    SM_F('Dust',{base:{c:[.55,.52,.48]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('dust',.45,.5,.5),SM_IMG('dust',1,false,'multiply',.8)),op:.5})]],
  ['Dusty Rubber',[SM_L('Rubber','black-rubber',[.06,.06,.06]),
    SM_F('Scuffed edges',{base:{c:[.18,.18,.18]},rough:{v:.75}},{mask:SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('brush-smears',1,false,'multiply',.9)),op:.8}),
    SM_F('Dust',{base:{c:[.5,.48,.44]},rough:{v:.95}},{mask:SM_M(SM_GEN('dust',.5,.55,.5),SM_IMG('mix-sandblasted',1,false,'multiply',.8)),op:.6})]],
  ['Matte Plastic',[SM_L('Plastic','plastic',[.3,.32,.35]),
    SM_F('Scuffs',{base:{c:[.45,.46,.48]},rough:{v:.65}},{mask:SM_M(SM_GEN('edge',.48,.45,.6),SM_IMG('light-scratches',2,false,'multiply',.85)),op:.7}),
    SM_F('Grime',{base:{c:[.1,.1,.1]},rough:{v:.9}},{mask:SM_M(SM_GEN('dirt',.45,.5,.5),SM_IMG('fine-grime',1,false,'multiply',.85)),op:.6})]],
  ['Forged Iron',[SM_L('Iron','hammered-iron',[.3,.3,.32]),
    SM_F('Soot',{base:{c:[.04,.04,.04]},rough:{v:.95},metal:{v:0}},{mask:SM_M(SM_GEN('soot',.5,.55,.5),SM_IMG('mix-scorch',1,false,'multiply',.85)),op:.75}),
    SM_L('Hammered shine','polished-steel',[.7,.7,.72],{mask:SM_M(SM_GEN('edge',.5,.45,.6),SM_IMG('scored-surface-scan',1,false,'multiply',.8))})]],
  ['Tarnished Silver',[SM_L('Silver','satin-silver',[.85,.85,.87]),
    SM_F('Tarnish',{base:{c:[.12,.1,.08]},rough:{v:.6},metal:{v:.6}},{mask:SM_M(SM_GEN('dirt',.55,.6,.5),SM_IMG('mix-ornate-tarnish',1,false,'multiply',.9)),op:.8})]],
  ['Stained Aluminium',[SM_L('Aluminium','rough-aluminium',[.7,.71,.72]),
    SM_F('Water stains',{base:{c:[.4,.38,.35]},rough:{v:.75},metal:{v:.4}},{mask:SM_M(SM_IMG('leaks-7',1,false,'normal',1),SM_IMG('bubble-stains',1,false,'max',.6)),op:.6}),
    SM_F('Oxide',{base:{c:[.82,.82,.8]},rough:{v:.9},metal:{v:0}},{mask:SM_M(SM_GEN('dirt',.45,.5,.5),SM_IMG('speckle',1,false,'multiply',.9)),op:.5})]]);
const SM_DIR=(axis,angle,soft,inv)=>['dir',{axis,angle,soft,inv:!!inv}];
const SM_GRAD=(axis,from,to,inv)=>['grad',{axis,from,to,inv:!!inv}];
const SM_MESH=(k,inv)=>['mesh',{k,inv:!!inv}];
SMASK_LIB.push(
  /* wear & damage */
  ['Battle damage',SM_M(SM_GEN('edge',.5,.5,.6),SM_IMG('mix-battle-damage',1,false,'max',.35),SM_OWN('warp',3,{scale:5}))],
  ['Blade scratches',SM_M(SM_IMG('mix-blade-scratches',1,false,'normal',.7),SM_GENM('multiply',.5,'edge',.35,.7,.5))],
  ['Bullet nicks',SM_M(SM_IMG('mix-bullet-nicks',1,false,'normal',1))],
  ['Grip wear',SM_M(SM_GEN('edge',.45,.6,.5),SM_IMG('mix-handled-wear',1,false,'multiply',.9))],
  ['Scorch marks',SM_M(SM_GEN('soot',.5,.55,.5),SM_IMG('mix-scorch',1,false,'multiply',.9),SM_OWN('warp',4,{scale:4}))],
  ['Torn coating',SM_M(SM_GEN('chips',.5,.5,.55),SM_IMG('torn-metal-coating',1,false,'multiply',1))],
  ['Gashed paint',SM_M(SM_GEN('chips',.48,.5,.55),SM_IMG('mixed-gashed-coating',1,false,'max',.3))],
  /* weather & nature */
  ['Moss in cavities',SM_M(SM_GEN('moss',.5,.6,.6),SM_IMG('mix-lichen',1,false,'multiply',.9))],
  ['Water streaks',SM_M(SM_GEN('drips',.5,.5,.5),SM_IMG('runs-3',1,false,'multiply',.9))],
  ['Sun-bleached top',SM_M(SM_GEN('bleach',.5,.55,.5),SM_IMG('mix-sun-bleach',1,false,'multiply',.8))],
  ['Snow on top',SM_M(SM_GEN('snow',.5,.55,.5),SM_IMG('spatter',1,false,'multiply',.8),SM_OWN('warp',3,{scale:6}))],
  ['Sand in crevices',SM_M(SM_GEN('dirt',.5,.6,.5),SM_IMG('mix-sandblasted',1,false,'multiply',.9))],
  ['Mud splash low',SM_M(SM_GRAD('up',0,.45,true),SM_IMG('mix-mud-splash',1,false,'multiply',1))],
  ['Ground dirt',SM_M(SM_GRAD('up',0,.6,true),SM_GENM('screen',.5,'dirt',.5,.6,.5),SM_IMG('dirt',1,false,'multiply',.85))],
  ['Surface leaks',SM_M(SM_IMG('leaks-8',1,false,'normal',1),SM_GENM('max',.6,'drips',.45,.5,.5))],
  ['Dust in occlusion',SM_M(SM_MESH('ao',true),SM_GENM('screen',.6,'dust',.5,.55,.5),SM_IMG('dust',1,false,'multiply',.85))],
  /* stylised */
  ['Painterly edge highlight',SM_M(SM_GEN('edge',.55,.7,.45),SM_IMG('mix-painterly',1,false,'multiply',.75))],
  ['Top light',SM_M(SM_GEN('light',.5,.6,.2))],
  ['Hand-painted cavity shade',SM_M(SM_GEN('dirt',.55,.65,.35),SM_IMG('mix-painterly',1,false,'multiply',.6))],
  ['Colour variation patches',SM_M(SM_NOISE('clouds',3,1.6,-.05),SM_IMG('mix-painterly',1,false,'overlay',.6))],
  /* technical */
  ['Height bottom to top',SM_M(SM_GRAD('up',0,1,false))],
  ['Ambient occlusion only',SM_M(SM_MESH('ao',true))],
  ['Curvature edges only',SM_M(SM_MESH('curvEdge',false))],
  ['Thin parts (thickness)',SM_M(SM_MESH('thick',true))]);
/* ---- the upgrade of the built-ins (old and new), done each time they are listed so nothing stored changes ---- */
const SM_UNEVEN=['edge','chips','dirt','dust','soot','moss','snow','crud','rust','scratch'];
function smMaskUpgrade(m){if(!m||!m.rows)return m;const o=JSON.parse(JSON.stringify(m)),gens=o.rows.filter(r=>r.kind==='gen'&&SM_UNEVEN.includes(r.p&&r.p.g));
  if(!gens.length||o.rows.some(r=>r.kind==='filter'))return o;
  for(const r of gens)if(r.p.distort==null)r.p.distort=.35;/* the generator reads the curvature a little off to the side, following a noise */
  o.rows.push(SM_OWN('warp',2.5,{scale:5,seed:11}).row);return o;}
function smUpgrade(n){const o=JSON.parse(JSON.stringify(n));if(o.mask)o.mask=smMaskUpgrade(o.mask);
  /* plain wear and dirt layers get a touch of height: chips and scratches sit a little lower, grime a little higher */
  const g=o.mask&&o.mask.rows&&(o.mask.rows.find(r=>r.kind==='gen')||{}).p;
  if(g&&!o.lib&&o.fill&&o.fill.maps&&!o.fill.maps.height&&!(o.cfx&&o.cfx.length)){const h=['edge','chips','scratch'].includes(g.g)?.46:['dirt','crud','soot','dust'].includes(g.g)?.53:null;if(h!=null)o.fill.maps.height={on:true,src:'value',v:h};}
  /* hand-painted presets are filled in here (the presets live in filters/handpaint.js) */
  for(const r of o.cfx||[])if(r.fx==='handPaint'&&r.v&&typeof r.v.preset==='string'&&r.v.base==null){const pr=typeof hpPreset==='function'?hpPreset(r.v.preset):null;r.v=Object.assign(typeof fxDefaults==='function'&&FX.handPaint?fxDefaults(FX.handPaint):{},pr?JSON.parse(JSON.stringify(pr)):{},{own:true,preset:r.v.preset,rOn:false,mOn:false});}
  if(o.kids)o.kids=o.kids.map(smUpgrade);return o;}
