/* ================= More examples for the welcome screen (0.95) =================
   Each one is built by the app itself (no files to ship): a wood-plank tile, a sheet of brush strokes, and three 3D Paint
   models dressed with smart materials. They open in a new tab like the first two. */
function exWoodPlanks(){const R=rng(23),W=256;
  const gaps=newDoc(1024,1024,8,fromHex('#3c2614'),'Wood planks',true);gaps.name='Gaps';
  const planks=newLayerObj('Planks');insertNode(planks,doc.root);
  const pal=['#9a6a3e','#8d5f35','#a47446','#935f36','#a8794a','#98683c'];
  for(let c=0;c<4;c++){const x=c*W+W/2;scriptStroke(planks,[[x,-140,1],[x,1164,1]],{size:W-12,hardness:1,spacing:.04,color:pal[Math.floor(R()*pal.length)]});}
  const grain=newLayerObj('Grain');Object.assign(grain,{clip:true,opacity:.7});insertNode(grain,doc.root);
  for(let c=0;c<4;c++){const x0=c*W+10;for(let k=0;k<30;k++){const x=x0+R()*(W-20),ph=R()*6.3,amp=2+R()*5,pts=[];for(let y=-20;y<=1044;y+=40)pts.push([x+Math.sin(y*.011+ph)*amp,y,1]);
      scriptStroke(grain,pts,{size:2+R()*4,hardness:.5,flow:.35+R()*.3,color:R()<.7?'#5b3919':'#c99a62',spacing:.05});}}
  const knots=newLayerObj('Knots');Object.assign(knots,{clip:true});insertNode(knots,doc.root);
  for(const [cx,cy] of [[128+W,300],[128+3*W,760],[128,880]]){for(const [k,col] of [[1,'#7a4b25'],[.72,'#6a3f1e'],[.46,'#5a3417'],[.2,'#3f2410']]){scriptStroke(knots,ell(cx,cy,34*k,58*k,0,0,6.283,30,null,[.06,R()*6,.03,R()*6]),{size:5*k+2,hardness:.8,flow:.8,color:col,spacing:.04});}}
  const shade=newLayerObj('Edge shading');Object.assign(shade,{mode:1,opacity:.8});insertNode(shade,doc.root);
  for(let c=0;c<4;c++)for(const dx of [10,W-10]){const x=c*W+dx;scriptStroke(shade,[[x,-20,1],[x,1044,1]],{size:26,hardness:0,flow:.5,color:'#2a1608',spacing:.05});}
  const nails=newLayerObj('Nails');insertNode(nails,doc.root);
  for(let c=0;c<4;c++)for(const y of [70,520,960]){const x=c*W+W/2+(R()-.5)*14;scriptStroke(nails,[[x,y,1],[x+.1,y,1]],{size:11,hardness:.9,color:'#34312e'});scriptStroke(nails,[[x-2,y-2,1],[x-1.9,y-2,1]],{size:4,hardness:.9,color:'#8d8a85'});}
  doc.count=7;selectOnly(nails);changedAll();}
function exBrushSampler(){const R=rng(5),paper=newDoc(1400,900,8,fromHex('#f3ecdf'),'Brush sampler',true);paper.name='Paper';
  const taper=u=>.25+.75*Math.sin(u*Math.PI);
  const looks=[['Soft round',{size:44,hardness:0,flow:.6,pSize:true,pOpacity:true,color:'#2d4a6b'}],['Hard round',{size:26,hardness:1,color:'#8a2e2e'}],['Pastel',{size:50,hardness:.3,grain:.7,flow:.5,pOpacity:true,color:'#c98a3d'}],
    ['Watercolour build-up',{size:64,hardness:.05,flow:.14,buildup:true,color:'#3a7d6e'}],['Ink',{size:8,hardness:.95,pSize:true,minSize:.1,color:'#1b1b1b'}],['Chalk',{size:36,hardness:.2,grain:.9,flow:.8,color:'#6b5b8c'}],
    ['Marker',{size:30,hardness:.6,flow:1,opacity:.7,color:'#d4a017'}],['Dry brush',{size:56,hardness:.5,grain:1,flow:.4,pSize:true,color:'#5a3b2a'}],['Airbrush',{size:84,hardness:0,flow:.22,buildup:true,color:'#c2477b'}],['Pencil',{size:5,hardness:.9,grain:.6,flow:.9,pOpacity:true,color:'#444444'}]];
  looks.forEach(([name,o],i)=>{const L=newLayerObj(name);insertNode(L,doc.root);const y=70+i*80,pts=[];for(let k=0;k<=44;k++){const u=k/44;pts.push([90+u*1220,y+Math.sin(u*9+i)*17+(R()-.5)*3,taper(u)]);}scriptStroke(L,pts,o);});
  doc.count=looks.length+1;selectOnly(doc.root.children[doc.root.children.length-1]);changedAll();}
async function exP3Smart(names){if(ui.mode!=='p3d'&&!setMode('p3d',true))return;await tick();await new Promise(r=>setTimeout(r,300));
  for(const n of names){const rec=smBuiltins().find(r=>r.name.toLowerCase()===n.toLowerCase());if(rec)await smApply(rec);}}
EXAMPLES.push(
  {id:'planks',name:'Wood planks tile',kind:'Paint',text:'A seamless hand-painted plank floor: gaps, planks, grain, knots, shading and nails, one layer each.',icon:'▤',async run(){if(!(await askReplace()))return;exWoodPlanks();fit();}},
  {id:'brushes',name:'Brush sampler',kind:'Paint',text:'Ten brush looks on their own layers: soft, hard, pastel, watercolour, ink, chalk, marker, dry brush, airbrush and pencil.',icon:'✎',async run(){if(!(await askReplace()))return;exBrushSampler();fit();}},
  {id:'p3rust',name:'Rusty painted metal',kind:'3D Paint',text:'Rusty painted metal with dust in 3D Paint: open the folders to see the generated masks.',icon:'◈',run(){return exP3Smart(['Rusty Painted Metal','Dust']);}},
  {id:'p3stone',name:'Mossy stone',kind:'3D Paint',text:'Cracked stone with moss growing in the cavities.',icon:'◈',run(){return exP3Smart(['Cracked Stone','Moss']);}},
  {id:'p3bronze',name:'Weathered bronze',kind:'3D Paint',text:'Aged bronze with a copper patina and dirt in the creases.',icon:'◈',run(){return exP3Smart(['Aged Bronze','Copper Patina','Dirt']);}});
