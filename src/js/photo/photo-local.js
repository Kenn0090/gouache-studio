/* ================= Photo tab: local adjustments (masks) =================
   Linear gradients, radial gradients and brushed areas, each with its own light and colour sliders and an optional luminance or
   colour range. Positions are kept on the original picture (0..1), so they follow the crop and the turn. */
ph.lm={sel:null,tool:null,show:false,bs:{sz:.06,fe:60,fl:100,e:false},cur:null};
const PH_LADJ=[['exp','Exposure',-5,5,.01],['con','Contrast',-100,100,1],['hi','Highlights',-100,100,1],['sh','Shadows',-100,100,1],['wh','Whites',-100,100,1],['bl','Blacks',-100,100,1],
  ['temp','Temperature',-100,100,1],['tint','Tint',-100,100,1],['vib','Vibrance',-100,100,1],['sat','Saturation',-100,100,1],['tex','Texture',-100,100,1],['cla','Clarity',-100,100,1],['dehaze','Dehaze',-100,100,1],['sharp','Sharpness',0,150,1]];
/* where an output position (0..1 over the shown picture) lands on the original, and back (the same steps as the shader) */
function phFwd(s,ar,zoom,u,v){const g=s.geo,c=g.crop,a=g.angle*Math.PI/180,kx=g.horiz/100*.5,ky=g.vert/100*.5;
  let qx=(c[0]+(c[2]-c[0])*u-.5)*ar/zoom,qy=(c[1]+(c[3]-c[1])*v-.5)/zoom;const ca=Math.cos(a),sa=Math.sin(a),rx=ca*qx+sa*qy,ry=-sa*qx+ca*qy;qx=rx;qy=ry;
  qx*=1+kx*qy;qy*=1+ky*qx;{const d=(g.dist||0)/100*.6,r2=qx*qx+qy*qy;qx*=1+d*r2;qy*=1+d*r2;}let sx=qx/ar+.5,sy=qy+.5;if(g.flipH)sx=1-sx;if(g.flipV)sy=1-sy;return [sx,sy];}
function phInv(s,ar,zoom,sx,sy){let u=.5,v=.5;const e=1e-4;
  for(let i=0;i<14;i++){const a=phFwd(s,ar,zoom,u,v),rx=a[0]-sx,ry=a[1]-sy;if(Math.abs(rx)+Math.abs(ry)<1e-7)break;
    const b=phFwd(s,ar,zoom,u+e,v),c=phFwd(s,ar,zoom,u,v+e),j11=(b[0]-a[0])/e,j21=(b[1]-a[1])/e,j12=(c[0]-a[0])/e,j22=(c[1]-a[1])/e,det=j11*j22-j12*j21;if(Math.abs(det)<1e-9)break;
    u-=(j22*rx-j12*ry)/det;v-=(-j21*rx+j11*ry)/det;}
  return [u,v];}
function phMapper(){const p=phP();if(!p)return null;const s=ph.crop?Object.assign({},p.s,{geo:Object.assign({},p.s.geo,{crop:[0,0,1,1]})}):p.s,ar=p.pw/p.ph,zoom=phGeo(s,p.pw,p.ph).zoom;
  return {ar,fwd:(u,v)=>phFwd(s,ar,zoom,u,v),inv:(x,y)=>phInv(s,ar,zoom,x,y)};}
/* the masks */
function phMasks(){const s=phS();if(!s)return [];if(!s.local)s.local=[];return s.local;}
function phSelMask(){const id=ph.lm.sel;return phMasks().find(m=>m.id===id)||null;}
function phMaskName(m){return m.name||(m.type==='lin'?'Linear gradient':m.type==='rad'?'Radial gradient':m.type==='ai'?'AI selection':'Brush');}
const phBitmapMasks=()=>phMasks().filter(m=>m.type==='brush'||m.type==='ai').length;
function phNewMask(type){const M=phMapper();if(!M)return;const list=phMasks();
  if((type==='brush'||type==='ai')&&phBitmapMasks()>=4){toast('Four brushed or AI masks at most on one photo.');return;}
  if(list.length>=8){toast('Eight masks at most on one photo.');return;}
  const id='m'+Date.now().toString(36)+Math.floor(Math.random()*999),m={id,type,on:true,inv:false,amt:100,feather:50,adj:{},rng:{kind:'none',lo:0,hi:100,soft:30,h:0,hr:30}};
  if(type==='lin'){m.a=M.fwd(.5,.3);m.b=M.fwd(.5,.65);m.adj={exp:-.5};}
  else if(type==='rad'){m.c=M.fwd(.5,.5);m.r=[.22,.16];m.rot=0;m.feather=50;m.adj={exp:.5};}
  else{m.strokes=[];}
  list.push(m);ph.open.local=true;ph.lm.sel=id;ph.lm.tool=type==='brush'?'brush':null;phCommit('Add mask');phBuildPanel();phDirty();drawXfOverlay();}
