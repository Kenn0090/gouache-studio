/* ================= The fun part of the unwrap review (0.55) =================
   Kenn: "make the UV unwrap fun and interactive". Three things, all in the UVs card of the Bake tab:
   - stretch colours: the model and the flat layout tinted by how stretched (or how big/small) each triangle's texels are,
     with the seams drawn as white lines on the model; the colours follow the Seam angle slider while you drag it
   - the dice gallery: roll 12 layouts at once, see each with its score, click one to use it, pin favourites
   - unfold: the model slides open into its flat layout (a slider and a Play button) */
/* ---- how stretched is each triangle? ---- */
function uvMetrics(m){if(m._uvMet)return m._uvMet;const I=m.idx,T=I.length/3,P=m.pos,UV=m.uv,str=new Float32Array(T),den=new Float32Array(T),flip=new Uint8Array(T),area=new Float32Array(T);let aSum=0;
  for(let t=0;t<T;t++){const a=I[t*3],b=I[t*3+1],c=I[t*3+2];
    const e1x=P[b*3]-P[a*3],e1y=P[b*3+1]-P[a*3+1],e1z=P[b*3+2]-P[a*3+2],e2x=P[c*3]-P[a*3],e2y=P[c*3+1]-P[a*3+1],e2z=P[c*3+2]-P[a*3+2];
    const l1=Math.hypot(e1x,e1y,e1z);if(l1<1e-12){str[t]=1;den[t]=0;continue;}
    /* the triangle in its own plane: edge 1 along x */
    const x2=(e1x*e2x+e1y*e2y+e1z*e2z)/l1,y2=Math.sqrt(Math.max(0,e2x*e2x+e2y*e2y+e2z*e2z-x2*x2));if(y2<1e-12){str[t]=1;den[t]=0;continue;}
    const du1=UV[b*2]-UV[a*2],dv1=UV[b*2+1]-UV[a*2+1],du2=UV[c*2]-UV[a*2],dv2=UV[c*2+1]-UV[a*2+1];
    /* J maps the plane to the UVs: columns are d(uv)/dx and d(uv)/dy */
    const ja=du1/l1,jc=dv1/l1,jb=(du2-ja*x2)/y2,jd=(dv2-jc*x2)/y2;
    const s2=ja*ja+jb*jb+jc*jc+jd*jd,dd=Math.sqrt(Math.max(0,(ja*ja+jb*jb-jc*jc-jd*jd)**2+4*(ja*jc+jb*jd)**2)),s1=Math.sqrt(Math.max(0,(s2+dd)/2)),s0=Math.sqrt(Math.max(0,(s2-dd)/2));
    str[t]=s0>1e-9?s1/s0:99;den[t]=Math.sqrt(Math.abs(ja*jd-jb*jc));flip[t]=ja*jd-jb*jc<0?1:0;area[t]=l1*y2/2;aSum+=area[t];}
  /* the middle texel size, weighted by area */
  const idx=[...den.keys()].filter(t=>den[t]>0).sort((x,y)=>den[x]-den[y]);let acc=0,med=0;for(const t of idx){acc+=area[t];if(acc>=aSum/2){med=den[t];break;}}
  const bad=[];let avg=0;for(let t=0;t<T;t++)avg+=Math.min(str[t],4)*area[t];avg=aSum?avg/aSum:1;
  return m._uvMet={str,den,flip,med:med||1,avg};}
