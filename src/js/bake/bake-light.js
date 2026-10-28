/* ================= Lighting bake and light rig (0.80) =================
   A light rig like Marmoset's: suns, point lights, spots and the sky (the 3D view's HDRI), each with a colour, strength,
   soft shadows and its own number of rays. The Lighting bake writes the light falling on the model into a picture
   (with the shadows the model casts on itself, from the baker's search tree). It goes to 3D Paint as a mesh map, which
   the Hand-painted and Stylize layers use for their lighting, and as a Multiply layer you can paint on.
   bakeCfg.rig = {lights:[{id,name,type,on,col,int,soft,shadow,rays,range,cone,edge,pos,el,turn}], expo, show, sel}.
   Positions are in the model's own space (the one the 3D view draws in); the front of a model faces +Z. */
const LIGHT_TYPES=[['sun','Sun'],['point','Point'],['spot','Spot'],['sky','Sky (HDRI)']];
let lightSeq=0;
function lightRig(){const C=bakeCfg;if(!C.rig)C.rig={lights:[],expo:1,show:true,sel:null};return C.rig;}
function lightNew(type,o){const box=lightBox(),R=box.r;
  return Object.assign({id:'l'+Date.now().toString(36)+(++lightSeq),name:{sun:'Sun',point:'Point light',spot:'Spot',sky:'Sky'}[type],type,on:true,col:[1,1,1],int:type==='sky'?.3:1,
    soft:type==='sun'?2:R*.15,shadow:true,rays:type==='sky'?24:12,range:R*3,cone:35,edge:.4,
    pos:[box.c[0]+R*.75,box.c[1]+R*.6,box.c[2]+R*.9],/* near the model, in view */el:45,turn:30},o||{});}
/* the model's box: centre and radius (in the view's space) */
function lightBox(){const m=typeof bkLow==='function'?bkLow():v3.mesh;const p=m&&m.pos;if(!p||!p.length)return {c:[0,0,0],r:1};
  if(m._lbox&&m._lbox.p===p)return m._lbox;const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[i+k]);mx[k]=Math.max(mx[k],p[i+k]);}
  const c=mn.map((v,k)=>(v+mx[k])/2),r=Math.max(1e-3,Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])/2);m._lbox={p,c,r};return m._lbox;}
/* the direction a light comes FROM (sun: its height and turn; point and spot: from their position) */
const lightFrom=(el,turn)=>{const e=el*Math.PI/180,t=turn*Math.PI/180;return [Math.cos(e)*Math.sin(t),Math.sin(e),Math.cos(e)*Math.cos(t)];};
const lightNorm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
function lightAim(L){const b=lightBox();return L.type==='sun'?lightFrom(L.el,L.turn).map(x=>-x):lightNorm(b.c.map((c,k)=>c-L.pos[k]));}
/* Auto rig: Marmoset-style three-point lighting around the model (it faces +Z): a warm key from the front left above,
   a cool weaker fill from the right, a bright rim from behind, and a little sky */
function lightAutoRig(){const R=lightRig();R.lights=[
    lightNew('sun',{name:'Key',col:[1,.95,.86],int:1.1,el:42,turn:-38,soft:3}),
    lightNew('sun',{name:'Fill',col:[.78,.85,1],int:.35,el:12,turn:62,soft:8,rays:8}),
    lightNew('sun',{name:'Rim',col:[1,1,1],int:.9,el:30,turn:165,soft:2}),
    lightNew('sky',{name:'Sky',int:.25})];R.sel=R.lights[0].id;R.expo=1;return R;}
