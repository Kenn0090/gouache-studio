/* ================= Animation mode: timeline, panel, preview window ================= */
$('#modeSel').addEventListener('change',e=>{if(!setMode(e.target.value))e.target.value=ui.mode;e.target.blur();});
const CELL=76;ui.fsel=null;/* frame range picked with Shift+click, for tagging */
const tl=$('#timeline');
const ic=(p,t)=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+p+'</svg>'+(t?'<span>'+t+'</span>':'');
function tlBtn(html,title,fn,cls){const b=el('button',{class:'tlb'+(cls?' '+cls:''),title,'aria-label':title});b.innerHTML=html;b.addEventListener('click',fn);return b;}
const tlParts={};
(function buildTimeline(){
  const P1='<path d="M6 5v14M18 5 9 12l9 7z"/>',P2='<path d="M15 5 8 12l7 7z"/>',PL='<path d="M8 5v14l11-7z"/>',PN='<path d="M9 5l7 7-7 7z"/>',PE='<path d="M18 5v14M6 5l9 7-9 7z"/>';
  tlParts.play=tlBtn(ic(PL),'Play / stop (Enter)',togglePlay,'play');
  const fps=el('div',{class:'tlgroup'});tlParts.fpsBtns=[12,24,30].map(v=>{const b=el('button',{class:'tlchip',text:String(v),title:v+' frames per second',onclick:()=>setFps(v)});fps.append(b);return b;});
  tlParts.fps=el('input',{class:'num tlnum',type:'number',min:1,max:120,'aria-label':'Frames per second',title:'Any frame rate'});tlParts.fps.addEventListener('change',()=>setFps(+tlParts.fps.value));fps.append(tlParts.fps,el('span',{class:'dim',text:'fps'}));
  tlParts.hold=el('input',{class:'num tlnum',type:'number',min:1,max:99,'aria-label':'Hold (frames)',title:'How many beats this frame stays on screen'});tlParts.hold.addEventListener('change',()=>setHold(+tlParts.hold.value));
  tlParts.info=el('span',{class:'dim tlinfo'});
  tlParts.onion=el('button',{class:'tlchip',title:'Onion skin: show nearby frames faintly',onclick:()=>{const A=A_();A.onion.on=!A.onion.on;renderTimeline();renderAnimPanel();requestRender(true);}},'Onion');
  const imp=el('select',{class:'tlsel','aria-label':'Import frames'},el('option',{value:'',text:'Import…'}),el('option',{value:'sheet',text:'Frames from a sprite sheet…'}),el('option',{value:'seq',text:'Frames from an image sequence…'}),el('option',{value:'gif',text:'Frames from a GIF…'}));
  imp.addEventListener('change',()=>{const v=imp.value;imp.value='';imp.blur();if(v==='sheet')importSheet();if(v==='seq')importSequence();if(v==='gif')importGif();});
  const ctr=el('div',{class:'tlctrl'},tlBtn(ic(P1),'First frame',()=>showFrame(0)),tlBtn(ic(P2),'Previous frame (,)',()=>stepFrame(-1)),tlParts.play,tlBtn(ic(PN),'Next frame (.)',()=>stepFrame(1)),tlBtn(ic(PE),'Last frame',()=>showFrame(A_().frames.length-1)),
    el('span',{class:'tlsep'}),fps,el('span',{class:'tlsep'}),el('label',{class:'dim',text:'Hold ×'}),tlParts.hold,el('span',{class:'tlsep'}),
    el('button',{class:'btn sm',text:'+ Frame',title:'New blank frame after this one',onclick:addFrame}),el('button',{class:'btn sm',text:'Duplicate',title:'Copy this frame',onclick:duplicateFrame}),el('button',{class:'btn sm',text:'Delete',onclick:deleteFrame}),
    el('span',{class:'tlsep'}),tlParts.onion,el('button',{class:'btn sm',text:'Preview',title:'Live preview window',onclick:togglePreviewWin}),imp,el('button',{class:'btn sm primary',text:'Export…',title:'Sprite sheet / flipbook export',onclick:dlgExportSheet}),tlParts.info);
  tlParts.tags=el('div',{class:'tltags'});tlParts.frames=el('div',{class:'tlframes',role:'listbox','aria-label':'Frames'});
  tlParts.scroll=el('div',{class:'tlscroll'},tlParts.tags,tlParts.frames);
  tl.append(ctr,tlParts.scroll);})();
