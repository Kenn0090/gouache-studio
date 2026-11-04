/* ================= A friend's picks (0.95) =================
   A friend likes these brushes from Heavypaint: Blur ice, boxes, brow, charcoal, dither, fan, fan fade, friend fluff, Line, Line blend, oil, oil bristle brush, Worm.
   These are our own versions, made from the names (not copies of anyone's files), so some may differ from what they have in mind: tell us which ones to change. */
const FR_TIPS={
  ice:genTip('Ice crystals',192,192,(x,w,h,R)=>{x.translate(w/2,h/2);
    for(let i=0;i<18;i++){const a=R()*6.283,l=w*(.16+R()*.3),t=2.5+R()*7;x.globalAlpha=.5+R()*.5;x.save();x.rotate(a);x.beginPath();x.moveTo(0,-t);x.lineTo(l,0);x.lineTo(0,t);x.closePath();x.fill();x.restore();}
    const g=x.createRadialGradient(0,0,0,0,0,w*.22);g.addColorStop(0,'rgba(255,255,255,.75)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.globalAlpha=1;x.beginPath();x.arc(0,0,w*.22,0,6.283);x.fill();}),
  brow:genTip('Brow hairs',96,192,(x,w,h,R)=>{x.lineCap='round';for(let i=0;i<11;i++){const bx=w*.18+R()*w*.64,bend=(R()-.5)*w*.45,top=h*(.04+R()*.25);x.globalAlpha=.6+R()*.4;x.lineWidth=1.3+R()*1.7;x.beginPath();x.moveTo(bx,h*.97);x.quadraticCurveTo(bx+bend*.3,(h+top)/2,bx+bend,top);x.stroke();}}),
  fan:genTip('Fan bristles',256,128,(x,w,h,R)=>{x.lineCap='round';for(let i=0;i<30;i++){const a=-1.22+2.44*(i/29)+(R()-.5)*.05,l=h*(.82+R()*.16);x.globalAlpha=.55+R()*.4;x.lineWidth=2.2+R()*1.6;x.beginPath();x.moveTo(w/2,h-2);x.lineTo(w/2+Math.sin(a)*l*1.9,h-2-Math.cos(a)*l);x.stroke();}}),
  fanFade:genTip('Fading fan',256,128,(x,w,h,R)=>{x.lineCap='round';for(let i=0;i<32;i++){const a=-1.25+2.5*(i/31)+(R()-.5)*.06,l=h*(.7+R()*.28),cx=Math.sin(a)*1.9,cy=-Math.cos(a);
    for(let s=0;s<6;s++){const t0=s/6,t1=(s+1)/6;x.globalAlpha=Math.max(0,(.95-t0*.95))*(.6+R()*.4);x.lineWidth=3.2-t0*2;x.beginPath();x.moveTo(w/2+cx*l*t0,h-2+cy*l*t0);x.lineTo(w/2+cx*l*t1,h-2+cy*l*t1);x.stroke();}}}),
  fluff:genTip('Fluff',192,192,(x,w,h,R)=>{for(let i=0;i<70;i++){const a=R()*6.283,rr=Math.sqrt(R())*w*.38,px=w/2+Math.cos(a)*rr,py=h/2+Math.sin(a)*rr,r=5+R()*15,g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(255,255,255,'+(.35+R()*.4)+')');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.beginPath();x.arc(px,py,r,0,6.283);x.fill();}
    x.fillStyle='#fff';x.strokeStyle='#fff';x.lineCap='round';for(let i=0;i<22;i++){const a=R()*6.283,rr=R()*w*.3,px=w/2+Math.cos(a)*rr,py=h/2+Math.sin(a)*rr,l=10+R()*22,b=R()*6.283;x.globalAlpha=.3+R()*.4;x.lineWidth=1+R()*1.2;x.beginPath();x.moveTo(px,py);x.quadraticCurveTo(px+Math.cos(b)*l*.6,py+Math.sin(b)*l*.6+6,px+Math.cos(b+.7)*l,py+Math.sin(b+.7)*l);x.stroke();}}),
  worm:genTip('Worm',192,96,(x,w,h,R)=>{x.lineCap='round';x.lineJoin='round';x.lineWidth=h*.26;x.beginPath();for(let i=0;i<=40;i++){const t=i/40,px=w*.1+t*w*.8,py=h/2+Math.sin(t*6.2)*h*.2;if(i)x.lineTo(px,py);else x.moveTo(px,py);}x.stroke();
    x.globalCompositeOperation='destination-out';x.globalAlpha=.55;x.lineWidth=2;for(let i=1;i<11;i++){const t=i/11,px=w*.1+t*w*.8,py=h/2+Math.sin(t*6.2)*h*.2;x.beginPath();x.arc(px,py,h*.13,-1.2,1.2);x.stroke();}}),
  dither:null
};
/* the dither tip: a soft round blob turned into crisp ordered-dither dots (a Bayer pattern), so strokes have a retro pixel-dither edge */
FR_TIPS.dither=(()=>{const N=96,B=[[0,32,8,40,2,34,10,42],[48,16,56,24,50,18,58,26],[12,44,4,36,14,46,6,38],[60,28,52,20,62,30,54,22],[3,35,11,43,1,33,9,41],[51,19,59,27,49,17,57,25],[15,47,7,39,13,45,5,37],[63,31,55,23,61,29,53,21]],A=new Uint8Array(N*N);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const r=Math.hypot(x+.5-N/2,y+.5-N/2)/(N/2),v=Math.max(0,1-r);A[y*N+x]=v*1.15>(B[y%8][x%8]+.5)/64?255:0;}
  return makeTip('Dither',N,N,A,true);})();
const FRIEND_PRESETS=[
  {name:'Blur ice',tool:'smudge',blendMode:'soft',tip:FR_TIPS.ice,size:90,hardness:.6,spacing:.12,strength:.6,charge:0,angleJitter:.5,sizeJitter:.3,grain:.2,pSize:false,pOpacity:true},
  {name:'Boxes',tool:'brush',tip:TIPS.square,size:40,hardness:1,spacing:.7,sizeJitter:.55,angleJitter:1,scatter:.45,bothAxes:true,valJitter:.12,pSize:false,pOpacity:false,smoothing:0},
  {name:'Brow',tool:'brush',tip:FR_TIPS.brow,size:54,hardness:.9,spacing:.16,followDir:true,sizeJitter:.15,angleJitter:.04,scatter:.08,pSize:true,minSize:.4,pOpacity:true,smoothing:.35,taperStart:30,taperEnd:44},
  {name:'Charcoal chunk',tool:'brush',tip:ART_TIPS.charcoal,size:52,hardness:.9,spacing:.12,grain:.8,sizeJitter:.15,angleJitter:.2,pSize:true,minSize:.5,pOpacity:true,flow:.8,smoothing:.2},
  {name:'Dither',tool:'brush',tip:FR_TIPS.dither,size:80,hardness:1,spacing:.15,pSize:true,minSize:.4,pOpacity:false,smoothing:.2},
  {name:'Fan',tool:'brush',tip:FR_TIPS.fan,size:120,hardness:.9,spacing:.1,followDir:true,angleJitter:.02,pSize:true,minSize:.5,pOpacity:true,flow:.85,smoothing:.3},
  {name:'Fan fade',tool:'brush',tip:FR_TIPS.fanFade,size:140,hardness:.9,spacing:.08,followDir:true,angleJitter:.03,pSize:true,minSize:.5,pOpacity:true,flow:.7,smoothing:.35,taperEnd:60},
  {name:'Friend fluff',tool:'brush',tip:FR_TIPS.fluff,size:80,hardness:.8,spacing:.35,sizeJitter:.5,angleJitter:1,scatter:.5,bothAxes:true,count:2,pSize:false,pOpacity:true,flow:.7},
  {name:'Line',tool:'brush',tip:null,size:6,hardness:1,spacing:.05,pSize:true,minSize:.12,pOpacity:false,smoothing:.55,correction:.4,taperStart:14,taperEnd:24},
  {name:'Oil',tool:'brush',tip:TIPS.bristle,size:60,hardness:.7,spacing:.02,followDir:true,pSize:true,minSize:.5,smoothing:.2,mix:true,mixLoad:.85,mixPick:.5,mixWet:.9,mixDry:0,mixUse:.15,mixBristles:24,mixDryB:.3,mixThick:.8},
  {name:'Oil bristle brush',tool:'brush',tip:TIPS.bristle,size:70,hardness:.7,spacing:.02,followDir:true,pSize:true,minSize:.5,smoothing:.2,mix:true,mixLoad:.9,mixPick:.35,mixWet:.7,mixDry:0,mixUse:.3,mixBristles:44,mixDryB:.55,mixThick:.9},
  {name:'Worm',tool:'brush',tip:FR_TIPS.worm,size:70,hardness:1,spacing:.85,followDir:true,angleJitter:.15,sizeJitter:.15,pSize:false,pOpacity:false,smoothing:.2}];
/* “Line blend” is the Line blend brush made earlier (line-blend.js): it sits in this set too */
{const lb=PRESETS.find(p=>p.name==='Line blend');if(lb)FRIEND_PRESETS.splice(9,0,lb);}
library.splice(Math.min(library.length,3),0,{id:'friend_picks',name:'A friend’s picks',builtin:true,presets:FRIEND_PRESETS,tips:[]});
