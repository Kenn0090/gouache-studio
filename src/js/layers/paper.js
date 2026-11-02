/* ================= Paper (0.86) =================
   A paper layer is an ordinary pixel layer that sits at the bottom, drawn by a shader (colour, tooth lit from the top left, and for notebooks the
   printed lines). The layer remembers which paper it is (n.paper = {t, sc, relief, lines}), so it can be changed later, and the Mixing brushes read
   the same paper to let paint catch in the dips and skip the peaks (Paper tooth). */
const FS_PAPER=PAPER_GLSL+`
uniform int uT; uniform float uSc; uniform float uRelief; uniform int uLines; uniform vec2 uSize;
vec3 papCol(vec2 p,float h){ vec3 c;
  if(uT==0) c=vec3(.985,.985,.975);
  else if(uT<=3) c=vec3(.975,.965,.91);
  else if(uT==4) c=vec3(.955,.945,.90);
  else if(uT==5) c=vec3(.965,.955,.925);
  else if(uT==6) c=vec3(.955,.94,.90);
  else if(uT==7) c=mix(vec3(.68,.50,.30),vec3(.80,.62,.40),clamp(h,0.0,1.0));
  else if(uT==8) c=vec3(.925,.90,.83);
  else if(uT==9) c=mix(vec3(.70,.56,.40),vec3(.77,.62,.45),h);
  else if(uT==10){ c=mix(vec3(.88,.77,.55),vec3(.93,.84,.64),h); vec2 e=p/uSize-0.5; c*=1.0-0.22*smoothstep(0.3,0.8,length(e)); c*=0.96+0.08*wf(p/(uSc*60.0)); }
  else if(uT==11) c=mix(vec3(.80,.78,.72),vec3(.85,.83,.77),h);
  else if(uT==12){ vec2 b=vec2(64.0,28.0)*uSc; vec2 u=p/b; float row=floor(u.y); u.x+=mod(row,2.0)*0.5; vec2 id=floor(u);
    float v=fract(sin(dot(id,vec2(12.9898,78.233)))*43758.5453); vec3 brick=mix(vec3(.55,.27,.20),vec3(.70,.36,.26),v)*(0.92+0.16*wn(p*0.3));
    vec2 f=fract(u); float edge=min(min(f.x,1.0-f.x)*b.x,min(f.y,1.0-f.y)*b.y); c=mix(vec3(.66,.64,.60),brick,smoothstep(1.5,4.0,edge)); }
  else if(uT==13) c=mix(vec3(.56,.56,.55),vec3(.68,.68,.66),clamp(h*1.2,0.0,1.0))*(0.94+0.1*wf(p/(uSc*80.0)));
  else if(uT==14) c=mix(vec3(.80,.77,.72),vec3(.88,.85,.80),h);
  else { c=mix(vec3(.50,.54,.57),vec3(.64,.67,.69),h); c*=0.9+0.2*wn(vec2(p.x*0.02,p.y*0.004)/uSc); }
  return c; }
void main(){ vec2 p=gl_FragCoord.xy; float h=pap_h(p,uT,uSc);
  float gx=(pap_h(p+vec2(1.0,0.0),uT,uSc)-pap_h(p-vec2(1.0,0.0),uT,uSc))*0.5, gy=(pap_h(p+vec2(0.0,1.0),uT,uSc)-pap_h(p-vec2(0.0,1.0),uT,uSc))*0.5;
  float rf=uT==0?0.08:uT<=3?0.12:uT==4?0.28:uT==5?0.36:uT==6?0.42:uT==7?0.3:uT==8?0.28:uT==9?0.3:uT==10?0.26:uT==11?0.22:uT==12?0.5:uT==13?0.35:uT==14?0.4:0.55; float rl=uRelief*rf;
  vec3 c=papCol(p,h); c*=1.0-(gx*-0.6+gy*-0.8)*rl*3.2; c*=1.0+(h-0.5)*rl*0.25;
  if(uLines==1){ float pitch=(uT==1?30.0:26.0)*uSc;
    if(uT==1){ float ln=1.0-smoothstep(0.4,1.4,abs(mod(p.y-pitch*2.0,pitch))); c=mix(c,vec3(.45,.62,.86),ln*0.55*step(pitch*2.0,p.y));
      float mg=1.0-smoothstep(0.4,1.4,abs(p.x-pitch*2.4)); c=mix(c,vec3(.86,.38,.40),mg*0.6); }
    else if(uT==2){ float lx=1.0-smoothstep(0.4,1.3,min(mod(p.x,pitch),pitch-mod(p.x,pitch))),ly=1.0-smoothstep(0.4,1.3,min(mod(p.y,pitch),pitch-mod(p.y,pitch)));
      c=mix(c,vec3(.55,.70,.88),max(lx,ly)*0.45); }
    else if(uT==3){ vec2 g=mod(p+pitch*0.5,pitch)-pitch*0.5; float dt=1.0-smoothstep(1.4,2.6,length(g)); c=mix(c,vec3(.36,.40,.52),dt*0.85); } }
  o=vec4(clamp(c,0.0,1.0),1.0); }`;
