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
    pos:lightStartPos(box),el:45,turn:30},o||{});}
/* a new bulb or spot starts between the view and the model, a little up and to the side, so it is on screen */
function lightStartPos(box){const R=box.r,c=box.c;let f=[.45,.35,.82];try{if(v3.cam){const e=v3Eye();f=lightNorm(e.map((v,k)=>v-c[k]));}}catch(_){}
  const rt=lightNorm([f[2],0,-f[0]]);return c.map((v,k)=>v+f[k]*R*.6+rt[k]*R*.2+(k===1?R*.25:0));}
/* the model's box: centre and radius (in the view's space) */
function lightBox(){const m=ui.mode==='p3d'&&v3.mesh?v3.mesh:typeof bkLow==='function'?bkLow():v3.mesh;const p=m&&m.pos;if(!p||!p.length)return {c:[0,0,0],r:1};
  if(m._lbox&&m._lbox.p===p)return m._lbox;const mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){mn[k]=Math.min(mn[k],p[i+k]);mx[k]=Math.max(mx[k],p[i+k]);}
  const c=mn.map((v,k)=>(v+mx[k])/2),r=Math.max(1e-3,Math.hypot(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])/2);m._lbox={p,c,r};return m._lbox;}
/* the direction a light comes FROM (sun: its height and turn; point and spot: from their position) */
const lightFrom=(el,turn)=>{const e=el*Math.PI/180,t=turn*Math.PI/180;return [Math.cos(e)*Math.sin(t),Math.sin(e),Math.cos(e)*Math.cos(t)];};
const lightNorm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l);};
function lightAim(L){const b=lightBox();return L.type==='sun'?lightFrom(L.el,L.turn).map(x=>-x):L.type==='spot'&&L.aim?lightNorm(L.aim):lightNorm(b.c.map((c,k)=>c-L.pos[k]));}
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
  if(!R.lights.length&&(C.kinds.light||!on))lightAutoRig();/* before the undo history starts */
  const paint=()=>{pg.replaceChildren(...lightTabBody().filter(Boolean));v3.dirty=true;requestRender&&requestRender();};
  /* (0.80.1) every change to the rig is an undo step (the buttons; Ctrl+Z too in the Lights window) */
  const H=editHistory(()=>JSON.stringify({lights:R.lights,expo:R.expo??1}),t=>{const o=JSON.parse(t);R.lights=o.lights;R.expo=o.expo;if(R.sel&&!R.lights.some(L=>L.id===R.sel))R.sel=null;paint();});
  lightHist=H;const redraw=()=>{H.note();paint();};
  const lightTabBody=()=>{const rows=R.lights.map(L=>{const sel=R.sel===L.id,set=(k,v)=>{L[k]=v;H.note();v3.dirty=true;requestRender&&requestRender();};
      const eye=el('button',{class:'eye p3eye',type:'button','aria-label':(L.on===false?'Turn on ':'Turn off ')+L.name,'aria-pressed':String(L.on!==false),onclick:e=>{e.stopPropagation();L.on=L.on===false;redraw();}});eye.innerHTML=L.on===false?eyeOff:eyeOn;
      const head=el('div',{class:'p3set lrow'+(sel?' on':'')+(L.on===false?' missing':''),id:'lrow_'+L.id,onclick:()=>{R.sel=sel?null:L.id;paint();}},eye,el('span',{class:'p3sn',text:L.name}),el('span',{class:'note',text:LIGHT_TYPES.find(t=>t[0]===L.type)[1]}),
        el('button',{class:'btn sm',type:'button',text:'×',title:'Delete this light','aria-label':'Delete '+L.name,onclick:e=>{e.stopPropagation();R.lights=R.lights.filter(x=>x!==L);redraw();}}));
      if(!sel)return head;
      const nm=el('input',{type:'text',value:L.name,'aria-label':'Name',id:'l_name'});nm.oninput=()=>{L.name=nm.value;};nm.onchange=()=>{H.note();};
      const typ=el('select',{id:'l_type','aria-label':'Type'},...LIGHT_TYPES.map(([v,t])=>el('option',{value:v,text:t})));typ.value=L.type;typ.onchange=()=>{L.type=typ.value;redraw();};
      const D0=lightNew(L.type),sl=(k,label,min,max,step,fmt)=>makeSlider({id:'l_'+k,label,min,max,step,value:L[k],def:typeof D0[k]==='number'?D0[k]:undefined,fmt,onInput:v=>set(k,v)}).el;const b=lightBox();
      const box=el('div',{class:'dlg-grid lset'},el('label',{class:'hpsel'},el('span',{text:'Name'}),nm),el('label',{class:'hpsel'},el('span',{text:'Type'}),typ),
        el('label',{class:'hpcol'},el('span',{text:'Colour'}),colourBtn('l_col',()=>L.col,c=>set('col',c.slice(0,3)),'Light colour')),sl('int','Strength',0,5,.01,v=>v.toFixed(2)),
        chk('l_shadow','Shadows',L.shadow!==false,v=>set('shadow',v)),sl('rays',L.type==='sky'?'Rays':'Shadow rays',1,64,1,String));
      if(L.type==='sun')box.append(sl('soft','Shadow softness',0,20,.1,v=>v.toFixed(1)+'°'),sl('el','Height',-90,90,1,v=>Math.round(v)+'°'),sl('turn','Turn',-180,180,1,v=>Math.round(v)+'°'));
      if(L.type==='point'||L.type==='spot')box.append(sl('soft','Shadow softness (size)',0,b.r,b.r/200,v=>(v/b.r*100).toFixed(0)+'%'),sl('range','Reach',b.r*.1,b.r*10,b.r/100,v=>(v/b.r).toFixed(1)+'×'));
      if(L.type==='spot')box.append(sl('cone','Cone',5,170,1,v=>Math.round(v)+'°'),sl('edge','Soft edge',0,1,.01,pct),el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',id:'l_aimMid',text:'Aim at the model',title:'Point the spot at the middle of the model again',onclick:()=>{delete L.aim;redraw();}})),el('p',{class:'note',text:'Drag the arrows in the view to move it, the ring to turn it.'}));
      if(L.type==='sky')box.append(el('p',{class:'note',text:'Light from the environment picture of the 3D view (its HDRI, turned as there). No HDRI: plain white sky.'}));
      if(L.type==='point'||L.type==='spot')box.append(lightXYZ(L,set));
      if(L.type==='point')box.append(el('p',{class:'note',text:'Drag the bulb or its arrows in the view to move it (Shift while dragging the bulb: nearer or further), or type its position. Delete removes the selected light.'}));
      if(L.type==='sun')box.append(el('p',{class:'note',text:'Drag the sun or its ring in the view to turn it around the model.'}));
      return el('div',{},head,box);});
    const add=t=>el('button',{class:'btn sm',type:'button',id:'lAdd_'+t,text:'+ '+LIGHT_TYPES.find(x=>x[0]===t)[1],onclick:()=>{const L=lightNew(t);if(t==='spot')L.name='Spot';R.lights.push(L);R.sel=L.id;redraw();}});
    return [on,H.buttons('l'),lightPresetRow(redraw),el('div',{class:'chips'},el('button',{class:'btn sm',type:'button',id:'lAuto',text:'Auto rig (key, fill, rim, sky)',title:'Three-point lighting around the model, like Marmoset',onclick:()=>{lightAutoRig();redraw();}}),add('sun'),add('point'),add('spot'),add('sky')),
      el('div',{class:'sub',text:'Lights'}),R.lights.length?el('div',{class:'p3sets lights',id:'lList'},...rows):el('p',{class:'note',text:'No lights yet. Press Auto rig, or add one.'}),
      makeSlider({id:'l_expo',label:'Exposure',min:.1,max:4,step:.01,value:R.expo??1,def:1,fmt:v=>v.toFixed(2),onInput:v=>{R.expo=v;H.note();}}).el,
      chk('l_show','Show the lights in the view',R.show!==false,v=>{R.show=v;v3.dirty=true;requestRender&&requestRender();}),
      ui.mode==='bake'?chk('l_prev','Live preview on the model',R.live!==false,v=>{R.live=v;if(!v)lightPreviewFree();bk.dirty=true;v3.dirty=true;requestRender&&requestRender(true);lightPreviewNote();}):null,
      ui.mode==='bake'?el('p',{class:'note',id:'lPrevNote',text:lpNoteText()}):null,
      ui.mode==='bake'&&bkMats(bkLow())?bkMatEyes(C):null,
      on&&note('Bakes the light of this rig onto the model, with the shadows it casts on itself. It goes to 3D Paint as a mesh map (the Hand-painted and Stylize layers light the model with it) and as a Multiply layer you can paint on. Parts left out (eyes above) are not baked, but still cast shadows.')];};
  lightPageRedraw=paint;
  pg.append(...lightTabBody().filter(Boolean));return pg;}

