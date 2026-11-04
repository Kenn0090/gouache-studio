/* ================= A friend's picks (0.95) =================
   A friend likes these brushes from Heavy Paint: Blur Ice, Boxes, Brow, Charcoal, Dither, Fan, Fan Fade, Fried Fluff, Line, Line Blend, Oil, Oil Bristle, Worm.
   Our own versions, rebuilt after looking at Heavy Paint's brush previews (each brush's stroke shape), not copies of anyone's files. Some may still differ: tell us which. */
const FR_TIPS={
  /* a rectangle for Boxes: wider than tall, so a stroke of them makes an angular band */
  box:genTip('Box',128,64,(x,w,h)=>{x.fillRect(4,4,w-8,h-8);}),
  /* a solid fan wedge, apex at the bottom, with faint radial stripes */
  fan:genTip('Fan wedge',256,144,(x,w,h)=>{const n=12,a0=-1.35,a1=1.35;for(let i=0;i<n;i++){const s=a0+(a1-a0)*i/n,e=a0+(a1-a0)*(i+1)/n;x.globalAlpha=i%2?.9:1;x.beginPath();x.moveTo(w/2,h-2);x.arc(w/2,h-2,h-4,-Math.PI/2+s,-Math.PI/2+e);x.closePath();x.fill();}}),
  /* a fan made of dots that thin out towards the rim */
  fanFade:genTip('Fan stipple',256,144,(x,w,h,R)=>{x.globalAlpha=1;for(let i=0;i<5200;i++){const a=-1.35+2.7*R(),rr=Math.pow(R(),.6)*(h-6),d=1-rr/(h-6);if(R()>d*d*1.1+.04)continue;x.fillRect(w/2+Math.sin(a)*rr,h-2-Math.cos(a)*rr,1.6,1.6);}}),
  /* a fan of concentric arcs (Fan Oil) is not asked for; the tips above are what the list names */
};
const FRIEND_PRESETS=[
  /* Blur ice: a soft, streaky ribbon that blends what is under it, thinning to a point at the end */
  {name:'Blur ice',tool:'smudge',blendMode:'smear',streak:.55,tip:null,size:120,hardness:.3,spacing:.05,strength:.7,charge:0,pSize:true,minSize:.04,pOpacity:false,taperStart:90,taperEnd:160,smoothing:.4},
  /* Boxes: flat rectangles turning with the stroke, so it makes an angular band of facets */
  {name:'Boxes',tool:'brush',tip:FR_TIPS.box,size:90,hardness:1,spacing:.22,followDir:true,angleJitter:.22,sizeJitter:.15,valJitter:.1,pSize:false,pOpacity:false,smoothing:.2},
  /* Brow: fine dots in a lens shape, like an eyebrow */
  {name:'Brow',tool:'brush',tip:null,spray:1.5,sprayDen:.9,sprayMist:.1,size:70,hardness:1,spacing:.06,pSize:true,minSize:.03,pOpacity:false,taperStart:110,taperEnd:150,smoothing:.45},
  /* Charcoal: a faint, thin trail of grit */
  {name:'Charcoal',tool:'brush',tip:null,spray:1.3,sprayDen:.4,sprayMist:.05,size:26,hardness:1,spacing:.07,grain:.5,pSize:true,minSize:.3,pOpacity:true,flow:.7,smoothing:.25},
  /* Dither: solid at first, breaking up into dots as the stroke goes on */
  {name:'Dither',tool:'brush',tip:null,spray:1.8,sprayDen:2,sprayMist:0,sprayPress:1,size:80,hardness:1,spacing:.05,pSize:false,pOpacity:false,taperEnd:260,smoothing:.3},
  /* Fan: a solid fan-shaped stamp */
  {name:'Fan',tool:'brush',tip:FR_TIPS.fan,size:150,hardness:1,spacing:.12,followDir:false,angleJitter:0,pSize:false,pOpacity:false,smoothing:.3},
  /* Fan fade: the fan made of dots that thin out towards its rim */
  {name:'Fan fade',tool:'brush',tip:FR_TIPS.fanFade,size:160,hardness:1,spacing:.1,followDir:false,pSize:false,pOpacity:true,flow:.9,smoothing:.3},
  /* Fried fluff: a soft ribbon with a grainy, fluffy edge */
  {name:'Fried fluff',tool:'brush',tip:null,spray:3.5,sprayDen:1.2,sprayMist:.6,size:130,hardness:.4,spacing:.05,grain:.45,pSize:true,minSize:.1,pOpacity:false,flow:.85,taperStart:80,taperEnd:140,smoothing:.4},
  /* Line: a clean, even line with round ends */
  {name:'Line',tool:'brush',tip:null,size:24,hardness:1,spacing:.02,pSize:false,pOpacity:false,smoothing:.5,correction:.35,flow:1},
  /* Oil: dry, sparse flecks of paint */
  {name:'Oil',tool:'brush',tip:null,spray:1.4,sprayDen:.16,sprayMist:0,size:50,hardness:1,spacing:.06,pSize:false,pOpacity:false,smoothing:.3},
  /* Oil bristle: a wide ribbon of long bristle streaks with a ragged end */
  {name:'Oil bristle',tool:'brush',tip:TIPS.bristle,size:170,hardness:.8,spacing:.02,followDir:true,pSize:false,smoothing:.3,mix:true,mixLoad:.9,mixPick:.35,mixWet:.7,mixDry:0,mixUse:.2,mixBristles:46,mixDryB:.45,mixThick:.85},
  /* Worm: a smooth ribbon, fat in the middle and pointed at both ends */
  {name:'Worm',tool:'brush',tip:null,size:90,hardness:.95,spacing:.02,pSize:true,minSize:.02,pOpacity:false,taperStart:200,taperEnd:240,smoothing:.55}];
/* “Line blend” is the Line blend brush made earlier (line-blend.js): it sits in this set too */
{const lb=PRESETS.find(p=>p.name==='Line blend');if(lb)FRIEND_PRESETS.splice(9,0,lb);}
library.splice(Math.min(library.length,3),0,{id:'friend_picks',name:'A friend’s picks (Heavy Paint style)',builtin:true,presets:FRIEND_PRESETS,tips:[]});
