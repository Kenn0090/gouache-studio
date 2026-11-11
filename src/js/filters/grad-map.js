/* ================= Gradient map, Substance-style (0.96.1, Kenn) =================
   "more live features and viewings": a grid of small gradient previews to pick from (built-ins and your own),
   an editor for the stops (click to add, drag to move, drag away to remove, colour and position, spread evenly,
   flip), saving your own (shared with the Gradient tool, kept for future projects, export/import), blending
   Smooth / Linear / Hard steps plus a Steps count, picking the colours from the picture (drag a line across
   the canvas or the model), an input range (like levels before the gradient) and a strength.
   Settings v: def, rev, blend ('smooth'|'linear'|'hard'), steps (0 = off), inLo, inHi, str, name. */
const GM_EXTRA=[
  {name:'Rust',def:gradDef(hexStops([[0,'#1c0f0a'],[.35,'#5a2a14'],[.65,'#a2532a'],[1,'#e0a066']]))},
  {name:'Gold',def:gradDef(hexStops([[0,'#2a1a05'],[.45,'#9c6b1c'],[.8,'#f0c75e'],[1,'#fff3c4']]))},
  {name:'Copper',def:gradDef(hexStops([[0,'#1f0b05'],[.5,'#9a4a2a'],[.85,'#e89a6e'],[1,'#ffe0c8']]))},
  {name:'Skin',def:gradDef(hexStops([[0,'#3b1a14'],[.4,'#a65a45'],[.75,'#e0a184'],[1,'#fbe1cf']]))},
  {name:'Moss',def:gradDef(hexStops([[0,'#121a0a'],[.5,'#4b6a1f'],[1,'#b9cf6a']]))},
  {name:'Toon 3 bands',def:gradDef(hexStops([[0,'#2b2840'],[.5,'#7a6fae'],[1,'#e9e4ff']]))},
  {name:'Heat',def:gradDef(hexStops([[0,'#000000'],[.3,'#5a0a6b'],[.55,'#e0302a'],[.8,'#ffb21c'],[1,'#ffffe0']]))}];
const gmPresets=()=>[...GRAD_BUILTIN.map(p=>({p,user:false})),...GM_EXTRA.map(p=>({p,user:false})),...userGradPresets.map(p=>({p,user:true}))];
function gmInit(v){if(!v.def)v.def=cloneGrad(v.pick==='cur'?ui.grad:presetDef(GRAD_BUILTIN[typeof v.pick==='number'?v.pick:2]||GRAD_BUILTIN[2]));
  if(v.blend==null)v.blend='smooth';if(v.steps==null)v.steps=0;if(v.inLo==null)v.inLo=0;if(v.inHi==null)v.inHi=1;if(v.str==null)v.str=1;return v;}
/* the colour for brightness x (0..1) with everything applied: input range, steps, hard stops */
function gmColourAt(v,x){const d=v.def;let t=clamp((x-v.inLo)/Math.max(1e-4,v.inHi-v.inLo),0,1);
  const n=Math.round(v.steps||0);if(n>=2)t=Math.min(n-1,Math.floor(t*n))/(n-1);
  if(v.blend==='hard'){const s=d.stops.slice().sort((a,b)=>a.p-b.p);let c=s[0];for(const q of s)if(t>=q.p-1e-6)c=q;const a=gradAt(Object.assign({},d,{reverse:false}),t)[3];return [c.c[0],c.c[1],c.c[2],a];}
  return gradAt(Object.assign({},d,{reverse:false,method:v.blend==='linear'?'linear':(d.method==='classic'?'classic':'perceptual')}),t);}
let gmLutTex=null;
function gmLut(v){const N=1024,a=new Float32Array(N*4);for(let i=0;i<N;i++)a.set(gmColourAt(v,i/(N-1)),i*4);
  if(!gmLutTex){gmLutTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,gmLutTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);}
  gl.bindTexture(gl.TEXTURE_2D,gmLutTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,N,1,0,gl.RGBA,gl.FLOAT,a);return gmLutTex;}
