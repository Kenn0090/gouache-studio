/* ================= Bake tab: fitting the high-poly, bake groups, explode and moving the models (0.96.6, Kenn) =================
   "My high-poly OBJ comes in tiny: scale it so it matches." "Move the low-poly or high-poly with a gizmo in case I need to explode the bake."
   "Bake groups like Marmoset, for people who keep one mesh but want the bakes separated into groups."
   - Match size: the high-poly is scaled (about the files' shared origin, so a cm-vs-m export lines up) until its size matches the low-poly's.
   - Bake groups: each low-poly triangle and each high-poly triangle gets a group; rays only find the high-poly of their own group
     (the same mechanism as the old "Match parts by name"). Groups come from part names (_low / _high), from materials, or by hand.
   - Explode: the groups are spread apart in the view for checking (the bake is the same, as each group only sees its own high-poly).
   - Move: arrows on the low-poly or the high-poly move it; the bake uses where the high-poly sits relative to the low-poly.
   Positions are in the low-poly's view space (centred, about 2 units across). */
const BG_MODES=[['off','Off (everything sees everything)'],['name','By name (_low / _high)'],['material','By material'],['hand','By hand…']];
function bgCfg(){const C=bakeCfg;if(C.groupMode==null)C.groupMode=C.match?'name':'off';if(!C.off)C.off={low:[0,0,0],high:[0,0,0]};if(!(C.hiScale>0))C.hiScale=1;if(!C.groupsHand)C.groupsHand={low:{},high:{}};C.match=C.groupMode!=='off';return C;}
const bgMode=()=>bgCfg().groupMode;
/* everything that changes where things sit or which group they are in */
function bgSig(){const C=bgCfg();return JSON.stringify([C.groupMode,C.hiScale,C.off,C.explode?1:0,C.groupMode==='hand'?C.groupsHand:0]);}
const bgBase=n=>partBase(n);
/* the groups of the low-poly: one id per triangle, and the names shown for them */
function bgLowGroups(L){const C=bgCfg(),T=L.idx.length/3,tri=new Uint32Array(T),mode=C.groupMode;
  if(mode==='material'){const names=(L.matNames||['default']).map(bgBase),ids=new Map();names.forEach(n=>{if(!ids.has(n))ids.set(n,ids.size);});for(let t=0;t<T;t++)tri[t]=ids.get(names[L.triMat?L.triMat[t]:0]||names[0])||0;return {tri,names:[...ids.keys()]};}
  const parts=L.partNames||['default'],base=parts.map(bgBase),ids=new Map();base.forEach(n=>{if(!ids.has(n))ids.set(n,ids.size);});
  const byPart=parts.map((p,i)=>mode==='hand'&&C.groupsHand.low[p]!=null?+C.groupsHand.low[p]:ids.get(base[i])+1);
  for(let t=0;t<T;t++)tri[t]=byPart[L.triPart?L.triPart[t]:0]||0;return {tri,names:[...ids.keys()]};}
/* the high-poly's group per triangle (9999 = no match: no ray finds it) */
function bgHighGroups(H,L){const C=bgCfg(),T=H.idx.length/3,out=new Float32Array(T),mode=C.groupMode;
  if(mode==='material'){const low=(L.matNames||['default']).map(bgBase),ids=new Map();low.forEach(n=>{if(!ids.has(n))ids.set(n,ids.size);});
    const hm=(H.matNames||[]).map(bgBase),hp=(H.partNames||[]).map(bgBase);
    for(let t=0;t<T;t++){const m=H.triMat?hm[H.triMat[t]]:null,p=H.triPart?hp[H.triPart[t]]:null;out[t]=ids.has(m)?ids.get(m):ids.has(p)?ids.get(p):9999;}return out;}
  const lowParts=L.partNames||['default'],lb=lowParts.map(bgBase),ids=new Map();lb.forEach(n=>{if(!ids.has(n))ids.set(n,ids.size+1);});
  const hp=H.partNames||['default'],gid=hp.map(p=>mode==='hand'&&C.groupsHand.high[p]!=null?+C.groupsHand.high[p]:ids.has(bgBase(p))?(()=>{/* the group the same-named low part is in */const i=lb.indexOf(bgBase(p));const lp=lowParts[i];return mode==='hand'&&C.groupsHand.low[lp]!=null?+C.groupsHand.low[lp]:ids.get(bgBase(p));})():9999);
  for(let t=0;t<T;t++)out[t]=gid[H.triPart?H.triPart[t]:0];return out;}
