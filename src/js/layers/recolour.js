/* ================= Recolour (0.29): change a material's base colour and keep its detail =================
   Like Marmoset's Recolor layer. L.fill.recol = {mode:'off'|'simple'|'main'|'multi'|'custom', amt, tint, tol, n, pairs:[{f,t}], con, bri, sat}.
   It runs on the base colour map after the material is drawn, so roughness, metal and the normal map are untouched. */
const FS_RECOL=`uniform sampler2D uSrc; uniform int uMode; uniform float uAmt,uRef,uTol,uCon,uBri,uSat; uniform vec3 uTint; uniform int uN;
uniform vec3 uF0,uF1,uF2,uF3,uT0,uT1,uT2,uT3;
vec3 r2h(vec3 c){ float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),d=mx-mn,h=0.0;
  if(d>1e-5){ if(mx==c.r) h=mod((c.g-c.b)/d,6.0); else if(mx==c.g) h=(c.b-c.r)/d+2.0; else h=(c.r-c.g)/d+4.0; h/=6.0; }
  return vec3(h,mx>0.0?d/mx:0.0,mx); }
vec3 h2r(vec3 c){ vec3 k=clamp(abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); return c.z*mix(vec3(1.0),k,c.y); }
vec2 cv(vec3 h){ return h.y*vec2(cos(6.2831853*h.x),sin(6.2831853*h.x)); }
vec3 pairFrom(int i){ return i==0?uF0:i==1?uF1:i==2?uF2:uF3; }
vec3 pairTo(int i){ return i==0?uT0:i==1?uT1:i==2?uT2:uT3; }
void main(){ vec4 s=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); vec3 c=s.a>0.0?s.rgb/s.a:vec3(0.0); vec3 q=c;
  if(uMode==1){ float l=dot(c,vec3(0.299,0.587,0.114)); q=mix(c,clamp(uTint*(l/max(uRef,0.02)),0.0,1.0),uAmt); }
  else if(uMode>=2){ vec3 h=r2h(c); vec3 acc=c;
    for(int i=0;i<4;i++){ if(i>=uN) break; vec3 fh=r2h(pairFrom(i)),th=r2h(pairTo(i));
      float dist=length(vec3(cv(h)-cv(fh),(h.z-fh.z)*0.5)); float w=1.0-smoothstep(uTol*0.5,uTol,dist);
      float nh=fh.y>0.08&&th.y>0.02?fract(h.x+th.x-fh.x):th.x; float ns=clamp(h.y*(th.y/max(fh.y,0.05)),0.0,1.0); float nv=clamp(h.z*(th.z/max(fh.z,0.05)),0.0,1.0);
      acc=mix(acc,h2r(vec3(nh,ns,nv)),w*uAmt); }
    q=acc; }
  q=(q-0.5)*uCon+0.5+uBri; float lum=dot(q,vec3(0.299,0.587,0.114)); q=mix(vec3(lum),q,uSat);
  q=clamp(q,0.0,1.0); o=vec4(q*s.a,s.a); }`;
let P_RECOL=null;
const RC_DEF=()=>({mode:'off',amt:1,tint:[.55,.35,.25],tol:.4,n:3,pairs:[],con:1,bri:0,sat:1});
const recolActive=f=>{const r=f&&f.recol;return !!r&&(r.mode!=='off'||r.con!==1||r.bri!==0||r.sat!==1);};
/* the picture as a 16 × 16 handful of colours (for the average brightness and the colour groups) */
function recolSample(T){const n=16,tmp=makeTarget(n,n,8,false);run(P.resample,tmp,{uSrc:T.tex,uOffset:[0,0],uScale:[T.w/n,T.h/n],uTaps:{int:8},uOutside:[0,0,0,0]});
  const d=captureRegionNow(tmp,0,0,n,n).data;disposeTarget(tmp);const px=[];for(let i=0;i<d.length;i+=4){const a=d[i+3]/255;if(a<.5)continue;px.push([d[i]/255/a,d[i+1]/255/a,d[i+2]/255/a]);}return px;}
