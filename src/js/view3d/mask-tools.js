/* ================= Mask mode tools =================
   In mask mode (Alt+click a mask) nothing paints until Paint is pressed in the mask bar, like Substance Painter.
   Box, Lasso and Polygon draw a shape: on the flat canvas they are the usual selection tools (drag inside a
   selection to move it); on the model the shape selects the parts of the model you can see under it, and a drag
   inside the shape moves it (the selection follows when you let go). Fill white / Fill black then fill the
   selection, and painting stays inside it. Shift adds to the selection, Ctrl takes away. */
const mk3={tool:null,pts:null,draw:null,move:null,el:null};
const MK_TOOLS=[['paint','Paint'],['box','Box'],['lasso','Lasso'],['poly','Polygon'],['id','ID colour']];
const maskToolsOn=()=>!!(ui.viewMask&&doc.active&&doc.active.mask&&ui.mode!=='anim'&&ui.mode!=='bake');
const maskPaintLocked=()=>maskToolsOn()&&mk3.tool!=='paint';
function maskTool(t){if(mk3.tool===t)t=null;if(mk3.tool==='id')idSelCommit();mk3.tool=t;mk3.draw=null;mk3.move=null;
  if(t==='paint'){if(!MESH_TOOLS.includes(ui.tool))setTool('brush');if(v3.on||ui.mode==='p3d')v3.paintOn=true;}
  else if(t==='box'){ui.marquee='rect';setTool('marquee');}
  else if(t==='lasso'){ui.lasso='free';setTool('lasso');}
  else if(t==='poly'){ui.lasso='poly';setTool('lasso');}
  maskBarSync();mk3Overlay();}
function mk3Reset(){if(mk3.tool==='id')idSelCommit();mk3.tool=null;mk3.pts=null;mk3.draw=null;mk3.move=null;mk3Overlay();}
const mk3Hint=()=>({paint:'Paint white to show, black to hide.',box:'Drag over the model to select what you see. Drag inside the box to move it. Shift adds, Ctrl removes.',
  lasso:'Draw around what you want. Drag inside the shape to move it. Shift adds, Ctrl removes.',poly:'Click the corners; double-click (or click the first point, or press Enter) to close.',id:'Click the model (or the flat texture) to pick colours of the ID map.'})[mk3.tool]||'Press Paint to paint the mask, or Box, Lasso or Polygon to select parts of the model.';
