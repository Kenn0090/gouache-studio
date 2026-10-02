/* Original, deterministic canvas tips: each medium has its own silhouette and deposit. */
const ART_TIPS={
 graphite:genTip('Graphite tooth',128,128,(x,w,h,R)=>{for(let i=0;i<2500;i++){const px=R()*w,py=R()*h,r=Math.hypot(px-w/2,py-h/2)/(w*.45);if(r>1)continue;x.globalAlpha=(1-r*r)*(.25+R()*.65);x.fillRect(px,py,1+R()*2,1+R()*2);}}),
 charcoal:genTip('Charcoal edge',128,160,(x,w,h,R)=>{x.fillRect(w*.14,h*.13,w*.72,h*.74);x.globalCompositeOperation='destination-out';for(let i=0;i<1800;i++){x.globalAlpha=.25+R()*.7;x.fillRect(R()*w,R()*h,1+R()*4,1+R()*3);}}),
 pastel:genTip('Pastel crumbs',160,160,(x,w,h,R)=>{for(let i=0;i<1400;i++){const px=R()*w,py=R()*h,r=Math.hypot(px-w/2,py-h/2)/(w*.46);if(r>1)continue;x.globalAlpha=(1-r*.6)*(.2+R()*.8);x.fillRect(px,py,2+R()*5,1+R()*3);}}),
 wash:genTip('Watercolour pool',192,192,(x,w,h,R)=>{const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.46);g.addColorStop(0,'rgba(255,255,255,.12)');g.addColorStop(.7,'rgba(255,255,255,.24)');g.addColorStop(.9,'rgba(255,255,255,.42)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);x.globalCompositeOperation='destination-out';for(let i=0;i<900;i++){x.globalAlpha=R()*.45;x.fillRect(R()*w,R()*h,1+R()*2,1+R()*2);}}),
 bristle:genTip('Filbert bristles',128,192,(x,w,h,R)=>{for(let i=0;i<150;i++){const px=w*.12+R()*w*.76,l=h*.82*Math.sqrt(Math.max(0,1-Math.pow((px-w/2)/(w*.4),2)));x.globalAlpha=.25+R()*.7;x.fillRect(px,(h-l)/2,1+R()*2,l);}}),
 knife:genTip('Palette knife edge',192,128,(x,w,h,R)=>{x.beginPath();x.moveTo(w*.05,h*.22);x.lineTo(w*.87,h*.1);x.lineTo(w*.98,h*.7);x.lineTo(w*.17,h*.88);x.closePath();x.fill();x.globalCompositeOperation='destination-out';for(let i=0;i<95;i++){x.globalAlpha=.2+R()*.6;x.fillRect(R()*w,R()*h,1+R()*2,8+R()*45);}}),
 reed:genTip('Reed nib',96,160,(x,w,h)=>{x.beginPath();x.moveTo(w*.12,h*.08);x.lineTo(w*.94,h*.28);x.lineTo(w*.88,h*.92);x.lineTo(w*.06,h*.72);x.closePath();x.fill();}),
 fan:genTip('Fan bristles',192,128,(x,w,h,R)=>{for(let i=0;i<100;i++){const a=-1.2+R()*2.4;x.globalAlpha=.4+R()*.6;x.lineWidth=1+R();x.beginPath();x.moveTo(w/2,h*.9);x.lineTo(w/2+Math.sin(a)*w*.46,h*.9-Math.cos(a)*h*.85);x.stroke();}})
};
const ART_MEDIA=[
 ['Graphite HB','graphite',{size:5,flow:.8,grain:.35,pSize:false}],['Graphite 2B','graphite',{size:9,flow:.85,grain:.25,pSize:true,minSize:.35}],
 ['Graphite 6B shading','graphite',{size:36,flow:.45,roundness:.45,pSize:true}],['Coloured pencil','graphite',{size:8,flow:.6,grain:.25,pSize:false}],
 ['Charcoal stick','charcoal',{size:50,flow:.8,angle:25,grain:.2,pSize:true}],['Charcoal edge','charcoal',{size:14,roundness:.25,flow:.9,followDir:true,pSize:true}],
 ['Soft pastel','pastel',{size:55,flow:.6,grain:.2,pSize:true}],['Oil pastel','pastel',{size:32,flow:.95,grain:.1,pSize:true}],
 ['Watercolour glaze','wash',{size:115,flow:.35,buildup:true,pSize:true}],['Watercolour dry edge','pastel',{size:70,flow:.25,spacing:.08,grain:.4,pSize:true}],
 ['Gouache filbert','bristle',{size:46,flow:.95,followDir:true,pSize:true}],['Dry acrylic','bristle',{size:64,flow:.7,grain:.45,followDir:true,pSize:true}],
 ['Oil filbert','bristle',{size:40,flow:1,followDir:true,pSize:true}],['Palette knife','knife',{size:64,flow:.95,followDir:true,pSize:true,minSize:.65}],
 ['Fan brush','fan',{size:70,flow:.8,followDir:true,pSize:true}],['Reed pen','reed',{size:12,flow:1,angle:35,pSize:true,minSize:.15}],
 ['Brush pen','bristle',{size:15,flow:1,pSize:true,minSize:.04,smoothing:.55}],['Chisel marker','reed',{size:25,flow:.7,opacity:.85,pSize:false,angle:40}],
 ['Crayon','pastel',{size:18,flow:.9,grain:.5,pSize:false}],['Scratchboard ink','graphite',{size:3,flow:1,grain:.05,pSize:true,minSize:.15}]
].map(([name,tip,settings])=>Object.assign({name,tool:'brush',tip:ART_TIPS[tip],spacing:.04,smoothing:.2,pOpacity:true},settings));
library.splice(2,0,{id:'art_media',name:'Drawing and painting',builtin:true,presets:ART_MEDIA,tips:[]});
