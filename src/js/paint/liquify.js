/* ================= Liquify (0.50) =================
   A tool for pushing, pinching, bloating and twirling the picture with the brush, like Clip Studio Paint's Liquify.
   While you drag, the strokes add up in a small "movement map" (how far each pixel has been pushed). The layer is redrawn
   from a copy of how it was when the stroke began, through that map, so the picture is resampled only once per stroke.
   Every map of the layer moves together (a material); a selection limits it; one undo step per stroke. */
const LIQ_MODES=[['push','Push','Drag to push the paint along'],['pinch','Pinch','Hold to pull paint in toward the middle'],['bloat','Bloat','Hold to swell paint out from the middle'],
  ['cw','Twirl ↻','Hold to swirl clockwise'],['ccw','Twirl ↺','Hold to swirl counter-clockwise'],['restore','Restore','Paint over a change to undo it, gently, within this stroke']];
const liq=(()=>{const d={mode:'push',size:160,strength:.5};try{Object.assign(d,JSON.parse(localStorage.getItem('gs.liq')||'{}'));}catch(e){}return d;})();
const liqSave=()=>{try{localStorage.setItem('gs.liq',JSON.stringify({mode:liq.mode,size:liq.size,strength:liq.strength}));}catch(e){}};
/* adds one dab to the movement map (uMode 0 push, 1 pinch, 2 bloat, 3 twirl, 4 restore) */
const FS_LIQDAB=`uniform sampler2D uD; uniform vec2 uC; uniform float uR; uniform int uMode; uniform vec2 uDelta; uniform float uK;
void main(){ vec2 p=gl_FragCoord.xy; vec4 d=texelFetch(uD,ivec2(gl_FragCoord.xy),0); vec2 v=p-uC; float t=length(v)/uR; if(t>=1.0){ o=d; return; }
  float f=1.0-t*t; f*=f; vec2 add=vec2(0.0);
  if(uMode==0) add=uDelta*f;
  else if(uMode==1) add=-v*uK*f;
  else if(uMode==2) add=v*uK*f;
  else if(uMode==3) add=vec2(-v.y,v.x)*uK*f;
  if(uMode==4) o=vec4(d.xy*(1.0-clamp(uK*f*4.0,0.0,1.0)),0.0,0.0); else o=vec4(d.xy+add,0.0,0.0); }`;
/* redraws the picture through the movement map */
const FS_LIQAPPLY=`uniform sampler2D uSrc; uniform sampler2D uD; uniform sampler2D uSelTex; uniform int uUseSel; uniform int uWrap;
void main(){ ivec2 q=ivec2(gl_FragCoord.xy); vec2 sz=vec2(textureSize(uSrc,0)); vec4 src0=texelFetch(uSrc,q,0); vec2 d=texelFetch(uD,q,0).xy;
  vec2 s=gl_FragCoord.xy-d; vec4 w; if(uWrap==1) w=texture(uSrc,fract(s/sz)); else if(s.x<0.0||s.y<0.0||s.x>sz.x||s.y>sz.y) w=vec4(0.0); else w=texture(uSrc,s/sz);
  float m=1.0; if(uUseSel==1) m=texelFetch(uSelTex,q,0).r; o=mix(src0,w,m); }`;