function stepFrame(d){const A=A_();if(!A)return;stopPlay();showFrame((A.cur+d+A.frames.length)%A.frames.length);}
let tlQueued=false;
function scheduleTimeline(){if(tlQueued)return;tlQueued=true;requestAnimationFrame(()=>{tlQueued=false;drawTimelineThumbs();drawPreviewWin();});}
function renderTimeline(){const A=A_();if(ui.mode!=='anim'||!A)return;
  tlParts.play.innerHTML=ic(playing?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>');tlParts.play.classList.toggle('on',!!playing);
  tlParts.fpsBtns.forEach(b=>b.classList.toggle('on',+b.textContent===A.fps));if(document.activeElement!==tlParts.fps)tlParts.fps.value=A.fps;
  if(document.activeElement!==tlParts.hold)tlParts.hold.value=curFrame().hold;tlParts.onion.classList.toggle('on',A.onion.on);
  const total=A.frames.reduce((s,f)=>s+f.hold,0);tlParts.info.textContent='Frame '+(A.cur+1)+' of '+A.frames.length+' · '+(total/A.fps).toFixed(2)+' s';
  const fr=tlParts.frames;if(fr.children.length!==A.frames.length){fr.replaceChildren(...A.frames.map((F,i)=>frameCell(i)));}
  [...fr.children].forEach((c,i)=>{c._i=i;c.querySelector('.fnum').textContent=i+1;const h=A.frames[i].hold;c.querySelector('.fhold').textContent=h>1?'×'+h:'';
    const inSel=ui.fsel&&i>=Math.min(...ui.fsel)&&i<=Math.max(...ui.fsel);c.classList.toggle('cur',i===A.cur);c.classList.toggle('rng',!!inSel&&i!==A.cur);c.setAttribute('aria-selected',String(i===A.cur));});
  tlParts.tags.replaceChildren(...A.tags.map((t,i)=>{const [a,b]=tagRange(t);const bar=el('button',{class:'tltag',title:t.name+' ('+{loop:'loops',once:'plays once',pingpong:'ping-pong'}[t.mode]+'). Click to play it.',style:'left:'+(a*CELL)+'px;width:'+((b-a+1)*CELL-4)+'px;background:'+t.color,text:t.name});
    bar.addEventListener('click',()=>{ui.playTag=i;stopPlay();togglePlay();renderAnimPanel();});return bar;}));
  tlParts.tags.style.height=A.tags.length?'18px':'0';
  const cur=fr.children[A.cur];if(cur){const s=tlParts.scroll,l=cur.offsetLeft;if(l<s.scrollLeft||l+CELL>s.scrollLeft+s.clientWidth)s.scrollLeft=l-s.clientWidth/2+CELL/2;}
  scheduleTimeline();}
function frameCell(i){const c=el('div',{class:'fcell',role:'option',tabindex:'-1'},el('canvas',{class:'fthumb'}),el('span',{class:'fnum'}),el('span',{class:'fhold'}));
  c.addEventListener('pointerdown',e=>{if(e.button!==0)return;const i0=c._i,A=A_();
    if(e.shiftKey){ui.fsel=[ui.fsel?ui.fsel[0]:A.cur,i0];renderTimeline();return;}
    ui.fsel=null;stopPlay();showFrame(i0);let drag=null;const sx=e.clientX;
    const mv=ev=>{if(!drag&&Math.abs(ev.clientX-sx)<6)return;const r=tlParts.frames.getBoundingClientRect(),to=clamp(Math.round((ev.clientX-r.left+tlParts.scroll.scrollLeft*0-CELL/2)/CELL),0,A.frames.length-1);
      drag=to;tlParts.frames.querySelectorAll('.fcell').forEach((x,k)=>x.classList.toggle('drop',k===to&&to!==i0));};
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);tlParts.frames.querySelectorAll('.drop').forEach(x=>x.classList.remove('drop'));if(drag!=null&&drag!==i0)moveFrame(i0,drag);};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);});
  return c;}
function drawTimelineThumbs(){const A=A_();if(ui.mode!=='anim'||!A)return;[...tlParts.frames.children].forEach((c,i)=>{const F=A.frames[i];if(!F)return;const cv2=c.querySelector('canvas'),img=frameImage(F);
  const h=56,w=Math.max(8,Math.round(h*doc.w/doc.h));if(cv2.width!==Math.min(w,68)||cv2.height!==h){cv2.width=Math.min(w,68);cv2.height=h;}const x=cv2.getContext('2d');x.clearRect(0,0,cv2.width,cv2.height);
  const s=Math.min(cv2.width/img.width,cv2.height/img.height);x.imageSmoothingQuality='high';x.drawImage(img,(cv2.width-img.width*s)/2,(cv2.height-img.height*s)/2,img.width*s,img.height*s);});}

