/* ================= Watercolour studio (0.89) =================
   Our own watercolour and ink toolkit, in seven groups: inkers, colouring brushes, ink washes, embellishments, stamps, blenders, erasers and lifters. */
const wcBlob=(R,cx,cy,r,lobes,wob,n=40)=>{const pts=[],ph=R()*6.28;for(let i=0;i<n;i++){const a=i/n*Math.PI*2,rr=r*(1+wob*(Math.sin(a*lobes+ph)*.6+(R()-.5)*.5));pts.push([cx+Math.cos(a)*rr,cy+Math.sin(a)*rr]);}return pts;};
const wcDraw=(x,pts)=>{x.beginPath();pts.forEach((q,i)=>i?x.lineTo(q[0],q[1]):x.moveTo(q[0],q[1]));x.closePath();};
/* a stamp: see-through inside, with the pigment pooled along the edge */
const wcStamp=(name,build)=>genTip(name,192,192,(x,w,h,R)=>{const shapes=build(R,w,h);for(const s of shapes){x.globalAlpha=s.fill==null?.5:s.fill;wcDraw(x,s.pts);x.fill();x.globalAlpha=s.rim==null?.95:s.rim;x.lineWidth=s.lw||10;x.strokeStyle='#fff';x.lineJoin='round';x.stroke();}x.globalAlpha=1;});
const WC_SALT=genTip('Salt crystals',160,160,(x,w,h,R)=>{for(let i=0;i<34;i++){const cx=w*.1+R()*w*.8,cy=h*.1+R()*h*.8,r=3+R()*R()*13;x.globalAlpha=.6+R()*.4;x.beginPath();for(let k=0;k<8;k++){const a=k/8*6.283,rr=k%2?r*.45:r;x.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}x.closePath();x.fill();}x.globalAlpha=1;});
const WC_TIPS={
 blob:wcStamp('Aqua blob',(R,w,h)=>[{pts:wcBlob(R,w/2,h/2,w*.36,3,.25)}]),
 splash:wcStamp('Aqua splash',(R,w,h)=>{const o=[{pts:wcBlob(R,w/2,h/2,w*.2,4,.3)}];for(let i=0;i<16;i++){const a=R()*6.28,d=w*(.26+R()*.2);o.push({pts:wcBlob(R,w/2+Math.cos(a)*d,h/2+Math.sin(a)*d,3+R()*9,2,.2,12),fill:.85,rim:1,lw:2});}for(let i=0;i<7;i++){const a=R()*6.28;o.push({pts:[[w/2+Math.cos(a)*w*.16,h/2+Math.sin(a)*w*.16],[w/2+Math.cos(a-.05)*w*.42,h/2+Math.sin(a-.05)*w*.42],[w/2+Math.cos(a+.05)*w*.42,h/2+Math.sin(a+.05)*w*.42]],fill:.7,rim:.7,lw:1});}return o;}),
 bloom:wcStamp('Aqua bloom',(R,w,h)=>[{pts:wcBlob(R,w/2,h/2,w*.38,9,.35),fill:.25,rim:1,lw:6},{pts:wcBlob(R,w/2,h/2,w*.2,6,.3),fill:.12,rim:.4,lw:3}]),
 leaf:wcStamp('Aqua leaf',(R,w,h)=>{const pts=[];for(let i=0;i<=24;i++){const t=i/24,y=h*.1+t*h*.8,half=Math.sin(Math.PI*t)*w*.2*(1+(R()-.5)*.15);pts.push([w/2-half,y]);}for(let i=24;i>=0;i--){const t=i/24,y=h*.1+t*h*.8,half=Math.sin(Math.PI*t)*w*.2*(1+(R()-.5)*.15);pts.push([w/2+half,y]);}return [{pts}];}),
 petal:wcStamp('Aqua petal',(R,w,h)=>{const pts=[];for(let i=0;i<40;i++){const a=i/40*Math.PI*2,r=w*.3*(1-Math.cos(a)*.0)*(0.55+0.45*Math.sin(a/2+0.0))*(1+(R()-.5)*.08);pts.push([w/2+Math.sin(a)*r*0.8,h*.55-Math.cos(a)*r*1.2]);}return [{pts}];}),
 ragged:wcStamp('Aqua ragged wash',(R,w,h)=>{const pts=[],n=48;for(let i=0;i<n;i++){const t=i/n;let px,py;const jx=(R()-.5)*w*.05,jy=(R()-.5)*h*.07;if(t<.25){px=w*.1+t*4*w*.8;py=h*.22;}else if(t<.5){px=w*.9;py=h*.22+(t-.25)*4*h*.56;}else if(t<.75){px=w*.9-(t-.5)*4*w*.8;py=h*.78;}else{px=w*.1;py=h*.78-(t-.75)*4*h*.56;}pts.push([px+jx,py+jy]);}return [{pts}];})
};
const WCS_MIX={mix:true,mixPick:.3,mixWet:1,mixDry:35,mixUse:.08,mixBristles:0,mixThick:0,mixTooth:.5,mixEven:true,smoothing:.45,smoothCurve:true,followDir:false,pSize:true,minSize:.35,pFlow:false,pOpacity:false,spacing:.04,hardness:.35,flow:.55,simP:'off'};
const WCS_INK={hardness:1,flow:1,opacity:1,spacing:.03,smoothing:.5,smoothCurve:true,pSize:true,minSize:.2,pOpacity:false,buildup:false,simP:'speed'};
const WCS_STAMP={hardness:1,flow:1,opacity:.85,spacing:1.8,smoothing:0,pSize:true,minSize:.5,sizeJitter:.18,angleJitter:1,buildup:false,simP:'off'};
const WCS_GROUPS=[
 ['Aqua · Inkers',[
  ['Fine ink pen',Object.assign({},WCS_INK,{size:5,minSize:.25})],
  ['Dip pen',Object.assign({},WCS_INK,{size:10,minSize:.06,curve:.35})],
  ['Brush pen',Object.assign({},WCS_INK,{size:22,minSize:.05,hardness:.85})],
  ['Technical pen',Object.assign({},WCS_INK,{size:4,pSize:false,simP:'off'})],
  ['Wobbly liner',Object.assign({},WCS_INK,{size:4,pSize:true,minSize:.5,smoothing:.08,smoothCurve:false,sizeJitter:.18,scatter:.1,bothAxes:true,simP:'off'})],
  ['Dry ink brush',Object.assign({},WCS_INK,{size:28,minSize:.1,grain:.7,hardness:.8,tip:'bristleDry',followDir:true,flow:.9,buildup:true})]]],
 ['Aqua · Colouring',[
  ['Round brush',Object.assign({},WCS_MIX,{size:40,mixLoad:.85,flow:.75,mixWC:.35,mixWCEdge:.5,mixWCPools:.3,mixWCGran:.3})],
  ['Flat brush',Object.assign({},WCS_MIX,{size:60,roundness:.3,angle:20,mixLoad:.85,flow:.75,mixWC:.3,mixWCEdge:.55,mixWCPools:.25,mixWCGran:.3})],
  ['Dry brush',{size:60,hardness:.7,tip:'bristleDry',grain:.7,followDir:true,flow:.5,opacity:.9,buildup:true,pSize:true,minSize:.4,spacing:.04,smoothing:.3,edgeSat:.3,simP:'off'}],
  ['Watercolour pencil',{size:7,hardness:.9,tip:'graphite',grain:.45,flow:1,pOpacity:true,pSize:false,spacing:.06,smoothing:.3,simP:'off'}],
  ['Wax crayon',{size:24,hardness:.9,tip:'pastel',grain:.4,flow:1,pSize:false,spacing:.06,smoothing:.2,simP:'off'}],
  ['Sponge',{size:80,hardness:1,tip:'sponge',scatter:.3,count:2,bothAxes:true,sizeJitter:.2,angleJitter:1,flow:.6,buildup:true,spacing:.6,pSize:false,simP:'off'}]]],
 ['Aqua · Ink washes',[
  ['Flat wash',Object.assign({},WCS_MIX,{size:160,mixLoad:.8,flow:.7,mixWC:.55,mixWCEdge:.35,mixWCPools:.25,mixWCGran:.2})],
  ['Graded wash',Object.assign({},WCS_MIX,{size:150,mixLoad:.95,flow:.75,mixWC:.4,mixWCEdge:.3,mixWCPools:.2,mixWCGran:.2,pOpacity:true,simP:'taper'})],
  ['Dark-edge wash',Object.assign({},WCS_MIX,{size:150,mixLoad:.75,flow:.7,mixWC:.7,mixWCEdge:1,mixWCPools:.2,mixWCGran:.25})],
  ['Bloom (backrun)',Object.assign({},WCS_MIX,{size:150,mixLoad:.75,flow:.7,mixWC:.8,mixWCEdge:.6,mixWCPools:.5,mixWCGran:.3,mixWCBloom:1})],
  ['Granulating wash',Object.assign({},WCS_MIX,{size:150,mixLoad:.75,flow:.7,mixWC:.5,mixWCEdge:.4,mixWCPools:.3,mixWCGran:1,mixTooth:.9})],
  ['Ink glaze',Object.assign({},WCS_MIX,{size:130,mixLoad:.5,mixWC:.2,mixWCEdge:.2,mixWCPools:.1,mixWCGran:.15,flow:.5})]]],
 ['Aqua · Embellishments',[
  ['Fine splatter',{size:150,hardness:.15,flow:1,spacing:.9,spray:3,sprayDen:.22,sprayVar:1,sprayMist:0,pSize:false,buildup:false,simP:'off'}],
  ['Coarse splatter',{size:150,hardness:.15,flow:1,spacing:.9,spray:7,sprayDen:.1,sprayVar:1,sprayMist:0,pSize:false,buildup:false,simP:'off'}],
  ['Salt',{tool:'erase',size:80,hardness:1,tip:'salt',count:3,scatter:.45,bothAxes:true,sizeJitter:.5,angleJitter:1,flow:.9,spacing:.45,pSize:false,buildup:false,simP:'off'}],
  ['Droplets',{size:26,hardness:.9,count:7,scatter:1.1,bothAxes:true,sizeJitter:.9,flow:1,spacing:1.3,pSize:false,buildup:false,simP:'off'}],
  ['Pooling edge line',Object.assign({},WCS_MIX,{size:12,mixLoad:.5,mixWC:.3,mixWCEdge:1,mixWCPools:0,mixWCGran:.2,hardness:.6})],
  ['Watery drip',{size:18,hardness:.9,flow:1,opacity:.8,drip:1,dripAuto:.3,dripWidth:1.3,pSize:true,minSize:.5,spacing:.04,smoothing:.4,buildup:false,simP:'off'}]]],
 ['Aqua · Stamps',[['Blob','blob'],['Splash','splash'],['Bloom','bloom'],['Leaf','leaf'],['Petal','petal'],['Ragged wash','ragged']].map(([n,t])=>['Stamp · '+n,Object.assign({},WCS_STAMP,{size:130,tip:t})])],
 ['Aqua · Blenders',[
  ['Water brush',Object.assign({},WCS_MIX,{size:70,mixLoad:0,mixPick:.9,mixWC:.3,mixWCEdge:0,mixWCPools:0,mixWCGran:.1})],
  ['Soft blender',{tool:'smudge',size:70,hardness:.2,strength:.5,sampleAll:true,paintMix:.6,spacing:.05,smoothing:.4,pSize:true,minSize:.4,simP:'off'}],
  ['Smudger',{tool:'smudge',size:22,hardness:.5,strength:.75,sampleAll:true,paintMix:.4,spacing:.05,smoothing:.3,pSize:false,simP:'off'}]]],
 ['Aqua · Erasers and lifters',[
  ['Lift-off (damp brush)',{tool:'erase',size:60,hardness:.3,grain:.5,flow:.3,spacing:.05,buildup:true,smoothing:.4,pSize:true,minSize:.4,simP:'off'}],
  ['Wet eraser',{tool:'erase',size:50,hardness:.1,flow:.5,spacing:.05,buildup:true,smoothing:.4,pSize:true,minSize:.4,simP:'off'}],
  ['Hard eraser',{tool:'erase',size:30,hardness:1,flow:1,spacing:.03,buildup:false,smoothing:.3,pSize:false,simP:'off'}]]]
];
(function(){const tipOf=k=>typeof k==='string'?(WC_TIPS[k]||ART_TIPS[k]||(k==='salt'?WC_SALT:k==='sponge'?TIPS.sponge:null)):k;
  WCS_GROUPS.forEach(([name,list],gi)=>library.splice(6+gi,0,{id:'aqua'+gi,name,builtin:true,tips:[],presets:list.map(([n,s])=>{const p=Object.assign({name:n,tool:'brush',tip:null,ownTool:true},s);if(typeof s.tip==='string')p.tip=tipOf(s.tip);return p;})}));})();
