/* ================= Polygon fill (0.95.5, Kenn) =================
   A 3D Paint tool like Substance Painter's: click (or drag over) the model to fill whole polygons at once, by
   Face (the quad), Triangle, Loop (a ring of quads) or UV island. It fills the selected layer with the brush colour (and the
   material brush's other maps); on a mask it fills white, Alt+click black. One undo step per click or drag. */
const PF_KINDS=[['face','Face'],['tri','Triangle'],['loop','Loop'],['island','UV island']];
const pf=(()=>{const d={kind:'face'};try{Object.assign(d,JSON.parse(localStorage.getItem('gs.pfill')||'{}'));}catch(e){}return d;})();
const pfSave=()=>{try{localStorage.setItem('gs.pfill',JSON.stringify({kind:pf.kind}));}catch(e){}};
let pfDrag=null;
const pfOn=()=>ui.tool==='pfill'&&ui.mode==='p3d';
/* the triangles one seed grows into (the drawn mesh's triangles, subdivided ones included) */
function pfGrow1(s,t){const own=pf.kind==='tri'?[t]:sel3Grow(s.O,t,pf.kind,s.pos,s.R),out=[];for(const x of own)for(let j=0;j<s.f;j++)out.push(x*s.f+j);return out;}
/* (0.95.7, Kenn: "use Polygon fill with symmetry") with mirror X/Y/Z or radial on, the polygons on the other sides fill too:
   the clicked point is mirrored and the triangle nearest to each copy is grown the same way */
function pfGrow(s){let out=pfGrow1(s,s.t);for(const t of pfMirTris(s))if(t!==s.t)out=out.concat(pfGrow1(s,t));return out;}
function pfHitPoint(s){const P=s.O.pos,I=s.O.idx,t=s.t,p=[0,0,0];for(let k=0;k<3;k++){const a=I[t*3+k]*3;p[0]+=P[a]/3;p[1]+=P[a+1]/3;p[2]+=P[a+2]/3;}
  if(s.eye&&s.dir){const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3,e1=[P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],e2=[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]],
    n=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]],dn=n[0]*s.dir[0]+n[1]*s.dir[1]+n[2]*s.dir[2];
    if(Math.abs(dn)>1e-12){const d=(n[0]*(P[a]-s.eye[0])+n[1]*(P[a+1]-s.eye[1])+n[2]*(P[a+2]-s.eye[2]))/dn;return [s.eye[0]+s.dir[0]*d,s.eye[1]+s.dir[1]*d,s.eye[2]+s.dir[2]*d];}}
  return p;}
/* squared distance from point p to triangle t (closest point on a triangle, Ericson) */
function pfTriDist2(P,I,t,p){const a=I[t*3]*3,b=I[t*3+1]*3,c=I[t*3+2]*3,A=[P[a],P[a+1],P[a+2]],B=[P[b],P[b+1],P[b+2]],C=[P[c],P[c+1],P[c+2]];
  const sub=(u,v)=>[u[0]-v[0],u[1]-v[1],u[2]-v[2]],dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2],ab=sub(B,A),ac=sub(C,A),ap=sub(p,A);let q;
  const d1=dot(ab,ap),d2=dot(ac,ap);
  if(d1<=0&&d2<=0)q=A;else{const bp=sub(p,B),d3=dot(ab,bp),d4=dot(ac,bp);
    if(d3>=0&&d4<=d3)q=B;else{const vc=d1*d4-d3*d2;
      if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);q=[A[0]+ab[0]*v,A[1]+ab[1]*v,A[2]+ab[2]*v];}
      else{const cp=sub(p,C),d5=dot(ab,cp),d6=dot(ac,cp);
        if(d6>=0&&d5<=d6)q=C;else{const vb=d5*d2-d1*d6;
          if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);q=[A[0]+ac[0]*w,A[1]+ac[1]*w,A[2]+ac[2]*w];}
          else{const va=d3*d6-d5*d4;
            if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));q=[B[0]+(C[0]-B[0])*w,B[1]+(C[1]-B[1])*w,B[2]+(C[2]-B[2])*w];}
            else{const den=1/(va+vb+vc),v=vb*den,w=vc*den;q=[A[0]+ab[0]*v+ac[0]*w,A[1]+ab[1]*v+ac[1]*w,A[2]+ab[2]*v+ac[2]*w];}}}}}}
  const d=sub(p,q);return dot(d,d);}
function pfMirTris(s){if(typeof mir3On!=='function'||!mir3On())return [];const L=mir3Mats();if(L.length<2)return [];
  const p=pfHitPoint(s),P=s.O.pos,I=s.O.idx,out=[];
  for(let k=1;k<L.length;k++){const M=L[k],q=[M[0]*p[0]+M[4]*p[1]+M[8]*p[2]+M[12],M[1]*p[0]+M[5]*p[1]+M[9]*p[2]+M[13],M[2]*p[0]+M[6]*p[1]+M[10]*p[2]+M[14]];
    let best=-1,bd=1e30;for(let t=s.R.start;t<s.R.start+s.R.count;t++){const d=pfTriDist2(P,I,t,q);if(d<bd){bd=d;best=t;}}
    if(best>=0&&!out.includes(best))out.push(best);}
  return out;}
