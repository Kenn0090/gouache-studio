/* ================= Photo tab: Spot removal =================
   Click a blemish, dust spot or small thing to take it out: the patch is copied from a nearby clean place (chosen automatically,
   and you can drag it somewhere else) and either healed to the light around it or cloned exactly. Positions are on the original. */
ph.sp={tool:false,sel:null,heal:true,size:.025,fe:40,op:100};
function phSpots(){const s=phS();if(!s)return [];if(!s.spots)s.spots=[];return s.spots;}
/* find a clean place to copy from: around the spot, the patch whose average colour is closest to the ring around it and which has little detail */
function phSpotSource(x,y,r){const p=phP();if(!p||!p.psrc)return [Math.min(.98,x+r*3),y];
  if(!p._sm||p._sm.src!==p.psrc)p._sm=Object.assign(phSmall(p.psrc,300),{src:p.psrc});const {w,h,g}=p._sm,ar=p.pw/p.ph;
  const px=(nx,ny)=>[Math.round(nx*(w-1)),Math.round(ny*(h-1))],rr=Math.max(1.5,r*h);
  const stats=(cx,cy,r0,r1)=>{let n=0,s=0,q=0;const [X,Y]=px(cx,cy);for(let j=Math.floor(-r1);j<=r1;j++)for(let i=Math.floor(-r1);i<=r1;i++){const d=Math.hypot(i,j);if(d<r0||d>r1)continue;const xx=X+i,yy=Y+j;if(xx<0||yy<0||xx>=w||yy>=h)return null;const v=g[yy*w+xx];s+=v;q+=v*v;n++;}return n?{m:s/n,v:q/n-(s/n)*(s/n)}:null;};
  const ring=stats(x,y,rr,rr*1.7);let best=null,bc=1e9;
  for(let a=0;a<16;a++)for(const k of [2.4,3.4,4.6]){const ang=a/16*Math.PI*2,cx=x+Math.cos(ang)*r*k/ar,cy=y+Math.sin(ang)*r*k;if(cx<.02||cx>.98||cy<.02||cy>.98)continue;const c=stats(cx,cy,0,rr);if(!c)continue;
    const cost=(ring?Math.abs(c.m-ring.m)*3:0)+Math.sqrt(Math.max(0,c.v))*4+k*.01;if(cost<bc){bc=cost;best=[cx,cy];}}
  return best||[Math.min(.98,x+r*3/ar),y];}
function phSpotAdd(ix,iy){const M=phMapper();if(!M)return;const list=phSpots();if(list.length>=16){toast('Sixteen spots at most on one photo.');return;}
  const sp=M.fwd(ix/doc.w,iy/doc.h),r=ph.sp.size,src=phSpotSource(sp[0],sp[1],r),q={id:'s'+Date.now().toString(36),x:sp[0],y:sp[1],r,sx:src[0],sy:src[1],heal:ph.sp.heal,fe:ph.sp.fe,op:ph.sp.op};
  list.push(q);ph.sp.sel=q.id;phCommit('Spot removal');phBuildPanel();phDirty();drawXfOverlay();}
function phSpotDel(id){const list=phSpots(),i=list.findIndex(q=>q.id===id);if(i<0)return;list.splice(i,1);if(ph.sp.sel===id)ph.sp.sel=null;phCommit('Delete spot');phBuildPanel();phDirty();drawXfOverlay();}
function phSpotTool(on){ph.sp.tool=on;if(on)ph.lm.tool=null;stage.classList.toggle('phpicking',on);phBuildPanel();drawXfOverlay();}
function phSpotPanel(){const list=phSpots(),S=ph.sp,body=[];
  body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm'+(S.tool?' primary':''),text:S.tool?'Done':'Remove spots…',title:'Click a spot on the picture to take it out',onclick:()=>phSpotTool(!S.tool)}),
    el('button',{class:'btn sm'+(S.heal?' primary':''),text:'Heal',title:'Copy and match the light around',onclick:()=>{S.heal=true;const q=list.find(x=>x.id===S.sel);if(q){q.heal=true;phCommit('Heal');phDirty();}phBuildPanel();}}),
    el('button',{class:'btn sm'+(!S.heal?' primary':''),text:'Clone',title:'Copy exactly',onclick:()=>{S.heal=false;const q=list.find(x=>x.id===S.sel);if(q){q.heal=false;phCommit('Clone');phDirty();}phBuildPanel();}})));
  body.push(phLGen(null,()=>S.size*100,v=>{S.size=v/100;const q=list.find(x=>x.id===S.sel);if(q)q.r=S.size;},'Size',.5,12,.1,v=>v.toFixed(1)),phLGen(null,()=>S.fe,v=>{S.fe=v;const q=list.find(x=>x.id===S.sel);if(q)q.fe=v;},'Feather',0,100,1),phLGen(null,()=>S.op,v=>{S.op=v;const q=list.find(x=>x.id===S.sel);if(q)q.op=v;},'Opacity',0,100,1));
  if(!list.length)body.push(el('p',{class:'note',text:'Press “Remove spots…”, then click a blemish. Drag the dashed circle to pick where it copies from.'}));
  list.forEach((q,i)=>body.push(el('div',{class:'phlmrow'+(q.id===S.sel?' on':'')},el('button',{class:'phlmname',text:'Spot '+(i+1)+' · '+(q.heal?'Heal':'Clone'),onclick:()=>{S.sel=q.id;S.size=q.r;phBuildPanel();drawXfOverlay();}}),el('button',{class:'btn sm',text:'×','aria-label':'Delete spot',onclick:()=>phSpotDel(q.id)}))));
  return body;}