/* ---- right-hand Animation panel ---- */
function renderAnimPanel(){const box=$('#animBody'),A=A_();if(!box)return;box.replaceChildren();if(ui.mode!=='anim'||!A)return;const o=A.onion;
  box.append(el('div',{class:'sub',text:'Onion skin'}),el('div',{class:'chips'},chk('aoOn','Show',o.on,v=>{o.on=v;renderTimeline();requestRender(true);}),chk('aoTint','Red before, green after',o.tint,v=>{o.tint=v;requestRender(true);})),
    makeSlider({id:'aoB',label:'Before',min:0,max:5,step:1,value:o.before,onInput:v=>{o.before=v;requestRender(true);}}).el,
    makeSlider({id:'aoA',label:'After',min:0,max:5,step:1,value:o.after,onInput:v=>{o.after=v;requestRender(true);}}).el,
    makeSlider({id:'aoF',label:'Fade',min:.1,max:.9,step:.05,value:o.fade,fmt:pct,onInput:v=>{o.fade=v;requestRender(true);}}).el,
    el('div',{class:'sub',text:'Canvas background'}),seg([['checker','Checker'],['white','White'],['grey','Grey'],['dark','Dark']],ui.animBg,v=>{ui.animBg=v;requestRender();drawPreviewWin();},'Canvas background'));
  const ps=el('select',{id:'aPlay','aria-label':'Play'},el('option',{value:'-1',text:'All frames'}),...A.tags.map((t,i)=>el('option',{value:String(i),text:'Tag: '+t.name})));ps.value=String(ui.playTag<A.tags.length?ui.playTag:-1);
  ps.addEventListener('change',()=>{ui.playTag=+ps.value;stopPlay();});
  box.append(el('div',{class:'sub',text:'Tags'}),el('div',{class:'frow'},el('label',{for:'aPlay',text:'Play'}),ps));
  A.tags.forEach((t,i)=>{const name=el('input',{class:'tagname',value:t.name,'aria-label':'Tag name'});name.addEventListener('change',()=>editTag(i,{name:name.value.trim()||t.name}));
    const md=el('select',{'aria-label':'Tag playback'},...[['loop','Loop'],['once','Once'],['pingpong','Ping-pong']].map(([v,x])=>el('option',{value:v,text:x})));md.value=t.mode;md.addEventListener('change',()=>editTag(i,{mode:md.value}));
    const [a,b]=tagRange(t);box.append(el('div',{class:'tagrow'},el('span',{class:'tagdot',style:'background:'+t.color}),name,el('span',{class:'dim',text:(a+1)+'–'+(b+1)}),md,el('button',{class:'xbtn',text:'×','aria-label':'Delete tag',onclick:()=>deleteTag(i)})));});
  box.append(el('div',{class:'frow'},el('button',{class:'btn sm',text:'+ Tag frames',title:'Name the frames picked with Shift+click in the timeline (or the current frame)',onclick:()=>{const r=ui.fsel||[A.cur,A.cur];addTag(r[0],r[1]);ui.fsel=null;}})),
    el('div',{class:'sub',text:'Shift+click frames in the timeline to pick a range, then tag it (idle, run, attack…). Each tag can loop, play once or ping-pong, and exports as its own animation.'}));}