function gmRender(src,dst,v){gmInit(v);run(P.f_gmap,dst,{uSrc:src.tex,uLut:gmLut(v),uRev:!!v.rev,uDither:!!v.def.dither&&dst.depth===8&&v.blend!=='hard'&&!(v.steps>=2),uStr:v.str==null?1:v.str});}
/* a CSS strip of what the map really does (steps and hard stops included) */
function gmCss(v,dir){const n=v.blend==='hard'||v.steps>=2?160:32,parts=[];for(let i=0;i<=n;i++){const c=gmColourAt(v,i/n);parts.push('rgba('+c.slice(0,3).map(x=>Math.round(clamp(x,0,1)*255)).join(',')+','+c[3].toFixed(3)+') '+(i/n*100).toFixed(2)+'%');}
  return 'linear-gradient('+(dir||'90deg')+','+parts.join(',')+'), repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px';}
const gmSame=(a,b)=>JSON.stringify(a.stops)===JSON.stringify(b.stops)&&JSON.stringify(a.alphas)===JSON.stringify(b.alphas);

function gmControls(v,upd){gmInit(v);const box=el('div',{class:'gmed'});let sel=0;
  const sync=(rebuildInfo=true)=>{upd();strip.style.background=gmCss(v);drawStops(rebuildInfo);markGrid();saveRowSync();};
  /* --- the gradient being used, with its stops --- */
  const strip=el('div',{class:'gmstrip',id:'gmStrip',title:'Click under the strip to add a colour stop'}),row=el('div',{class:'gmstops',id:'gmStops'}),info=el('div',{class:'frow gminfo',id:'gmInfo'});
  const drawStops=(rebuildInfo=true)=>{const s=v.def.stops;sel=Math.min(sel,s.length-1);row.replaceChildren(...s.map((q,i)=>{const b=el('button',{class:'gstop c'+(i===sel?' on':''),type:'button','aria-label':'Colour stop at '+Math.round(q.p*100)+'%',title:'Drag to move, drag away to remove',style:'left:'+(q.p*100)+'%;background:'+toHex(q.c)});
      b.addEventListener('pointerdown',e=>drag(e,q));return b;}));if(rebuildInfo)drawInfo();};
  const drawInfo=()=>{const s=v.def.stops,q=s[sel];info.replaceChildren();if(!q)return;
    const loc=el('input',{class:'num',type:'number',min:0,max:100,step:1,value:Math.round(q.p*100),id:'gmLoc','aria-label':'Position %'});loc.addEventListener('change',()=>{q.p=clamp(+loc.value/100,0,1);sync();});
    info.append(el('label',{for:'gmCol',text:'Colour'}),colourBtn('gmCol',()=>q.c,c=>{q.c=c.slice(0,3);sync(false);},'This stop’s colour'),
      el('button',{class:'btn sm',type:'button',text:'Use foreground',onclick:()=>{q.c=ui.fg.slice(0,3);sync();drawInfo();}}),el('label',{for:'gmLoc',text:'Position %'}),loc);
    if(s.length>2)info.append(el('button',{class:'xbtn',type:'button',text:'×',title:'Remove this stop','aria-label':'Remove stop',onclick:()=>{s.splice(sel,1);sel=0;sync();}}));};
  const drag=(e,q)=>{e.preventDefault();e.stopPropagation();const s=v.def.stops;sel=s.indexOf(q);const r=row.getBoundingClientRect();let gone=false;
    const mv=ev=>{const away=Math.abs(ev.clientY-(r.top+r.height/2))>36&&s.length>2;if(away&&!gone){s.splice(s.indexOf(q),1);gone=true;}else if(!away&&gone){s.push(q);gone=false;}
      q.p=clamp((ev.clientX-r.left)/r.width,0,1);sel=Math.max(0,s.indexOf(q));sync();};
    const up=()=>{window.removeEventListener('pointermove',mv);window.removeEventListener('pointerup',up);if(gone)sel=0;sync();};
    window.addEventListener('pointermove',mv);window.addEventListener('pointerup',up);drawStops();};
  const addAt=e=>{if(e.target!==row&&e.target!==strip)return;const r=row.getBoundingClientRect(),p=clamp((e.clientX-r.left)/r.width,0,1);
    v.def.stops.push({p,c:gradAt(Object.assign({},v.def,{reverse:false}),p).slice(0,3)});sel=v.def.stops.length-1;sync();};
  row.addEventListener('pointerdown',addAt);strip.addEventListener('pointerdown',addAt);
  const tools=el('div',{class:'chips'},
    el('button',{class:'btn sm',type:'button',id:'gmEven',text:'Spread evenly',title:'Space the stops out evenly',onclick:()=>{const s=v.def.stops.sort((a,b)=>a.p-b.p);s.forEach((q,i)=>q.p=s.length>1?i/(s.length-1):0);sync();}}),
    el('button',{class:'btn sm',type:'button',id:'gmFlip',text:'Flip',title:'Turn the gradient around (dark ↔ light)',onclick:()=>{for(const q of v.def.stops)q.p=1-q.p;for(const q of v.def.alphas)q.p=1-q.p;sync();}}),
    el('button',{class:'btn sm',type:'button',id:'gmPick',text:'Pick from picture',title:'Drag a line across the canvas or the model: the colours under it become the gradient (dark to light). Esc cancels.',onclick:()=>gmPickLine(v,()=>{sel=0;sync();})}),
    el('button',{class:'btn sm',type:'button',id:'gmPickScreen',text:'Pick from screen',title:'Drag a line across anything on your screen, also outside the app (like Substance Designer): the colours along it become the gradient, in the order you drag. Esc cancels.',onclick:()=>screenGrabPick('line',cols=>{v.def.stops=sgStops(cols);v.name='';sel=0;sync();})}));
  /* --- presets: a grid of small strips --- */
  const grid=el('div',{class:'gmgrid',id:'gmGrid'});
  const buildGrid=()=>{grid.replaceChildren(...gmPresets().map(({p,user})=>{const d=presetDef(p);const b=el('button',{class:'gmtile'+(user?' user':''),type:'button',title:p.name+(user?' (yours: right-click for more)':''),'aria-label':p.name,style:'background:'+gradCss(d)+', repeating-conic-gradient(#555 0 25%, #333 0 50%) 0 0/8px 8px'});b._p=p;b._user=user;
      b.addEventListener('click',()=>{const nd=presetDef(p);v.def=Object.assign(nd,{method:v.def.method,dither:v.def.dither});v.name=p.name;sel=0;sync();});
      if(user)b.addEventListener('contextmenu',e=>{e.preventDefault();gmUserMenu(e,p,()=>{buildGrid();saveRowSync();});});return b;}));markGrid();};
  const markGrid=()=>{for(const b of grid.children)b.classList.toggle('on',b._p.name===v.name&&gmSame(presetDef(b._p),v.def));};
  /* --- saving your own (shared with the Gradient tool) --- */
  const nameIn=el('input',{type:'text',id:'gmName',placeholder:'Name','aria-label':'Gradient name',value:v.name||''});
  const upBtn=el('button',{class:'btn sm',type:'button',id:'gmUpdate',text:'Update',title:'Save the changes into your gradient with this name'});
  const saveRowSync=()=>{const u=userGradPresets.find(p=>p.name===(nameIn.value||'').trim());upBtn.hidden=!u||gmSame(u.def,v.def);};
  nameIn.addEventListener('input',saveRowSync);
  upBtn.addEventListener('click',()=>{const u=userGradPresets.find(p=>p.name===nameIn.value.trim());if(!u)return;u.def=cloneGrad(v.def);saveGradPresets();v.name=u.name;buildGrid();saveRowSync();toast('Updated “'+u.name+'”.');});
  const saveNew=el('button',{class:'btn sm',type:'button',id:'gmSave',text:'Save as new',onclick:()=>{let n=(nameIn.value||'').trim()||'My gradient';const base=n;let k=2;while(userGradPresets.some(p=>p.name===n))n=base+' '+k++;
      userGradPresets.push({name:n,def:cloneGrad(v.def)});saveGradPresets();v.name=n;nameIn.value=n;buildGrid();saveRowSync();toast('Saved “'+n+'”. It is also in the Gradient tool.');}});
  const exp=el('button',{class:'btn sm',type:'button',id:'gmExport',text:'Export…',title:'Save your gradients to a file to share',onclick:async()=>{if(!userGradPresets.length){toast('Save a gradient first.');return;}
      const r=await deliver('gradients.ggrad',new Blob([JSON.stringify({app:'Gouache Studio',kind:'gradients',v:1,list:userGradPresets})],{type:'application/json'}));toast(deliveredText(r,'Gradients'));}});
  const imp=el('button',{class:'btn sm',type:'button',id:'gmImport',text:'Import…',onclick:async()=>{const fs=await pickFiles('.ggrad,.json',true,'Gradients',['ggrad','json']);let n=0;
      for(const f of fs||[]){try{const j=JSON.parse(await f.text());for(const p of j.list||[])if(p&&p.def&&p.def.stops){let nm=p.name||'Gradient';while(userGradPresets.some(q=>q.name===nm))nm+=' (2)';userGradPresets.push({name:nm,def:p.def});n++;}}catch(e){toast('Could not read '+f.name);}}
      if(n){saveGradPresets();buildGrid();toast('Imported '+n+' gradient'+(n>1?'s':'')+'.');}}});
  /* --- how it maps --- */
  const steps=makeSlider({id:'gmSteps',label:'Steps',min:0,max:16,step:1,value:v.steps||0,def:0,fmt:x=>x<2?'Off':String(x),onInput:x=>{v.steps=x;sync();}});
  const lo=makeSlider({id:'gmInLo',label:'Input dark',min:0,max:1,step:.005,value:v.inLo,def:0,fmt:x=>Math.round(x*255),onInput:x=>{v.inLo=Math.min(x,v.inHi-.005);sync();}});
  const hi=makeSlider({id:'gmInHi',label:'Input light',min:0,max:1,step:.005,value:v.inHi,def:1,fmt:x=>Math.round(x*255),onInput:x=>{v.inHi=Math.max(x,v.inLo+.005);sync();}});
  const str=makeSlider({id:'gmStr',label:'Strength',min:0,max:1,step:.01,value:v.str,def:1,fmt:pct,onInput:x=>{v.str=x;upd();}});
  const blend=seg([['smooth','Smooth','Blends the colours evenly to the eye'],['linear','Linear','Plain blend between the colours'],['hard','Hard','No blending: each stop is a flat band']],v.blend,x=>{v.blend=x;sync();},'Blending');blend.id='gmBlend';
  box.append(el('div',{class:'gmbar'},strip,row),info,tools,
    el('div',{class:'sub',text:'Gradients'}),grid,el('div',{class:'frow gmsave'},nameIn,upBtn,saveNew),el('div',{class:'chips'},imp,exp),
    el('div',{class:'sub',text:'Mapping'}),blend,steps.el,lo.el,hi.el,str.el);
  buildGrid();strip.style.background=gmCss(v);drawStops();saveRowSync();return [box];}
