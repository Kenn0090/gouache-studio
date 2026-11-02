/* Shift-click joins the previous brush endpoint. Shift-drag locks horizontal/vertical.
   Anchors belong to a document, target, channel, tool and (in 3D) camera projection. */
let brushLineAnchor=null;
function brushLineContext(et,space){return {root:doc.root,layer:et.L,target:et.L.target||et.t||null,mask:!!et.isMask,map:doc.map,tool:ui.tool,space,
  mesh:space==='mesh'?v3.mesh:null,camera:space==='mesh'?JSON.stringify([v3.cam,v3s().uvs,v3s().fov,v3s().ortho,document.getElementById('v3Hit')?.clientWidth,document.getElementById('v3Hit')?.clientHeight]):null};}
function brushLineSame(a,b){return a&&Object.keys(b).every(k=>a[k]===b[k]);}
function brushLineStart(et,x,y,p,e,space){const context=brushLineContext(et,space),old=brushLineAnchor,joined=!!(e.shiftKey&&brushLineSame(old?.context,context));
  return {context,ox:x,oy:y,x:joined?old.x:x,y:joined?old.y:y,p:joined?old.p:p,joined,axis:null};}
/* Substance Painter's straight line: Shift draws it, Shift+Ctrl snaps its angle to 5 degree steps (from where the line starts) */
function brushLineAngle(line,x,y){const sx=line.x,sy=line.y,dx=x-sx,dy=y-sy,len=Math.hypot(dx,dy);if(len<1e-6)return [x,y];const a=Math.round(Math.atan2(dy,dx)/(Math.PI/36))*(Math.PI/36);return [sx+Math.cos(a)*len,sy+Math.sin(a)*len];}
function brushLineSnap(line,x,y,shift,ctrl){if(shift&&ctrl&&line&&line.context&&line.context.space!=='canvas-persp')return brushLineAngle(line,x,y);{const ps=typeof perspSnap==='function'?perspSnap(line,x,y,shift):null;if(ps)return ps;}if(!shift){line.axis=null;return [x,y];}const dx=x-line.ox,dy=y-line.oy;
  if(!line.axis&&Math.hypot(dx,dy)>2)line.axis=Math.abs(dx)>=Math.abs(dy)?'x':'y';
  return line.axis==='x'?[x,line.oy]:line.axis==='y'?[line.ox,y]:[line.ox,line.oy];}
function brushLineRemember(line,x,y,p){if(line)brushLineAnchor={context:line.context,x,y,p};}