let P_LIQDAB=null,P_LIQAPPLY=null,liqS=null;
function liqProgs(){if(!P_LIQDAB){P_LIQDAB=program(FS_LIQDAB);P_LIQAPPLY=program(FS_LIQAPPLY);}}
function liqDown(e,ix,iy){
  if(!canFloat){toast('Liquify needs a graphics card that can use 16-bit textures.');return;}
  if(ui.mode!=='paint'&&ui.mode!=='brush'){toast('Liquify works in Paint.');return;}
  const et=needTarget();if(!et)return;if(typeof lockStop==='function'&&lockStop(et))return;
  if(doc.w*doc.h>=100e6){toast('This canvas is too big for Liquify. Try a smaller one.');return;}
  liqProgs();const L=et.L,items=[];
  const add=(k,T)=>{const orig=acquireD(T.depth);blit(T,orig,0,0,T.w,T.h,0,0);items.push({k,T,orig});};
  add(null,et.target);
  if(!et.isMask&&L.maps)for(const k of mapKeysOf(L)){const T=mapT(L,k);if(!T||T===et.target||T.empty)continue;add(k,T);}
  const D=acquireD(16),tmp=acquireD(16);clearTarget(D,[0,0,0,0]);
  liqS={L,et,items,D,tmp,last:[ix,iy],bb:null,pos:[ix,iy],t:performance.now(),dabs:0};
  ptr={mode:'liq',id:e.pointerId};liqDab(ix,iy,0,0,1);liqFlush();liqLoop();}
/* one dab at x,y (dx,dy = how far the pointer moved for it; amount = time-based share for the hold modes) */
function liqDab(x,y,dx,dy,amount){const s=liqS,r=liq.size/2,mode=['push','pinch','bloat','cw','ccw','restore'].indexOf(liq.mode);if(!s)return;
  const k=liq.mode==='cw'?-1:1,K=mode===0?0:mode===3||mode===4?(mode===4?liq.strength*amount:liq.strength*amount*.04*k):liq.strength*amount*.12*(mode===1?1:1);
  const bx=Math.max(0,Math.floor(x-r-1)),by=Math.max(0,Math.floor(y-r-1)),bw=Math.min(doc.w,Math.ceil(x+r+1))-bx,bh=Math.min(doc.h,Math.ceil(y+r+1))-by;if(bw<=0||bh<=0)return;
  scissorDo([bx,by,bw,bh],()=>run(P_LIQDAB,s.tmp,{uD:s.D.tex,uC:[x,y],uR:r,uMode:{int:mode===4?4:mode===3?3:mode},uDelta:[dx*liq.strength*1.6,dy*liq.strength*1.6],uK:K}));
  blit(s.tmp,s.D,bx,by,bw,bh,bx,by);s.bb=s.bb?[Math.min(s.bb[0],bx),Math.min(s.bb[1],by),Math.max(s.bb[2],bx+bw),Math.max(s.bb[3],by+bh)]:[bx,by,bx+bw,by+bh];
  s.dirty=s.dirty?[Math.min(s.dirty[0],bx),Math.min(s.dirty[1],by),Math.max(s.dirty[2],bx+bw),Math.max(s.dirty[3],by+bh)]:[bx,by,bx+bw,by+bh];s.dabs++;}
/* redraw the layer inside what changed since the last redraw */
function liqFlush(){const s=liqS;if(!s||!s.dirty)return;const d=s.dirty;s.dirty=null;const U=Object.assign({uD:s.D.tex,uWrap:{int:doc.wrap?1:0}},selU({sel:selOn(s.et)}));
  for(const it of s.items)scissorDo([d[0],d[1],d[2]-d[0],d[3]-d[1]],()=>run(P_LIQAPPLY,it.T,Object.assign({uSrc:it.orig.tex},U)));
  if(!s.L.maskOf&&!s.L.quick)s.L.lookVer=(s.L.lookVer||0)+1;requestRender(true);}
/* hold modes keep working while the button is down, even when the pointer is still */
function liqLoop(){const s=liqS;if(!s||!ptr||ptr.mode!=='liq')return;const now=performance.now(),dt=Math.min(.1,(now-s.t)/1000);s.t=now;
  if(liq.mode!=='push')liqDab(s.pos[0],s.pos[1],0,0,dt*60);liqFlush();requestAnimationFrame(liqLoop);}
function liqMove(e,ix,iy){const s=liqS;if(!s)return;const [lx,ly]=s.last,len=Math.hypot(ix-lx,iy-ly),step=Math.max(2,liq.size*.12),n=Math.max(1,Math.ceil(len/step));
  for(let i=1;i<=n;i++){const x=lx+(ix-lx)*i/n,y=ly+(iy-ly)*i/n;liqDab(x,y,(ix-lx)/n,(iy-ly)/n,liq.mode==='push'?1:.6/n*Math.min(n,4));}
  s.last=[ix,iy];s.pos=[ix,iy];liqFlush();}