/* Alt + click (no drag) on a mask fills black; Alt + drag still turns the view */
function pfDown(hit,e){if(!pfOn()||e.button!==0||v3.drag||e.ctrlKey||e.metaKey)return false;if(e.altKey&&!pfMaskTarget())return false;
  const s=sel3HitSeed(hit,e);if(!s){return false;}e.preventDefault();try{hit.setPointerCapture(e.pointerId);}catch(er){}
  pfDrag={id:e.pointerId,m:s.m,O:s.O,f:s.f,R:s.R,tris:new Set(pfGrow(s)),seeds:new Set([s.t]),black:e.altKey,altPend:e.altKey,x:e.clientX,y:e.clientY,nav:e.altKey?v3NavOf(hit,e):null,root:doc.root};if(!e.altKey)pfPreview();return true;}
const pfMaskTarget=()=>{const et=typeof editTarget==='function'?editTarget():null;return !!(et&&et.isMask);};
function pfBusy(){return !!pfDrag;}
function pfMove(hit,e){const d=pfDrag;if(!d||e.pointerId!==d.id)return;if(!e.buttons){pfUp(e);return;}
  if(d.altPend){if(Math.hypot(e.clientX-d.x,e.clientY-d.y)<4)return;pfDrag=null;sel3HoverClear();v3.drag={x:d.x,y:d.y,how:d.nav||'turn',id:d.id,x0:d.x,y0:d.y,alt:true};return;}const s=sel3HitSeed(hit,e);if(!s||s.m!==d.m||d.seeds.has(s.t))return;d.seeds.add(s.t);for(const t of pfGrow(s))d.tris.add(t);pfPreview();}
function pfPreview(){const d=pfDrag,H=sel3HoverState;if(!d)return;H.mesh=d.m;H.root=d.root;H.tris=[...d.tris];H.upload=true;v3.dirty=true;requestRender();}
/* hovering shows what a click would fill */
function pfHover(hit,e){if(!pfOn()||e.buttons||!modal.hidden||v3.drag){return false;}pfHover.q={clientX:e.clientX,clientY:e.clientY,hit};if(pfHover.f)return true;
  pfHover.f=requestAnimationFrame(()=>{pfHover.f=0;const q=pfHover.q;if(q&&pfOn()&&!pfDrag)pfHoverRun(q.hit,q);});return true;}
function pfHoverRun(hit,e){hit.style.cursor='crosshair';const s=sel3HitSeed(hit,e),H=sel3HoverState;
  if(!s){if(H.tris){H.tris=null;v3.dirty=true;requestRender();}return true;}const key=s.t+':'+pf.kind+':'+(typeof mir3On==='function'&&mir3On()?JSON.stringify(mir3):'');if(H.pfKey===key&&H.tris)return true;H.pfKey=key;H.mesh=s.m;H.root=doc.root;H.tris=pfGrow(s);H.upload=true;v3.dirty=true;requestRender();return true;}
function pfUp(e){const d=pfDrag;if(!d||e&&e.pointerId!==undefined&&e.pointerId!==d.id)return;pfDrag=null;sel3HoverClear();if(e&&e.type==='pointercancel')return;pfApply(d.m,[...d.tris],d.black);}
/* fill those triangles: their UV shapes become a temporary selection, then the layer (or mask) is filled through it */
function pfApply(m,tris,black){if(!tris.length)return;if(stroke||preview){toast('Finish the current edit first.');return;}
  if(typeof fillNoMask==='function'&&fillNoMask())return;const et=needTarget();if(!et)return;if(typeof lockStop==='function'&&lockStop(et))return;
  const cov=sel3Draw(m,tris),keep=selState(),keepT=sel.t;
  try{sel.t=cov;sel.active=true;sel.quick=false;sel.bb=fullRect();
    const g=black?0:1,c=et.isMask?[g,g,g,1]:[...ui.fg,1],oth=fillOthers(et,et.isMask?null:mapBrushColor);fillSel(et,c,'Polygon fill',oth);}
  finally{sel.t=keepT;setSelState(keep);release(cov);}
  v3.mapsDirty=true;v3.dirty=true;requestRender(true);}
/* the tool's options (in the Brush panel's place) */
function pfPanel(box){$('#brushTitle').textContent='Polygon fill';
  box.append(el('div',{class:'sub',text:'Fill by'}),seg(PF_KINDS,pf.kind,v=>{pf.kind=v;pfSave();sel3HoverState.pfKey=null;buildBrushPanel();},'Polygon fill by'),
    el('p',{class:'note',text:'Click the model to fill a whole '+(PF_KINDS.find(k=>k[0]===pf.kind)||PF_KINDS[0])[1].toLowerCase()+' with the brush colour; drag to fill several. With mirror or radial symmetry on, the matching polygons on the other sides fill too. On a mask it fills white; Alt+click fills black. Only the active texture set takes paint.'}));}
/* the tool button (3D Paint only) */
(function pfButton(){const bar=$('#tools');if(!bar)return;const b=el('button',{class:'tool','data-tool':'pfill',title:'Polygon fill','aria-label':'Polygon fill','aria-pressed':'false'});
  b.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 18 9 5l11 4-4 11z"/><path d="M9 5l7 15M4 18l16-9" opacity=".45"/></svg>';b.addEventListener('click',()=>setTool('pfill'));
  const after=bar.querySelector('.tool[data-tool="smudge"]');if(after&&after.nextSibling)bar.insertBefore(b,after.nextSibling);else bar.append(b);})();