/* k colour groups (k-means, farthest-point start), biggest first */
function recolGroups(px,k){if(!px.length)return [[.5,.5,.5]];const dist=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2;
  const mean=px.reduce((m,p)=>[m[0]+p[0]/px.length,m[1]+p[1]/px.length,m[2]+p[2]/px.length],[0,0,0]);let C=[mean];
  while(C.length<k){let best=null,bd=-1;for(const p of px){const d=Math.min(...C.map(c=>dist(c,p)));if(d>bd){bd=d;best=p;}}if(bd<1e-4)break;C.push(best.slice());}
  let cnt=[];for(let it=0;it<8;it++){const S=C.map(()=>[0,0,0,0]);for(const p of px){let bi=0,bd=1e9;C.forEach((c,i)=>{const d=dist(c,p);if(d<bd){bd=d;bi=i;}});const s=S[bi];s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++;}
    C=C.map((c,i)=>S[i][3]?[S[i][0]/S[i][3],S[i][1]/S[i][3],S[i][2]/S[i][3]]:c);cnt=S.map(s=>s[3]);}
  return C.map((c,i)=>[c,cnt[i]]).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);}
function fillRecol(L){const f=L.fill;if(!recolActive(f))return;const s=f.maps&&f.maps.base;if(!s||!s.on)return;const T=mapT(L,'base');if(!T||T.empty)return;const r=f.recol;
  if(!P_RECOL)P_RECOL=program(FS_RECOL);const tmp=acquireD(T.depth);
  const pairs=(r.mode==='main'?r.pairs.slice(0,1):r.mode==='multi'||r.mode==='custom'?r.pairs.slice(0,4):[]);const pad=i=>pairs[i]?pairs[i].f:[0,0,0],padT=i=>pairs[i]?pairs[i].t:[0,0,0];
  let ref=.5;if(r.mode==='simple'){const px=recolSample(T);ref=px.length?px.reduce((a,p)=>a+p[0]*.299+p[1]*.587+p[2]*.114,0)/px.length:.5;}
  const mode=r.mode==='simple'?1:r.mode==='off'?0:2;
  run(P_RECOL,tmp,{uSrc:T.tex,uMode:{int:mode},uAmt:r.amt==null?1:r.amt,uRef:ref,uTol:Math.max(.02,r.tol||.4),uCon:r.con==null?1:r.con,uBri:r.bri||0,uSat:r.sat==null?1:r.sat,uTint:r.tint||[.5,.5,.5],uN:{int:pairs.length},
    uF0:pad(0),uF1:pad(1),uF2:pad(2),uF3:pad(3),uT0:padT(0),uT1:padT(1),uT2:padT(2),uT3:padT(3)});
  blit(tmp,T,0,0,doc.w,doc.h,0,0);release(tmp);}
/* after the material is drawn, the recolour goes over its base colour */
{const fr=fillRender;fillRender=function(L,only){fr.apply(this,arguments);if((!only||only==='base')&&recolActive(L&&L.fill)){fillRecol(L);L.lookVer=(L.lookVer||0)+1;scheduleThumb(L);requestRender(true);}};
  window.fillRenderRaw=fr;}
/* colour groups of the material as drawn without the recolour */
function recolDetect(L,k){const r=L.fill.recol,keep=r.mode;r.mode='off';const c=[r.con,r.bri,r.sat];r.con=1;r.bri=0;r.sat=1;fillRenderRaw(L,'base');
  const T=mapT(L,'base'),px=T&&!T.empty?recolSample(T):[];r.mode=keep;[r.con,r.bri,r.sat]=c;
  const G=recolGroups(px,k),old=r.pairs;r.pairs=G.map((g,i)=>({f:g,t:old[i]?old[i].t:g.slice()}));}