/* ---- live preview window ---- */
let pw=null;
function togglePreviewWin(){if(pw){pw.el.remove();clearTimeout(pw.timer);pw=null;return;}
  const cvs=el('canvas',{class:'pwcv'}),zoom=el('select',{'aria-label':'Zoom'},...[['fit','Fit'],['1','100%'],['2','200%']].map(([v,t])=>el('option',{value:v,text:t})));
  const tag=el('select',{'aria-label':'Play'});const play=el('button',{class:'tlb on',title:'Play / pause'});
  const head=el('div',{class:'pwhead'},el('strong',{text:'Preview'}),el('span',{class:'dim',text:'updates as you paint'}),el('button',{class:'xbtn',text:'×','aria-label':'Close preview',onclick:togglePreviewWin}));
  const w=el('div',{id:'animPrev',role:'dialog','aria-label':'Animation preview'},head,cvs,el('div',{class:'frow'},play,tag,zoom));document.body.append(w);
  pw={el:w,cvs,zoom,tag,play,k:0,on:true,timer:0};
  play.innerHTML=ic('<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>');play.addEventListener('click',()=>{pw.on=!pw.on;play.innerHTML=ic(pw.on?'<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>':'<path d="M8 5v14l11-7z"/>');if(pw.on)pwTick();});
  const fillTags=()=>{const A=A_();tag.replaceChildren(el('option',{value:'-1',text:'All frames'}),...A.tags.map((t,i)=>el('option',{value:String(i),text:t.name})));};fillTags();tag.addEventListener('focus',fillTags);
  tag.addEventListener('change',()=>{pw.k=0;});zoom.addEventListener('change',drawPreviewWin);
  let drag=null;head.addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;const r=w.getBoundingClientRect();drag=[e.clientX-r.left,e.clientY-r.top];head.setPointerCapture(e.pointerId);});
  head.addEventListener('pointermove',e=>{if(!drag)return;w.style.left=Math.max(0,e.clientX-drag[0])+'px';w.style.top=Math.max(0,e.clientY-drag[1])+'px';w.style.right='auto';});head.addEventListener('pointerup',()=>{drag=null;});
  pwTick();}
function pwSeq(){const A=A_(),t=+pw.tag.value;let a=0,b=A.frames.length-1,mode='loop';if(t>=0&&A.tags[t]){[a,b]=tagRange(A.tags[t]);mode=A.tags[t].mode;}
  const s=[];for(let i=a;i<=b;i++)s.push(i);if(mode==='pingpong')for(let i=b-1;i>a;i--)s.push(i);return {s,mode};}
function pwTick(){if(!pw)return;clearTimeout(pw.timer);const A=A_();if(!A||ui.mode!=='anim'){pw.timer=setTimeout(pwTick,300);return;}
  const {s,mode}=pwSeq();if(pw.k>=s.length)pw.k=mode==='once'?s.length-1:0;drawPreviewWin();if(!pw.on)return;
  const F=A.frames[s[pw.k]];pw.timer=setTimeout(()=>{pw.k++;if(pw.k>=s.length&&mode==='once'){pw.k=s.length-1;pw.on=false;pw.play.innerHTML=ic('<path d="M8 5v14l11-7z"/>');drawPreviewWin();return;}pwTick();},(F?F.hold:1)*1000/A.fps);}
function drawPreviewWin(){if(!pw)return;const A=A_();if(!A)return;const {s}=pwSeq(),i=s[Math.min(pw.k,s.length-1)],F=A.frames[i];if(!F)return;const img=frameImage(F);
  const z=pw.zoom.value,maxW=320,sc=z==='fit'?Math.min(maxW/doc.w,maxW/doc.h):+z*Math.min(1,img.width/doc.w);
  const W=Math.max(1,Math.round(doc.w*(z==='fit'?sc:+z))),H=Math.max(1,Math.round(doc.h*(z==='fit'?sc:+z)));
  const c=pw.cvs;if(c.width!==W||c.height!==H){c.width=W;c.height=H;}const x=c.getContext('2d');
  if(ui.animBg==='checker'){for(let yy=0;yy<H;yy+=8)for(let xx=0;xx<W;xx+=8){x.fillStyle=((xx+yy)/8)%2?'#3a3d44':'#2f3238';x.fillRect(xx,yy,8,8);}}
  else{x.fillStyle={white:'#fff',grey:'#808080',dark:'#1f1f21'}[ui.animBg];x.fillRect(0,0,W,H);}
  x.imageSmoothingEnabled=z==='fit';x.imageSmoothingQuality='high';x.drawImage(img,0,0,W,H);}

/* ---- keys in Animation mode; returns true if used ---- */
function animKeys(e,m,k){if(ui.mode!=='anim')return false;
  if(m&&['n','g','e'].includes(k)||(m&&k==='j')){e.preventDefault();toast('Layers are not used in Animation mode. Switch to Paint mode (top right) for layers.');return true;}
  if(m||e.altKey)return false;
  if(k===','){stepFrame(-1);return true;}if(k==='.'){stepFrame(1);return true;}
  if(e.key==='Enter'){e.preventDefault();togglePlay();return true;}
  return false;}