/* ---- the lights in the 3D view of the Bake tab: drag a sun to turn it, a bulb or spot to move it ---- */
const lgz={el:null,drag:null,raf:0};
let lightPageRedraw=null,lightHist=null;
const lightWin={open:false};
function lgzActive(){const R=bakeCfg&&bakeCfg.rig;return (ui.mode==='bake'||ui.mode==='p3d'&&(v3s().rigLive||lightWin.open))&&v3.on&&R&&R.show!==false&&R.lights&&R.lights.some(L=>L.type!=='sky')?R:null;}
function lgzGeom(hit){const R=lgzActive();if(!R||!hit)return null;const r=hit.getBoundingClientRect(),w=Math.max(1,r.width),h=Math.max(1,r.height);if(r.width<4)return null;
  const {VP}=v3ViewProj(w,h),b=lightBox();
  const pr=p=>{const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],ww=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];if(ww<=1e-5)return null;return [(x/ww*.5+.5)*w,(1-(y/ww*.5+.5))*h];};
  /* (0.95.8) a light outside the view sits at the edge, with an arrow pointing to it */
  const items=R.lights.filter(L=>L.type!=='sky').map(L=>{const at=L.type==='sun'?lightFrom(L.el,L.turn).map((x,k)=>b.c[k]+x*b.r*1.7):L.pos;let p=pr(at),out=false;
    if(!p){const c=pr(b.c)||[w/2,h/2];p=[w-c[0],h-c[1]];out=true;}
    const m=18;if(p[0]<m||p[0]>w-m||p[1]<m||p[1]>h-m){out=true;p=[clamp(p[0],m,w-m),clamp(p[1],m,h-m)];}return {L,at,p,out};});
  /* the selected light's gizmo: move arrows (bulb, spot) and a turn ring (sun, spot) */
  const S=items.find(o=>o.L.id===R.sel&&!o.out);let gz=null;
  if(S){gz={it:S,ax:[],ring:S.L.type!=='point'?34:0};if(S.L.type!=='sun'){const len=b.r*.4;for(let k=0;k<3;k++){const q=S.at.slice();q[k]+=len;const e=pr(q);if(e){const v=[e[0]-S.p[0],e[1]-S.p[1]],l=Math.hypot(v[0],v[1]);if(l>4){const rr=S.L.type!=='point'?34:0,L2=Math.max(l,rr+40),u=[v[0]/l,v[1]/l];gz.ax.push({k,u,ppu:l/len,end:[S.p[0]+u[0]*Math.min(L2,rr+90),S.p[1]+u[1]*Math.min(L2,rr+90)]});}}}}
    if(S.L.type==='spot'){const d=lightAim(S.L),e=pr(S.at.map((v,k)=>v+d[k]*b.r*.5));gz.aim=e;}}
  return {R,w,h,pr,b,items,c:pr(b.c),gz};}