P.paper=program(FS_PAPER);
const PAPER_DEF={t:0,sc:1,relief:.5,lines:true};
/* the paper the brushes feel: the first visible paper layer */
function paperInfo(){try{for(const n of allLayers())if(n.paper&&n.visible!==false&&n.type==='layer')return {t:n.paper.t,sc:n.paper.sc||1};}catch(e){}return null;}
function paperLayer(){return allLayers().find(n=>n.paper&&n.type==='layer')||null;}
function paperDraw(target,cfg){run(P.paper,target,{uT:{int:cfg.t},uSc:cfg.sc||1,uRelief:cfg.relief==null?.5:cfg.relief,uLines:{int:cfg.lines!==false&&cfg.t>=1&&cfg.t<=3?1:0},uSize:[target.w,target.h]});}
/* make (or change) the document's paper layer */
function paperApply(cfg){cfg=Object.assign({},PAPER_DEF,cfg||{});let L=paperLayer();
  if(L){fullRecord(L,'Change paper',()=>{L.paper=cfg;L.name='Paper: '+PAPER_NAMES[cfg.t];paperDraw(mapT(L,'base'),cfg);});renderLayers();return L;}
  L=newLayerObj('Paper: '+PAPER_NAMES[cfg.t]);L.paper=cfg;paperDraw(mapT(L,'base'),cfg);
  const prev=doc.active;
  structOp('New paper',()=>{insertNode(L,doc.root,0);
    /* a plain Background above the paper would hide it */
    const above=doc.root.children[1];if(above&&above.type==='layer'&&/^Background$/i.test(above.name||'')&&above.visible!==false){above.visible=false;toast('The Background layer is hidden so the paper shows.');}
    /* paint on a layer above the paper, never on the paper itself */
    if(prev&&prev!==L&&prev.visible!==false&&prev.type==='layer')selectOnly(prev);else{const P=newLayerObj('Layer');insertNode(P,doc.root,doc.root.children.length);selectOnly(P);}});
  changed(L);return L;}
/* a small picture of each paper for the picker */
function paperThumb(t,lines,sc){const w=96,h=96,T=makeTarget(w,h,8,false);try{paperDraw(T,{t,sc:sc||1,relief:PAPER_DEF.relief,lines});const d=captureRegionNow(T,0,0,w,h).data,c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
  for(let j=0;j<h;j++)for(let i=0;i<w;i++){const a=((h-1-j)*w+i)*4,b=(j*w+i)*4;im.data[b]=d[a];im.data[b+1]=d[a+1];im.data[b+2]=d[a+2];im.data[b+3]=255;}x.putImageData(im,0,0);return c;}finally{disposeTarget(T);}}
function dlgPaper(){const cur=paperLayer(),S=Object.assign({},PAPER_DEF,cur?cur.paper:{});
  const body=el('div',{class:'paperdlg',style:'max-height:72vh;overflow:auto;padding:2px;min-width:min(560px,86vw)'}),grid=el('div',{class:'papergrid',style:'display:grid;grid-template-columns:repeat(4,minmax(0,150px));justify-content:center;gap:8px;margin-bottom:12px'}),tiles=[];
  const pick=t=>{S.t=t;tiles.forEach((b,i)=>b.classList.toggle('on',i===t));};
  for(let t=0;t<PAPER_NAMES.length;t++){const c=paperThumb(t,true,1);c.style.cssText='width:100%;height:auto;aspect-ratio:1;border-radius:4px;display:block';
    const b=el('button',{class:'bptile',title:PAPER_NAMES[t],style:'padding:3px;text-align:center;font-size:11px;line-height:1.25;display:flex;flex-direction:column;gap:3px;align-items:stretch',onclick:()=>pick(t)},c,el('div',{text:PAPER_NAMES[t]}));tiles.push(b);grid.append(b);}
  pick(S.t);
  body.append(grid,makeSlider({id:'ppSc',label:'Texture size',min:.4,max:3,step:.05,value:S.sc,fmt:v=>Math.round(v*100)+'%',onInput:v=>{S.sc=v;}}).el,
    makeSlider({id:'ppRel',label:'Tooth strength',min:0,max:1.5,step:.05,value:S.relief,fmt:v=>Math.round(v*100)+'%',onInput:v=>{S.relief=v;}}).el,
    chk('ppLines','Draw the printed lines (notebook paper)',S.lines!==false,v=>{S.lines=v;}),
    el('p',{class:'note',text:'The paper is its own layer at the bottom, so you can hide it, change it later, or delete it. Watercolour brushes feel its tooth (Paper tooth setting).'}));
  openDialog({title:cur?'Change paper':'Paper',body,wide:true,okLabel:cur?'Change':'Add paper',onOk(){paperApply(S);}});}
