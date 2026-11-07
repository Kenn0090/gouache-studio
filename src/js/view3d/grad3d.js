/* ================= 3D gradient (0.95.8, Kenn's video) =================
   Coloured points placed around the model in 3D; every spot on the model takes a blend of the points' colours by how near
   it is to each (each point has its own reach; Softness sets how smoothly they meet). It is both a mask generator (a mask
   row, grey from the colours' brightness) and a layer type (a material whose channels can use it).
   The points live in the model's box (0..1 on each side), so they follow the model; on the flat canvas without a model the
   box is the texture (x right, y up). In the 3D view the points of the selected 3D gradient show as dots: drag one to move
   it across the view, drag its arrows to move it along X / Y / Z, Delete removes it, and "Add point" then a click on the model
   drops a new one just above the surface. */
const G3_MAX=16;
function g3Default(){return {pts:[{p:[.5,.9,.5],c:[1,.42,.25],r:.75},{p:[.5,.1,.5],c:[.25,.35,1],r:.75}],soft:2};}
const FS_G3=MS_SURF_GLSL+`
uniform vec4 uG3P[16]; uniform vec4 uG3C[16]; uniform int uG3N; uniform float uG3S; uniform int uG3Out; uniform int uNeg;
void main(){ vec2 uv=gl_FragCoord.xy/uSz; vec3 P=surfP(uv); float mx=max(max(uBsize.x,uBsize.y),max(uBsize.z,1e-6)); vec3 k=uHasPos==1?uBsize/mx:vec3(1.0);
  vec3 sum=vec3(0.0); float ws=0.0;
  for(int i=0;i<16;i++){ if(i>=uG3N) break; vec3 d=(P-uG3P[i].xyz)*k; float r=max(uG3P[i].w,1e-3); float w=1.0/pow(max(length(d)/r,1e-3),uG3S); sum+=uG3C[i].rgb*w; ws+=w; }
  vec3 c=ws>0.0?sum/ws:vec3(0.0); if(uG3Out==1){ float g=dot(c,vec3(0.2126,0.7152,0.0722)); if(uNeg==1) g=1.0-g; o=vec4(vec3(g),1.0);} else o=vec4(c,1.0); }`;
let P_G3=null;
function g3Uniforms(g){const P=new Float32Array(64),C=new Float32Array(64),pts=(g&&g.pts||[]).slice(0,G3_MAX);
  pts.forEach((q,i)=>{P.set([q.p[0],q.p[1],q.p[2],q.r||.6],i*4);C.set([...(q.c||[1,1,1]),1],i*4);});
  return {uG3P:{v4a:P},uG3C:{v4a:C},uG3N:{int:pts.length},uG3S:Math.max(.5,(g&&g.soft)||2)};}
/* draw the gradient into a document-size target: out 0 = colour, 1 = grey */
function g3Run(dst,g,out,surf,inv){if(!P_G3)P_G3=program(FS_G3);run(P_G3,dst,Object.assign({},surf||msSurf(),{uSz:[dst.w,dst.h],uDocN:dummy,uHasDocN:{int:0}},g3Uniforms(g),{uG3Out:{int:out},uNeg:{int:inv?1:0}}));}

/* ---- the mask generator: a row kind of its own ---- */
MS_KINDS.g3d={title:'3D gradient',p:()=>Object.assign(g3Default(),{pts:[{p:[.5,.9,.5],c:[1,1,1],r:.75},{p:[.5,.1,.5],c:[0,0,0],r:.75}],inv:false})};

/* ---- the layer type: a material whose channels can read the gradient (src 'g3d') ---- */
function cmdNewG3dLayer(){if(ui.mode!=='paint'&&ui.mode!=='p3d'){toast('3D gradient layers are for Paint and 3D Paint.');return;}
  cmdNewFillLayer({name:'3D gradient',maps:{base:{src:'g3d',c:[1,1,1]}}});const L=doc.active;if(!L||!L.fill)return;L.fill.g3=g3Default();L.fill.coverH=false;fillRender(L);
  g3.sel=0;if(typeof showPanel==='function')showPanel('matEd');if(typeof renderMatEd==='function')renderMatEd(true);toast('3D gradient: drag the dots in the 3D view, or press Add point and click the model.');}
function g3FillRun(L,k,T){const f=L.fill;if(!f.g3)f.g3=g3Default();g3Run(T,f.g3,MAP_DEFS[k].grey?1:0,msSurf(),false);}

