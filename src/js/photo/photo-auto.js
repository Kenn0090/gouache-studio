/* ================= Photo tab: Auto tone and Auto level =================
   Both look at a small copy of the picture. Auto tone sets the Basic sliders from the brightness spread; Auto level finds the
   dominant near-horizontal or near-vertical lines (a horizon, a wall, a door frame) and turns the picture to make them straight. */
function phSmall(src,n){const k=Math.min(1,n/Math.max(src.w,src.h)),w=Math.max(2,Math.round(src.w*k)),h=Math.max(2,Math.round(src.h*k)),sm=makeTarget(w,h,8,false);
  try{run(P.resample,sm,{uSrc:src.tex,uOffset:[0,0],uScale:[src.w/w,src.h/h],uTaps:{int:Math.min(8,Math.max(1,Math.ceil(src.w/w)))}});const d=captureRegionNow(sm,0,0,w,h).data,g=new Float32Array(w*h);
    for(let i=0;i<w*h;i++){const a=d[i*4+3]/255||1;g[i]=(.2126*d[i*4]+.7152*d[i*4+1]+.0722*d[i*4+2])/255/a;}return {w,h,g};}finally{disposeTarget(sm);}}
/* the dominant tilt, in degrees (positive = the lines run down to the right), or null when nothing line-like is there */
function phTiltOf(g,w,h){const bins=new Float32Array(61);let tot=0;
  for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x,gx=(g[i+1]-g[i-1])*2+(g[i-w+1]-g[i-w-1])+(g[i+w+1]-g[i+w-1]),gy=(g[i+w]-g[i-w])*2+(g[i+w-1]-g[i-w-1])+(g[i+w+1]-g[i-w+1]),m=Math.hypot(gx,gy);if(m<.25)continue;
    /* the line's direction is across the gradient; fold to -45..45 degrees from horizontal or vertical */
    let a=Math.atan2(gx,-gy)*180/Math.PI;a=((a%90)+90)%90;if(a>45)a-=90;if(a<-30||a>30)continue;bins[Math.round(a)+30]+=m;tot+=m;}
  if(tot<1)return null;let best=0,bv=-1;for(let i=0;i<61;i++){let v=0;for(let k=-2;k<=2;k++){const j=i+k;if(j>=0&&j<61)v+=bins[j]*(3-Math.abs(k));}if(v>bv){bv=v;best=i-30;}}
  /* the weighted mean around the peak */
  let sw=0,sa=0;for(let k=-3;k<=3;k++){const j=best+k+30;if(j>=0&&j<61){sw+=bins[j];sa+=bins[j]*(best+k);}}return sw>0?sa/sw:best;}
function phAutoLevel(){const p=phP();if(!p||!p.psrc)return;const sm=phSmall(p.psrc,360),t=phTiltOf(sm.g,sm.w,sm.h);
  if(t==null||Math.abs(t)<.05){toast('No clear lines to level here.');return;}
  const n=phClone(p.s);n.geo.angle=Math.max(-45,Math.min(45,Math.round((n.geo.angle-t)*10)/10));phApply(n,'Auto level');}
function phAutoTone(){const p=phP();if(!p||!p.psrc)return;const sm=phSmall(p.psrc,128),g=Array.from(sm.g).sort((a,b)=>a-b),q=f=>g[Math.min(g.length-1,Math.floor(f*g.length))];
  const p01=q(.01),p10=q(.1),p50=q(.5),p90=q(.9),p99=q(.99);
  const lin=v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4),ev=Math.log2(lin(.45)/Math.max(1e-4,lin(Math.max(.02,p50))));
  const exp=Math.max(-2,Math.min(2,ev*.8)),k=Math.pow(2,exp),after=v=>{const l=lin(v)*k;return l<=.0031308?l*12.92:1.055*Math.pow(Math.min(l,8),1/2.4)-.055;};
  const hi99=Math.min(1.4,after(p99)),lo01=after(p01),hi90=after(p90),lo10=after(p10);
  const n=phClone(p.s);n.exp=Math.round(exp*100)/100;
  n.wh=Math.round(Math.max(-60,Math.min(60,(0.97-hi99)*120)));n.bl=-Math.round(Math.max(0,Math.min(50,(lo01-.02)*200)));
  n.hi=-Math.round(Math.max(0,Math.min(60,(hi90-.82)*250)));n.sh=Math.round(Math.max(0,Math.min(60,(.2-lo10)*250)));
  n.con=Math.round(Math.max(-10,Math.min(30,(.6-(hi99-lo01))*60)));
  phApply(n,'Auto tone');}