function phSpotOverlay(f){if(ui.mode!=='photo'||ph.crop||!phP())return '';const list=phSpots(),M=phMapper();if(!M||(!ph.sp.tool&&!list.length)||!ph.sp.tool)return '';const W=doc.w,H=doc.h,ar=M.ar;
  const toSp=(px,py)=>[px/ar+.5,py+.5],P=sp=>{const u=M.inv(sp[0],sp[1]);return f([u[0]*W,u[1]*H]);},ring=(c,r)=>{let d='';const C=[(c[0]-.5)*ar,c[1]-.5];for(let k=0;k<=36;k++){const t=k/36*Math.PI*2;d+=(k?'L':'M')+P(toSp(C[0]+Math.cos(t)*r,C[1]+Math.sin(t)*r));}return d;};let s='';
  for(const q of list){const on=q.id===ph.sp.sel;s+='<path class="phlm'+(on?'':' dim')+'" d="'+ring([q.x,q.y],q.r)+'"/>';
    if(on){s+='<path class="phlm" style="stroke-dasharray:3 3" d="'+ring([q.sx,q.sy],q.r)+'M'+P([q.x,q.y])+'L'+P([q.sx,q.sy])+'"/>';for(const c of [[q.x,q.y],[q.sx,q.sy],[q.x+q.r/ar,q.y]]){const [x,y]=P(c).split(' ').map(Number);s+='<circle class="phlmh" cx="'+x+'" cy="'+y+'" r="5"/>';}}}
  return s;}
function phSpotDown(e,ix,iy){const S=ph.sp;if(!S.tool||ph.crop||e.button!==0)return false;const M=phMapper();if(!M)return false;const W=doc.w,H=doc.h,r=stage.getBoundingClientRect(),list=phSpots(),ar=M.ar;
  const scr=sp=>{const u=M.inv(sp[0],sp[1]);return scrPt([u[0]*W,u[1]*H]);};let hit=null,hq=null,bd=14;
  for(const q of list){const pts=[['c',[q.x,q.y]],['r',[q.x+q.r/ar,q.y]]];if(q.id===S.sel)pts.push(['s',[q.sx,q.sy]]);
    for(const [k,pt] of pts){const sp=scr(pt),d=Math.hypot(e.clientX-r.left-sp[0],e.clientY-r.top-sp[1]);if(d<bd){bd=d;hit=k;hq=q;}}}
  if(!hit){for(const q of list){const sp=scr([q.x,q.y]),sr=scr([q.x+q.r/ar,q.y]),rad=Math.hypot(sr[0]-sp[0],sr[1]-sp[1]),d=Math.hypot(e.clientX-r.left-sp[0],e.clientY-r.top-sp[1]);if(d<=rad){hit='c';hq=q;break;}}}
  if(!hit){phSpotAdd(ix,iy);return true;}
  S.sel=hq.id;ptr={mode:'phsp',id:e.pointerId,kind:hit,q:hq,M,sp0:M.fwd(ix/W,iy/H),x0:hq.x,y0:hq.y,sx0:hq.sx,sy0:hq.sy};phBuildPanel();return true;}
function phSpotMove(ix,iy){const t=ptr,q=t.q,M=t.M,sp=M.fwd(ix/doc.w,iy/doc.h),dx=sp[0]-t.sp0[0],dy=sp[1]-t.sp0[1],ar=M.ar;
  if(t.kind==='c'){q.x=t.x0+dx;q.y=t.y0+dy;q.sx=t.sx0+dx;q.sy=t.sy0+dy;}else if(t.kind==='s'){q.sx=t.sx0+dx;q.sy=t.sy0+dy;}else{q.r=Math.max(.004,Math.min(.3,Math.hypot((sp[0]-q.x)*ar,sp[1]-q.y)));ph.sp.size=q.r;}
  phDirty();drawXfOverlay();}
function phSpotUp(){ptr=null;phCommit('Move spot');phSidecarSoon();phBuildPanel();drawXfOverlay();}