function gmUserMenu(e,p,done){const m=el('div',{class:'ctxmenu gmmenu',style:'position:fixed;left:'+e.clientX+'px;top:'+e.clientY+'px;z-index:80'});const close=()=>{m.remove();window.removeEventListener('pointerdown',out,true);};const out=ev=>{if(!m.contains(ev.target))close();};
  const item=(t,f)=>el('button',{type:'button',class:'mi',text:t,onclick:()=>{close();f();}});
  m.append(item('Rename…',()=>{const n=prompt('New name',p.name);if(n&&n.trim()){p.name=n.trim();saveGradPresets();done();}}),
    item('Duplicate',()=>{userGradPresets.push({name:p.name+' copy',def:cloneGrad(p.def)});saveGradPresets();done();}),
    item('Delete',()=>{userGradPresets.splice(userGradPresets.indexOf(p),1);saveGradPresets();done();}));
  document.body.append(m);setTimeout(()=>window.addEventListener('pointerdown',out,true),0);}
/* drag a line across the canvas (or the model in a 3D view): the colours under it, sorted dark to light, become the stops */
function gmPickLine(v,done){const ov=el('canvas',{class:'gmpick',id:'gmPickOv'});ov.width=innerWidth;ov.height=innerHeight;document.body.append(ov);
  const tip=el('div',{class:'gmpicktip',text:'Drag a line across the picture. Esc cancels.'});document.body.append(tip);
  let a=null,b=null;const g=ov.getContext('2d');
  const draw=()=>{g.clearRect(0,0,ov.width,ov.height);if(!a||!b)return;g.lineWidth=3;g.strokeStyle='#000';g.beginPath();g.moveTo(a[0],a[1]);g.lineTo(b[0],b[1]);g.stroke();g.lineWidth=1.5;g.strokeStyle='#fff';g.stroke();};
  const end=()=>{ov.remove();tip.remove();window.removeEventListener('keydown',key,true);};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();end();}};window.addEventListener('keydown',key,true);
  ov.addEventListener('pointerdown',e=>{a=b=[e.clientX,e.clientY];ov.setPointerCapture(e.pointerId);draw();});
  ov.addEventListener('pointermove',e=>{if(!a)return;b=[e.clientX,e.clientY];draw();});
  ov.addEventListener('pointerup',()=>{if(!a)return;const A=a,B=b;end();if(Math.hypot(B[0]-A[0],B[1]-A[1])<4){toast('Drag a line, not a click.');return;}
    const cols=gmSampleLine(A,B,48);if(cols.length<2){toast('Nothing under that line to pick from.');return;}
    cols.sort((p,q)=>lumOfRGB(p)-lumOfRGB(q));const n=Math.min(8,cols.length),stops=[];
    for(let i=0;i<n;i++){const k=Math.round(i*(cols.length-1)/Math.max(1,n-1));stops.push({p:n>1?i/(n-1):0,c:cols[k]});}
    v.def.stops=stops;v.name='';done();});}