/* the bake's shader inputs: four vec4 per light (see BK_FS_OUT kind 11) */
function lightBakeUniforms(rig,bmin,bsize,SS){rig=rig||lightRig();const on=(rig.lights||[]).filter(L=>L.on!==false).slice(0,8),A=new Float32Array(32),B=new Float32Array(32),Cc=new Float32Array(32),D=new Float32Array(32);
  on.forEach((L,i)=>{const t={sun:0,point:1,spot:2,sky:3}[L.type]??0,dir=lightAim(L),c=(L.col||[1,1,1]).map(x=>x*(L.int??1));
    A.set([t,...(L.pos||[0,0,0])],i*4);B.set([...dir,L.type==='sun'?(L.soft??2)*Math.PI/180:(L.soft??0)],i*4);Cc.set([...c,L.range||1],i*4);
    const half=(L.cone??35)/2*Math.PI/180,inner=half*(1-(L.edge??.4));D.set([Math.cos(inner),Math.cos(half),L.shadow===false?0:1,bkRaysPer(L.rays||12,SS)],i*4);});
  const E=typeof envEnsure==='function'?envEnsure():null,envOk=!!(E&&E.lv&&E.lv.length>3),s=v3s();
  return {uLN:{int:on.length},uLA:{v4a:A},uLB:{v4a:B},uLC:{v4a:Cc},uLD:{v4a:D},uEnvL:envOk?E.lv[3].tex:dummy,uHasEnv:{int:envOk?1:0},uEnvRot:(s.envRot||0)/360,
    uExpo:rig.expo??1,uFar:Math.hypot(...bsize)*4};}
const lightBakeOff=()=>({});

/* ---- the Lighting tab of the Bake panel: the rig as a list (eye, name, type, colour, strength, softness, shadows…) ---- */
function lightTabPage(on,note){const R=lightRig(),C=bakeCfg,pg=el('div',{});
  const redraw=()=>{pg.replaceChildren(...lightTabBody().filter(Boolean));v3.dirty=true;requestRender&&requestRender();};
  const lightTabBody=()=>{const rows=R.lights.map(L=>{const sel=R.sel===L.id,set=(k,v)=>{L[k]=v;v3.dirty=true;requestRender&&requestRender();};
      const eye=el('button',{class:'eye p3eye',type:'button','aria-label':(L.on===false?'Turn on ':'Turn off ')+L.name,'aria-pressed':String(L.on!==false),onclick:e=>{e.stopPropagation();L.on=L.on===false;redraw();}});eye.innerHTML=L.on===false?eyeOff:eyeOn;
      const head=el('div',{class:'p3set lrow'+(sel?' on':'')+(L.on===false?' missing':''),id:'lrow_'+L.id,onclick:()=>{R.sel=sel?null:L.id;redraw();}},eye,el('span',{class:'p3sn',text:L.name}),el('span',{class:'note',text:LIGHT_TYPES.find(t=>t[0]===L.type)[1]}),
        el('button',{class:'btn sm',type:'button',text:'×',title:'Delete this light','aria-label':'Delete '+L.name,onclick:e=>{e.stopPropagation();R.lights=R.lights.filter(x=>x!==L);redraw();}}));
      if(!sel)return head;
      const nm=el('input',{type:'text',value:L.name,'aria-label':'Name',id:'l_name'});nm.oninput=()=>{L.name=nm.value;};nm.onchange=redraw;
      const typ=el('select',{id:'l_type','aria-label':'Type'},...LIGHT_TYPES.map(([v,t])=>el('option',{value:v,text:t})));typ.value=L.type;typ.onchange=()=>{L.type=typ.value;redraw();};
      const sl=(k,label,min,max,step,fmt)=>makeSlider({id:'l_'+k,label,min,max,step,value:L[k],fmt,onInput:v=>set(k,v)}).el;const b=lightBox();
      const box=el('div',{class:'dlg-grid lset'},el('label',{class:'hpsel'},el('span',{text:'Name'}),nm),el('label',{class:'hpsel'},el('span',{text:'Type'}),typ),
        el('label',{class:'hpcol'},el('span',{text:'Colour'}),colourBtn('l_col',()=>L.col,c=>set('col',c.slice(0,3)),'Light colour')),sl('int','Strength',0,5,.01,v=>v.toFixed(2)),
        chk('l_shadow','Shadows',L.shadow!==false,v=>set('shadow',v)),sl('rays',L.type==='sky'?'Rays':'Shadow rays',1,64,1,String));
      if(L.type==='sun')box.append(sl('soft','Shadow softness',0,20,.1,v=>v.toFixed(1)+'°'),sl('el','Height',-90,90,1,v=>Math.round(v)+'°'),sl('turn','Turn',-180,180,1,v=>Math.round(v)+'°'));
      if(L.type==='point'||L.type==='spot')box.append(sl('soft','Shadow softness (size)',0,b.r,b.r/200,v=>(v/b.r*100).toFixed(0)+'%'),sl('range','Reach',b.r*.1,b.r*10,b.r/100,v=>(v/b.r).toFixed(1)+'×'));
      if(L.type==='spot')box.append(sl('cone','Cone',5,170,1,v=>Math.round(v)+'°'),sl('edge','Soft edge',0,1,.01,pct),el('p',{class:'note',text:'A spot always points at the middle of the model. Drag it in the view to move it.'}));
      if(L.type==='sky')box.append(el('p',{class:'note',text:'Light from the environment picture of the 3D view (its HDRI, turned as there). No HDRI: plain white sky.'}));
      if(L.type==='point')box.append(el('p',{class:'note',text:'Drag the bulb in the view to move it (across the screen; Shift: nearer or further).'}));
      if(L.type==='sun')box.append(el('p',{class:'note',text:'Drag the sun in the view to turn it around the model.'}));
      return el('div',{},head,box);});
    const add=t=>el('button',{class:'btn sm',type:'button',id:'lAdd_'+t,text:'+ '+LIGHT_TYPES.find(x=>x[0]===t)[1],onclick:()=>{const L=lightNew(t);if(t==='spot')L.name='Spot';R.lights.push(L);R.sel=L.id;redraw();}});
    return [on,el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',id:'lAuto',text:'Auto rig (key, fill, rim, sky)',title:'Three-point lighting around the model, like Marmoset',onclick:()=>{lightAutoRig();redraw();}}),add('sun'),add('point'),add('spot'),add('sky')),
      el('div',{class:'sub',text:'Lights'}),R.lights.length?el('div',{class:'p3sets lights',id:'lList'},...rows):el('p',{class:'note',text:'No lights yet. Press Auto rig, or add one.'}),
      makeSlider({id:'l_expo',label:'Exposure',min:.1,max:4,step:.01,value:R.expo??1,fmt:v=>v.toFixed(2),onInput:v=>{R.expo=v;}}).el,
      chk('l_show','Show the lights in the view',R.show!==false,v=>{R.show=v;v3.dirty=true;requestRender&&requestRender();}),
      bkMats(bkLow())?bkMatEyes(C):null,
      note('Bakes the light of this rig onto the model, with the shadows it casts on itself. It goes to 3D Paint as a mesh map (the Hand-painted and Stylize layers light the model with it) and as a Multiply layer you can paint on. Parts left out (eyes above) are not baked, but still cast shadows.')];};
  if(!R.lights.length&&C.kinds.light)lightAutoRig();
  pg.append(...lightTabBody().filter(Boolean));return pg;}

