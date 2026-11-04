/* ================= A friend's picks (0.95) =================
   A friend likes these brushes from Heavy Paint: Blur Ice, Boxes, Brow, Charcoal, Dither, Fan, Fan Fade, Fried Fluff, Line, Line Blend, Oil, Oil Bristle, Worm.
   Our own versions, rebuilt after watching a screen recording of each one being used (its footprint, how it moves with the stroke, its colour), not copies of anyone's files.
   What each does (seen in the recording): Blur Ice smears like a marbled squeegee with a square footprint; Boxes sweeps a square filled with thin vertical stripes of slightly different colour;
   Brow is a ribbon of fine hair-thin strands in shades of the colour; Charcoal is a big soft grainy cloud; Dither is a flat bar (like a chisel nib held level) that breaks into dots;
   Fan stamps a fan-shaped wedge of radial stripes that turns with the stroke; Fan Fade is the same wedge dissolving into dots; Fried Fluff is a wide ribbon of wavy bands of changing hue;
   Line is a thick even line with round ends and a slightly different colour each stroke; Oil is long dry bristle fibres; Oil Bristle is thick impasto that mixes colours; Worm is a round tube shaded like a 3D worm, hue changing from its middle to its edges. */
/* a brush tip made from one of the real CC0 photo textures we ship (assets/grunge): it shows as a plain tip until the picture has loaded, then swaps itself.
   fn(l, x, y, R) gets the picture's brightness (0..1) at each pixel and where it is in the tip (0..1, 0..1) and returns the alpha (0..1). */
function frTexTip(name,w,h,slug,crop,fn){const t=makeTip(name,w,h,(()=>{const a=new Uint8Array(w*h);for(let i=0;i<a.length;i++)a[i]=200;return a;})(),false);
  (async()=>{try{const u=await txPhotoBytes(slug);const bm=await createImageBitmap(new Blob([u],{type:'image/webp'}));const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d',{willReadFrequently:true});
    x.drawImage(bm,crop[0]*bm.width,crop[1]*bm.height,crop[2]*bm.width,crop[3]*bm.height,0,0,w,h);const d=x.getImageData(0,0,w,h).data,A=new Uint8Array(w*h);
    for(let j=0;j<h;j++)for(let i=0;i<w;i++){const k=j*w+i,l=(d[k*4]*.3+d[k*4+1]*.59+d[k*4+2]*.11)/255;A[k]=Math.round(255*Math.max(0,Math.min(1,fn(l,i/w,j/h))));}
    t.alpha=A;t._tex=undefined;t._cv=null;}catch(e){}})();return t;}