/* explode: each group's sideways step, from the low-poly's group boxes */
function bgExplode(L,lg){const C=bgCfg();if(!C.explode||C.groupMode==='off')return null;const B=new Map();
  for(let t=0;t<lg.tri.length;t++){const g=lg.tri[t];let b=B.get(g);if(!b)B.set(g,b=[1e9,-1e9]);for(let k=0;k<3;k++){const x=L.pos[L.idx[t*3+k]*3];if(x<b[0])b[0]=x;if(x>b[1])b[1]=x;}}
  const gs=[...B.keys()].sort((a,b)=>a-b),gap=.25;let x=0;const at=new Map();for(const g of gs){const b=B.get(g);at.set(g,x-b[0]);x+=b[1]-b[0]+gap;}
  const mid=x/2;for(const g of gs)at.set(g,at.get(g)-mid);return at;}
/* the high-poly placed for the bake (relative to the low-poly) or for the view (where it is shown) */
function bgPlaceHigh(H,L,view){const C=bgCfg(),k=C.hiScale||1,ls=L.xf.s,lc=L.xf.ctr,o=view?C.off.high:[0,1,2].map(a=>C.off.high[a]-C.off.low[a]);
  const ex=view&&C.explode&&C.groupMode!=='off'?bgExplode(L,bgLowGroups(L)):null,hg=ex?bgHighGroups(H,L):null;
  if(k===1&&!o[0]&&!o[1]&&!o[2]&&!ex)return H;const pos=new Float32Array(H.pos.length),vg=ex?new Float32Array(H.pos.length/3):null;
  if(ex)for(let t=0;t<hg.length;t++)for(let j=0;j<3;j++)vg[H.idx[t*3+j]]=hg[t];
  for(let i=0;i<pos.length;i+=3){const e=ex?(ex.get(vg[i/3])||0):0;for(let a=0;a<3;a++){const orig=H.pos[i+a]/ls+lc[a];pos[i+a]=(orig*k-lc[a])*ls+o[a]+(a===0?e:0);}}
  return Object.assign({},H,{pos});}
/* the low-poly as shown (moved and exploded); the bake itself uses the original */
const bgShown={src:null,sig:null,m:null};
function bgLowShown(L){const C=bgCfg(),o=C.off.low,ex=C.explode&&C.groupMode!=='off';if(!L||(!o[0]&&!o[1]&&!o[2]&&!ex))return L;
  const sig=bgSig();if(bgShown.src===L&&bgShown.sig===sig)return bgShown.m;const lg=ex?bgLowGroups(L):null,at=ex?bgExplode(L,lg):null,vg=ex?new Float32Array(L.pos.length/3):null;
  if(ex)for(let t=0;t<lg.tri.length;t++)for(let j=0;j<3;j++)vg[L.idx[t*3+j]]=lg.tri[t];
  const pos=new Float32Array(L.pos.length);for(let i=0;i<pos.length;i+=3){const e=ex?(at.get(vg[i/3])||0):0;for(let a=0;a<3;a++)pos[i+a]=L.pos[i+a]+o[a]+(a===0?e:0);}
  const m=Object.assign({},L,{pos,bgOf:L});for(const k in m)if(k[0]==='_')delete m[k];bgShown.src=L;bgShown.sig=sig;bgShown.m=m;return m;}