/* ---- which 3D gradient is being edited: the selected mask row, else the active layer's ---- */
const g3={sel:-1,drag:null,arm:false,hot:null,el:null,raf:0};
function g3Target(){const L=doc.active;if(!L||!isLayer(L))return null;
  if(typeof msRowOf==='function'&&ui.msSel&&ui.msSel.L===L){const r=msRowOf(ui.msSel);if(r&&r.kind==='g3d')return {L,g:r.p,row:r};}
  if(L.fill&&L.fill.g3&&Object.values(L.fill.maps).some(s=>s&&s.on&&s.src==='g3d'))return {L,g:L.fill.g3,row:null};return null;}
/* change it as one undo step (a whole drag too); live: redraw while dragging without a step */
function g3Edit(T,fn,live){if(T.row){if(live){fn(T.g);if(T.L.mask)T.L.mask._key=null;T.L.lookVer=(T.L.lookVer||0)+1;}else msEdit(T.L,T.row,()=>fn(T.g));}
  else{if(!live)matEdBegin(T.L);fn(T.g);fillRender(T.L);if(!live){clearTimeout(matEd.timer);matEd.timer=setTimeout(matEdCommit,700);}}
  v3.dirty=true;requestRender(true);}
function g3Box3(){const m=v3.mesh;if(!m||!m.pos)return {mn:[0,0,0],sz:[1,1,1]};if(!m._bb)msSurf();return m._bb||{mn:[0,0,0],sz:[1,1,1]};}
const g3World=(B,p)=>p.map((v,k)=>B.mn[k]+v*B.sz[k]),g3Local=(B,w)=>w.map((v,k)=>(v-B.mn[k])/Math.max(1e-6,B.sz[k]));

/* ---- the dots in the 3D view ---- */
function g3Geom(hit){const T=g3Target();if(T){const key=T.row?'r'+T.row.id:'l'+(T.L.id||T.L.name);if(g3.key!==key){g3.key=key;g3.sel=-1;g3.arm=false;}}if(!T||!v3.on||!hit||!v3.mesh)return null;const r=hit.getBoundingClientRect(),w=r.width,h=r.height;if(w<4)return null;
  const {VP}=v3ViewProj(w,h),B=g3Box3(),pr=p=>{const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],ww=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];if(ww<=1e-5)return null;return [(x/ww*.5+.5)*w,(1-(y/ww*.5+.5))*h];};
  const items=T.g.pts.map((q,i)=>{const at=g3World(B,q.p);return {i,q,at,p:pr(at)};}).filter(o=>o.p);let gz=null;const S=items.find(o=>o.i===g3.sel);
  if(S){gz={it:S,ax:[]};const len=Math.max(...B.sz)*.25;for(let k=0;k<3;k++){const q=S.at.slice();q[k]+=len;const e=pr(q);if(e){const v=[e[0]-S.p[0],e[1]-S.p[1]],l=Math.hypot(v[0],v[1]);if(l>4){const u=[v[0]/l,v[1]/l];gz.ax.push({k,u,ppu:l/len,end:[S.p[0]+u[0]*Math.min(Math.max(l,40),80),S.p[1]+u[1]*Math.min(Math.max(l,40),80)]});}}}}
  return {T,w,h,pr,B,items,gz};}
