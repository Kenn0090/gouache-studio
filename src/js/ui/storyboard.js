/* ---------- Storyboard template (0.57) ----------
   Kenn: a storyboard template that people can see when they start a new document. The page gets a locked "Storyboard frames" layer
   (panel frames, numbers and caption lines) and an empty "Sketch" layer on top, so drawing never moves the frames. */
const SB_LAYOUTS=[['6','6 panels',2,3],['4','4 panels',2,2],['8','8 panels',2,4],['3','3 wide panels',1,3],['2','2 wide panels',1,2],['1','1 big panel',1,1]];
const SB_ASPECTS=[['16:9','16:9 (video)',16/9],['2.39','2.39:1 (cinema)',2.39],['4:3','4:3 (TV)',4/3],['1:1','1:1 (square)',1],['9:16','9:16 (vertical)',9/16]];
const SB_DEFAULT={layout:'6',aspect:'16:9',captions:true,header:true};
/* the panel boxes of a page: grid, shrunk to fit, so the frames always sit inside the paper */
function sbBoxes(W,H,o){const lay=SB_LAYOUTS.find(l=>l[0]===o.layout)||SB_LAYOUTS[0],asp=(SB_ASPECTS.find(a=>a[0]===o.aspect)||SB_ASPECTS[0])[2],cols=lay[2],rows=lay[3],
    m=Math.round(Math.min(W,H)*.05),gap=Math.round(Math.min(W,H)*.03),headH=o.header?Math.round(H*.07):0,capK=o.captions?.26:0;
  const aw=W-2*m-(cols-1)*gap,ah=H-2*m-headH-(rows-1)*gap;
  /* panel width pw: height = pw/asp, plus the caption strip (a fraction of the panel height) */
  let pw=aw/cols;const need=pw/asp*(1+capK)*rows;if(need>ah)pw=ah/rows/(1+capK)*asp;
  const ph=pw/asp,ch=ph*capK,gw=cols*pw+(cols-1)*gap,gh=rows*(ph+ch)+(rows-1)*gap,x0=(W-gw)/2,y0=m+headH+(ah-gh)/2,out=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)out.push({x:x0+c*(pw+gap),y:y0+r*(ph+ch+gap),w:pw,h:ph,capH:ch});
  return {boxes:out,m,headH,lineW:Math.max(1.5,Math.min(W,H)/450)};}
/* draws the frames on a canvas of any size (the thumbnail in the New document window uses the same function) */
function sbDraw(c,o){o=Object.assign({},SB_DEFAULT,o||{});const W=c.width,H=c.height,x=c.getContext('2d'),B=sbBoxes(W,H,o),ink='#2b2b2b',soft='#9a9a9a';x.clearRect(0,0,W,H);
  x.lineWidth=B.lineW;x.strokeStyle=ink;x.fillStyle=ink;
  if(o.header){const fs=Math.max(8,B.headH*.42),y=B.m+B.headH*.62;x.font=Math.round(fs)+'px sans-serif';x.textBaseline='alphabetic';
    for(const [lab,fx,fw] of [['Project',B.m,.4],['Scene',B.m+(W-2*B.m)*.46,.2],['Page',B.m+(W-2*B.m)*.72,.12],['Date',B.m+(W-2*B.m)*.86,.14]]){x.fillStyle=ink;x.fillText(lab,fx,y);const tw=x.measureText(lab).width+fs*.4;x.strokeStyle=soft;x.beginPath();x.moveTo(fx+tw,y+2);x.lineTo(fx+(W-2*B.m)*fw-fs*.5,y+2);x.stroke();}
    x.strokeStyle=ink;}
  B.boxes.forEach((b,i)=>{x.strokeStyle=ink;x.lineWidth=B.lineW*1.4;x.strokeRect(b.x,b.y,b.w,b.h);x.lineWidth=B.lineW;
    const fs=Math.max(7,Math.min(b.h*.1,B.m*.7));x.font='bold '+Math.round(fs)+'px sans-serif';x.fillStyle=ink;x.textBaseline='top';x.fillText(String(i+1),b.x+fs*.45,b.y+b.h+fs*.2-(o.captions?0:fs*2));
    if(o.captions&&b.capH>6){x.strokeStyle=soft;const n=3,top=b.y+b.h+b.capH*.22,step=(b.capH*.78)/n;for(let k=0;k<n;k++){const yy=top+step*(k+.8);x.beginPath();x.moveTo(b.x+fs*1.6,yy);x.lineTo(b.x+b.w,yy);x.stroke();}}});
  return c;}
/* put the template into the document that was just made: a locked frames layer and a Sketch layer above it */
function sbApply(o){const c=document.createElement('canvas');c.width=doc.w;c.height=doc.h;sbDraw(c,o);const id=c.getContext('2d').getImageData(0,0,doc.w,doc.h);
  const F=newLayerObj('Storyboard frames');insertNode(F,doc.root);drawRawInto(F.target,{w:doc.w,h:doc.h,data:id.data,bits:8},false);F.lockAll=true;
  const S=newLayerObj('Sketch');insertNode(S,doc.root);selectOnly(S);if(typeof renderLayers==='function')renderLayers();changedAll();requestRender(true);}