function mk3InPoly(x,y,P){let c=false;for(let i=0,j=P.length-2;i<P.length;j=i,i+=2){const xi=P[i],yi=P[i+1],xj=P[j],yj=P[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c;}return c;}
/* pointer on the 3D view in mask mode: true when the mask tools took it */
function mk3Down(hit,e){
  if(!mk3.tool||mk3.tool==='paint'){if(!mk3.tool&&v3CanPaint()){toast('Press Paint in the mask bar to paint the mask.');return true;}return false;}
  if(mk3.tool==='id'){idSelPick3(hit,e);return true;}
  if(!sel.active)mk3.pts=null;const [x,y]=meshPt(hit,e);
  if(mk3.pts&&!mk3.draw&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey&&mk3InPoly(x,y,mk3.pts)){mk3.move={id:e.pointerId,x,y,pts0:mk3.pts.slice()};return true;}
  const mode=e.shiftKey?'add':(e.ctrlKey||e.metaKey)?'sub':'new';
  if(mk3.tool==='poly'){const d=mk3.draw;
    if(!d)mk3.draw={kind:'poly',pts:[x,y],cur:[x,y],mode};
    else{const P=d.pts;if(e.detail>=2||(P.length>=6&&Math.hypot(x-P[0],y-P[1])<8)){mk3Finish();return true;}P.push(x,y);}
    mk3Overlay();return true;}
  mk3.draw={kind:mk3.tool,id:e.pointerId,x0:x,y0:y,pts:[x,y],mode};mk3Overlay();return true;}
const mk3Busy=()=>!!(mk3.draw||mk3.move);
function mk3Move(hit,e){const [x,y]=meshPt(hit,e);
  if(mk3.move){if(e.pointerId!==mk3.move.id)return;const dx=x-mk3.move.x,dy=y-mk3.move.y;mk3.pts=mk3.move.pts0.map((v,i)=>v+(i&1?dy:dx));mk3Overlay();return;}
  const d=mk3.draw;if(!d)return;
  if(d.kind==='poly'){d.cur=[x,y];mk3Overlay();return;}
  if(e.pointerId!==d.id)return;
  if(d.kind==='box')d.pts=[d.x0,d.y0,x,d.y0,x,y,d.x0,y];else{const n=d.pts.length;if(Math.hypot(x-d.pts[n-2],y-d.pts[n-1])>=2)d.pts.push(x,y);}
  mk3Overlay();}
function mk3Up(e){if(mk3.move&&(!e||e.pointerId===mk3.move.id)){const m=mk3.move;mk3.move=null;if(mk3.pts&&(mk3.pts[0]!==m.pts0[0]||mk3.pts[1]!==m.pts0[1]))mk3Project('new','Move selection');return;}
  const d=mk3.draw;if(d&&d.kind!=='poly'&&(!e||e.pointerId===d.id))mk3Finish();}
function mk3Finish(){const d=mk3.draw;mk3.draw=null;if(!d){mk3Overlay();return;}const P=d.pts;
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(let i=0;i<P.length;i+=2){x0=Math.min(x0,P[i]);x1=Math.max(x1,P[i]);y0=Math.min(y0,P[i+1]);y1=Math.max(y1,P[i+1]);}
  if(P.length<6||x1-x0<3||y1-y0<3){if(d.mode==='new'){deselect();mk3.pts=null;}mk3Overlay();return;}
  mk3.pts=P.slice();mk3Project(d.mode,d.kind==='box'?'Box select':d.kind==='poly'?'Polygon select':'Lasso select');}
/* the shape on the screen → the parts of the model visible under it → a selection on the texture */
const FS_MK3A=`uniform sampler2D uSrc; void main(){ float a=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0).a; o=vec4(vec3(a),1.0); }`;
let P_MK3A=null;
function mk3Project(mode,label){const hit=document.getElementById('v3Hit');if(!hit||!mk3.pts||selBusy())return;
  const r=hit.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height)),sp=meshSpace(w,h);if(!sp)return;
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),P=mk3.pts;x.fillStyle='#fff';x.beginPath();x.moveTo(P[0],P[1]);for(let i=2;i<P.length;i+=2)x.lineTo(P[i],P[i+1]);x.closePath();x.fill();
  /* the canvas's top row lands in the texture's first row, which is the bottom of the view: the same way up as the pointer */
  const tmp=makeTarget(w,h,8,false);gl.bindTexture(gl.TEXTURE_2D,tmp.tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,c);copyScaled(tmp,sp.buf);disposeTarget(tmp);
  const stm=st3.mode;st3.mode='off';try{sp.sync();}finally{st3.mode=stm;}
  if(!P_MK3A)P_MK3A=program(FS_MK3A);const t=acquireS();run(P_MK3A,t,{uSrc:strokeT.tex});
  applyShape(t,mode,fullRect(),label);release(t);clearTarget(strokeT);v3.dirty=true;requestRender(true);mk3Overlay();}
/* the dashed outline over the view */
function mk3Overlay(){const hit=document.getElementById('v3Hit');let c=mk3.el;const d=mk3.draw,P=d?d.pts:(sel.active?mk3.pts:null);
  if(!hit||!maskToolsOn()||!P){if(c)c.hidden=true;return;}
  if(!c||!c.isConnected){c=mk3.el=el('canvas',{class:'v3mk','aria-hidden':'true'});hit.parentNode.insertBefore(c,hit.nextSibling);}
  const r=hit.getBoundingClientRect(),pr=hit.parentNode.getBoundingClientRect(),w=Math.max(1,Math.round(r.width)),h=Math.max(1,Math.round(r.height));
  if(c.width!==w||c.height!==h){c.width=w;c.height=h;}c.hidden=false;c.style.left=(r.left-pr.left)+'px';c.style.top=(r.top-pr.top)+'px';c.style.width=w+'px';c.style.height=h+'px';
  const x=c.getContext('2d');x.clearRect(0,0,w,h);const pts=d&&d.kind==='poly'?[...P,...d.cur]:P;x.beginPath();x.moveTo(pts[0],h-pts[1]);for(let i=2;i<pts.length;i+=2)x.lineTo(pts[i],h-pts[i+1]);if(!(d&&d.kind==='poly'))x.closePath();
  x.lineWidth=1.5;x.setLineDash([6,4]);x.strokeStyle='#000';x.stroke();x.lineDashOffset=5;x.strokeStyle='#fff';x.stroke();}
window.addEventListener('keydown',e=>{if(!mk3.draw||isTypingTarget(e.target))return;
  if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();mk3.draw=null;mk3Overlay();}
  else if(e.key==='Enter'&&mk3.draw.kind==='poly'){e.preventDefault();e.stopImmediatePropagation();mk3Finish();}},true);

