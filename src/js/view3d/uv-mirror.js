/* ================= Mirror and radial symmetry with UV alignment (0.96.6, Kenn) =================
   "Graffiti brushes don't do symmetry": with UV alignment the brush paints straight onto the texture, and the mirror (which works on the
   model in 3D) was simply switched off. Now each dab finds its own mirrored spot: texture pixel → point on the model (from the position
   picture, `fillPosMaps`) → mirrored or turned point (`mir3Mats`) → nearest point on the model → its texture pixel. The dab's angle and
   flip follow the way the texture runs there. The lookup is built once per model / texture set (a 512-ish grid of points in a spatial hash). */
const uvm={key:null,G:0,H:0,P:null,cell:0,head:null,next:null,lo:null,n:0};
const FS_UVMDOWN=`uniform sampler2D uSrc; uniform vec2 uScale; void main(){ o=texelFetch(uSrc,ivec2(floor(gl_FragCoord.xy*uScale)),0); }`;
let P_UVMDOWN=null;
function uvmBuild(){const C=typeof fillPosMaps==='function'?fillPosMaps():null;if(!C||!C.pos)return null;const key=C.key+'|'+doc.w+'x'+doc.h;if(uvm.key===key&&uvm.P)return uvm;
  const G=Math.min(doc.w,512),H=Math.max(1,Math.round(G*doc.h/doc.w));if(!P_UVMDOWN)P_UVMDOWN=program(FS_UVMDOWN);
  const t=makeTarget(G,H,32,false);let P;try{run(P_UVMDOWN,t,{uSrc:C.pos.tex,uScale:[doc.w/G,doc.h/H]});P=new Float32Array(G*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,t.fbo);gl.readPixels(0,0,G,H,gl.RGBA,gl.FLOAT,P);gl.bindFramebuffer(gl.FRAMEBUFFER,null);}finally{disposeTarget(t);}
  /* a spatial hash of the covered samples */
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],n=0;for(let i=0;i<G*H;i++){if(P[i*4+3]<.5)continue;n++;for(let a=0;a<3;a++){const v=P[i*4+a];if(v<mn[a])mn[a]=v;if(v>mx[a])mx[a]=v;}}
  if(!n)return null;const size=Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1,cell=size/64,K=1<<16,head=new Int32Array(K).fill(-1),next=new Int32Array(G*H).fill(-1);
  const hash=(x,y,z)=>(((x*73856093)^(y*19349663)^(z*83492791))>>>0)&(K-1);
  for(let i=0;i<G*H;i++){if(P[i*4+3]<.5)continue;const h=hash(Math.floor((P[i*4]-mn[0])/cell),Math.floor((P[i*4+1]-mn[1])/cell),Math.floor((P[i*4+2]-mn[2])/cell));next[i]=head[h];head[h]=i;}
  Object.assign(uvm,{key,G,H,P,cell,head,next,lo:mn,n,hash,K});return uvm;}
/* the point on the model at a canvas pixel (bilinear between the samples around it, covered ones only) */
function uvmPos(x,y){const U=uvm,fx=x/doc.w*U.G-.5,fy=y/doc.h*U.H-.5,ix=Math.floor(fx),iy=Math.floor(fy),tx=fx-ix,ty=fy-iy;let s=[0,0,0],w=0;
  for(const [dx,dy,k] of [[0,0,(1-tx)*(1-ty)],[1,0,tx*(1-ty)],[0,1,(1-tx)*ty],[1,1,tx*ty]]){const X=clamp(ix+dx,0,U.G-1),Y=clamp(iy+dy,0,U.H-1),i=(Y*U.G+X)*4;if(U.P[i+3]<.5||k<=0)continue;s[0]+=U.P[i]*k;s[1]+=U.P[i+1]*k;s[2]+=U.P[i+2]*k;w+=k;}
  if(w<1e-4){const X=clamp(Math.round(fx),0,U.G-1),Y=clamp(Math.round(fy),0,U.H-1),i=(Y*U.G+X)*4;return U.P[i+3]<.5?null:[U.P[i],U.P[i+1],U.P[i+2]];}return s.map(v=>v/w);}
