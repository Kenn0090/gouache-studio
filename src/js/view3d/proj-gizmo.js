/* ================= The projection gizmo in the 3D view (0.23.1) =================
   When the selected material layer or mask row projects a picture or pattern from 3D (Triplanar, Planar,
   Spherical, World), a gizmo sits on the model like Substance Painter's: arrows move it along its axes, rings
   turn it, the small boxes scale it along an axis and the middle box scales it evenly. Red/green/blue = its own
   X/Y/Z. Drawn on a plain canvas over the view; each drag is one undo step. */
const pgz={el:null,hover:null,drag:null,raf:0,on:true};
const PGZ_COL=['#e5533d','#5fbf45','#4d8fe8'],PGZ_HI='#ffd24a';
function pgzActive(){if(!pgz.on||!v3.on&&ui.mode!=='p3d'||!v3.mesh||v3.mesh.noUV)return null;const T=typeof pxfTarget==='function'?pxfTarget():null;return T&&pxfIs3D(T.mode)?T:null;}
/* where everything is on screen (pixels from the view's top left) */
function pgzGeom(hit){const T=pgzActive();if(!T||!hit)return null;const r=hit.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);if(r.width<4)return null;
  const X=pxfNorm(T.xf),c=pxfCenter(X),R=pxfRot(X.r),ax=[0,1,2].map(a=>[R[0][a],R[1][a],R[2][a]]),{VP,eye}=v3ViewProj(w,h),len=Math.hypot(eye[0]-c[0],eye[1]-c[1],eye[2]-c[2])*.16;
  const pr=p=>{const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],ww=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];if(ww<=1e-5)return null;return [(x/ww*.5+.5)*w,(1-(y/ww*.5+.5))*h];};
  const at=(a,k)=>[c[0]+ax[a][0]*len*k,c[1]+ax[a][1]*len*k,c[2]+ax[a][2]*len*k],p0=pr(c);if(!p0)return null;
  const rings=[0,1,2].map(a=>{const u=ax[(a+1)%3],v=ax[(a+2)%3],pts=[],wp=[];for(let i=0;i<=64;i++){const t=i/64*Math.PI*2,q=[0,1,2].map(j=>c[j]+(u[j]*Math.cos(t)+v[j]*Math.sin(t))*len*.82);wp.push(q);pts.push(pr(q));}return {pts,wp,u,v};});
  return {T,X,c,R,ax,len,w,h,pr,p0,tips:[0,1,2].map(a=>pr(at(a,1))),boxes:[0,1,2].map(a=>pr(at(a,.62))),rings,eye};}
const pgzDist=(p,a,b)=>{if(!a||!b)return 1e9;const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l,0,1);return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);};
/* which handle is under the pointer */
function pgzHit(G,m){if(!G)return null;if(Math.hypot(m[0]-G.p0[0],m[1]-G.p0[1])<9)return {k:'su'};
  for(let a=0;a<3;a++){const b=G.boxes[a];if(b&&Math.hypot(m[0]-b[0],m[1]-b[1])<8)return {k:'s',a};}
  for(let a=0;a<3;a++)if(pgzDist(m,G.p0,G.tips[a])<7)return {k:'t',a};
  let best=null;for(let a=0;a<3;a++){const P=G.rings[a].pts;for(let i=0;i<P.length-1;i++){const d=pgzDist(m,P[i],P[i+1]);if(d<6&&(!best||d<best.d))best={k:'r',a,i,d};}}
  return best;}