function liqUp(){const s=liqS;liqS=null;ptr=null;if(!s)return;s.dirty=s.dirty;liqS=s;liqFlush();liqS=null;
  const bb=s.bb;try{if(bb&&s.dabs){const x=bb[0],y=bb[1],w=bb[2]-bb[0],h=bb[3]-bb[1],P=s.items[0],before=captureRegion(P.orig,x,y,w,h),after=captureRegion(P.T,x,y,w,h);
    const parts=s.items.slice(1).map(it=>({k:it.k,before:captureRegion(it.orig,x,y,w,h),after:captureRegion(it.T,x,y,w,h)}));
    const rec=regionRecord(s.L,before,after,x,y,w,h,'Liquify');pushUndo(parts.length?withMapParts(rec,s.L,parts,x,y):rec);}}
  finally{for(const it of s.items)release(it.orig);release(s.D);release(s.tmp);}
  changed(s.L.maskOf||s.L);refreshCursor();}
function liqSetMode(m){liq.mode=m;liqSave();if(typeof buildBrushPanel==='function')buildBrushPanel();if(typeof buildOptBar==='function')buildOptBar();}
function buildLiquifyPanel(box){$('#brushTitle').textContent='Liquify';
  box.append(seg(LIQ_MODES,liq.mode,liqSetMode,'Liquify mode'));
  const sl=(id,label,min,max,step,v,fmt,set)=>{const s=makeSlider({id,label,min,max,step,value:v,fmt,onInput:x=>{set(x);liqSave();refreshCursor();if(optSliders[id])optSliders[id].sl.set(x);}});box.append(el('div',{class:'frow'},el('label',{for:id,text:label}),s.el));return s;};
  sl('lqSize','Size',10,1500,1,liq.size,v=>Math.round(v)+'px',v=>{liq.size=v;});sl('lqStr','Strength',.05,1,.01,liq.strength,pct,v=>{liq.strength=v;});
  box.append(el('p',{class:'note',text:'Push: drag the paint along. Pinch, Bloat and Twirl keep working while you hold the button. Restore softly undoes the change you just made in this stroke. Every map of the layer moves together; a selection limits it.'}));}
function buildLiquifyOpt(bar){bar.append(...LIQ_MODES.map(([v,l,t])=>el('button',{class:'optchip'+(liq.mode===v?' on':''),'aria-pressed':String(liq.mode===v),title:t,text:l,onclick:()=>liqSetMode(v)})),el('span',{class:'optsep'}));
  const mk=(id,label,min,max,step,v,fmt,set)=>{const s=makeSlider({id:'ob_'+id,label,min,max,step,value:v,fmt,onInput:x=>{set(x);liqSave();refreshCursor();const o=document.getElementById(id);if(o){o.value=x;const w=o.nextSibling;if(w)w.textContent=fmt(x);}}});s.el.classList.add('optslider');optSliders[id]={sl:s,get:()=>v};bar.append(s.el);};
  mk('lqSize','Size',10,1500,1,liq.size,v=>Math.round(v)+'px',v=>{liq.size=v;});mk('lqStr','Strength',.05,1,.01,liq.strength,pct,v=>{liq.strength=v;});}
(function(){const c=document.querySelector('#tools .tool[data-tool="clone"]');if(!c)return;
  const b=el('button',{class:'tool','data-tool':'liquify',title:'Liquify (Ctrl+Shift+X): push, pinch, bloat and twirl the paint','aria-label':'Liquify','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><path d="M3 8.5c3-3 5 3 8 0s5-3 10 0M3 15.5c3-3 5 3 8 0s5-3 10 0"/><path d="M12 19.5v2M9 21h6"/></svg>';
  b.addEventListener('click',()=>setTool('liquify'));c.after(b);})();