function lgzDraw(){const hit=document.getElementById('v3Hit');let c=lgz.el;const G=lgzGeom(hit);
  if(!G){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=lgz.el=el('canvas',{class:'v3gz v3lgz','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.round(G.w*dpr),H=Math.round(G.h*dpr);
  if(c.width!==W||c.height!==H){c.width=W;c.height=H;}c.hidden=false;Object.assign(c.style,{left:(r.left-pr.left)+'px',top:(r.top-pr.top)+'px',width:G.w+'px',height:G.h+'px'});
  const x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,G.w,G.h);
  for(const {L,p,out} of G.items){const sel=G.R.sel===L.id,col='rgb('+L.col.map(v=>Math.round(Math.min(1,v)*255)).join(',')+')',off=L.on===false;x.globalAlpha=off?.35:1;
    /* a soft glow, so the lights stand out on any background */
    const gr=x.createRadialGradient(p[0],p[1],2,p[0],p[1],26);gr.addColorStop(0,'rgba('+L.col.map(v=>Math.round(Math.min(1,v)*255)).join(',')+',.55)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.beginPath();x.arc(p[0],p[1],26,0,7);x.fill();
    if(out&&G.c){const a=Math.atan2(p[1]-G.c[1],p[0]-G.c[0]);x.fillStyle='#ffd24a';x.beginPath();x.moveTo(p[0]+Math.cos(a)*18,p[1]+Math.sin(a)*18);x.lineTo(p[0]+Math.cos(a+2.6)*12,p[1]+Math.sin(a+2.6)*12);x.lineTo(p[0]+Math.cos(a-2.6)*12,p[1]+Math.sin(a-2.6)*12);x.fill();}
    if(G.c&&L.type!=='point'){x.strokeStyle=sel?'#ffd24a':'rgba(255,255,255,.55)';x.setLineDash([4,4]);x.lineWidth=1.2;x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(G.c[0],G.c[1]);x.stroke();x.setLineDash([]);}
    x.fillStyle=col;x.strokeStyle=sel?'#ffd24a':'#111';x.lineWidth=sel?2.5:1.5;x.beginPath();x.arc(p[0],p[1],L.type==='sun'?9:7,0,7);x.fill();x.stroke();
    if(L.type==='sun'){x.strokeStyle=col;x.lineWidth=2;for(let i=0;i<8;i++){const a=i*Math.PI/4;x.beginPath();x.moveTo(p[0]+Math.cos(a)*12,p[1]+Math.sin(a)*12);x.lineTo(p[0]+Math.cos(a)*16,p[1]+Math.sin(a)*16);x.stroke();}}
    if(L.type==='spot'){x.strokeStyle=col;x.lineWidth=2;x.beginPath();x.arc(p[0],p[1],12,0,7);x.stroke();}
    x.fillStyle='#fff';x.font='11px sans-serif';x.fillText(L.name,p[0]+14,p[1]-10);x.globalAlpha=1;}
  const z=G.gz;if(z){const p=z.it.p,AX=['#ff5a5a','#5ad46a','#5a9bff'];
    for(const a of z.ax){const hot=lgz.hot==='ax'+a.k;x.strokeStyle=AX[a.k];x.fillStyle=AX[a.k];x.lineWidth=hot?4:2.5;const r0=z.ring?z.ring+5:14,s0=[p[0]+a.u[0]*r0,p[1]+a.u[1]*r0];x.beginPath();x.moveTo(s0[0],s0[1]);x.lineTo(a.end[0],a.end[1]);x.stroke();
      const n=[-a.u[1],a.u[0]];x.beginPath();x.moveTo(a.end[0]+a.u[0]*10,a.end[1]+a.u[1]*10);x.lineTo(a.end[0]+n[0]*5,a.end[1]+n[1]*5);x.lineTo(a.end[0]-n[0]*5,a.end[1]-n[1]*5);x.fill();}
    if(z.ring){x.strokeStyle=lgz.hot==='ring'?'#ffd24a':'rgba(255,210,74,.75)';x.lineWidth=lgz.hot==='ring'?4:2.5;x.beginPath();x.arc(p[0],p[1],z.ring,0,7);x.stroke();}
    if(z.aim){x.strokeStyle='#ffd24a';x.lineWidth=2;x.setLineDash([2,3]);x.beginPath();x.moveTo(p[0],p[1]);x.lineTo(z.aim[0],z.aim[1]);x.stroke();x.setLineDash([]);x.beginPath();x.arc(z.aim[0],z.aim[1],3,0,7);x.fillStyle='#ffd24a';x.fill();}}}
const lgzMouse=(hit,e)=>{const r=hit.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
/* which gizmo part is under the pointer: 'ax0'..'ax2' (move along X/Y/Z) or 'ring' (turn) */
function lgzPart(G,m){const z=G&&G.gz;if(!z)return null;const p=z.it.p;
  if(z.ring&&Math.abs(Math.hypot(m[0]-p[0],m[1]-p[1])-z.ring)<6)return 'ring';const a0=z.ring?z.ring+7:14;
  for(const a of z.ax){const t=(m[0]-p[0])*a.u[0]+(m[1]-p[1])*a.u[1],L=Math.hypot(a.end[0]-p[0],a.end[1]-p[1])+10;if(t>a0&&t<L){const d=Math.abs((m[0]-p[0])*a.u[1]-(m[1]-p[1])*a.u[0]);if(d<7)return 'ax'+a.k;}}
  return null;}
function lgzHover(hit,e){const G=lgzGeom(hit);const h=G&&!lgz.drag?lgzPart(G,lgzMouse(hit,e)):null;if(h!==lgz.hot){lgz.hot=h;lgzDraw();}if(hit&&h)hit.style.cursor=h==='ring'?'grab':'move';return !!h;}
function lgzDown(hit,e){const G=lgzGeom(hit);if(!G)return false;const m=lgzMouse(hit,e);let best=null;
  const part=lgzPart(G,m);if(part){const L=G.gz.it.L;lgz.drag={L,m0:m,el0:L.el,turn0:L.turn,pos0:(L.pos||[0,0,0]).slice(),aim0:lightAim(L),G,part,shift:e.shiftKey};lgz.picked=true;try{hit.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();return true;}
  for(const it of G.items){const d=Math.hypot(m[0]-it.p[0],m[1]-it.p[1]);if(d<14&&(!best||d<best.d))best={it,d};}
  if(!best){lgz.picked=false;return false;}const L=best.it.L;G.R.sel=L.id;lgz.picked=true;lgz.drag={L,m0:m,el0:L.el,turn0:L.turn,pos0:(L.pos||[0,0,0]).slice(),G,shift:e.shiftKey};
  try{hit.setPointerCapture(e.pointerId);}catch(_){}e.preventDefault();if(lightPageRedraw)lightPageRedraw();else lightTabSync();return true;}
function lgzMove(hit,e){const D=lgz.drag;if(!D)return;D.m=lgzMouse(hit,e);D.shift=e.shiftKey;if(lgz.raf)return;lgz.raf=requestAnimationFrame(()=>{lgz.raf=0;lgzApply();});}
function lgzApply(){const D=lgz.drag;if(!D||!D.m)return;const {L,G}=D,dx=D.m[0]-D.m0[0],dy=D.m[1]-D.m0[1];
  if(D.part&&D.part.startsWith('ax')){const k=+D.part[2],a=G.gz&&G.gz.ax.find(o=>o.k===k);if(a){const t=(dx*a.u[0]+dy*a.u[1])/a.ppu;L.pos=D.pos0.slice();L.pos[k]+=t;}}
  else if(D.part==='ring'&&L.type==='spot'){/* turn the spot: across = around the up axis, up/down = tilt */const a0=D.aim0,yaw=-dx*.6*Math.PI/180,pit=-dy*.6*Math.PI/180;
    let v=[a0[0]*Math.cos(yaw)+a0[2]*Math.sin(yaw),a0[1],-a0[0]*Math.sin(yaw)+a0[2]*Math.cos(yaw)];const hz=Math.hypot(v[0],v[2])||1e-6,el=Math.asin(clamp(v[1],-1,1))+pit,ce=Math.cos(clamp(el,-1.55,1.55));
    v=[v[0]/hz*ce,Math.sin(clamp(el,-1.55,1.55)),v[2]/hz*ce];L.aim=v;}
  else if(L.type==='sun'){L.turn=((D.turn0+dx*.5+540)%360)-180;L.el=clamp(D.el0-dy*.5,-89,89);}
  else{/* across the screen: screen pixels → model units, measured at the light; Shift: nearer or further from the view */
    const p0=G.pr(D.pos0),eye=v3Eye(),f=lightNorm(D.pos0.map((v,k)=>v-eye[k])),rt=lightNorm([-f[2],0,f[0]]),up=[f[1]*rt[2]-f[2]*rt[1],f[2]*rt[0]-f[0]*rt[2],f[0]*rt[1]-f[1]*rt[0]].map(v=>-v),
      px=G.pr(D.pos0.map((v,k)=>v+rt[k]))||p0,u=p0&&px?Math.max(1e-3,Math.hypot(px[0]-p0[0],px[1]-p0[1])):100;
    L.pos=D.shift?D.pos0.map((v,k)=>v-f[k]*dy/u):D.pos0.map((v,k)=>v+rt[k]*dx/u-up[k]*dy/u);}
  v3.dirty=true;requestRender&&requestRender();lightTabSync();}
function lgzUp(){if(!lgz.drag)return;if(lgz.raf){cancelAnimationFrame(lgz.raf);lgz.raf=0;lgzApply();}lgz.drag=null;if(lightHist)lightHist.commit();lgzDraw();}
/* the open Lighting tab follows a drag (its sliders) */
function lightTabSync(){const L=(lightRig().lights||[]).find(x=>x.id===lightRig().sel);if(!L)return;for(const k of ['el','turn']){const i=document.getElementById('l_'+k);if(i){i.value=L[k];const o=i.parentNode&&i.parentNode.querySelector('output');if(o)o.textContent=Math.round(L[k])+'°';}}
  document.querySelectorAll('#lList .lrow').forEach(r=>r.classList.toggle('on',r.id==='lrow_'+L.id));}
{const d3=draw3D;draw3D=function(){d3();lgzDraw();};}

/* ---- exact numbers: a point light's or spot's position, typed (model units; the model's middle is shown) ---- */
function lightXYZ(L,set){const b=lightBox(),row=el('div',{class:'chips lxyz'},el('span',{class:'note',text:'Position'}));
  ['X','Y','Z'].forEach((a,k)=>{const i=el('input',{type:'number',id:'l_pos'+a,step:String(+(b.r/50).toPrecision(2)),value:(+L.pos[k].toFixed(3)),'aria-label':'Position '+a,style:'width:6em'});
    i.onchange=()=>{const v=parseFloat(i.value);if(!isFinite(v))return;const p=L.pos.slice();p[k]=v;set('pos',p);};row.append(el('label',{},el('span',{text:a+' '}),i));});
  row.append(el('span',{class:'note',text:'(middle of the model: '+b.c.map(v=>v.toFixed(2)).join(', ')+')'}));return row;}

/* ---- rig presets: built in, or saved by you; positions are kept relative to the model's box, so a rig fits any model ---- */
const LIGHT_PRESETS={
  'Three-point':()=>lightAutoRig().lights,
  'Soft studio':()=>[lightNew('sun',{name:'Key',col:[1,.97,.92],int:.9,el:35,turn:-30,soft:12}),lightNew('sun',{name:'Fill',col:[.9,.93,1],int:.45,el:20,turn:50,soft:15}),lightNew('sky',{name:'Sky',int:.45})],
  'Top light':()=>[lightNew('sun',{name:'Top',int:1.2,el:85,turn:0,soft:4}),lightNew('sky',{name:'Sky',int:.3})],
  'Dramatic rim':()=>[lightNew('sun',{name:'Key',col:[1,.9,.8],int:.7,el:20,turn:-60,soft:2}),lightNew('sun',{name:'Rim left',int:1.3,el:25,turn:-150,soft:2}),lightNew('sun',{name:'Rim right',col:[.75,.85,1],int:1.1,el:25,turn:150,soft:2})],
  'Sunset':()=>[lightNew('sun',{name:'Low sun',col:[1,.62,.35],int:1.3,el:10,turn:-70,soft:2}),lightNew('sky',{name:'Sky',col:[.55,.65,1],int:.4})]};
const lightMine=()=>{try{return JSON.parse(localStorage.getItem('gs.lightRigs')||'[]');}catch(e){return [];}};
const lightMineSave=a=>{try{localStorage.setItem('gs.lightRigs',JSON.stringify(a));}catch(e){toast('Could not save the rig.');}};
function lightRigOut(name){const b=lightBox();return {name,expo:lightRig().expo??1,lights:lightRig().lights.map(L=>Object.assign({},L,{id:undefined,rel:L.pos?L.pos.map((v,k)=>(v-b.c[k])/b.r):null,soft:L.type==='sun'?L.soft:(L.soft||0)/b.r,range:(L.range||b.r)/b.r}))};}
function lightRigIn(rec){const b=lightBox(),R=lightRig();R.lights=(rec.lights||[]).map(o=>lightNew(o.type||'sun',Object.assign({},o,{pos:o.rel?o.rel.map((v,k)=>b.c[k]+v*b.r):undefined,
    soft:o.type==='sun'?o.soft:(o.soft||0)*b.r,range:(o.range||3)*b.r}))).map(L=>{if(!L.pos)L.pos=lightStartPos(b);return L;});R.expo=rec.expo??1;R.sel=null;v3.dirty=true;}
function lightPresetRow(redraw){const mine=lightMine(),s=el('select',{id:'lPreset','aria-label':'Light rig'},el('option',{value:'',text:'Rigs…'}),
    el('optgroup',{label:'Built in'},...Object.keys(LIGHT_PRESETS).map(n=>el('option',{value:'b:'+n,text:n}))),
    ...(mine.length?[el('optgroup',{label:'Yours'},...mine.map((r,i)=>el('option',{value:'m:'+i,text:r.name})))]:[]));
  s.onchange=()=>{const v=s.value;if(!v)return;if(v.startsWith('b:')){const R=lightRig();R.lights=LIGHT_PRESETS[v.slice(2)]();R.sel=null;R.expo=1;}else lightRigIn(mine[+v.slice(2)]);redraw();toast('Light rig: '+s.selectedOptions[0].textContent+'.');};
  const save=el('button',{class:'btn sm',type:'button',id:'lSave',text:'Save rig…',onclick:()=>smAskName('Save light rig','My rig',name=>{const a=lightMine().filter(r=>r.name!==name);a.push(lightRigOut(name));lightMineSave(a);redraw();toast('Saved the rig “'+name+'”.');})});
  const del=el('button',{class:'btn sm',type:'button',id:'lDel',text:'Delete',title:'Delete the chosen rig of yours',onclick:()=>{const v=s.value;if(!v.startsWith('m:')){toast('Choose one of your rigs first.');return;}const a=lightMine();a.splice(+v.slice(2),1);lightMineSave(a);redraw();}});
  const exp=el('button',{class:'btn sm',type:'button',id:'lExport',text:'Export',onclick:()=>{const b=new Blob([JSON.stringify(lightRigOut('Light rig'),null,1)],{type:'application/json'});deliver('Light rig.json',b);}});
  const imp=el('button',{class:'btn sm',type:'button',id:'lImport',text:'Import',onclick:async()=>{const fs=await pickFiles('.json,application/json',false,'Light rig',['json']);const f=fs&&fs[0];if(!f)return;
    try{const r=JSON.parse(await f.text());if(!Array.isArray(r.lights))throw 0;lightRigIn(r);const a=lightMine();a.push(Object.assign(r,{name:r.name||baseName(f.name)}));lightMineSave(a);redraw();toast('Imported the rig.');}catch(e){toast('That file is not a light rig.');}}});
  return el('div',{class:'chips'},s,save,del,exp,imp);}

/* ---- the rig in the 3D view (3D Paint): your lights light the view live (no shadows there: bake Lighting for those) ---- */
function lightViewUniforms(){const s=v3s(),R=bakeCfg&&bakeCfg.rig;if(!R||(ui.mode==='bake'?!lpInstant():!s.rigLive))return {uVLN:{int:0}};
  const on=R.lights.filter(L=>L.on!==false&&L.type!=='sky').slice(0,4),A=new Float32Array(16),B=new Float32Array(16),Cc=new Float32Array(16),ex=R.expo??1;
  on.forEach((L,i)=>{const t={sun:0,point:1,spot:2}[L.type],d=lightAim(L);A.set([t,...(L.pos||[0,0,0])],i*4);B.set([...d,Math.cos((L.cone??35)/2*Math.PI/180)],i*4);Cc.set([...(L.col||[1,1,1]).map(x=>x*(L.int??1)*ex),L.range||1],i*4);});
  return {uVLN:{int:on.length},uVLA:{v4a:A},uVLB:{v4a:B},uVLC:{v4a:Cc}};}
/* the row in the 3D view's lighting settings: light the view with your rig, and open the rig */
function lightRigRow(){const s=v3s();return el('div',{class:'dlg-grid',id:'lRigRow'},el('div',{class:'sub',text:'Your lights'}),
  chk('l_live','Light the view with my light rig',!!s.rigLive,v=>{s.rigLive=v;if(v&&!lightRig().lights.length)lightAutoRig();v3.dirty=true;requestRender&&requestRender();}),
  el('button',{class:'btn sm',type:'button',id:'lOpen',text:'Lights…',title:'Add, move and set up your lights (the same rig the Lighting bake uses)',onclick:()=>lightDialog()}),
  el('p',{class:'note',text:'Up to four lights show in the view (no shadows there). The Lighting bake (Bake mesh maps) bakes them all, with shadows.'}));}
function lightDialog(){lightWin.open=true;const s=v3s();if(!s.rigLive){s.rigLive=true;}const body=lightTabPage(null,t=>el('p',{class:'note',text:t})),prevHist=edHist;edHist=lightHist;const unkey=lightHist?lightHist.bindKeys():()=>{};v3.dirty=true;requestRender&&requestRender();
  openDialog({title:'Lights',body:el('div',{class:'dlg-grid',id:'lightDlg'},body),float:true,okLabel:null,cancelLabel:'Close',onCancel(){lightWin.open=false;lightPageRedraw=null;if(lightHist)lightHist.commit();edHist=prevHist;unkey();v3.dirty=true;requestRender&&requestRender();}});}

/* ---- (0.95.4, Kenn: "when you add lights you can't even see them affecting anything") live preview of the Lighting bake ----
   While the Bake tab's Lighting page is open, any change to the rig (a light added, moved, recoloured, the exposure, the sky)
   starts a quick Lighting bake by itself: first a small rough one (few rays), then a sharper one, each thrown away when the rig
   changes again. The result is shown on the model (with its shadows) until the page is left. It never touches the real bakes. */
const LP_SIZES=[[256,4],[1024,0]];/* [picture size, ray cap (0 = the rig's own rays)] */
const lp={sig:'',done:'',t:0,prog:null,run:null,raw:null,view:null,pass:-1,ids:new WeakMap(),seq:0};
/* (0.95.8, Kenn: "the light bake preview is laggy") instant first: while the rig is being changed the model is lit live by the
   lights (no shadows, no waiting); the quick bake only starts once nothing has changed for half a second (and never mid-drag),
   then shows with its shadows, first rough then sharp */
const LP_IDLE=500;
const lpInstant=()=>lpvActive()&&!(lp.view&&lp.done===lp.sig&&lp.sig);
const lpOn=()=>!!(bakeCfg&&lightRig().live!==false);
function lpvActive(){if(ui.mode!=='bake'||!v3.on||!(bakeCfg.mapOpen&&bakeCfg.mapOpen.light)||!lpOn()||bk.uvCheck)return false;if(bk.show!=='material'&&bk.show!=='light')return false;
  const L=bkLow();return !!(L&&!L.noUV&&canFloat&&(lightRig().lights||[]).some(x=>x.on!==false));}
const lpId=o=>{if(!o)return 0;let i=lp.ids.get(o);if(!i){i=++lp.seq;lp.ids.set(o,i);}return i;};
function lpSig(){const R=lightRig(),s=v3s(),lo=bakeCfg.low||(s.model==='imported'?v3.imported:null);/* a built-in shape is made anew on every call: name it instead */return JSON.stringify([R.lights,R.expo,s.env,s.envRot,lo?lpId(lo):s.model,lpId(bakeCfg.high),lpId(bakeCfg.cage),bakeCfg.front,bakeCfg.back,bakeCfg.skip]);}
/* called every time the Bake tab's model is refreshed: start a preview when the rig changed */
function lightPreviewTick(){if(!lpvActive()){if(lp.prog)lp.prog.cancelled=true;return false;}
  const s=lpSig();if(s!==lp.sig){lp.sig=s;lp.pass=-1;if(lp.prog)lp.prog.cancelled=true;clearTimeout(lp.t);lp.t=setTimeout(()=>lightPreviewRun(0),LP_IDLE);lightPreviewNote();}
  return !!lp.view&&lp.done===lp.sig;}
async function lightPreviewRun(pass){if(!lpvActive())return;if(bk.busy||bk.regionBusy||lp.run||lgz.drag){clearTimeout(lp.t);lp.t=setTimeout(()=>lightPreviewRun(pass),250);return;}
  const sig=lp.sig,[sz,cap]=LP_SIZES[pass],size=Math.min(sz,Math.max(64,doc.w)),prog={cancelled:false,set(){},step(){}},L=bkLow();lp.prog=prog;
  const rig=JSON.parse(JSON.stringify(lightRig()));if(cap)for(const x of rig.lights)x.rays=Math.min(x.rays||12,x.type==='sky'?cap*2:cap);
  const job=(async()=>{const {low,high,cage}=bakePrep(L),C=bakeCfg;
    const hg=await bakeHG(L,high,low,()=>{},false,true);if(prog.cancelled)return null;
    const o={bevel:null,size,sizeH:size,ss:1,front:C.front*.02,back:C.back*.02,average:C.average,soften:C.soften||0,cage,match:C.match&&!!high,kinds:['light'],rays:C.rays,light:rig,
      aoDist:C.aoDist*.02,thickDist:C.thickDist*.02,pad:Math.max(2,Math.round((C.pad||8)*size/Math.max(1,doc.w))),dx:false,seed:1.7,hg,acc:{}};
    const res=await bakeRun(low,high,o,prog);for(const k in o.acc)if(!res||res[k]!==o.acc[k])disposeTarget(o.acc[k]);return res;})();
  lp.run=job;let res=null;try{res=await job;}catch(e){console.warn('Lighting preview:',e);}lp.run=null;if(lp.prog===prog)lp.prog=null;
  if(!res||!res.light){if(res)for(const k in res)disposeTarget(res[k]);return;}
  if(prog.cancelled||sig!==lp.sig){disposeTarget(res.light);return;}
  if(lp.raw)disposeTarget(lp.raw);lp.raw=res.light;lp.pass=pass;
  if(!lp.view||lp.view.w!==doc.w||lp.view.h!==doc.h){if(lp.view)disposeTarget(lp.view);lp.view=makeTarget(doc.w,doc.h,8,false);}
  copyScaled(lp.raw,lp.view);lp.done=sig;bk.dirty=true;v3.dirty=true;requestRender();lightPreviewNote();
  if(pass+1<LP_SIZES.length&&lpvActive()){clearTimeout(lp.t);lp.t=setTimeout(()=>{if(sig===lp.sig)lightPreviewRun(pass+1);},350);}}
/* the line under the switch: what the model shows right now */
function lightPreviewNote(){const n=document.getElementById('lPrevNote');if(n)n.textContent=lpNoteText();}
function lpNoteText(){return !lpOn()?'Off: bake Lighting to see the lights on the model.':lp.pass<0?'Live lights on the model (no shadows yet); the shadowed preview follows when you stop for a moment.':lp.pass>=0&&lp.pass<LP_SIZES.length-1?'Quick preview shown; a sharper one is on its way…':lp.view?'The model shows a quick bake of these lights, with shadows. Bake for the full-quality result.':'The model shows a quick bake of these lights while this page is open.';}
function lightPreviewFree(){if(lp.prog)lp.prog.cancelled=true;clearTimeout(lp.t);lp.sig='';lp.done='';lp.pass=-1;if(lp.raw){disposeTarget(lp.raw);lp.raw=null;}if(lp.view){disposeTarget(lp.view);lp.view=null;}}
/* a real bake waits for a preview that is running, and stops it */
async function lightPreviewStop(){if(lp.prog)lp.prog.cancelled=true;clearTimeout(lp.t);if(lp.run){try{await lp.run;}catch(e){}}lp.sig='';}

/* (0.95.8, Kenn) Delete removes the selected light, while the lights are being worked on (Bake tab's Lighting page, the Lights
   window, or right after a light was clicked in the view) */
function lightKeyDelete(e){if(e.key!=='Delete'&&e.key!=='Backspace')return false;if(isTypingTarget(e.target)||e.ctrlKey||e.metaKey||e.altKey)return false;
  const R=bakeCfg&&bakeCfg.rig;if(!R||!R.sel||!lgzActive())return false;const page=ui.mode==='bake'&&!!(bakeCfg.mapOpen&&bakeCfg.mapOpen.light);/* (0.97, no tabs) the Lighting settings are always on show: its preview and lights follow the Lighting tick */if(!(page||lightWin.open||lgz.picked))return false;
  if(!modal.hidden&&!lightWin.open)return false;const L=R.lights.find(x=>x.id===R.sel);if(!L)return false;
  e.preventDefault();e.stopImmediatePropagation();if(e.repeat)return true;R.lights=R.lights.filter(x=>x!==L);R.sel=null;lgz.picked=false;if(lightHist)lightHist.note();
  if(lightPageRedraw)lightPageRedraw();else if(typeof buildBakePanel==='function'&&ui.mode==='bake')buildBakePanel();v3.dirty=true;requestRender&&requestRender(true);toast('Deleted the light “'+L.name+'”.');return true;}
window.addEventListener('keydown',e=>{if(ui.mode==='p3d')return;/* 3D Paint's own key handler asks first */lightKeyDelete(e);},true);