const pgzMouse=(hit,e)=>{const r=hit.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
function pgzDraw(){const hit=document.getElementById('v3Hit');let c=pgz.el;const G=pgzGeom(hit);
  if(!G){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=pgz.el=el('canvas',{class:'v3gz','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.round(G.w*dpr),H=Math.round(G.h*dpr);
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}c.hidden=false;Object.assign(c.style,{left:(r.left-pr.left)+'px',top:(r.top-pr.top)+'px',width:G.w+'px',height:G.h+'px'});
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,G.w,G.h);const on=pgz.drag?pgz.drag.h:pgz.hover,is=(k,a)=>on&&on.k===k&&(a===undefined||on.a===a);
  x.lineCap='round';
  /* rings behind, then arrows and boxes */
  for(let a=0;a<3;a++){const P=G.rings[a].pts;x.beginPath();let st=false;for(const p of P){if(!p){st=false;continue;}if(!st){x.moveTo(p[0],p[1]);st=true;}else x.lineTo(p[0],p[1]);}
    x.strokeStyle=is('r',a)?PGZ_HI:PGZ_COL[a];x.globalAlpha=is('r',a)?1:.75;x.lineWidth=is('r',a)?3:2;x.stroke();}
  x.globalAlpha=1;
  for(let a=0;a<3;a++){const t=G.tips[a];if(!t)continue;const col=is('t',a)?PGZ_HI:PGZ_COL[a];x.strokeStyle=col;x.fillStyle=col;x.lineWidth=is('t',a)?3.5:2.5;
    x.beginPath();x.moveTo(G.p0[0],G.p0[1]);x.lineTo(t[0],t[1]);x.stroke();
    const dx=t[0]-G.p0[0],dy=t[1]-G.p0[1],l=Math.hypot(dx,dy)||1,ux=dx/l,uy=dy/l;x.beginPath();x.moveTo(t[0]+ux*11,t[1]+uy*11);x.lineTo(t[0]-uy*6,t[1]+ux*6);x.lineTo(t[0]+uy*6,t[1]-ux*6);x.closePath();x.fill();
    const b=G.boxes[a];if(b){x.fillStyle=is('s',a)?PGZ_HI:PGZ_COL[a];x.fillRect(b[0]-5,b[1]-5,10,10);x.strokeStyle='#111';x.lineWidth=1;x.strokeRect(b[0]-5,b[1]-5,10,10);}}
  x.fillStyle=is('su')?PGZ_HI:'#e8e8e8';x.fillRect(G.p0[0]-6,G.p0[1]-6,12,12);x.strokeStyle='#111';x.lineWidth=1;x.strokeRect(G.p0[0]-6,G.p0[1]-6,12,12);}
function pgzHover(hit,e){const G=pgzGeom(hit),h=G?pgzHit(G,pgzMouse(hit,e)):null,key=h?h.k+(h.a==null?'':h.a):'';
  if(key!==(pgz.hover?pgz.hover.k+(pgz.hover.a==null?'':pgz.hover.a):'')){pgz.hover=h;pgzDraw();}hit.classList.toggle('gzhot',!!h);return !!h;}
/* a press on a handle starts a drag (true: the gizmo took it) */
function pgzDown(hit,e){const G=pgzGeom(hit);if(!G)return false;const m=pgzMouse(hit,e),h=pgzHit(G,m);if(!h)return false;
  pgz.drag={h,m0:m,G,X0:pxfNorm(G.T.xf),T:G.T,phi:0};pgzDraw();return true;}
function pgzMove(hit,e){const D=pgz.drag;if(!D)return;D.m=pgzMouse(hit,e);if(pgz.raf)return;pgz.raf=requestAnimationFrame(()=>{pgz.raf=0;pgzApply();});}
function pgzApply(){const D=pgz.drag;if(!D||!D.m)return;const {G,X0,h}=D,m=D.m,dm=[m[0]-D.m0[0],m[1]-D.m0[1]];let nx=null;
  if(h.k==='t'){const t=G.tips[h.a];if(!t)return;const sd=[t[0]-G.p0[0],t[1]-G.p0[1]],l2=sd[0]*sd[0]+sd[1]*sd[1];if(l2<4)return;const along=(dm[0]*sd[0]+dm[1]*sd[1])/l2*G.len;
    nx=x=>{for(let j=0;j<3;j++)x.t[j]=X0.t[j]+G.ax[h.a][j]*along;};}
  else if(h.k==='s'){const b=G.boxes[h.a];if(!b)return;const sd=[b[0]-G.p0[0],b[1]-G.p0[1]],l2=sd[0]*sd[0]+sd[1]*sd[1];if(l2<4)return;const f=Math.max(.02,1+(dm[0]*sd[0]+dm[1]*sd[1])/l2);
    nx=x=>{if(pxfLocked()){for(let j=0;j<3;j++)x.s[j]=Math.max(.001,X0.s[j]*f);}else x.s[h.a]=Math.max(.001,X0.s[h.a]*f);};}
  else if(h.k==='su'){const f=Math.exp((dm[0]-dm[1])/160);nx=x=>{for(let j=0;j<3;j++)x.s[j]=Math.max(.001,X0.s[j]*f);};}
  else if(h.k==='r'){const Rg=G.rings[h.a],th0=h.i/64*Math.PI*2,rr=G.len*.82,scr=phi=>{const q=[0,1,2].map(j=>G.c[j]+(Rg.u[j]*Math.cos(th0+phi)+Rg.v[j]*Math.sin(th0+phi))*rr);return G.pr(q);};
    /* the turn that keeps the grabbed point of the ring under the pointer */
    const dist=phi=>{const p=scr(phi);return p?Math.hypot(p[0]-m[0],p[1]-m[1]):1e9;};let best=D.phi,bd=dist(best);
    for(let k=-60;k<=60;k++){const f=D.phi+k*Math.PI/60,d=dist(f);if(d<bd){bd=d;best=f;}}for(let k=-12;k<=12;k++){const f=best+k*Math.PI/720,d=dist(f);if(d<bd){bd=d;best=f;}}
    D.phi=best;const Rn=pxfMul3(pxfAxisRot(G.ax[h.a],best),G.R),e=pxfEuler(Rn);nx=x=>{x.r[0]=e[0];x.r[1]=e[1];x.r[2]=e[2];};}
  if(!nx)return;D.T.edit(x=>{const n=pxfNorm(x);Object.assign(x,{t:n.t,r:n.r,s:n.s});nx(x);});pxfSyncFields();v3.dirty=true;requestRender(true);}
function pgzUp(){if(!pgz.drag)return;if(pgz.raf){cancelAnimationFrame(pgz.raf);pgz.raf=0;pgzApply();}pgz.drag=null;pgzDraw();}
/* drawn after every 3D view update */
{const d3=draw3D;draw3D=function(){d3();pgzDraw();};}