/* ---- the lights in the 3D view of the Bake tab: drag a sun to turn it, a bulb or spot to move it ---- */
const lgz={el:null,drag:null,raf:0};
function lgzActive(){const R=bakeCfg&&bakeCfg.rig;return ui.mode==='bake'&&v3.on&&R&&R.show!==false&&R.lights&&R.lights.some(L=>L.type!=='sky')?R:null;}
function lgzGeom(hit){const R=lgzActive();if(!R||!hit)return null;const r=hit.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);if(r.width<4)return null;
  const {VP}=v3ViewProj(w,h),b=lightBox();
  const pr=p=>{const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],ww=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];if(ww<=1e-5)return null;return [(x/ww*.5+.5)*w,(1-(y/ww*.5+.5))*h];};
  const items=R.lights.filter(L=>L.type!=='sky').map(L=>{const at=L.type==='sun'?lightFrom(L.el,L.turn).map((x,k)=>b.c[k]+x*b.r*1.7):L.pos;return {L,at,p:pr(at)};}).filter(o=>o.p);
  return {R,w,h,pr,b,items,c:pr(b.c)};}
function lgzDraw(){const hit=document.getElementById('v3Hit');let c=lgz.el;const G=lgzGeom(hit);
  if(!G){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=lgz.el=el('canvas',{class:'v3gz v3lgz','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.round(G.w*dpr),H=Math.round(G.h*dpr);
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}c.hidden=false;Object.assign(c.style,{left:(r.left-pr.left)+'px',top:(r.top-pr.top)+'px',width:G.w+'px',height:G.h+'px'});
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,G.w,G.h);
  for(const {L,p} of G.items){const sel=G.R.sel===L.id,col='rgb('+L.col.map(v=>Math.round(Math.min(1,v)*255)).join(',')+')',off=L.on===false;x.globalAlpha=off?.35:1;
    if(G.c&&L.type!=='point'){x.strokeStyle=sel?'#ffd24a':'rgba(255,255,255,.55)';x.setLineDash([4,4]);x.lineWidth=1.2;x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(G.c[0],G.c[1]);x.stroke();x.setLineDash([]);}
    x.fillStyle=col;x.strokeStyle=sel?'#ffd24a':'#111';x.lineWidth=sel?2.5:1.5;x.beginPath();x.arc(p[0],p[1],L.type==='sun'?9:7,0,7);x.fill();x.stroke();
    if(L.type==='sun'){x.strokeStyle=col;x.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4;x.beginPath();x.moveTo(p[0]+Math.cos(a)*12,p[1]+Math.sin(a)*12);x.lineTo(p[0]+Math.cos(a)*16,p[1]+Math.sin(a)*16);x.stroke();}}
    if(L.type==='spot'){x.strokeStyle=col;x.lineWidth=2;x.beginPath();x.arc(p[0],p[1],12,0,7);x.stroke();}
    x.fillStyle='#fff';x.font='11px sans-serif';x.fillText(L.name,p[0]+14,p[1]-10);x.globalAlpha=1;}}