const uvLerp=(a,b,t)=>a+(b-a)*t;
function uvStretchRGB(s){/* 1 = a perfect fit (green) -> yellow -> red from 2.2 on */const k=Math.max(0,Math.min(1,(s-1)/1.2));return k<.5?[uvLerp(62,240,k*2),uvLerp(207,205,k*2),uvLerp(106,70,k*2)]:[uvLerp(240,226,(k-.5)*2),uvLerp(205,64,(k-.5)*2),uvLerp(70,64,(k-.5)*2)];}
function uvTexelRGB(r){/* log2 of the texel size against the middle one: blue = small, green = right, red = big */const k=Math.max(-1,Math.min(1,Math.log2(Math.max(r,1e-6))));return k<0?[uvLerp(62,70,-k),uvLerp(207,120,-k),uvLerp(106,235,-k)]:[uvLerp(62,235,k),uvLerp(207,70,k),uvLerp(106,70,k)];}
/* the layout drawn in colour (also the picture put on the model: it is a texture in UV space) */
function uvHeatCanvas(m,mode,S,seams){const cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d');x.fillStyle='#17181c';x.fillRect(0,0,S,S);if(!m||m.noUV)return cv;
  const I=m.idx,T=I.length/3,UV=m.uv,M=uvMetrics(m);
  for(let t=0;t<T;t++){const rgb=mode==='texel'?uvTexelRGB(M.den[t]/M.med):uvStretchRGB(M.str[t]);x.fillStyle='rgb('+rgb.map(Math.round).join(',')+')';x.strokeStyle=x.fillStyle;x.lineWidth=1;x.beginPath();
    for(let k=0;k<3;k++){const v=I[t*3+k],px=UV[v*2]*S,py=UV[v*2+1]*S;k?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();x.fill();x.stroke();}
  if(seams)uvDrawSeams(x,m,S);return cv;}
/* the outline of every island, white (these are the seams: on the model they show as bright lines) */
function uvDrawSeams(x,m,S){const I=m.idx,T=I.length/3,UV=m.uv,em=new Map(),B=4294967296,q=v=>Math.round(UV[v*2]*65535)*65536+Math.round(UV[v*2+1]*65535);
  const key=(a,b)=>{const p=q(a),r=q(b);return p<r?p*B+r:r*B+p;};for(let t=0;t<T;t++)for(let k=0;k<3;k++){const a=I[t*3+k],b=I[t*3+(k+1)%3],e=key(a,b);em.set(e,(em.get(e)||0)+1);}
  x.strokeStyle='rgba(255,255,255,.95)';x.lineWidth=Math.max(1.5,S/400);x.beginPath();for(let t=0;t<T;t++)for(let k=0;k<3;k++){const a=I[t*3+k],b=I[t*3+(k+1)%3];if(em.get(key(a,b))===1){x.moveTo(UV[a*2]*S,UV[a*2+1]*S);x.lineTo(UV[b*2]*S,UV[b*2+1]*S);}}x.stroke();}
/* ---- what the model wears while reviewing: nothing, the numbered checker, or a colour map ---- */
let uvViewT=null,uvViewKey='';
function uvViewTarget(){const m=(typeof bkLow==='function')?bkLow():null,v=uvw.view;if(!m||m.noUV||!v||v==='off')return null;
  const key=v+'|'+(m.uv&&m.uv.length)+'|'+(m._uvStamp||0)+'|'+(m.uvAuto?m.uvAuto.packSeed+':'+m.uvAuto.seed:'');if(uvViewT&&uvViewKey===key&&uvViewT.mesh===m)return uvViewT;
  if(uvViewT){disposeTarget(uvViewT.t);uvViewT=null;}
  let cv;if(v==='check')cv=uvCheckerCanvas();else cv=uvHeatCanvas(m,v,1024,true);
  const t=makeTarget(cv.width,cv.height,8,true),tex=uploadStraight({w:cv.width,h:cv.height,data:new Uint8Array(cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data.buffer),bits:8});try{premultInto(t,tex,[0,0],null);}finally{gl.deleteTexture(tex);}setWrap(t,true);
  uvViewKey=key;uvViewT={t,unlit:v!=='check',mesh:m};return uvViewT;}
function uvCheckerCanvas(){const S=1024,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),n=16,s=S/n;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){x.fillStyle=(i+j)&1?'#d9d9de':'#8c8f99';x.fillRect(i*s,j*s,s,s);}
  x.font='bold 40px sans-serif';x.fillStyle='#2b2d33';x.textAlign='center';x.textBaseline='middle';for(let i=0;i<n;i+=2)for(let j=0;j<n;j+=2)x.fillText(String(i/2+1+(j/2)*8),(i+.5)*s+s,(j+.5)*s+s);return c;}
function uvViewSync(){bk.uvCheck=uvw.view&&uvw.view!=='off';bk.dirty=true;if(typeof v3!=='undefined')v3.dirty=true;if(typeof requestRender==='function')requestRender(true);}
/* ---- the dice gallery ---- */
const UV_ROLLS=12;
async function uvRoll(){const old=bkLow();if(!old||uvw.busy)return;const src=old.uwSrc||(old.noUV?old:null);if(!src){toast('Rolling needs a model that was auto unwrapped (or has no UVs).');return;}
  uvw.busy=true;const big=src.tris>150000,n=big?4:UV_ROLLS,base=(old.uwOpt&&old.uwOpt.seed)||1,topo=src._uwTopo||(src._uwTopo=uwTopo(src)),opt0=Object.assign(uwDefaults(),old.uwOpt||{},{size:uvSizeNow()}),keep=uvw.gal.filter(g=>g.pin),out=[];
  try{for(let k=0;k<n;k++){const seed=base+1+k*7+Math.floor(Math.random()*5),o=Object.assign({},opt0,{seed,packSeed:null}),res=await uwUnwrap(src,o,null,topo),lay=uwLayout(src,res,o);
      out.push({seed,opt:o,res,lay,util:lay.util,charts:res.flats.length,thumb:uvThumb(res,lay)});uvw.rollNote='Rolling… '+(k+1)+' of '+n;if(ui.mode==='bake'){const l=$('#uvRollNote');if(l)l.textContent=uvw.rollNote;}await uwYield();}
    uvw.gal=[...keep,...out];uvw.rollNote='';}
  catch(e){console.warn(e);toast('The dice roll did not work: '+(e.message||e));}finally{uvw.busy=false;if(ui.mode==='bake')buildBakePanel();}}
