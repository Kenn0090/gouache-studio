/* ================= Free brush packs =================
   (0.45, Kenn) More brushes for the library. "Particles and marks" are the 81 brush tips of Kenney's Particle Pack and
   Smoke Particles (CC0, kenney.nl), packed as one grey picture (assets/brushes/particles.webp, 10 tiles across, 192 px each);
   "Basic media" are our own pencil, charcoal, pastel and paint brushes. Nothing here is saved in the file: they are rebuilt at start. */
const BP_TILE=192,BP_COLS=10;
const BP_NAMES=["Dirt crumbs", "Dirt specks", "Dirt clods", "Burst 1", "Burst 2", "Burst 3", "Scratches", "Dusty puff 1", "Dusty puff 2", "Dusty puff 3", "Smoke puff 1", "Smoke puff 2", "Smoke puff 3", "Cloud 1", "Cloud 2", "Smoke ring 1", "Smoke ring 2", "Lightning web 1", "Lightning web 2", "Lightning web 3", "Lightning web 4", "Lightning bolt 1", "Lightning bolt 2", "Electric line", "Glint 1", "Glint 2", "Glint 3", "Glint 4", "Soft glow", "Glint 5", "Star 1", "Star 2", "Star 3", "Crescent 1", "Crescent 2", "Crescent 3", "Crescent 4", "Needle 1", "Needle 2", "Crack 1", "Crack 2", "Crack 3", "Beam", "Swirl 1", "Swirl 2", "Swirl 3", "Wisp 1", "Wisp 2", "Wisp 3", "Wisp 4", "Flame 1", "Flame 2", "Fireball 1", "Fireball 2", "Ring 1", "Ring 2", "Ring 3", "Lens flare", "Soft dot", "Flame burst", "Flame 3", "Flame 4", "Flame 5", "Flame 6", "Black smoke 1", "Black smoke 2", "Black smoke 3", "Black smoke 4", "Black smoke 5", "Puff 1", "Puff 2", "Puff 3", "Puff 4", "Puff 5", "Explosion 1", "Explosion 2", "Explosion 3", "Explosion 4", "Flash 1", "Flash 2", "Flash 3"];
const BP_CATS="dddddddsssssssssslllllllgggggggggwwwwwwwwwwwwwwwwwffffgggggfffffssssssssssssssfff";
const BP_SETS={d:['Dirt and scorch',{size:90,spacing:.9,angleJitter:1,sizeJitter:.4,scatter:.3,pSize:false}],
  s:['Smoke and clouds',{size:150,spacing:.35,flow:.5,angleJitter:1,sizeJitter:.35,scatter:.15,pSize:false,pOpacity:true,buildup:true}],
  l:['Lightning and sparks',{size:170,spacing:1,followDir:true,sizeJitter:.2,pSize:false}],
  g:['Glints and stars',{size:70,spacing:.8,angleJitter:.15,sizeJitter:.6,scatter:1.2,pSize:false}],
  w:['Swooshes and cracks',{size:150,spacing:1,followDir:true,angleJitter:.05,pSize:false}],
  f:['Fire and flashes',{size:120,spacing:.5,angleJitter:.08,sizeJitter:.35,pSize:false,flow:.85}]};
let bpDone=false;
async function bpBytes(){const tag=document.getElementById('br_particles');
  if(tag){const b=atob(tag.textContent.trim()),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return u;}
  const r=await fetch('brushes/particles.webp');if(!r.ok)throw new Error('missing');return new Uint8Array(await r.arrayBuffer());}