/* ---- the panel section, under the material's channels ---- */
function recolBuild(box,L){const W=L.fill;if(!W.recol)W.recol=RC_DEF();const r=W.recol;box.replaceChildren();
  const ed=(fn,redraw)=>{matEdBegin(L);fn();fillRender(L,'base');clearTimeout(matEd.timer);matEd.timer=setTimeout(matEdCommit,700);if(redraw)recolBuild(box,L);};
  const mode=(m)=>{ed(()=>{r.mode=m;if(m==='main'||m==='multi'||m==='custom'){const want=m==='main'?1:m==='multi'?(r.n||3):Math.max(1,r.pairs.length||1);if(r.pairs.length!==want||!r.pairs.length){if(m==='custom'&&r.pairs.length)r.pairs=r.pairs.slice(0,4);else{recolDetect(L,want);}}}},true);};
  box.append(el('div',{class:'sub',text:'Recolour (keeps the detail)'}),
    seg([['off','Off'],['simple','One colour'],['main','Main colour'],['multi','Several'],['custom','Custom']],r.mode,mode,'Recolour mode'));
  if(r.mode==='simple')box.append(el('div',{class:'frow'},el('label',{text:'Colour'}),colourBtn('rc_tint',()=>r.tint,c=>ed(()=>{r.tint=c;}),'Recolour colour')));
  if(r.mode==='main'||r.mode==='multi'||r.mode==='custom'){
    if(r.mode==='multi')box.append(makeSlider({id:'rc_n',label:'Colours',min:2,max:4,step:1,value:Math.max(2,Math.min(4,r.n||3)),fmt:v=>String(v),onInput:v=>ed(()=>{r.n=Math.round(v);recolDetect(L,r.n);}),onChange:()=>recolBuild(box,L)}).el);
    r.pairs.forEach((p,i)=>box.append(el('div',{class:'frow rcpair'},el('span',{class:'note',text:r.mode==='main'?'Main colour':'Colour '+(i+1)}),
      colourBtn('rc_f'+i,()=>p.f,c=>ed(()=>{p.f=c;}),'Colour to change'),el('span',{class:'note',text:'→'}),colourBtn('rc_t'+i,()=>p.t,c=>ed(()=>{p.t=c;}),'New colour'),
      r.mode==='custom'&&r.pairs.length>1?el('button',{class:'btn sm',text:'×',title:'Remove','aria-label':'Remove this colour',onclick:()=>ed(()=>{r.pairs.splice(i,1);},true)}):null)));
    const row=el('div',{class:'chips'});
    if(r.mode==='custom'&&r.pairs.length<4)row.append(el('button',{class:'btn sm',id:'rc_add',text:'Add a colour',onclick:()=>ed(()=>{const g=r.pairs.length?r.pairs[r.pairs.length-1].f:[.5,.5,.5];r.pairs.push({f:g.slice(),t:g.slice()});},true)}));
    row.append(el('button',{class:'btn sm',id:'rc_detect',text:'Find the colours again',title:'Look at the material again and pick the colours to change',onclick:()=>ed(()=>{recolDetect(L,r.mode==='main'?1:r.mode==='multi'?(r.n||3):Math.max(1,r.pairs.length));},true)}));
    box.append(row,makeSlider({id:'rc_tol',label:'Reach',min:.05,max:1,step:.01,value:r.tol||.4,fmt:pct,onInput:v=>ed(()=>{r.tol=v;})}).el);}
  if(r.mode!=='off')box.append(makeSlider({id:'rc_amt',label:'Amount',min:0,max:1,step:.01,value:r.amt==null?1:r.amt,fmt:pct,onInput:v=>ed(()=>{r.amt=v;})}).el);
  box.append(makeSlider({id:'rc_con',label:'Contrast',min:.2,max:2.5,step:.01,value:r.con==null?1:r.con,fmt:v=>Math.round(v*100)+'%',onInput:v=>ed(()=>{r.con=v;})}).el,
    makeSlider({id:'rc_bri',label:'Brightness',min:-.5,max:.5,step:.01,value:r.bri||0,fmt:v=>(v>0?'+':'')+Math.round(v*100),onInput:v=>ed(()=>{r.bri=v;})}).el,
    makeSlider({id:'rc_sat',label:'Saturation',min:0,max:2,step:.01,value:r.sat==null?1:r.sat,fmt:v=>Math.round(v*100)+'%',onInput:v=>ed(()=>{r.sat=v;})}).el,
    el('p',{class:'note',text:'Only the base colour changes. Roughness, metal and the normal map keep their detail.'}));}
{const rm=renderMatEd;renderMatEd=function(force){rm.apply(this,arguments);const box=document.getElementById('matEdBody'),L=doc.active;
  if(!box||matEd.shownRow||!isLayer(L)||!L.fill||!box.querySelector('.matHead')||box.querySelector('.recolBox'))return;
  const b=el('div',{class:'recolBox dlg-grid'});const cover=box.querySelector('#fl_cover');(cover?cover.closest('label'):null)?cover.closest('label').before(b):box.append(b);recolBuild(b,L);};}