/* the canvas pixel of the nearest point on the model to p (refined between neighbouring samples) */
function uvmUV(p){const U=uvm,c=[0,1,2].map(a=>Math.floor((p[a]-U.lo[a])/U.cell));let best=-1,bd=Infinity;
  for(let r=0;r<3&&best<0;r++){for(let i=-r;i<=r;i++)for(let j=-r;j<=r;j++)for(let k=-r;k<=r;k++){if(Math.max(Math.abs(i),Math.abs(j),Math.abs(k))!==r)continue;
      for(let s=U.head[U.hash(c[0]+i,c[1]+j,c[2]+k)];s>=0;s=U.next[s]){const d=(U.P[s*4]-p[0])**2+(U.P[s*4+1]-p[1])**2+(U.P[s*4+2]-p[2])**2;if(d<bd){bd=d;best=s;}}}}
  if(best<0||bd>(U.cell*2)**2)return null;const X=best%U.G,Y=(best/U.G)|0;
  /* a step towards the exact spot using the two neighbours' directions on the surface */
  const at=(x,y)=>{if(x<0||y<0||x>=U.G||y>=U.H)return null;const i=(y*U.G+x)*4;return U.P[i+3]<.5?null:[U.P[i],U.P[i+1],U.P[i+2]];};
  const p0=at(X,Y),px=at(X+1,Y)||at(X-1,Y),py=at(X,Y+1)||at(X,Y-1),sx=at(X+1,Y)?1:-1,sy=at(X,Y+1)?1:-1;let ox=0,oy=0;
  if(px&&py){const a=px.map((v,i)=>v-p0[i]),b=py.map((v,i)=>v-p0[i]),d=p.map((v,i)=>v-p0[i]),aa=a[0]*a[0]+a[1]*a[1]+a[2]*a[2],bb=b[0]*b[0]+b[1]*b[1]+b[2]*b[2],ab=a[0]*b[0]+a[1]*b[1]+a[2]*b[2],da=d[0]*a[0]+d[1]*a[1]+d[2]*a[2],db=d[0]*b[0]+d[1]*b[1]+d[2]*b[2],det=aa*bb-ab*ab;
    if(Math.abs(det)>1e-12){ox=clamp((da*bb-db*ab)/det,-1,1)*sx;oy=clamp((db*aa-da*ab)/det,-1,1)*sy;}}
  return [(X+.5+ox)/U.G*doc.w,(Y+.5+oy)/U.H*doc.h];}
const uvmMul=(M,p)=>[M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14]];
/* the stroke's symmetry for UV alignment, or null when no mirror or radial is on */
function uvmSym(){if(typeof mir3Mats!=='function'||ui.mode!=='p3d')return null;const mats=mir3Mats();if(mats.length<2)return null;if(!uvmBuild())return null;
  const copies=mats.slice(1),e=Math.max(1,doc.w/uvm.G);
  return {mode:'map',fn:(x,y,ang,fx,fy,dx,dy)=>{const p=uvmPos(x,y);if(!p)return [];const pa=uvmPos(x+e,y)||p,pb=uvmPos(x,y+e)||p,out=[];
    for(const M of copies){const q=uvmUV(uvmMul(M,p));if(!q)continue;const qa=uvmUV(uvmMul(M,pa)),qb=uvmUV(uvmMul(M,pb));
      /* how the texture turns and flips at the copy: where a step right and a step down land */
      let rot=0,flip=false;if(qa&&qb){const ax=qa[0]-q[0],ay=qa[1]-q[1],bx=qb[0]-q[0],by=qb[1]-q[1];rot=Math.atan2(ay,ax);flip=ax*by-ay*bx<0;}
      const c=Math.cos(rot),s=Math.sin(rot);const ddx=c*dx-s*dy*(flip?-1:1),ddy=s*dx+c*dy*(flip?-1:1);
      out.push([q[0],q[1],flip?rot-ang:rot+ang,flip?-fx:fx,fy,ddx,ddy]);}
    return out;}};}
