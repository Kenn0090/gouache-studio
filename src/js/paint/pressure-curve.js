/* ================= Pressure curve graph (0.65.1) =================
   Shows how pen pressure (across) turns into brush strength (up), and lets you drag the middle of the curve: up makes the
   pen feel softer (light pressure already gives a lot), down makes it firmer. Double-click puts it back to a straight line.
   It sets brush.curve (-1 firm … 0 straight … 1 soft), the same value as the Curve slider under it. */
function pcGraph(){const W=132,box=el('div',{class:'pcgraph'}),cv=el('canvas',{id:'bCurveGraph',width:W*2,height:W*2,title:'Drag the middle of the curve. Double-click to make it straight.','aria-label':'Pressure curve'});cv.style.width=cv.style.height=W+'px';
  const yOf=c=>Math.pow(.5,Math.pow(2,-c*1.6));
  const draw=()=>{const g=cv.getContext('2d'),S=W*2,cs=getComputedStyle(document.documentElement),line=cs.getPropertyValue('--line-2').trim()||'#444',acc=cs.getPropertyValue('--accent').trim()||'#e8a24a',muted=cs.getPropertyValue('--muted').trim()||'#888';
    g.clearRect(0,0,S,S);g.lineWidth=2;g.strokeStyle=line;g.strokeRect(1,1,S-2,S-2);for(let i=1;i<4;i++){g.beginPath();g.moveTo(i*S/4,0);g.lineTo(i*S/4,S);g.moveTo(0,i*S/4);g.lineTo(S,i*S/4);g.stroke();}
    g.strokeStyle=muted;g.setLineDash([6,6]);g.beginPath();g.moveTo(0,S);g.lineTo(S,0);g.stroke();g.setLineDash([]);
    g.strokeStyle=acc;g.lineWidth=4;g.beginPath();for(let i=0;i<=64;i++){const x=i/64,y=Math.pow(x,Math.pow(2,-(brush.curve||0)*1.6));i?g.lineTo(x*S,S-y*S):g.moveTo(0,S);}g.stroke();
    const hy=yOf(brush.curve||0);g.fillStyle=acc;g.beginPath();g.arc(S/2,S-hy*S,9,0,7);g.fill();};
  const setY=y=>{y=clamp(y,.04,.96);const gg=Math.log(y)/Math.log(.5),c=clamp(-Math.log2(gg)/1.6,-1,1);brush.curve=Math.round(c*100)/100;brushEdited('curve');draw();const s=document.getElementById('bCurve');if(s&&s._gsSlider)s._gsSlider.set(brush.curve);};
  const pt=e=>{const r=cv.getBoundingClientRect();return 1-(e.clientY-r.top)/r.height;};
  let drag=false;cv.addEventListener('pointerdown',e=>{drag=true;cv.setPointerCapture(e.pointerId);setY(pt(e));e.preventDefault();});
  cv.addEventListener('pointermove',e=>{if(drag)setY(pt(e));});cv.addEventListener('pointerup',()=>{drag=false;});cv.addEventListener('pointercancel',()=>{drag=false;});
  cv.addEventListener('dblclick',()=>{brush.curve=0;brushEdited('curve');draw();const s=document.getElementById('bCurve');if(s&&s._gsSlider)s._gsSlider.set(0);});
  box.append(cv,el('span',{class:'note',text:'Pressure → strength'}));draw();box.redraw=draw;return box;}
