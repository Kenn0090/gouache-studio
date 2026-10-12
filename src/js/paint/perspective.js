/* ================= Perspective guides (0.59, Kenn) =================
   One, two or three vanishing points with a horizon. The guides are drawn over the canvas, the points can be dragged, and strokes
   can snap to the guide lines (draw along a line towards a point and the stroke runs exactly on it). They belong to the document. */
const psp={lock:null};
const pspOn=()=>!!(doc.persp&&doc.persp.on&&doc.persp.vps&&doc.persp.vps.length);
function pspMake(n){const W=doc.w,H=doc.h,hy=H*.5,o={on:true,n,snap:true,show:true,lines:18};
  o.vps=n===1?[[W/2,hy]]:n===2?[[-W*.3,hy],[W*1.3,hy]]:[[-W*.3,hy],[W*1.3,hy],[W/2,-H*.9]];return o;}
const pspClone=p=>p?JSON.parse(JSON.stringify(p)):null;
function pspSet(next,label){const before=pspClone(doc.persp);doc.persp=next;const after=pspClone(next);
  pushUndo({label:label||'Perspective guides',refs:[],undo(){doc.persp=pspClone(before);drawXfOverlay();pspSync();},redo(){doc.persp=pspClone(after);drawXfOverlay();pspSync();}});drawXfOverlay();}
/* the lines of one point: spread over the angles that cover the canvas (all round when the point is inside it) */
function pspRays(vp,count){const W=doc.w,H=doc.h,[px,py]=vp,inside=px>=0&&px<=W&&py>=0&&py<=H,out=[];
  if(inside){for(let k=0;k<count;k++)out.push(k/count*Math.PI*2);return out;}
  const a=[[0,0],[W,0],[W,H],[0,H]].map(([x,y])=>Math.atan2(y-py,x-px)),base=Math.atan2(H/2-py,W/2-px);
  const rel=a.map(t=>{let d=t-base;while(d>Math.PI)d-=Math.PI*2;while(d<-Math.PI)d+=Math.PI*2;return d;}),lo=Math.min(...rel),hi=Math.max(...rel);
  for(let k=0;k<count;k++)out.push(base+lo+(hi-lo)*(k/Math.max(1,count-1)));return out;}
function perspOverlay(f){if(!pspOn()||doc.persp.show===false)return '';const P=doc.persp,R=Math.hypot(doc.w,doc.h)*3;let d='',h='',s='';
  P.vps.forEach(vp=>{for(const t of pspRays(vp,P.lines||18))d+='M'+f(vp)+'L'+f([vp[0]+Math.cos(t)*R,vp[1]+Math.sin(t)*R]);});
  if(P.vps.length>=2)h='M'+f([P.vps[0][0]-(P.vps[1][0]-P.vps[0][0])*R/1e3,P.vps[0][1]-(P.vps[1][1]-P.vps[0][1])*R/1e3])+'L'+f([P.vps[1][0]+(P.vps[1][0]-P.vps[0][0])*R/1e3,P.vps[1][1]+(P.vps[1][1]-P.vps[0][1])*R/1e3]);
  else h='M'+f([-R,P.vps[0][1]])+'L'+f([R,P.vps[0][1]]);
  s+='<path class="persp" d="'+d+'"/><path class="persp-h" d="'+h+'"/>';
  P.vps.forEach(vp=>{const p=scrPt(vp);s+='<circle class="persp-vp" cx="'+p[0]+'" cy="'+p[1]+'" r="7"/>';});return s;}
/* dragging a point */
function perspDown(e,ix,iy){if(!pspOn()||doc.persp.show===false||e.altKey||e.ctrlKey||e.metaKey||e.shiftKey)return false;const r=stage.getBoundingClientRect();
  for(let i=0;i<doc.persp.vps.length;i++){const p=scrPt(doc.persp.vps[i]);if(Math.hypot(e.clientX-r.left-p[0],e.clientY-r.top-p[1])<=11){ptr={mode:'persp',id:e.pointerId,i,before:pspClone(doc.persp)};return true;}}return false;}
function perspMove(x,y){const P=doc.persp,i=ptr.i;P.vps[i]=[Math.round(x),Math.round(y)];
  /* the horizon stays level between the first two points */
  if(P.n>=2&&i<2)P.vps[1-i]=[P.vps[1-i][0],P.vps[i][1]];drawXfOverlay();}