function phDelMask(id){const list=phMasks(),i=list.findIndex(m=>m.id===id);if(i<0)return;list.splice(i,1);if(ph.lm.sel===id){ph.lm.sel=null;ph.lm.tool=null;}phCommit('Delete mask');phBuildPanel();phDirty();drawXfOverlay();}
/* the panel */
function phLSl(m,key,label,min,max,step){const v=(m.adj&&m.adj[key])||0;
  const sl=makeSlider({id:'phl_'+key,label,min,max,step,value:v,fmt:key==='exp'?(x=>(x>0?'+':'')+x.toFixed(2)):PH_SIGN,onInput:x=>{if(!m.adj)m.adj={};m.adj[key]=x;phDirty();phHistLater('Mask '+label);},onChange:x=>{if(!m.adj)m.adj={};m.adj[key]=x;phDirty();phHistLater('Mask '+label);}});
  const lab=sl.el.querySelector('label');if(lab){lab.title='Double-click to reset';lab.addEventListener('dblclick',()=>{m.adj[key]=0;phDirty();phHistLater('Mask '+label);phBuildPanel();});}return sl.el;}
function phLGen(m,get,set,label,min,max,step,fmt){const sl=makeSlider({id:'phlg_'+label.replace(/\W/g,''),label,min,max,step,value:get(),fmt:fmt||(v=>Math.round(v)),onInput:v=>{set(v);phDirty();drawXfOverlay();phHistLater('Mask '+label);},onChange:v=>{set(v);phDirty();drawXfOverlay();phHistLater('Mask '+label);}});return sl.el;}
function phLocalPanel(){const list=phMasks(),m=phSelMask(),L=ph.lm,body=[];
  body.push(el('div',{class:'phlmbtns'},
    el('button',{class:'btn sm',text:'Linear',title:'Add a linear gradient: strongest at the first line, fading out to the second',onclick:()=>phNewMask('lin')}),
    el('button',{class:'btn sm',text:'Radial',title:'Add a round or oval gradient',onclick:()=>phNewMask('rad')}),
    el('button',{class:'btn sm',text:'Brush',title:'Add a brushed area',onclick:()=>phNewMask('brush')})));
  if(!list.length)body.push(el('p',{class:'note',text:'Add a mask to change light and colour in one part of the photo only.'}));
  for(const x of list){const row=el('div',{class:'phlmrow'+(x.id===L.sel?' on':'')},
    el('input',{type:'checkbox',checked:x.on!==false,title:'Show or hide this mask’s effect','aria-label':'Enabled',onchange:e=>{x.on=e.target.checked;phCommit('Mask on/off');phDirty();}}),
    el('button',{class:'phlmname',text:phMaskName(x),onclick:()=>{L.sel=x.id;L.tool=x.type==='brush'?'brush':null;phBuildPanel();drawXfOverlay();}}),
    el('button',{class:'btn sm',text:x.inv?'Inverted':'Invert',title:'Swap the affected and unaffected parts',onclick:()=>{x.inv=!x.inv;phCommit('Invert mask');phBuildPanel();phDirty();}}),
    el('button',{class:'btn sm',text:'×',title:'Delete this mask','aria-label':'Delete mask',onclick:()=>phDelMask(x.id)}));body.push(row);}
  if(m){body.push(el('div',{class:'sub',text:phMaskName(m)}));
    if(m.type==='brush'){const b=L.bs;body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm'+(L.tool==='brush'&&!b.e?' primary':''),text:'Paint',onclick:()=>{L.tool='brush';b.e=false;phBuildPanel();}}),el('button',{class:'btn sm'+(L.tool==='brush'&&b.e?' primary':''),text:'Erase',onclick:()=>{L.tool='brush';b.e=true;phBuildPanel();}}),el('button',{class:'btn sm',text:'Clear',onclick:()=>{m.strokes=[];phCommit('Clear brush');phDirty();}})),
      phLGen(m,()=>b.sz*100,v=>{b.sz=v/100;},'Brush size',1,40,.5,v=>v.toFixed(1)),phLGen(m,()=>b.fe,v=>{b.fe=v;},'Feather',0,100,1),phLGen(m,()=>b.fl,v=>{b.fl=v;},'Flow',5,100,1));}
    else if(m.type==='rad'){body.push(phLGen(m,()=>m.feather,v=>{m.feather=v;},'Feather',1,100,1),phLGen(m,()=>m.rot||0,v=>{m.rot=v;},'Rotation',-90,90,1));}
    body.push(chk('phlmShow','Show the mask (red)',!!L.show,v=>{L.show=v;phDirty();}));
    body.push(phLGen(m,()=>m.amt==null?100:m.amt,v=>{m.amt=v;},'Amount',0,100,1));
    const r=m.rng||(m.rng={kind:'none',lo:0,hi:100,soft:30,h:0,hr:30});
    const rs=el('select',{id:'phlmRange','aria-label':'Range'},...[['none','No range'],['lum','Luminance range'],['col','Colour range']].map(([v,t])=>el('option',{value:v,text:t})));rs.value=r.kind||'none';rs.onchange=()=>{r.kind=rs.value;phCommit('Mask range');phBuildPanel();phDirty();};
    body.push(el('div',{class:'frow'},el('label',{for:'phlmRange',text:'Limit to'}),rs));
    if(r.kind==='lum')body.push(phLGen(m,()=>r.lo,v=>{r.lo=v;},'From',0,100,1),phLGen(m,()=>r.hi,v=>{r.hi=v;},'To',0,100,1),phLGen(m,()=>r.soft,v=>{r.soft=v;},'Smoothness',0,100,1));
    if(r.kind==='col')body.push(phLGen(m,()=>r.h,v=>{r.h=v;},'Hue',0,360,1),phLGen(m,()=>r.hr,v=>{r.hr=v;},'Range',5,120,1),el('button',{class:'btn sm',text:'Pick from the photo',title:'Click a colour on the picture',onclick:()=>phPickStart('mask')}));
    body.push(el('div',{class:'sub',text:'Adjustments'}),...PH_LADJ.map(a=>phLSl(m,...a)));}
  return body;}
