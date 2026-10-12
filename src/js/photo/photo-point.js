/* ================= Photo tab: Point colour and colour picking =================
   Click a colour on the picture and nudge just that colour (its hue, saturation and brightness), with a range to say how wide
   "that colour" is. Also used to pick the colour for a mask's colour range. */
function phRgb2Hsl(r,g,b){const mx=Math.max(r,g,b),mn=Math.min(r,g,b),l=(mx+mn)/2,d=mx-mn;let h=0,s=0;if(d>1e-5){s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360;}return [h,s,l];}
/* the colour of the original at a position on the shown picture */
function phSampleAt(ix,iy){const p=phP(),M=phMapper();if(!p||!p.psrc||!M)return null;const sp=M.fwd(ix/doc.w,iy/doc.h),x=Math.max(0,Math.min(p.psrc.w-1,Math.floor(sp[0]*p.psrc.w))),y=Math.max(0,Math.min(p.psrc.h-1,Math.floor(sp[1]*p.psrc.h))),
    r=3,x0=Math.max(0,x-1),y0=Math.max(0,y-1),w=Math.min(r,p.psrc.w-x0),h=Math.min(r,p.psrc.h-y0),d=captureRegionNow(p.psrc,x0,y0,w,h).data;let R=0,G=0,B=0;const n=w*h;
  for(let i=0;i<n;i++){const a=d[i*4+3]/255||1;R+=d[i*4]/255/a;G+=d[i*4+1]/255/a;B+=d[i*4+2]/255/a;}return phRgb2Hsl(R/n,G/n,B/n);}
function phPickAt(ix,iy,e){const k=ph.pick;if(k==='aisubject'){phAiClick(ix,iy,e);return;}ph.pick=null;if(k==='lensfocus'){stage.classList.remove('phpicking');const d=phDepthAt(ix,iy);if(d!=null){phS().lens.focus=Math.round(d);phCommit('Lens focus');phBuildPanel();phDirty();}return;}stage.classList.remove('phpicking');if(!k)return;const c=phSampleAt(ix,iy);if(!c)return;
  if(k==='mask'){const m=phSelMask();if(m){m.rng=m.rng||{};m.rng.kind='col';m.rng.h=Math.round(c[0]);m.rng.hr=m.rng.hr||30;phCommit('Mask colour');phBuildPanel();phDirty();}return;}
  const s=phS();if(!s.pts)s.pts=[];if(s.pts.length>=8){toast('Eight colour points at most.');return;}
  s.pts.push({id:'c'+Date.now().toString(36),on:true,h:+c[0].toFixed(1),s:+c[1].toFixed(3),l:+c[2].toFixed(3),range:40,dh:0,ds:0,dl:0});ph.open.point=true;phCommit('Add colour point');phBuildPanel();phDirty();}
function phPickStart(kind){ph.pick=kind;stage.classList.add('phpicking');toast('Click a colour on the picture.');}
function phPointPanel(){const s=phS(),list=s.pts||(s.pts=[]),body=[el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'Pick a colour…',title:'Click a colour on the picture, then change just that colour',onclick:()=>phPickStart('pt')}))];
  if(!list.length)body.push(el('p',{class:'note',text:'Pick a colour on the picture, then move its sliders to change only that colour.'}));
  list.forEach((q,i)=>{const sw=el('span',{class:'phpsw',style:'background:hsl('+q.h+','+Math.round(q.s*100)+'%,'+Math.round(q.l*100)+'%)'});
    body.push(el('div',{class:'phlmrow'},el('input',{type:'checkbox',checked:q.on!==false,'aria-label':'Enabled',onchange:e=>{q.on=e.target.checked;phCommit('Colour point on/off');phDirty();}}),sw,el('span',{class:'phlmname',text:'Colour '+(i+1)}),
      el('button',{class:'btn sm',text:'×','aria-label':'Delete colour point',onclick:()=>{list.splice(i,1);phCommit('Delete colour point');phBuildPanel();phDirty();}})));
    const sl=(key,label,min,max,step)=>phLGen(q,()=>q[key]||0,v=>{q[key]=v;},label,min,max,step);
    body.push(sl('dh','Hue shift',-100,100,1),sl('ds','Saturation',-100,100,1),sl('dl','Brightness',-100,100,1),sl('range','Range',5,120,1));});
  return body;}