async function bpLoad(){if(bpDone)return;bpDone=true;
  try{const bm=await createImageBitmap(new Blob([await bpBytes()],{type:'image/webp'}),{premultiplyAlpha:'none',colorSpaceConversion:'none'});
    const c=document.createElement('canvas');c.width=bm.width;c.height=bm.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
    const by={};
    BP_NAMES.forEach((nm,i)=>{const k=BP_CATS[i],ox=(i%BP_COLS)*BP_TILE,oy=Math.floor(i/BP_COLS)*BP_TILE,a=new Uint8Array(BP_TILE*BP_TILE);
      for(let y=0;y<BP_TILE;y++)for(let xx=0;xx<BP_TILE;xx++)a[y*BP_TILE+xx]=d[((oy+y)*c.width+ox+xx)*4];
      (by[k]||(by[k]=[])).push(Object.assign({name:nm,tool:'brush',tip:makeTip(nm,BP_TILE,BP_TILE,a)},BP_SETS[k][1]));});
    const at=library.findIndex(s=>s.id==='builtin')+1+(library.some(s=>s.id==='bp_basic')?1:0);let n=0;
    for(const k of Object.keys(BP_SETS))if(by[k])library.splice(at+n++,0,{id:'bp_'+k,name:BP_SETS[k][0],builtin:true,presets:by[k],tips:[]});
    renderLibrary();}catch(e){console.error('brush pack',e);}}
/* our own: tips drawn in code, then settings that make them feel like pencil, charcoal, pastel, dry paint */
const BP_TIPS={
  gasapen:genTip('Gasa Gaya tapered nib',128,128,(x,w,h,R)=>{x.save();x.scale(w,h);x.beginPath();x.moveTo(.43,.09);x.bezierCurveTo(.49,.04,.57,.055,.62,.14);x.bezierCurveTo(.69,.27,.78,.44,.84,.59);x.bezierCurveTo(.93,.79,.79,.91,.63,.9);x.bezierCurveTo(.5,.89,.36,.92,.24,.85);x.bezierCurveTo(.1,.77,.14,.63,.2,.51);x.bezierCurveTo(.27,.37,.35,.18,.43,.09);x.closePath();x.fill();x.restore();}),
  /* dry ink: a blob with long fibre gaps and a ragged edge, so strokes come out streaky and scratchy like a scanned ink brush */
  inkdry:genTip('Dry ink',128,128,(x,w,h,R)=>{x.beginPath();x.ellipse(w/2,h/2,w*.45,h*.4,0,0,7);x.fill();x.globalCompositeOperation='destination-out';
    for(let i=0;i<34;i++){const py=h*.1+R()*h*.8,len=w*(.35+R()*.65),x0=R()>.5?-4:w-len+4;x.globalAlpha=.9+R()*.1;x.fillRect(x0,py,len,1.2+R()*3.2);}
    for(let i=0;i<150;i++){x.globalAlpha=.5+R()*.5;x.fillRect(R()*w,R()*h,1+R()*3,1+R()*2);}}),
  inkbrush:genTip('Ink brush',256,96,(x,w,h,R)=>{for(let i=0;i<40;i++){const py=h*.1+R()*h*.8,len=w*(.5+R()*.5),x0=(w-len)/2+(R()-.5)*w*.12;x.globalAlpha=.7+R()*.3;x.fillRect(x0,py,len,1.4+R()*3);}
    x.globalCompositeOperation='destination-out';for(let i=0;i<45;i++){x.globalAlpha=.8+R()*.2;x.fillRect(R()*w,R()*h,8+R()*40,1+R()*1.6);}}),
  dry:genTip('Dry brush',160,256,(x,w,h,R)=>{for(let i=0;i<260;i++){const px=R()*w,len=h*(.5+R()*.5);x.globalAlpha=.2+R()*.6;x.fillRect(px,(h-len)/2+R()*10,1+R()*2.4,len);}}),
  stipple:genTip('Stipple',128,128,(x,w,h,R)=>{for(let i=0;i<60;i++){const a=R()*6.283,rr=Math.sqrt(R())*w*.46;x.globalAlpha=.5+R()*.5;x.beginPath();x.arc(w/2+Math.cos(a)*rr,h/2+Math.sin(a)*rr,1+R()*3,0,7);x.fill();}}),
  hatch:genTip('Hatching',192,192,(x,w,h)=>{x.globalAlpha=.9;x.lineWidth=2.5;for(let i=-4;i<9;i++){x.beginPath();x.moveTo(i*24,h);x.lineTo(i*24+h*.6,0);x.stroke();}}),
  chalk:genTip('Rough chalk',128,128,(x,w,h,R)=>{x.beginPath();x.arc(w/2,h/2,w*.42,0,7);x.fill();x.globalCompositeOperation='destination-out';for(let i=0;i<900;i++){x.globalAlpha=.3+R()*.7;x.fillRect(R()*w,R()*h,1+R()*2,1+R()*2);}}),
  fur:genTip('Fur',192,192,(x,w,h,R)=>{for(let i=0;i<70;i++){const px=w*.15+R()*w*.7,len=h*(.25+R()*.4),b=(R()-.5)*30;x.globalAlpha=.4+R()*.5;x.lineWidth=1+R()*1.5;x.beginPath();x.moveTo(px,h*.9);x.quadraticCurveTo(px+b*.4,h*.9-len*.5,px+b,h*.9-len);x.stroke();}})};