/* a thumbnail drawn straight from the flattened pieces (no mesh needed) */
function uvThumb(res,lay,S=84){const cv=document.createElement('canvas');cv.width=cv.height=S;const x=cv.getContext('2d');x.fillStyle='#17181c';x.fillRect(0,0,S,S);const pal=['#e06c6c','#6cc06c','#6c9ce0','#e0c05c','#c06cc0','#5cc0c0','#f0a060','#a0a0a8'];
  res.flats.forEach((F,c)=>{x.fillStyle=pal[c%pal.length];x.globalAlpha=.8;const uv=lay.uvs[c];for(const l of F.tris){x.beginPath();for(let k=0;k<3;k++){const px=uv[l[k]*2]*S,py=(1-uv[l[k]*2+1])*S;k?x.lineTo(px,py):x.moveTo(px,py);}x.closePath();x.fill();}});x.globalAlpha=1;return cv.toDataURL('image/png');}
async function uvUseRoll(g){const old=bkLow(),src=old.uwSrc||old;uvw.busy=true;try{const nm=uwBuild(src,g.res,g.lay);nm.uwSrc=src;nm.uwRes=g.res;nm.uwOpt=Object.assign({},g.res.opt,g.opt,{packSeed:g.lay.packSeed});nm.xf=src.xf;nm.name=src.name;nm._uvStamp=(old._uvStamp||0)+1;uvReplaceMesh(old,nm);uvViewSync();}finally{uvw.busy=false;if(ui.mode==='bake')buildBakePanel();}}
/* ---- unfold ---- */
function uvFoldSet(t){const was=bk.fold||0;bk.fold=Math.max(0,Math.min(1,t));if(was===0&&bk.fold>0){v3.cam.yaw=0;v3.cam.pitch=0;}/* look at it from the front */bk.dirty=true;v3.dirty=true;requestRender(true);const s=$('#uvFold');if(s&&+s.value!==bk.fold)s.value=bk.fold;}
function uvFoldPlay(){if(uvw.anim){uvw.anim=false;const b=$('#uvPlay');if(b)b.textContent='Play';return;}uvw.anim=true;const b=$('#uvPlay');if(b)b.textContent='Pause';let dir=(bk.fold||0)>=1?-1:1,last=performance.now();
  const step=now=>{if(!uvw.anim||ui.mode!=='bake')return;const dt=Math.min(.05,(now-last)/1000);last=now;let t=(bk.fold||0)+dir*dt/2.4;if(t>=1.15){t=1;dir=-1;}else if(t<=-.15){t=0;dir=1;}uvFoldSet(Math.max(0,Math.min(1,t)));requestAnimationFrame(step);};requestAnimationFrame(step);}
/* ---- live: the pieces follow the Seam angle slider while you drag it ---- */
let uvLiveTimer=0,uvLiveOpt=null;
function uvLive(opt){uvLiveOpt=Object.assign(uvLiveOpt||{},opt);clearTimeout(uvLiveTimer);uvLiveTimer=setTimeout(async()=>{if(uvw.busy){uvLive({});return;}const o=uvLiveOpt;uvLiveOpt=null;await uvAct('unwrap',o,{quiet:true});},160);}

function uvGalleryEl(){const best=Math.max(...uvw.gal.map(g=>g.util)),box=el('div',{class:'uvgal',id:'uvGallery'});
  for(const g of uvw.gal){const tile=el('div',{class:'uvdie'+(g.pin?' pin':'')+(g.util===best?' best':'')},
      el('button',{class:'uvdiepic',type:'button',title:'Use this layout (seed '+g.seed+')','aria-label':'Use layout with seed '+g.seed,onclick:()=>uvUseRoll(g)},el('img',{src:g.thumb,alt:''}),g.util===best?el('i',{class:'uvbest',text:'best'}):null),
      el('div',{class:'uvdielbl'},el('span',{text:Math.round(g.util*100)+'% · '+g.charts+' piece'+(g.charts===1?'':'s')}),el('button',{class:'uvpin',type:'button',text:g.pin?'★':'☆',title:g.pin?'Unpin':'Pin this layout (it stays when you roll again)','aria-label':g.pin?'Unpin':'Pin',onclick:()=>{g.pin=!g.pin;buildBakePanel();}})));box.append(tile);}
  return box;}