/* ---- ID colour selection (like Substance Painter's and Marmoset's): pick colours on the texture set's baked ID map;
   where the ID map has one of them the mask turns white, elsewhere black. Live while you change it: more colours,
   Tolerance (how close a colour counts), Softness (the edge) and Invert. It is a row of the mask (ID colour), so you can
   come back to it; changes become one undo step after a pause. ---- */
const FS_IDSEL=`uniform sampler2D uId; uniform vec3 uCols[8]; uniform int uN; uniform float uTol; uniform float uSoft; uniform int uInv; uniform vec2 uSz;
void main(){ vec4 c=texture(uId,gl_FragCoord.xy/uSz); float m=0.0;
  if(c.a>0.01){ vec3 q=c.rgb/c.a; float d=10.0; for(int i=0;i<8;i++){ if(i>=uN) break; d=min(d,length(q-uCols[i])); } m=1.0-smoothstep(uTol,uTol+uSoft+1e-4,d); }
  if(uInv==1) m=1.0-m; o=vec4(vec3(m),1.0); }`;
let P_IDSEL=null;
const idSelMap=()=>doc.meshMaps&&doc.meshMaps.id;
/* the ID colour row of the active layer's mask: the selected one, else the top one (made on the first pick) */
function idSelRowOf(L,make){if(!L||!L.mask&&!make)return null;const S=L.mask&&L.mask.stack||[],cur=msRowOf(ui.msSel);
  if(cur&&cur.kind==='id'&&ui.msSel.L===L)return cur;for(let i=S.length-1;i>=0;i--)if(S[i].kind==='id')return S[i];
  if(!make)return null;const p=L.idSel?JSON.parse(JSON.stringify(L.idSel)):null;return msAdd(L,'id',p?{p}:null,'Add ID colour to the mask');}
function idSelOf(L){const r=idSelRowOf(L,false);return r?r.p:(L.idSel||{cols:[],tol:.08,soft:.04,inv:false});}
function idSelEdit(fn){const L=doc.active;if(!L)return;if(!idSelMap()){toast('Bake an ID map and send it to 3D Paint first (Bake tab › ID).');return;}
  const r=idSelRowOf(L,true);if(!r)return;msEdit(L,r,x=>fn(x.p),'ID colour selection');}
function idSelCommit(){if(typeof msCommit==='function')msCommit();}
/* a pick on the ID map at texture position (x, y) adds its colour */
function idSelPickAt(x,y){const M=idSelMap();if(!M){toast('Bake an ID map and send it to 3D Paint first (Bake tab › ID).');return;}
  const px=clamp(Math.floor(x),0,M.w-1),py=clamp(Math.floor(y),0,M.h-1),d=captureRegionNow(M,px,py,1,1).data,a=(d[3]||255)/255,c=[d[0]/255/a,d[1]/255/a,d[2]/255/a];
  if(d[3]<3){toast('No ID colour there.');return;}
  idSelEdit(S=>{if(!S.cols.some(q=>Math.hypot(q[0]-c[0],q[1]-c[1],q[2]-c[2])<.02)){S.cols.push(c);if(S.cols.length>8)S.cols.shift();}});maskBarSync();}
function idSelPick3(hit,e){const p=v3PickAt(hit,e);if(!p||!p.uv){toast('Click on the model.');return;}const M=idSelMap();if(!M)return idSelPickAt(0,0);idSelPickAt(p.uv[0]*M.w,p.uv[1]*M.h);}
/* the second row of the mask bar while ID is on */
function idSelRow(){const L=doc.active,S=idSelOf(L),has=!!idSelMap();
  if(!has)return el('div',{class:'maskbar-row'},el('span',{class:'maskbar-n',text:'This texture set has no baked ID map yet. Bake one in the Bake tab (ID) and press Send to 3D Paint.'}));
  const sw=S.cols.map((c,i)=>el('button',{class:'idsw',style:'background:'+toHex(c),title:'Remove this colour','aria-label':'Remove colour '+toHex(c),onclick:()=>{idSelEdit(S=>S.cols.splice(i,1));maskBarSync();}}));
  return el('div',{class:'maskbar-row'},el('span',{class:'maskbar-n',text:S.cols.length?'Colours:':'Click the model to pick ID colours.'}),...sw,
    makeSlider({id:'idTol',label:'Tolerance',min:0,max:.6,step:.01,value:S.tol,fmt:pct,onInput:v=>idSelEdit(S=>{S.tol=v;})}).el,
    makeSlider({id:'idSoft',label:'Softness',min:0,max:.3,step:.01,value:S.soft,fmt:pct,onInput:v=>idSelEdit(S=>{S.soft=v;})}).el,
    chk('idInv','Invert',!!S.inv,v=>idSelEdit(S=>{S.inv=v;})));}