/* on the picture */
function phLocalOverlay(f){if(ui.mode!=='photo'||ph.crop||!phP())return '';const L=ph.lm,m=phSelMask(),M=phMapper();if(!m||!M||m.on===false)return '';const W=doc.w,H=doc.h,ar=M.ar,P=([x,y])=>{const q=M.inv(x,y);return f([q[0]*W,q[1]*H]);};
  const toSp=(px,py)=>[px/ar+.5,py+.5];let s='';
  if(m.type==='lin'){const A=P(m.a),B=P(m.b),a=m.a,b=m.b,dx=(b[0]-a[0])*ar,dy=b[1]-a[1],n=Math.hypot(dx,dy)||1,nx=-dy/n*.6,ny=dx/n*.6;
    const edge=(p)=>{const c=[(p[0]-.5)*ar,p[1]-.5],e1=toSp(c[0]-nx,c[1]-ny),e2=toSp(c[0]+nx,c[1]+ny);return 'M'+P(e1)+'L'+P(e2);};
    s+='<path class="phlm" d="'+edge(a)+edge(b)+'M'+A+'L'+B+'"/>';for(const q of [A,B]){const [x,y]=q.split(' ').map(Number);s+='<circle class="phlmh" cx="'+x+'" cy="'+y+'" r="6"/>';}}
  else if(m.type==='rad'){const C=[(m.c[0]-.5)*ar,m.c[1]-.5],cr=Math.cos((m.rot||0)*Math.PI/180),sr=Math.sin((m.rot||0)*Math.PI/180);let d='';
    for(let k=0;k<=48;k++){const t=k/48*Math.PI*2,ex=m.r[0]*Math.cos(t),ey=m.r[1]*Math.sin(t);d+=(k?'L':'M')+P(toSp(C[0]+cr*ex-sr*ey,C[1]+sr*ex+cr*ey));}
    s+='<path class="phlm" d="'+d+'"/>';const hs=[[0,0],[m.r[0],0],[-m.r[0],0],[0,m.r[1]],[0,-m.r[1]]];
    for(const [ex,ey] of hs){const [x,y]=P(toSp(C[0]+cr*ex-sr*ey,C[1]+sr*ex+cr*ey)).split(' ').map(Number);s+='<circle class="phlmh" cx="'+x+'" cy="'+y+'" r="6"/>';}}
  else if(m.type==='brush'&&L.tool==='brush'&&L.cur){const [x,y]=f(L.cur).split(' ').map(Number),sp=M.fwd(L.cur[0]/W,L.cur[1]/H),q=M.inv(sp[0],sp[1]+L.bs.sz/2),e=f([q[0]*W,q[1]*H]).split(' ').map(Number);
    s+='<circle class="phlm" cx="'+x+'" cy="'+y+'" r="'+Math.max(2,Math.hypot(e[0]-x,e[1]-y))+'"/>';}
  return s;}