/* after a change: the view and the high-poly's search tree follow */
function bgChanged(){bk.hgKey=null;if(typeof bkHighViewFree==='function')bkHighViewFree();bakeSyncMesh();v3.dirty=true;requestRender();}
/* Match size: the high-poly's size (in its file's units) made equal to the low-poly's */
function bgMatchSize(){const C=bgCfg(),L=bkLow(),H=C.high;if(!H||!L){toast('Load a high-poly first.');return;}
  const size=m=>{let mn=[1e30,1e30,1e30],mx=[-1e30,-1e30,-1e30];for(let i=0;i<m.pos.length;i+=3)for(let a=0;a<3;a++){const v=m.pos[i+a]/m.xf.s+m.xf.ctr[a];if(v<mn[a])mn[a]=v;if(v>mx[a])mx[a]=v;}return Math.max(mx[0]-mn[0],mx[1]-mn[1],mx[2]-mn[2])||1;};
  const k=size(L)/size(H);C.hiScale=k;bgChanged();if(typeof buildBakePanel==='function')buildBakePanel();toast('High-poly scaled ×'+(k>=10||k<.1?k.toPrecision(3):k.toFixed(3))+' to match the low-poly’s size.');}
/* how far apart the two sizes are, for a hint */
function bgSizeHint(){const C=bgCfg(),L=bkLow(),H=C.high;if(!H||!L||!L.xf||!H.xf)return '';const r=(L.xf.s?1/L.xf.s:1)/((H.xf.s?1/H.xf.s:1)*C.hiScale);return r>3||r<1/3?'The high-poly is about '+(r>1?Math.round(r)+'× smaller':Math.round(1/r)+'× bigger')+' than the low-poly. Press Match size.':'';}

/* ---- the controls in the Bake tab's Models section ---- */
function bgControls(redraw){const C=bgCfg();const sel=el('select',{id:'bkGroups','aria-label':'Bake groups'},...BG_MODES.map(([v,l])=>el('option',{value:v,text:l})));sel.value=C.groupMode;
  sel.onchange=()=>{C.groupMode=sel.value;C.match=C.groupMode!=='off';bgChanged();redraw();if(C.groupMode==='hand')dlgBakeGroups();};
  const hint=bgSizeHint();
  return [el('div',{class:'frow'},el('label',{for:'bkGroups',text:'Bake groups',title:'Like Marmoset: each group of the low-poly is only baked from its own high-poly parts'}),sel),
    el('div',{class:'chips'},
      C.groupMode==='hand'?el('button',{class:'btn sm',id:'bkGroupsEdit',text:'Groups…',onclick:dlgBakeGroups}):'',
      C.groupMode!=='off'?el('button',{class:'btn sm'+(C.explode?' on':''),id:'bkExplode','aria-pressed':String(!!C.explode),text:C.explode?'Put back':'Explode',title:'Spread the groups apart in the view to check them (the bake is the same)',onclick:()=>{C.explode=!C.explode;bgChanged();redraw();}}):'',
      el('button',{class:'btn sm',id:'bkMatchSize',text:'Match size',disabled:!C.high,title:'Scale the high-poly so its size matches the low-poly (for exports in different units)',onclick:()=>{bgMatchSize();redraw();}}),
      C.hiScale!==1?el('span',{class:'note',id:'bkScaleNote',text:'High-poly ×'+(+C.hiScale.toPrecision(4))}):'',
      el('button',{class:'btn sm'+(bmv.target==='low'?' on':''),id:'bkMoveLow',text:'Move low',title:'Arrows on the low-poly: drag one to move it',onclick:()=>{bmv.target=bmv.target==='low'?null:'low';redraw();bmvDraw();}}),
      el('button',{class:'btn sm'+(bmv.target==='high'?' on':''),id:'bkMoveHigh',text:'Move high',disabled:!C.high,title:'Arrows on the high-poly: drag one to move it',onclick:()=>{bmv.target=bmv.target==='high'?null:'high';redraw();bmvDraw();}}),
      (C.off.low.some(Boolean)||C.off.high.some(Boolean)||C.hiScale!==1)?el('button',{class:'btn sm',id:'bkPlaceReset',text:'Reset',title:'Back to where the files put them, at their own size',onclick:()=>{C.off={low:[0,0,0],high:[0,0,0]};C.hiScale=1;bgChanged();redraw();}}):''),
    hint?el('p',{class:'note',id:'bkSizeHint',text:hint}):''];}