const lumOfRGB=c=>.299*c[0]+.587*c[1]+.114*c[2];
/* colours of the finished picture (without the filter being previewed) at n points along a screen line */
function gmSampleLine(A,B,n){const keep=preview;let comp=null;const out=[];
  try{preview=null;comp=compositeMap('base');const hit=document.getElementById('v3Hit'),hr=hit&&hit.offsetParent?hit.getBoundingClientRect():null;
    for(let i=0;i<n;i++){const t=i/(n-1),x=A[0]+(B[0]-A[0])*t,y=A[1]+(B[1]-A[1])*t;let ix,iy;
      if(hr&&x>=hr.left&&x<=hr.right&&y>=hr.top&&y<=hr.bottom&&v3.mesh){const pk=v3PickAt(hit,{clientX:x,clientY:y});if(!pk)continue;ix=pk.uv[0]*doc.w;iy=pk.uv[1]*doc.h;}
      else{const r=stage.getBoundingClientRect();if(x<r.left||x>r.right||y<r.top||y>r.bottom)continue;[ix,iy]=toImage(x,y);}
      ix=Math.floor(ix);iy=Math.floor(iy);if(ix<0||iy<0||ix>=doc.w||iy>=doc.h)continue;
      const r=captureRegionNow(comp,ix,iy,1,1),q=r.depth===16?Array.from(r.data,h2f):Array.from(r.data,x=>x/255),al=q[3];if(al<.05)continue;out.push([q[0]/al,q[1]/al,q[2]/al].map(x=>clamp(x,0,1)));}}
  catch(e){console.warn(e);}finally{preview=keep;if(comp)release(comp);}
  return out;}
