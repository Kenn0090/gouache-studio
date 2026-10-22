/* Original, deterministic canvas tips: each medium has its own silhouette and deposit. */
const ART_TIPS={
 graphite:genTip('Graphite tooth',128,128,(x,w,h,R)=>{for(let i=0;i<2500;i++){const px=R()*w,py=R()*h,r=Math.hypot(px-w/2,py-h/2)/(w*.45);if(r>1)continue;x.globalAlpha=(1-r*r)*(.25+R()*.65);x.fillRect(px,py,1+R()*2,1+R()*2);}}),
 charcoal:genTip('Charcoal edge',128,160,(x,w,h,R)=>{x.fillRect(w*.14,h*.13,w*.72,h*.74);x.globalCompositeOperation='destination-out';for(let i=0;i<1800;i++){x.globalAlpha=.25+R()*.7;x.fillRect(R()*w,R()*h,1+R()*4,1+R()*3);}}),
 pastel:genTip('Pastel crumbs',160,160,(x,w,h,R)=>{for(let i=0;i<1400;i++){const px=R()*w,py=R()*h,r=Math.hypot(px-w/2,py-h/2)/(w*.46);if(r>1)continue;x.globalAlpha=(1-r*.6)*(.2+R()*.8);x.fillRect(px,py,2+R()*5,1+R()*3);}}),
 wash:genTip('Watercolour pool',192,192,(x,w,h,R)=>{const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.46);g.addColorStop(0,'rgba(255,255,255,.12)');g.addColorStop(.7,'rgba(255,255,255,.24)');g.addColorStop(.9,'rgba(255,255,255,.42)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,w,h);x.globalCompositeOperation='destination-out';for(let i=0;i<900;i++){x.globalAlpha=R()*.45;x.fillRect(R()*w,R()*h,1+R()*2,1+R()*2);}}),
 bristle:genTip('Filbert bristles',128,192,(x,w,h,R)=>{for(let i=0;i<150;i++){const px=w*.12+R()*w*.76,l=h*.82*Math.sqrt(Math.max(0,1-Math.pow((px-w/2)/(w*.4),2)));x.globalAlpha=.25+R()*.7;x.fillRect(px,(h-l)/2,1+R()*2,l);}}),
 knife:genTip('Palette knife edge',192,128,(x,w,h,R)=>{x.beginPath();x.moveTo(w*.05,h*.22);x.lineTo(w*.87,h*.1);x.lineTo(w*.98,h*.7);x.lineTo(w*.17,h*.88);x.closePath();x.fill();x.globalCompositeOperation='destination-out';for(let i=0;i<95;i++){x.globalAlpha=.2+R()*.6;x.fillRect(R()*w,R()*h,1+R()*2,8+R()*45);}}),
 reed:genTip('Reed nib',96,160,(x,w,h)=>{x.beginPath();x.moveTo(w*.12,h*.08);x.lineTo(w*.94,h*.28);x.lineTo(w*.88,h*.92);x.lineTo(w*.06,h*.72);x.closePath();x.fill();}),
 /* (0.68) hair-fine bristles that run along the stroke (the tip's x direction), as on a real brush: many separate hairs, some thicker, some missing, each lighter or darker
    along its length, so a stroke leaves long fine streaks with the paper showing between them */
 bristleFlat:genTip('Bristles flat',256,128,(x,w,h,R)=>{const n=118;for(let i=0;i<n;i++){const y=h*.08+(i+R()*.8)/n*h*.84,th=.8+R()*R()*2.4,s0=w*(.04+R()*.1),s1=w*(.9-R()*.1),base=.45+R()*.55;if(R()<.07)continue;for(let sx=s0;sx<s1;sx+=5+R()*7){x.globalAlpha=Math.min(1,base*(.5+R()*.7));x.fillRect(sx,y,7+R()*6,th);}}}),
 bristleDry:genTip('Bristles dry',256,128,(x,w,h,R)=>{const n=70;for(let i=0;i<n;i++){const y=h*.06+(i+R())/n*h*.88,th=.8+R()*R()*1.8,base=.3+R()*.7;if(R()<.3)continue;let on=true;for(let sx=w*.05;sx<w*.95;sx+=3+R()*10){if(R()<.22)on=!on;if(!on)continue;x.globalAlpha=Math.min(1,base*(.3+R()*.8));x.fillRect(sx,y,5+R()*12,th);}}}),
 fan:genTip('Fan bristles',192,128,(x,w,h,R)=>{for(let i=0;i<100;i++){const a=-1.2+R()*2.4;x.globalAlpha=.4+R()*.6;x.lineWidth=1+R();x.beginPath();x.moveTo(w/2,h*.9);x.lineTo(w/2+Math.sin(a)*w*.46,h*.9-Math.cos(a)*h*.85);x.stroke();}})
};
const ART_MEDIA=[
 ['Graphite HB','graphite',{size:5,flow:.8,grain:.35,pSize:false}],['Graphite 2B','graphite',{size:9,flow:.85,grain:.25,pSize:true,minSize:.35}],
 ['Graphite 6B shading','graphite',{size:36,flow:.45,roundness:.45,pSize:true}],['Coloured pencil','graphite',{size:8,flow:.6,grain:.25,pSize:false}],
 ['Charcoal stick','charcoal',{size:50,flow:.8,angle:25,grain:.2,pSize:true}],['Charcoal edge','charcoal',{size:14,roundness:.25,flow:.9,followDir:true,pSize:true}],
 ['Soft pastel','pastel',{size:55,flow:.6,grain:.2,pSize:true}],['Oil pastel','pastel',{size:32,flow:.95,grain:.1,pSize:true}],
 ['Watercolour glaze','wash',{size:115,flow:.35,buildup:true,pSize:true,edgeSat:.6,glaze:.85,wet:.5}],['Dual sponge wash','wash',{size:95,flow:.45,buildup:true,pSize:true,dual:{on:true,tipKey:'b:sponge',size:34,spacing:130,scatter:90,count:2,mode:0,amount:90},edgeSat:.5,glaze:.7}],['Watercolour dry edge','pastel',{size:70,flow:.25,spacing:.08,grain:.4,pSize:true,edgeSat:.5,glaze:.7,wet:.4}],
 ['Gouache filbert','bristle',{size:46,flow:.95,wet:.4,pickup:.3,followDir:true,pSize:true}],['Dry acrylic','bristle',{size:64,flow:.7,wet:.3,grain:.45,followDir:true,pSize:true}],
 ['Oil filbert','bristle',{size:40,flow:1,wet:.7,pickup:.45,followDir:true,pSize:true}],['Palette knife','knife',{size:64,flow:.95,wet:.7,pickup:.65,followDir:true,pSize:true,minSize:.65}],
 ['Bristle flat','bristleFlat',{size:90,flow:.9,followDir:true,pSize:true,minSize:.5,wet:.5,pickup:.3,spacing:.03}],['Bristle dry brush','bristleDry',{size:90,flow:.85,followDir:true,pSize:true,minSize:.5,spacing:.03}],['Bristle thin pigment','bristleFlat',{size:90,flow:.7,followDir:true,pSize:true,minSize:.5,glaze:.85,edgeSat:.4,spacing:.03}],
 ['Fan brush','fan',{size:70,flow:.8,followDir:true,pSize:true}],['Reed pen','reed',{size:12,flow:1,angle:35,pSize:true,minSize:.15}],
 ['Brush pen','bristle',{size:15,flow:1,pSize:true,minSize:.04,smoothing:.55}],['Chisel marker','reed',{size:25,flow:.7,opacity:.85,pSize:false,angle:40}],
 ['Crayon','pastel',{size:18,flow:.9,grain:.5,pSize:false}],['Scratchboard ink','graphite',{size:3,flow:1,grain:.05,pSize:true,minSize:.15}]
].map(([name,tip,settings])=>Object.assign({name,tool:'brush',tip:ART_TIPS[tip],spacing:.04,smoothing:.2,pOpacity:true},settings));
library.splice(2,0,{id:'art_media',name:'Drawing and painting',builtin:true,presets:ART_MEDIA,tips:[]});