/* By hand: a group number for every low-poly part and every high-poly part */
function dlgBakeGroups(){const C=bgCfg(),L=bkLow(),H=C.high;const lp=L.partNames||['default'],hp=(H&&H.partNames)||[];
  const lg=bgLowGroups(Object.assign({},L));const defLow=p=>{const i=lp.indexOf(p);return C.groupsHand.low[p]!=null?C.groupsHand.low[p]:lg.tri.length?(()=>{const b=bgBase(p),names=[...new Set(lp.map(bgBase))];return names.indexOf(b)+1;})():1;};
  const defHigh=p=>{if(C.groupsHand.high[p]!=null)return C.groupsHand.high[p];const i=lp.map(bgBase).indexOf(bgBase(p));return i>=0?defLow(lp[i]):0;};
  const num=(side,p,v)=>{const inp=el('input',{type:'number',min:0,max:99,step:1,value:String(v),'aria-label':'Group of '+p,class:'bgnum'});inp.addEventListener('change',()=>{C.groupsHand[side][p]=Math.max(0,Math.round(+inp.value||0));});return el('div',{class:'frow'},el('span',{text:p}),inp);};
  const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Give each part a group number. Low-poly parts are only baked from high-poly parts with the same number. 0 = left out.'}),
    el('div',{class:'sub',text:'Low-poly parts'}),...lp.map(p=>num('low',p,defLow(p))),
    ...(hp.length?[el('div',{class:'sub',text:'High-poly parts'}),...hp.map(p=>num('high',p,defHigh(p)))]:[el('p',{class:'note',text:'Load a high-poly to group its parts.'})]));
  openDialog({title:'Bake groups',body,resizable:true,okLabel:'Done',onOk(){C.groupMode='hand';C.match=true;bgChanged();if(typeof buildBakePanel==='function')buildBakePanel();}});}

/* ---- the move gizmo in the Bake tab's view ---- */
const bmv={target:null,el:null,hover:null,drag:null};
const BMV_COL=['#e5533d','#5fbf45','#4d8fe8'];
function bmvCentre(){const C=bgCfg(),L=bkLow();if(!L)return null;const m=bmv.target==='high'?(C.high?bgPlaceHigh(bakeAlign(C.high,L),L,true):null):bgLowShown(L);if(!m)return null;
  let mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];const step=Math.max(3,Math.floor(m.pos.length/3/20000)*3);for(let i=0;i<m.pos.length;i+=step)for(let a=0;a<3;a++){const v=m.pos[i+a];if(v<mn[a])mn[a]=v;if(v>mx[a])mx[a]=v;}
  return [0,1,2].map(a=>(mn[a]+mx[a])/2);}
function bmvGeom(hit){if(ui.mode!=='bake'||!bmv.target||!v3.on||!hit)return null;const r=hit.getBoundingClientRect(),w=r.width,h=r.height;if(w<4)return null;
  const c=bmv.drag?bmv.drag.c:(bmv.c||(bmv.c=bmvCentre()));if(!c)return null;const {VP,eye}=v3ViewProj(w,h),len=Math.hypot(eye[0]-c[0],eye[1]-c[1],eye[2]-c[2])*.16;
  const pr=p=>{const x=VP[0]*p[0]+VP[4]*p[1]+VP[8]*p[2]+VP[12],y=VP[1]*p[0]+VP[5]*p[1]+VP[9]*p[2]+VP[13],ww=VP[3]*p[0]+VP[7]*p[1]+VP[11]*p[2]+VP[15];if(ww<=1e-5)return null;return [(x/ww*.5+.5)*w,(1-(y/ww*.5+.5))*h];};
  const p0=pr(c);if(!p0)return null;return {c,len,w,h,p0,tips:[0,1,2].map(a=>pr(c.map((v,i)=>v+(i===a?len:0))))};}
