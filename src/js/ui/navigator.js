/* (0.97.15, Kenn: "a pip for zooming into the canvas") a small picture-in-picture of the whole canvas in the corner of the Paint view, with a frame showing
   what is on screen. It appears when you are zoomed in; drag the frame (or click the picture) to move around. View › Navigator turns it off. */
const nav={on:(()=>{try{return localStorage.getItem('gs.nav')!=='0';}catch(e){return true;}})(),el:null,cv:null,fr:null,dirty:true,timer:0,w:0,h:0,drag:false};
function navBuild(){if(nav.el)return;
  nav.cv=el('canvas',{width:176,height:132,'aria-hidden':'true'});nav.fr=el('div',{class:'navframe'});
  nav.el=el('div',{id:'navPip',class:'navpip',role:'group','aria-label':'Navigator: drag the frame to move around the canvas',title:'Navigator: drag the frame to move around. View › Navigator turns it off.',hidden:true},nav.cv,nav.fr);
  stage.append(nav.el);
  const go=e=>{const r=nav.cv.getBoundingClientRect(),dx=(e.clientX-r.left)/r.width,dy=(e.clientY-r.top)/r.height,px=dx*doc.w,py=dy*doc.h;
    const W=stage.clientWidth,H=stage.clientHeight;view.x=W/2-px*view.zoom;view.y=H/2-py*view.zoom;updateStatus();requestRender();navSync();};
  nav.el.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();nav.drag=true;try{nav.el.setPointerCapture(e.pointerId);}catch(er){}go(e);});
  nav.el.addEventListener('pointermove',e=>{if(nav.drag)go(e);});
  const up=e=>{nav.drag=false;try{nav.el.releasePointerCapture(e.pointerId);}catch(er){}};nav.el.addEventListener('pointerup',up);nav.el.addEventListener('pointercancel',up);
  nav.el.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});}
/* the little picture of the whole canvas, made from the finished composite (a small read-back, not while you paint) */
function navPicture(){nav.timer=0;if(!nav.on||stroke||!compOut||ui.mode!=='paint')return;
  const w=176,h=Math.max(1,Math.min(132,Math.round(176*doc.h/doc.w))),ww=h===132?Math.max(1,Math.round(132*doc.w/doc.h)):w;
  let sm=null;try{sm=makeTarget(ww,h,8,false);run(P.f_rs,sm,{uSrc:compOut.tex,uOut:[ww,h]});const d=captureRegionNow(sm,0,0,ww,h).data;
    nav.cv.width=ww;nav.cv.height=h;const x=nav.cv.getContext('2d'),im=x.createImageData(ww,h);
    for(let i=0;i<ww*h;i++){const a=d[i*4+3]/255,sq=((i%ww>>3)+(((i/ww)|0)>>3))&1?200:240;/* a checker under transparent areas */
      im.data[i*4]=d[i*4]*1+sq*(1-a);im.data[i*4+1]=d[i*4+1]+sq*(1-a);im.data[i*4+2]=d[i*4+2]+sq*(1-a);im.data[i*4+3]=255;}
    x.putImageData(im,0,0);nav.w=ww;nav.h=h;nav.dirty=false;}catch(e){}finally{if(sm)disposeTarget(sm);}}
function navSoon(){nav.dirty=true;if(!nav.timer)nav.timer=setTimeout(navPicture,260);}
/* where the screen's frame sits on the picture, and whether the pip shows at all */
function navSync(){if(!nav.el&&nav.on&&ui.mode==='paint')navBuild();if(!nav.el)return;
  const show=nav.on&&ui.mode==='paint'&&!vxA()&&!ui.cageFlat&&view.zoom>0;let vis=false,fx=0,fy=0,fw=1,fh=1;
  if(show){const W=stage.clientWidth,H=stage.clientHeight,x0=(0-view.x)/view.zoom,y0=(0-view.y)/view.zoom,x1=(W-view.x)/view.zoom,y1=(H-view.y)/view.zoom;
    const cx0=Math.max(0,x0),cy0=Math.max(0,y0),cx1=Math.min(doc.w,x1),cy1=Math.min(doc.h,y1);
    vis=(x0>1||y0>1||x1<doc.w-1||y1<doc.h-1)&&cx1>cx0&&cy1>cy0;/* only when part of the canvas is out of view */
    fx=cx0/doc.w;fy=cy0/doc.h;fw=(cx1-cx0)/doc.w;fh=(cy1-cy0)/doc.h;}
  if(nav.el.hidden===vis)nav.el.hidden=!vis;
  if(!vis)return;
  if(nav.dirty&&!nav.timer&&!stroke)navSoon();
  const r=nav.cv.getBoundingClientRect(),pr=nav.el.getBoundingClientRect();
  nav.fr.style.left=(r.left-pr.left+fx*r.width)+'px';nav.fr.style.top=(r.top-pr.top+fy*r.height)+'px';nav.fr.style.width=Math.max(4,fw*r.width)+'px';nav.fr.style.height=Math.max(4,fh*r.height)+'px';}
function navToggle(){nav.on=!nav.on;try{localStorage.setItem('gs.nav',nav.on?'1':'0');}catch(e){}if(nav.on)navBuild();navSync();toast(nav.on?'Navigator shown while you are zoomed in.':'Navigator off.');}
MENUS.View.push('-',['Navigator','navigator']);
Object.assign(actions,{navigator:()=>navToggle()});Object.assign(checked,{navigator:()=>nav.on});