const lgzMouse=(hit,e)=>{const r=hit.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
function lgzDown(hit,e){const G=lgzGeom(hit);if(!G)return false;const m=lgzMouse(hit,e);let best=null;
  for(const it of G.items){const d=Math.hypot(m[0]-it.p[0],m[1]-it.p[1]);if(d<14&&(!best||d<best.d))best={it,d};}
  if(!best)return false;const L=best.it.L;G.R.sel=L.id;lgz.drag={L,m0:m,el0:L.el,turn0:L.turn,pos0:(L.pos||[0,0,0]).slice(),G,shift:e.shiftKey};
  try{hit.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();lightTabSync();return true;}
function lgzMove(hit,e){const D=lgz.drag;if(!D)return;D.m=lgzMouse(hit,e);D.shift=e.shiftKey;if(lgz.raf)return;lgz.raf=requestAnimationFrame(()=>{lgz.raf=0;lgzApply();});}
function lgzApply(){const D=lgz.drag;if(!D||!D.m)return;const {L,G}=D,dx=D.m[0]-D.m0[0],dy=D.m[1]-D.m0[1];
  if(L.type==='sun'){L.turn=((D.turn0+dx*.5+540)%360)-180;L.el=clamp(D.el0-dy*.5,-89,89);}
  else{/* across the screen: screen pixels → model units, measured at the light; Shift: nearer or further from the view */
    const p0=G.pr(D.pos0),eye=v3Eye(),f=lightNorm(D.pos0.map((v,k)=>v-eye[k])),rt=lightNorm([-f[2],0,f[0]]),up=[f[1]*rt[2]-f[2]*rt[1],f[2]*rt[0]-f[0]*rt[2],f[0]*rt[1]-f[1]*rt[0]].map(v=>-v),
      px=G.pr(D.pos0.map((v,k)=>v+rt[k]))||p0,u=p0&&px?Math.max(1e-3,Math.hypot(px[0]-p0[0],px[1]-p0[1])):100;
    L.pos=D.shift?D.pos0.map((v,k)=>v-f[k]*dy/u):D.pos0.map((v,k)=>v+rt[k]*dx/u-up[k]*dy/u);}
  v3.dirty=true;requestRender&&requestRender();lightTabSync();}
function lgzUp(){if(!lgz.drag)return;if(lgz.raf){cancelAnimationFrame(lgz.raf);lgz.raf=0;lgzApply();}lgz.drag=null;lgzDraw();}
/* the open Lighting tab follows a drag (its sliders) */
function lightTabSync(){const L=(lightRig().lights||[]).find(x=>x.id===lightRig().sel);if(!L)return;for(const k of ['el','turn']){const i=document.getElementById('l_'+k);if(i){i.value=L[k];const o=i.parentNode&&i.parentNode.querySelector('output');if(o)o.textContent=Math.round(L[k])+'°';}}
  document.querySelectorAll('#lList .lrow').forEach(r=>r.classList.toggle('on',r.id==='lrow_'+L.id));}
{const d3=draw3D;draw3D=function(){d3();lgzDraw();};}