const FR_TIPS={
  /* Brow: a dense ribbon of fine hair-thin strands, from the real fine-brushed-lines texture, with ragged ends */
  hair:frTexTip('Fine hair',256,96,'fine-brushed-lines',[.1,.2,.5,.19],(l,x,y)=>{const e=Math.min(x,1-x),rag=Math.sin(y*97.3)*.5+.5;return(.5+.5*Math.max(0,Math.min(1,(l-.05)*6)))*Math.min(1,Math.max(0,(e-.02-rag*.05)*18));}),
  /* Oil: long dry fibres with gaps, from the brushed-scratches texture */
  dry:frTexTip('Dry fibres',256,96,'brushed-scratches',[.2,.3,.5,.19],(l,x,y)=>{const e=Math.min(x,1-x);return Math.max(0,Math.min(1,(l-.08)*6))*Math.min(1,Math.max(0,(e-.02)*14));}),
  /* Charcoal: a soft round of real grit (the dust texture), thinning to the edge */
  grit:frTexTip('Charcoal grit',256,256,'dust',[.1,.1,.5,.5],(l,x,y)=>{const r=Math.hypot(x-.5,y-.5)*2,f=1-Math.min(1,Math.max(0,(r-.2)/.8));return Math.max(0,Math.min(1,(l*1.35+f*1.15-.95)*3.2))*(r<1?1:0);}),
  /* Fried fluff: a bar whose edges and ends are torn like real paint smears (the ink-smears texture) */
  smearBar:frTexTip('Paint smear bar',128,64,'ink-smears',[.15,.2,.4,.2],(l,x,y)=>{const e=Math.min(x,1-x,y*1.2,(1-y)*1.2);return Math.max(0,Math.min(1,(l*1.5-.25)*1.4+.1))*Math.min(1,Math.max(0,(e-.03)*12));}),
  /* a square with softly rounded corners (Boxes, Blur Ice) */
  sharpBox:genTip('Sharp box',128,128,(x,w,h)=>{x.fillRect(2,2,w-4,h-4);}),
  box:genTip('Rounded box',128,128,(x,w,h)=>{const r=14;x.beginPath();x.moveTo(r,2);x.arcTo(w-2,2,w-2,h-2,r);x.arcTo(w-2,h-2,2,h-2,r);x.arcTo(2,h-2,2,2,r);x.arcTo(2,2,w-2,2,r);x.closePath();x.fill();}),
  raggedSq:genTip('Ragged square',128,128,(x,w,h,R)=>{x.fillRect(10,4,w-20,h-8);for(let y=4;y<h-4;y+=2){const l=R()<.35?R()*9:0,r=R()<.35?R()*9:0;x.clearRect(10,y,l,2);x.clearRect(w-10-r,y,r,2);}}),
  fbar:genTip('Feathered bar',320,26,(x,w,h)=>{let g=x.createLinearGradient(0,0,0,h);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.25,'rgba(0,0,0,.45)');g.addColorStop(.5,'rgba(0,0,0,1)');g.addColorStop(.75,'rgba(0,0,0,.45)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);
    x.globalCompositeOperation='destination-in';g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(.12,'rgba(0,0,0,.5)');g.addColorStop(.3,'rgba(0,0,0,1)');g.addColorStop(.7,'rgba(0,0,0,1)');g.addColorStop(.88,'rgba(0,0,0,.5)');g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,0,w,h);x.globalCompositeOperation='source-over';}),
  oilbar:genTip('Oil fibres',256,96,(x,w,h,R)=>{for(let i=0;i<96;i++){const len=w*(.9+R()*.1),x0=(w-len)/2;x.globalAlpha=.55+R()*.45;x.fillRect(x0,i,len,1);}x.globalAlpha=1;}),
  flakes:genTip('Bristle flakes',256,256,(x,w,h,R)=>{for(let i=0;i<260;i++){const a=R()*6.2832,r=Math.sqrt(R())*w*.46,cx=w/2+Math.cos(a)*r,cy=h/2+Math.sin(a)*r,fw=3+R()*6,fh=8+R()*20;x.save();x.translate(cx,cy);x.rotate((R()-.5)*1.6+(R()<.25?1.57:0));x.beginPath();x.moveTo(-fw/2,-fh/2);x.lineTo(fw/2+R()*3,-fh/2+R()*4);x.lineTo(fw/2,fh/2);x.lineTo(-fw/2-R()*3,fh/2-R()*4);x.closePath();x.fill();x.restore();}}),
  hair:genTip('Fine hair',256,96,(x,w,h,R)=>{for(let i=0;i<64;i++){const y=(i+.5)/64*h,len=w*(.78+R()*.22),x0=(w-len)/2+(R()-.5)*w*.04;x.globalAlpha=.7+R()*.3;x.fillRect(x0,y-.7,len,1.5);}}),
  dry:genTip('Dry fibres',256,96,(x,w,h,R)=>{for(let i=0;i<40;i++){const y=(i+.5)/40*h,len=w*(.6+R()*.4),x0=(w-len)/2;let px=x0;while(px<x0+len){const seg=10+R()*60;x.globalAlpha=.6+R()*.4;if(R()>.2)x.fillRect(px,y-.6,Math.min(seg,x0+len-px),1.2);px+=seg+R()*14;}}}),
  fan:genTip('Fan wedge',256,144,(x,w,h,R)=>{const n=140,a0=-1.25,a1=1.25;for(let i=0;i<n;i++){const s=a0+(a1-a0)*i/n,e=a0+(a1-a0)*(i+1)/n+.006;x.globalAlpha=.6+R()*.4;x.beginPath();x.moveTo(w/2,h-2);x.arc(w/2,h-2,h-4,-Math.PI/2+s,-Math.PI/2+e);x.closePath();x.fill();}}),
  fanFade:genTip('Fan dissolve',256,144,(x,w,h,R)=>{x.globalAlpha=.95;x.beginPath();x.moveTo(w/2,h-2);x.arc(w/2,h-2,(h-4)*.3,-Math.PI/2-1.25,-Math.PI/2+1.25);x.closePath();x.fill();x.globalAlpha=1;
    for(let i=0;i<9000;i++){const a=-1.25+2.5*R(),rr=Math.sqrt(R())*(h-4),f=rr/(h-4),p=f<.3?1:Math.pow(1-(f-.3)/.7,1.6);if(R()>p)continue;x.fillRect(w/2+Math.sin(a)*rr,h-2-Math.cos(a)*rr,1.7,1.7);}}),
  /* a wide bar with ragged ends, for the wavy bands of Fried Fluff */
  fluff:genTip('Ragged bar',128,64,(x,w,h,R)=>{x.fillRect(6,4,w-12,h-8);x.globalCompositeOperation='destination-out';for(let y=0;y<h;y++){const a=R()*9,b=R()*9;x.fillRect(0,y,6+a,1);x.fillRect(w-6-b,y,6+b,1);}})
};
const FRIEND_PRESETS=[
  {name:'Blur ice',tool:'smudge',blendMode:'smear',streak:.7,tip:FR_TIPS.box,size:270,hardness:1,spacing:.05,strength:.85,charge:0,pSize:false,pOpacity:false,smoothing:.3},
  {name:'Boxes',tool:'brush',tip:FR_TIPS.sharpBox,size:200,hardness:1,spacing:.002,followDir:false,hueJitter:.03,valJitter:.14,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Brow',tool:'brush',tip:FR_TIPS.hair,size:240,hardness:1,spacing:.002,followDir:true,laneN:60,laneMode:0,laneHue:.14,laneVal:.12,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Charcoal',tool:'brush',tip:FR_TIPS.fbar,size:120,hardness:1,grain:.8,grainSize:1,spacing:.002,followDir:false,flow:1,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Dither',tool:'brush',tip:null,roundness:.03,angle:0,spray:1.7,sprayDen:4,sprayMist:.2,size:200,hardness:1,spacing:.002,laneN:40,laneMode:2,laneHue:.06,laneVal:.1,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Fan',tool:'brush',fanFill:1,size:60,hardness:1,flow:1,spacing:.05,pSize:false,pOpacity:false,smoothing:.3,laneN:40,laneHue:.12,laneVal:.12},
  {name:'Fan fade',tool:'brush',fanFill:2,size:60,hardness:1,flow:1,spacing:.05,pSize:false,pOpacity:false,smoothing:.3,laneN:40,laneHue:.12,laneVal:.12},
  {name:'Fried fluff',tool:'brush',tip:FR_TIPS.raggedSq,size:260,hardness:1,spacing:.002,followDir:true,laneN:6,laneMode:5,laneHue:.8,laneVal:.3,softEnd:.025,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Line',tool:'brush',tip:null,size:100,hardness:1,spacing:.002,pSize:false,pOpacity:false,jitterPerStroke:true,hueJitter:.02,valJitter:.08,smoothing:.6,smoothCurve:true,correction:.35},
  {name:'Oil',tool:'brush',tip:FR_TIPS.oilbar,size:190,hardness:1,spacing:.002,followDir:true,laneN:90,laneMode:0,laneHue:.3,laneVal:.22,grain:1,grainSize:1,flow:1,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Oil bristle',tool:'brush',tip:FR_TIPS.flakes,size:220,hardness:1,flow:1,spacing:.002,followDir:false,laneN:20,laneMode:0,laneHue:.06,laneVal:.3,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true},
  {name:'Oil bristle 3D',tool:'brush',tip:null,size:200,hardness:.9,spacing:.02,followDir:true,pSize:false,smoothing:.35,mix:true,mixLoad:1,mixPick:.15,mixWet:.8,mixDry:0,mixUse:.12,mixBristles:50,mixDryB:.2,mixThick:.9},
  {name:'Worm',tool:'brush',tip:null,size:200,hardness:1,spacing:.002,laneN:1,laneMode:1,laneHue:.8,laneVal:.4,pSize:false,pOpacity:false,smoothing:.6,smoothCurve:true}];
/* “Line blend” is the Line blend brush made earlier (line-blend.js): it sits in this set too */
{const lb=PRESETS.find(p=>p.name==='Line blend');if(lb)FRIEND_PRESETS.splice(9,0,lb);}
library.splice(Math.min(library.length,3),0,{id:'friend_picks',name:'A friend’s picks (Heavy Paint style)',builtin:true,presets:FRIEND_PRESETS,tips:[]});