function perspUp(){const before=ptr.before,after=pspClone(doc.persp);ptr=null;
  pushUndo({label:'Move vanishing point',refs:[],undo(){doc.persp=pspClone(before);drawXfOverlay();pspSync();},redo(){doc.persp=pspClone(after);drawXfOverlay();pspSync();}});pspSync();}
/* strokes follow the guide lines: when the first few pixels point along a line to a vanishing point, the stroke is held on it */
function perspSnap(line,x,y,shift){if(shift||!pspOn()||doc.persp.snap===false||!line||!line.context||line.context.space!=='canvas')return null;
  if(line.pv===undefined){line.pv=null;line.pdec=false;}
  const dx=x-line.ox,dy=y-line.oy,len=Math.hypot(dx,dy);
  if(!line.pdec){if(len<5)return [x,y];let best=-1,bd=15;
    doc.persp.vps.forEach((vp,i)=>{const ux=vp[0]-line.ox,uy=vp[1]-line.oy,ul=Math.hypot(ux,uy);if(ul<1)return;const c=Math.abs((dx*ux+dy*uy)/(len*ul)),ang=Math.acos(Math.min(1,c))*180/Math.PI;if(ang<bd){bd=ang;best=i;}});
    line.pdec=true;line.pv=best>=0?best:null;}
  if(line.pv==null)return [x,y];
  const vp=doc.persp.vps[line.pv],ux=vp[0]-line.ox,uy=vp[1]-line.oy,ul=Math.hypot(ux,uy)||1,nx=ux/ul,ny=uy/ul,t=dx*nx+dy*ny;return [line.ox+nx*t,line.oy+ny*t];}
/* the window */
function pspSync(){const d=$('#pspBody');if(d&&typeof d._sync==='function')d._sync();}
function dlgPersp(){const P0=pspClone(doc.persp),cur=()=>doc.persp||{on:false,n:2,vps:[],snap:true,show:true,lines:18};
  const body=el('div',{class:'dlg-grid',id:'pspBody'}),draw=()=>{const P=cur(),on=pspOn();body.replaceChildren(
    el('div',{class:'frow'},el('label',{text:'Guides'}),seg([[0,'Off'],[1,'1 point'],[2,'2 points'],[3,'3 points']],on?P.n:0,v=>{v=+v;if(!v)pspSet(Object.assign(pspClone(P)||pspMake(2),{on:false}));else pspSet(P&&P.vps&&P.vps.length&&P.n===v?Object.assign(pspClone(P),{on:true}):pspMake(v));draw();},'Guides')),
    ...(on?[chk('pspShow','Show the guides',P.show!==false,v=>{pspSet(Object.assign(pspClone(P),{show:v}));}),
      chk('pspSnap','Strokes snap to the guide lines (draw towards a point, Shift for straight lines instead)',P.snap!==false,v=>{pspSet(Object.assign(pspClone(P),{snap:v}));}),
      makeSlider({id:'pspLines',label:'Lines',min:4,max:48,step:1,value:P.lines||18,onInput:v=>{doc.persp.lines=Math.round(v);drawXfOverlay();},onChange:v=>{pspSet(Object.assign(pspClone(doc.persp),{lines:Math.round(v)}));}}).el,
      ...P.vps.map((vp,i)=>el('div',{class:'frow'},el('label',{text:'Point '+(i+1)}),...['x','y'].map((k,j)=>{const inp=el('input',{type:'number',class:'num',value:String(Math.round(vp[j])),'aria-label':'Point '+(i+1)+' '+k,onchange(){const n=pspClone(doc.persp);n.vps[i][j]=+inp.value||0;if(n.n>=2&&i<2&&j===1)n.vps[1-i][1]=n.vps[i][1];pspSet(n,'Move vanishing point');draw();}});return inp;}),el('span',{class:'dim',text:'px'}))),
      el('div',{class:'frow'},el('button',{class:'btn sm',text:'Reset points',onclick:()=>{pspSet(pspMake(cur().n));draw();}})),
      el('p',{class:'note',text:'Drag a point on the canvas to move it. The horizon between the first two points stays level.'})]:[el('p',{class:'note',text:'Guides help you draw boxes, streets and rooms in perspective. Pick how many vanishing points you need.'})]));};
  body._sync=draw;draw();openDialog({title:'Perspective guides',body,cancelLabel:'Close',okLabel:null});}