function bmvDraw(){const hit=document.getElementById('v3Hit');let cv=bmv.el;const G=bmvGeom(hit);if(!G){if(cv)cv.hidden=true;return;}
  if(!cv||!cv.isConnected){cv=bmv.el=el('canvas',{class:'v3gz','aria-hidden':'true'});hit.parentNode.insertBefore(cv,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),dpr=window.devicePixelRatio||1,W=Math.round(G.w*dpr),H=Math.round(G.h*dpr);
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H;}cv.hidden=false;Object.assign(cv.style,{left:(r.left-pr.left)+'px',top:(r.top-pr.top)+'px',width:G.w+'px',height:G.h+'px'});
  const x=cv.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,G.w,G.h);const on=bmv.drag?bmv.drag.a:bmv.hover;
  for(let a=0;a<3;a++){const t=G.tips[a];if(!t)continue;x.strokeStyle=on===a?'#ffd24a':BMV_COL[a];x.fillStyle=x.strokeStyle;x.lineWidth=on===a?4:3;x.beginPath();x.moveTo(G.p0[0],G.p0[1]);x.lineTo(t[0],t[1]);x.stroke();
    const ang=Math.atan2(t[1]-G.p0[1],t[0]-G.p0[0]);x.beginPath();x.moveTo(t[0]+Math.cos(ang)*10,t[1]+Math.sin(ang)*10);x.lineTo(t[0]+Math.cos(ang+2.5)*9,t[1]+Math.sin(ang+2.5)*9);x.lineTo(t[0]+Math.cos(ang-2.5)*9,t[1]+Math.sin(ang-2.5)*9);x.fill();}
  x.fillStyle='#fff';x.beginPath();x.arc(G.p0[0],G.p0[1],4,0,7);x.fill();x.font='12px sans-serif';x.fillText(bmv.target==='high'?'High-poly':'Low-poly',G.p0[0]+8,G.p0[1]-8);}
const bmvMouse=(hit,e)=>{const r=hit.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
function bmvPick(G,m){for(let a=0;a<3;a++)if(G.tips[a]&&pgzDist(m,G.p0,G.tips[a])<8)return a;return null;}
/* grabbing an arrow comes before turning the view */
function bmvDown(e){const hit=document.getElementById('v3Hit');if(e.button!==0||e.altKey||!hit||e.target!==hit)return;const G=bmvGeom(hit);if(!G)return;const a=bmvPick(G,bmvMouse(hit,e));if(a==null)return;
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();const C=bgCfg(),d=[G.tips[a][0]-G.p0[0],G.tips[a][1]-G.p0[1]],l2=d[0]*d[0]+d[1]*d[1]||1;
  bmv.drag={a,m0:bmvMouse(hit,e),d,l2,len:G.len,c:G.c.slice(),v0:C.off[bmv.target][a],big:(bmv.target==='high'?(C.high?C.high.tris:0):bkLow().tris)>300000};
  const move=ev=>{const D=bmv.drag;if(!D)return;const m=bmvMouse(hit,ev),t=((m[0]-D.m0[0])*D.d[0]+(m[1]-D.m0[1])*D.d[1])/D.l2,v=D.v0+t*D.len;C.off[bmv.target][D.a]=v;D.c=G.c.map((q,i)=>i===D.a?q+(v-D.v0):q);
      if(!D.big&&!D.raf)D.raf=requestAnimationFrame(()=>{D.raf=0;bgChanged();});bmvDraw();};
  const up=()=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);bmv.drag=null;bmv.c=null;bgChanged();bmvDraw();if(typeof buildBakePanel==='function')buildBakePanel();};
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);bmvDraw();}
function bmvHover(e){const hit=document.getElementById('v3Hit');if(bmv.drag||!hit||e.target!==hit)return;const G=bmvGeom(hit);const a=G?bmvPick(G,bmvMouse(hit,e)):null;if(a!==bmv.hover){bmv.hover=a;bmvDraw();}if(a!=null)hit.style.cursor='grab';}
window.addEventListener('pointerdown',e=>{if(ui.mode==='bake'&&bmv.target)bmvDown(e);},true);
window.addEventListener('pointermove',e=>{if(ui.mode==='bake'&&bmv.target&&!e.buttons)bmvHover(e);},true);
{const d3=draw3D;draw3D=function(){d3();if(ui.mode==='bake'&&bmv.target){if(!bmv.drag)bmv.c=null;bmvDraw();}else if(bmv.el)bmv.el.hidden=true;};}