const BP_BASIC=[
  {name:'Pencil',size:5,hardness:.55,spacing:.05,grain:.7,pSize:false,pOpacity:true,smoothing:.3,opacity:.9},
  {name:'Soft pencil',size:9,hardness:.3,spacing:.05,grain:.8,pSize:true,pOpacity:true,minSize:.4,smoothing:.3,opacity:.85},
  {name:'Charcoal',tip:BP_TIPS.chalk,size:36,spacing:.12,grain:.9,angleJitter:1,pSize:true,pOpacity:true,minSize:.5,smoothing:.2,flow:.8},
  {name:'Pastel',tip:BP_TIPS.chalk,size:50,spacing:.1,grain:.6,angleJitter:1,sizeJitter:.1,pOpacity:true,pSize:false,buildup:true,flow:.55},
  {name:'Dry brush',tip:BP_TIPS.dry,size:60,spacing:.04,followDir:true,pSize:true,minSize:.6,pOpacity:true,smoothing:.3,flow:.9},
  {name:'Stipple',tip:BP_TIPS.stipple,size:40,spacing:.5,angleJitter:1,sizeJitter:.4,scatter:.6,count:2,pSize:false},
  {name:'Hatching',tip:BP_TIPS.hatch,size:44,spacing:.9,pSize:false,flow:.9},
  {name:'Fur',tip:BP_TIPS.fur,size:70,spacing:.3,followDir:true,sizeJitter:.35,scatter:.3,pSize:false,randFlipX:true},
  {name:'Oil paint',size:46,hardness:.6,spacing:.04,grain:.25,pSize:true,pOpacity:false,minSize:.5,smoothing:.35,flow:1},
  {name:'Wash',size:140,hardness:0,spacing:.08,flow:.12,buildup:true,pSize:false,pOpacity:true,smoothing:.4},
  {name:'Marker',size:20,hardness:1,spacing:.04,pSize:false,pOpacity:false,flow:.9,opacity:.85,smoothing:.4},
  {name:'Fine liner',size:3,hardness:1,spacing:.03,pSize:true,minSize:.3,smoothing:.6},
  {name:'Gasa Gaya Pen',tip:BP_TIPS.gasapen,size:9,hardness:1,spacing:.025,pSize:true,minSize:.04,pOpacity:false,smoothing:.45,flow:1,opacity:1,grain:0,endInk:.18},
  {name:'Dry ink pen',tip:BP_TIPS.inkdry,size:16,spacing:.05,followDir:true,pSize:true,minSize:.25,smoothing:.55,flow:1},
  {name:'Dry ink brush',tip:BP_TIPS.inkbrush,size:48,spacing:.03,followDir:true,pSize:true,minSize:.35,smoothing:.5,flow:1},
  {name:'Scratchy liner',tip:BP_TIPS.inkdry,size:9,spacing:.05,followDir:true,sizeJitter:.12,pSize:true,minSize:.2,smoothing:.6,grain:.35}
].map(p=>Object.assign({tool:'brush'},p));
{const at=library.findIndex(s=>s.id==='builtin')+1;library.splice(at,0,{id:'bp_basic',name:'Basic media',builtin:true,presets:BP_BASIC,tips:[]});}
setTimeout(bpLoad,0);