function g3Draw(){const hit=document.getElementById('v3Hit');let c=g3.el;const G=g3Geom(hit);if(!G){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=g3.el=el('canvas',{class:'v3gz v3g3','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.round(G.w*dpr),H=Math.round(G.h*dpr);
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}c.hidden=false;Object.assign(c.style,{left:(r.left-pr.left)+'px',top:(r.top-pr.top)+'px',width:G.w+'px',height:G.h+'px'});
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,G.w,G.h);
  for(const {i,q,p} of G.items){const sel=i===g3.sel,col='rgb('+q.c.map(v=>Math.round(Math.min(1,Math.max(0,v))*255)).join(',')+')';
    x.fillStyle=col;x.strokeStyle=sel?'#ffd24a':'#fff';x.lineWidth=sel?3:2;x.beginPath();x.arc(p[0],p[1],sel?9:7,0,7);x.fill();x.stroke();x.strokeStyle='rgba(0,0,0,.6)';x.lineWidth=1;x.beginPath();x.arc(p[0],p[1],(sel?9:7)+2,0,7);x.stroke();}
  const z=G.gz;if(z){const p=z.it.p,AX=['#ff5a5a','#5ad46a','#5a9bff'];for(const a of z.ax){const hot=g3.hot==='ax'+a.k;x.strokeStyle=AX[a.k];x.fillStyle=AX[a.k];x.lineWidth=hot?4:2.5;x.beginPath();x.moveTo(p[0]+a.u[0]*13,p[1]+a.u[1]*13);x.lineTo(a.end[0],a.end[1]);x.stroke();
    const n=[-a.u[1],a.u[0]];x.beginPath();x.moveTo(a.end[0]+a.u[0]*10,a.end[1]+a.u[1]*10);x.lineTo(a.end[0]+n[0]*5,a.end[1]+n[1]*5);x.lineTo(a.end[0]-n[0]*5,a.end[1]-n[1]*5);x.fill();}}
  if(g3.arm){x.fillStyle='rgba(0,0,0,.6)';x.fillRect(8,8,250,22);x.fillStyle='#ffd24a';x.font='12px sans-serif';x.fillText('Click the model to add a 3D gradient point',14,23);}}
{const d3=draw3D;draw3D=function(){d3();g3Draw();};}
const g3Mouse=(hit,e)=>{const r=hit.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
function g3Part(G,m){const z=G&&G.gz;if(z){const p=z.it.p;for(const a of z.ax){const t=(m[0]-p[0])*a.u[0]+(m[1]-p[1])*a.u[1],L=Math.hypot(a.end[0]-p[0],a.end[1]-p[1])+10;if(t>12&&t<L&&Math.abs((m[0]-p[0])*a.u[1]-(m[1]-p[1])*a.u[0])<7)return 'ax'+a.k;}}
  let best=null;for(const it of G.items){const d=Math.hypot(m[0]-it.p[0],m[1]-it.p[1]);if(d<12&&(!best||d<best.d))best={it,d};}return best?{pt:best.it.i}:null;}
function g3Hover(hit,e){const G=g3Geom(hit);if(!G||g3.drag)return false;const h=g3Part(G,g3Mouse(hit,e)),k=h?typeof h==='string'?h:'pt'+h.pt:null;if(k!==g3.hot){g3.hot=k;g3Draw();}if(h)hit.style.cursor='move';return !!h;}
function g3Down(hit,e){const G=g3Geom(hit);if(!G||e.button!==0||e.altKey)return false;const m=g3Mouse(hit,e);
  if(g3.arm){const s=typeof sel3HitSeed==='function'?sel3HitSeed(hit,e):null;if(!s){toast('Click on the model to place the point.');return true;}
    const w=pfHitPoint(s),O=s.O,I=O.idx,P=O.pos,t=s.t,a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3,e1=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],e2=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]];
    let n=lightNorm([e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]]);if(n[0]*s.dir[0]+n[1]*s.dir[1]+n[2]*s.dir[2]>0)n=n.map(v=>-v);
    const lift=Math.max(...G.B.sz)*.04,at=g3Local(G.B,w.map((v,k)=>v+n[k]*lift));g3.arm=false;
    if(G.T.g.pts.length>=G3_MAX){toast('A 3D gradient holds up to '+G3_MAX+' points.');return true;}
    g3Edit(G.T,g=>{g.pts.push({p:at,c:(ui.fg||[1,1,1]).slice(0,3),r:.5});});g3.sel=G.T.g.pts.length-1;if(typeof renderMatEd==='function')renderMatEd(true);e.preventDefault();return true;}
  const part=g3Part(G,m);if(!part)return false;
  if(part.pt!==undefined){g3.sel=part.pt;if(typeof renderMatEd==='function')renderMatEd(true);}
  const i=g3.sel,q=G.T.g.pts[i];if(!q)return false;g3.drag={T:G.T,i,m0:m,p0:q.p.slice(),all0:JSON.parse(JSON.stringify(G.T.g.pts)),G,part:typeof part==='string'?part:'free'};
  try{hit.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();g3Draw();return true;}
function g3Move(hit,e){const D=g3.drag;if(!D)return false;if(!e.buttons){g3Up();return true;}D.m=g3Mouse(hit,e);if(g3.raf)return true;g3.raf=requestAnimationFrame(()=>{g3.raf=0;g3Apply();});return true;}
function g3Apply(){const D=g3.drag;if(!D||!D.m)return;const {G}=D,dx=D.m[0]-D.m0[0],dy=D.m[1]-D.m0[1],B=G.B,q=D.T.g.pts[D.i];if(!q)return;
  if(D.part.startsWith('ax')){const k=+D.part[2],a=G.gz&&G.gz.ax.find(o=>o.k===k);if(!a)return;const t=(dx*a.u[0]+dy*a.u[1])/a.ppu,w=g3World(B,D.p0);w[k]+=t;q.p=g3Local(B,w);}
  else{/* across the screen, at the point's depth */const w0=g3World(B,D.p0),p0=G.pr(w0),eye=v3Eye(),f=lightNorm(w0.map((v,k)=>v-eye[k])),rt=lightNorm([-f[2],0,f[0]]),up=[f[1]*rt[2]-f[2]*rt[1],f[2]*rt[0]-f[0]*rt[2],f[0]*rt[1]-f[1]*rt[0]].map(v=>-v),
    px=G.pr(w0.map((v,k)=>v+rt[k]))||p0,u=p0&&px?Math.max(1e-3,Math.hypot(px[0]-p0[0],px[1]-p0[1])):100;q.p=g3Local(B,w0.map((v,k)=>v+rt[k]*dx/u-up[k]*dy/u));}
  g3Edit(D.T,()=>{},true);g3Draw();}
