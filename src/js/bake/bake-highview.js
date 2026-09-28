/* ================= Bake tab: the high-poly in the 3D view, and C to step through the maps (0.26) =================
   Show the high-poly: Off, See-through (over the low-poly, to check they line up) or Only (the high-poly alone,
   in plain grey clay). It is sent to the graphics card only when first shown, in the low-poly's space (as the
   baker sees it). C (Shift+C backwards) steps what the model shows through the lit material, each baked map
   and the painted fixes. */
const bkHV={g:null,key:null};
const FS_BKHIGH=`in vec3 vP; in vec3 vN; in vec2 vT; in vec4 vTan; uniform vec3 uCamH; uniform float uAlpha; uniform vec3 uTint;
void main(){ vec3 N=normalize(vN),V=normalize(uCamH-vP); if(dot(N,V)<0.0) N=-N; float l=0.25+0.6*max(dot(N,normalize(vec3(0.4,0.8,0.5))),0.0)+0.15*max(dot(N,V),0.0); o=vec4(uTint*l,uAlpha); }`;
let P_BKHIGH=null;
function bkHighView(){const C=bakeCfg,low=v3.mesh;if(!C.high||!low)return null;const key=[C.high,low].join();if(bkHV.g&&bkHV.key===key)return bkHV.g;bkHighViewFree();
  const H=bakeAlign(C.high,low),n=H.pos.length/3,d=new Float32Array(n*6);for(let i=0;i<n;i++){d.set(H.pos.subarray(i*3,i*3+3),i*6);if(H.nrm)d.set(H.nrm.subarray(i*3,i*3+3),i*6+3);}
  const vaoH=gl.createVertexArray();gl.bindVertexArray(vaoH);const vb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,24,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,3,gl.FLOAT,false,24,12);for(const a of [2,3])gl.disableVertexAttribArray(a);
  const ib=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ib);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,H.idx instanceof Uint32Array?H.idx:new Uint32Array(H.idx),gl.STATIC_DRAW);gl.bindVertexArray(vao);
  bkHV.key=key;return bkHV.g={vao:vaoH,vb,ib,count:H.idx.length};}
function bkHighViewFree(){const g=bkHV.g;if(g){gl.deleteVertexArray(g.vao);gl.deleteBuffer(g.vb);gl.deleteBuffer(g.ib);}bkHV.g=null;bkHV.key=null;}
const bakeHighHidesLow=()=>ui.mode==='bake'&&bk.showHigh==='only'&&!!bakeCfg.high;
function bakeDrawHigh(common){if(ui.mode!=='bake'||!bk.showHigh||bk.showHigh==='off'||!bakeCfg.high)return;const g=bkHighView();if(!g)return;if(!P_BKHIGH)P_BKHIGH=prog3(VS_3D,FS_BKHIGH);
  const see=bk.showHigh==='over';if(see){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);}
  useProg(P_BKHIGH,Object.assign({},common,{uUseH:false,uCamH:v3Eye(),uAlpha:see?.45:1,uTint:see?[1,.72,.45]:[.82,.8,.78]}));gl.bindVertexArray(g.vao);gl.drawElements(gl.TRIANGLES,g.count,gl.UNSIGNED_INT,0);
  gl.bindVertexArray(vao);if(see){gl.depthMask(true);gl.disable(gl.BLEND);}}
/* C steps through what the model shows */
function bakeShowList(){const have=Object.keys(bk.res).filter(k=>k!=='mcurv'&&k!=='gcurv');return ['material',...have,...Object.keys(BK_PAINT).filter(k=>bk.maps[k])];}
function bakeCycleShow(dir){const L=bakeShowList();if(L.length<2){toast('Bake first: C steps through the baked maps on the model.');return;}const i=L.indexOf(bk.show);bk.show=L[(i+dir+L.length)%L.length];bk.dirty=true;v3.dirty=true;requestRender();
  if(typeof buildBakePanel==='function')buildBakePanel();toast('Showing: '+(bk.show==='material'?'the material (lit)':bk.show==='curv'?'Curvature':BAKE_NAMES[bk.show]||(BK_PAINT[bk.show]?BK_PAINT[bk.show].name+' map':bk.show)));}
window.addEventListener('keydown',e=>{if(ui.mode!=='bake'||(e.key!=='c'&&e.key!=='C')||e.ctrlKey||e.metaKey||e.altKey||isTypingTarget(e.target))return;e.preventDefault();e.stopImmediatePropagation();bakeCycleShow(e.shiftKey?-1:1);},true);
