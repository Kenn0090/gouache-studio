/* ================= Hover previews (0.97.1, Kenn: "when I hover over textures or canvases I should see a preview") =================
   After a short pause over a Textures tile, a layer or mask thumbnail, a document tab, a mask row with a picture, a brush tip,
   or the name of a picture chosen in a setting (grunge, guide picture, a material channel's image), a bigger picture shows
   beside it, with its name and size; it goes when the mouse leaves. Anything can offer one by setting `el._hpv = () => source`,
   where source is {t: GPU picture} | {canvas} | {tex: Textures item or {kind,id}} plus optional name / sub. */
const HPV_DELAY=350,HPV_SIZE=256;
const hpv={el:null,timer:0,cur:null,seq:0};
function hpvHide(){clearTimeout(hpv.timer);hpv.timer=0;hpv.cur=null;hpv.seq++;if(hpv.el){hpv.el.remove();hpv.el=null;}}
/* a GPU picture as a small canvas (straight colours, at most S px on its long side) */
function hpvFromTarget(t,S){if(!t||!t.w||!t.h)return null;const k=Math.min(1,S/Math.max(t.w,t.h)),w=Math.max(1,Math.round(t.w*k)),h=Math.max(1,Math.round(t.h*k));
  const s=makeTarget(w,h,8,false);let d;try{copyScaled(t,s);d=captureRegionNow(s,0,0,w,h).data;}finally{disposeTarget(s);}
  const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),id=x.createImageData(w,h);
  for(let y=0;y<h;y++)for(let i=0;i<w;i++){const a=(y*w+i)*4,b=a,al=d[a+3];const f=al?255/al:0;id.data[b]=Math.min(255,d[a]*f);id.data[b+1]=Math.min(255,d[a+1]*f);id.data[b+2]=Math.min(255,d[a+2]*f);id.data[b+3]=al;}
  x.putImageData(id,0,0);c._size=t.w+' × '+t.h+' px';return c;}
/* what to show for the element under the mouse (null: nothing) */
function hpvFind(target){if(!target||!target.closest)return null;
  for(let n=target;n&&n!==document.body;n=n.parentElement)if(typeof n._hpv==='function')return {anchor:n,get:n._hpv};
  const tile=target.closest('.txtile');if(tile&&tile._libDrag&&tile._libDrag[0]==='tex'){const it=tile._libDrag[1];return {anchor:tile,get:()=>({tex:it,name:it.name})};}
  const lr=target.closest('.lrow');if(lr&&lr._node){const n=lr._node;
    if(n.mask&&target===n.mask.thumb)return {anchor:target,get:()=>({t:n.mask.target,name:n.name+' · mask'})};
    if(target===n.thumb)return {anchor:target,get:()=>hpvLayer(n)};}
  const ms=target.closest('.msrow');if(ms&&ms._ms){const {L,where,id}=ms._ms,S=where==='m'?(L.mask&&L.mask.stack):L.cfx,r=S&&S.find(x=>x.id===id);if(r&&r.t)return {anchor:ms,get:()=>({t:r.t,name:msRowTitle(r)})};}
  const tab=target.closest('.dtab');if(tab&&typeof dtab!=='undefined'){const bar=tab.parentElement,i=[...bar.querySelectorAll('.dtab')].indexOf(tab),T=dtab.tabs[i];if(T)return {anchor:tab,get:()=>hpvTab(T)};}
  const tc=target.closest('.tipcell');if(tc&&tc._tip&&tc._tip.canvas)return {anchor:tc,get:()=>({canvas:tc._tip.canvas,name:tc._tip.name||'Tip'})};
  return null;}
/* a layer as it looks in the map being shown (fill layers drawn the way their thumbnail is) */
function hpvLayer(n){const k=doc.map||'base';if(n.type==='group'){const acc=acquireD(mapDepth(k));clearTarget(acc,[0,0,0,0]);const t=compositeList(n.children,acc,k);return {t,tmp:t,name:n.name};}
  if(typeof mapLive==='function'&&mapLive(n,k)){const t=acquireD(mapDepth(k));fillDrawMap(n,k,t);return {t,tmp:t,name:n.name};}
  const T=mapT(n,k,true)||n.target;if(T&&!T.empty)return {t:T,name:n.name};const c=typeof mapSolid==='function'&&mapSolid(n,k);
  if(c){const cv=document.createElement('canvas');cv.width=cv.height=64;const x=cv.getContext('2d');x.fillStyle='rgba('+c.slice(0,3).map(v=>Math.round(v*255)).join(',')+','+(c[3]??1)+')';x.fillRect(0,0,64,64);return {canvas:cv,name:n.name,sub:'One colour'};}
  return {canvas:n.thumb,name:n.name};}
/* a document tab: the live one from its composite, the others from the picture kept when you left them */
function hpvTab(T){const live=T.id===dtab.live;if(live&&compOut)return {t:compOut,name:doc.name,sub:doc.w+' × '+doc.h+' px'};
  const st=T.state&&T.state.doc;return {canvas:T.shot||null,name:st?st.name:'Document',sub:st?st.w+' × '+st.h+' px':''};}
async function hpvCanvas(src){if(!src)return null;if(src.canvas)return src.canvas;
  if(src.t){const c=hpvFromTarget(src.t,HPV_SIZE);if(src.tmp)release(src.tmp);return c;}
  if(src.tex){let it=src.tex;if(typeof fxdAllTex==='function'){await txLoad();it=fxdAllTex().find(x=>x.kind===it.kind&&x.id===it.id)||it;}
    const t=await txTarget(it);return hpvFromTarget(t,HPV_SIZE);}
  return null;}
function hpvShow(found){const seq=++hpv.seq;hpv.timer=setTimeout(async()=>{let src,c;try{src=found.get();if(!src)return;c=await hpvCanvas(src);}catch(e){console.warn('hover preview',e);return;}
    if(seq!==hpv.seq||!c||!found.anchor.isConnected)return;
    const big=document.createElement('canvas'),k=Math.min(HPV_SIZE/c.width,HPV_SIZE/c.height,4),w=Math.max(1,Math.round(c.width*k)),h=Math.max(1,Math.round(c.height*k));big.width=w;big.height=h;
    const x=big.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(c,0,0,w,h);big.className='hpvpic';
    const sub=src.sub||c._size||(c.width+' × '+c.height+' px');
    const pop=el('div',{class:'hpvpop matpop',id:'hpvPop',role:'tooltip'},big,src.name?el('div',{class:'mpname',text:src.name}):'',sub?el('div',{class:'mpline dim',text:sub}):'');
    if(hpv.el)hpv.el.remove();hpv.el=pop;document.body.append(pop);
    const r=found.anchor.getBoundingClientRect(),pw=pop.offsetWidth,ph=pop.offsetHeight;let left=r.left-pw-10;if(left<8)left=Math.min(innerWidth-pw-8,r.right+10);
    pop.style.left=left+'px';pop.style.top=Math.max(8,Math.min(r.top,innerHeight-ph-8))+'px';},HPV_DELAY);}
document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;if(prefs&&prefs.hoverPreview===false)return;const f=hpvFind(e.target);
  if(f&&hpv.cur&&f.anchor===hpv.cur)return;hpvHide();if(!f||e.buttons)return;hpv.cur=f.anchor;hpvShow(f);});
document.addEventListener('pointerout',e=>{if(!hpv.cur)return;const to=e.relatedTarget;if(to&&hpv.cur.contains(to))return;hpvHide();});
document.addEventListener('pointerdown',()=>hpvHide(),true);
document.addEventListener('wheel',()=>{if(hpv.el)hpvHide();},{passive:true,capture:true});