function phLocalDown(e,ix,iy){const L=ph.lm,m=phSelMask(),M=phMapper();if(!m||!M||ph.crop||m.on===false)return false;const W=doc.w,H=doc.h,r=stage.getBoundingClientRect();
  if(L.pickCol){return false;}
  if(m.type==='brush'&&L.tool==='brush'){const sp=M.fwd(ix/W,iy/H),b=L.bs;if(!m.strokes)m.strokes=[];const st={e:b.e?1:0,sz:b.sz,fe:b.fe,fl:b.fl,pts:[+sp[0].toFixed(4),+sp[1].toFixed(4)]};m.strokes.push(st);ptr={mode:'phlm',id:e.pointerId,kind:'brush',st,m,M};phDirty();return true;}
  const pts=[],ar=M.ar;const toSp=(px,py)=>[px/ar+.5,py+.5];
  if(m.type==='lin'){pts.push(['a',m.a],['b',m.b]);}
  else if(m.type==='rad'){const C=[(m.c[0]-.5)*ar,m.c[1]-.5],cr=Math.cos((m.rot||0)*Math.PI/180),sr=Math.sin((m.rot||0)*Math.PI/180),at=(ex,ey)=>toSp(C[0]+cr*ex-sr*ey,C[1]+sr*ex+cr*ey);
    pts.push(['c',m.c],['rx+',at(m.r[0],0)],['rx-',at(-m.r[0],0)],['ry+',at(0,m.r[1])],['ry-',at(0,-m.r[1])]);}
  let hit=null,bd=14;for(const [k,q] of pts){const u=M.inv(q[0],q[1]),sp=scrPt([u[0]*W,u[1]*H]),d=Math.hypot(e.clientX-r.left-sp[0],e.clientY-r.top-sp[1]);if(d<bd){bd=d;hit=k;}}
  if(!hit&&m.type==='lin'){const a=M.inv(m.a[0],m.a[1]),b=M.inv(m.b[0],m.b[1]),pa=scrPt([a[0]*W,a[1]*H]),pb=scrPt([b[0]*W,b[1]*H]),px=e.clientX-r.left,py=e.clientY-r.top,vx=pb[0]-pa[0],vy=pb[1]-pa[1],t=Math.max(0,Math.min(1,((px-pa[0])*vx+(py-pa[1])*vy)/(vx*vx+vy*vy||1))),d=Math.hypot(px-(pa[0]+vx*t),py-(pa[1]+vy*t));if(d<10)hit='line';}
  if(!hit)return false;
  ptr={mode:'phlm',id:e.pointerId,kind:hit,m,M,sp0:M.fwd(ix/W,iy/H),a0:m.a&&m.a.slice(),b0:m.b&&m.b.slice(),c0:m.c&&m.c.slice(),r0:m.r&&m.r.slice()};return true;}
function phLocalMove(ix,iy){const t=ptr,m=t.m,M=t.M,W=doc.w,H=doc.h,ar=M.ar;
  if(t.kind==='brush'){const sp=M.fwd(ix/W,iy/H),n=t.st.pts.length,lx=t.st.pts[n-2],ly=t.st.pts[n-1];if(Math.hypot((sp[0]-lx)*ar,sp[1]-ly)>t.st.sz*.06){t.st.pts.push(+sp[0].toFixed(4),+sp[1].toFixed(4));phDirty();}return;}
  const sp=M.fwd(ix/W,iy/H),dx=sp[0]-t.sp0[0],dy=sp[1]-t.sp0[1];
  if(m.type==='lin'){if(t.kind==='a')m.a=[t.a0[0]+dx,t.a0[1]+dy];else if(t.kind==='b')m.b=[t.b0[0]+dx,t.b0[1]+dy];else{m.a=[t.a0[0]+dx,t.a0[1]+dy];m.b=[t.b0[0]+dx,t.b0[1]+dy];}}
  else if(m.type==='rad'){if(t.kind==='c'){m.c=[t.c0[0]+dx,t.c0[1]+dy];}else{const C=[(m.c[0]-.5)*ar,m.c[1]-.5],P=[(sp[0]-.5)*ar-C[0],sp[1]-.5-C[1]],a=(m.rot||0)*Math.PI/180,cr=Math.cos(a),sr=Math.sin(a),lx=cr*P[0]+sr*P[1],ly=-sr*P[0]+cr*P[1];
    if(t.kind[1]==='x')m.r[0]=Math.max(.01,Math.abs(lx));else m.r[1]=Math.max(.01,Math.abs(ly));}}
  phDirty();drawXfOverlay();}
function phLocalUp(){const t=ptr;ptr=null;phCommit(t.kind==='brush'?'Brush stroke':'Move mask');phSidecarSoon();drawXfOverlay();}