function g3Up(){const D=g3.drag;if(!D)return;if(g3.raf){cancelAnimationFrame(g3.raf);g3.raf=0;g3Apply();}g3.drag=null;const fin=JSON.parse(JSON.stringify(D.T.g.pts));
  /* one undo step for the whole drag: put the start back, then make the change through the editor */
  D.T.g.pts=D.all0;g3Edit(D.T,g=>{g.pts=fin;});if(typeof renderMatEd==='function')renderMatEd(true);g3Draw();}
/* Delete removes the selected point (while the 3D view is under the pointer and no light is selected) */
window.addEventListener('keydown',e=>{if((e.key!=='Delete'&&e.key!=='Backspace')||isTypingTarget(e.target)||e.ctrlKey||e.metaKey||e.altKey||!modal.hidden)return;
  const T=g3Target();if(!T||g3.sel<0||!T.g.pts[g3.sel]||!v3.on||!v3.hover)return;if(T.g.pts.length<=1){toast('A 3D gradient needs at least one point.');e.preventDefault();e.stopImmediatePropagation();return;}
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return;const i=g3.sel;g3Edit(T,g=>{g.pts.splice(i,1);});g3.sel=-1;if(typeof renderMatEd==='function')renderMatEd(true);g3Draw();},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&g3.arm){g3.arm=false;g3Draw();}},true);

/* ---- the settings (Properties): one line per point, Add point, Softness ---- */
function g3Box(T,grey){const g=T.g,box=el('div',{class:'dlg-grid g3box',id:'g3Box'});
  const rows=g.pts.map((q,i)=>el('div',{class:'frow g3row'+(i===g3.sel?' on':''),id:'g3row_'+i},
    el('button',{class:'btn sm g3pick',type:'button',text:String(i+1),title:'Select this point in the 3D view','aria-pressed':String(i===g3.sel),onclick:()=>{g3.sel=i===g3.sel?-1:i;renderMatEd(true);g3Draw();v3.dirty=true;requestRender();}}),
    colourBtn('g3c_'+i,()=>q.c,c=>g3Edit(T,()=>{q.c=c.slice(0,3);}),(grey?'Value':'Colour')+' of point '+(i+1)),
    makeSlider({id:'g3r_'+i,label:'Reach',min:.05,max:2,step:.01,value:q.r||.6,def:.6,fmt:v=>Math.round(v*100)+'%',onInput:v=>g3Edit(T,()=>{q.r=v;})}).el,
    el('button',{class:'btn sm',type:'button',text:'×',title:'Remove point '+(i+1),'aria-label':'Remove point '+(i+1),disabled:g.pts.length<=1,onclick:()=>{g3Edit(T,x=>{x.pts.splice(i,1);});if(g3.sel>=i)g3.sel--;renderMatEd(true);g3Draw();}})));
  box.append(el('div',{class:'sub',text:'3D gradient points'}),...rows,
    el('div',{class:'chips'},el('button',{class:'btn sm'+(g3.arm?' on':''),type:'button',id:'g3Add',text:g3.arm?'Click the model…':'+ Add point',disabled:g.pts.length>=G3_MAX,title:'Then click the model where the point goes',onclick:()=>{g3.arm=!g3.arm;if(g3.arm&&!v3.on&&typeof toggle3D==='function')toggle3D(true);renderMatEd(true);g3Draw();}})),
    makeSlider({id:'g3soft',label:'Softness',min:.5,max:8,step:.1,value:g.soft||2,def:2,fmt:v=>v.toFixed(1),onInput:v=>g3Edit(T,()=>{g.soft=v;})}).el,
    el('p',{class:'note',text:'Each spot of the model blends the points’ '+(grey?'values':'colours')+' by how near it is to each. In the 3D view: drag a dot to move it, drag its arrows to move it along X, Y or Z, Delete removes the selected point. Low softness gives sharp regions, high softness smooth blends.'}));
  return box;}
