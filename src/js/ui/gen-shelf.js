/* (0.97.11, Kenn) a Generators category in the 3D Paint shelf: baked-map masks, wear and weather generators, gradients and noises as tiles.
   Click one to add it to the selected layer's mask, or drag it onto a layer or onto the rows under a mask. */
const GEN_ICON_STYLE={edge:'edge',chips:'blot',scratch:'streak',scratches:'streak',streaks:'streak',drips:'streak',rust:'streak',water:'band',snow:'top',dust:'top',dirt:'blot',moss:'blot',slime:'blot',crud:'blot',soot:'blot',bleach:'grad',light:'grad',linear:'grad',radial:'radial',comic:'band',dir:'top',grad:'grad',g3d:'radial',clouds:'cloud',cells:'cells',grunge:'blot',dots:'dots',fibres:'streak',ao:'blot',curv:'edge',thick:'blot',height:'grad'};
function genIcon(key,w,h){const c=el('canvas',{width:w,height:h,'aria-hidden':'true'}),x=c.getContext('2d'),st=GEN_ICON_STYLE[key]||'blot';let sd=0;for(const ch of String(key))sd=(sd*31+ch.charCodeAt(0))>>>0;
  const rnd=()=>{sd=(sd*1664525+1013904223)>>>0;return sd/4294967296;};x.fillStyle='#16181c';x.fillRect(0,0,w,h);
  const blobs=(n,r0,r1,a)=>{for(let i=0;i<n;i++){const px=rnd()*w,py=rnd()*h,r=r0+rnd()*(r1-r0),g=x.createRadialGradient(px,py,0,px,py,r);g.addColorStop(0,'rgba(235,235,235,'+a+')');g.addColorStop(1,'rgba(235,235,235,0)');x.fillStyle=g;x.fillRect(px-r,py-r,r*2,r*2);}};
  if(st==='grad'||st==='top'){const g=x.createLinearGradient(0,h,0,0);g.addColorStop(0,'#101010');g.addColorStop(1,'#f0f0f0');x.fillStyle=g;x.fillRect(0,0,w,h);if(st==='top')blobs(10,3,8,.25);}
  else if(st==='radial'){const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,Math.max(w,h)/2);g.addColorStop(0,'#f0f0f0');g.addColorStop(1,'#101010');x.fillStyle=g;x.fillRect(0,0,w,h);}
  else if(st==='edge'){x.strokeStyle='rgba(240,240,240,.85)';x.lineWidth=3;x.strokeRect(5,5,w-10,h-10);blobs(14,2,6,.5);}
  else if(st==='streak'){for(let i=0;i<16;i++){const px=rnd()*w,len=h*(.3+rnd()*.7),g=x.createLinearGradient(0,0,0,len);g.addColorStop(0,'rgba(240,240,240,.9)');g.addColorStop(1,'rgba(240,240,240,0)');x.fillStyle=g;x.fillRect(px,rnd()*h*.4,1+rnd()*2,len);}}
  else if(st==='band'){const g=x.createLinearGradient(0,0,0,h);g.addColorStop(.35,'#101010');g.addColorStop(.5,'#eeeeee');g.addColorStop(.65,'#101010');x.fillStyle=g;x.fillRect(0,0,w,h);blobs(6,3,8,.2);}
  else if(st==='cells'){x.strokeStyle='rgba(240,240,240,.8)';x.lineWidth=1.4;for(let i=0;i<10;i++){x.beginPath();x.arc(rnd()*w,rnd()*h,6+rnd()*9,0,7);x.stroke();}}
  else if(st==='dots'){x.fillStyle='rgba(240,240,240,.9)';for(let i=0;i<46;i++){x.beginPath();x.arc(rnd()*w,rnd()*h,1+rnd()*2.4,0,7);x.fill();}}
  else if(st==='cloud'){blobs(20,8,22,.35);}
  else blobs(16,4,14,.55);
  return c;}
/* what each tile adds: [row kind, options], made when it is used so it reads the current baked maps */
function genRecs(){const R=[];
  for(const [k,title,part] of MS_MESH_GENS)R.push({group:'From baked maps',name:title,key:k,make:()=>['mesh',{p:Object.assign(MS_KINDS.mesh.p(),{k:msMeshPick(k),part:part||'both'})}]});
  for(const [k,title] of MS_GENS)R.push({group:'Wear and weather',name:title,key:k,make:()=>['gen',{p:msGenDefaults(k)}]});
  R.push({group:'Gradients and direction',name:'3D gradient',key:'g3d',make:()=>['g3d']},{group:'Gradients and direction',name:'Direction (faces pointing up)',key:'dir',make:()=>['dir']},{group:'Gradients and direction',name:'Gradient (bottom to top)',key:'grad',make:()=>['grad']});
  for(const [k,title] of MS_NOISES)R.push({group:'Noise and grunge',name:title,key:k,make:()=>['noise',{p:Object.assign(MS_KINDS.noise.p(),{type:k})}]});
  return R;}
/* put one generator on a layer's mask (the mask is made if the layer has none) */
function genApply(n,rec){if(!n||!isLayer(n)&&n.type!=='group'){toast('Select a layer in the Layers list first (or drop the generator on one).');return null;}
  selectOnly(n);n.editMask=true;const [kind,o]=rec.make(),r=msAdd(n,kind,o);renderLayers();return r;}
function genShelfRender(){const box=document.getElementById('shGenBody');if(!box)return;const tw=typeof matTw==='function'?matTw():64,groups=new Map();
  for(const r of genRecs()){if(!groups.has(r.group))groups.set(r.group,[]);groups.get(r.group).push(r);}
  box.replaceChildren(...[...groups].flatMap(([g,list])=>[el('div',{class:'sub',text:g}),el('div',{class:'matgrid'},...list.map(r=>{
    const pic=typeof GEN_THUMBS!=='undefined'&&GEN_THUMBS[r.group+'|'+r.name],sz=Math.max(48,Math.round(tw));
    const b=el('button',{type:'button',class:'mattile gentile',title:r.name+': click to add to the selected layer’s mask, or drag it onto a layer','aria-label':r.name,'data-shkey':'gen:'+r.group+':'+r.name},pic?el('img',{class:'matprev',src:pic,width:sz,height:sz,alt:'',draggable:'false'}):genIcon(r.key,sz,Math.round(sz*.75)),el('span',{text:r.name}));
    b._libDrag=['gen',r];b.addEventListener('click',()=>genApply(doc.active,r));return b;}))]),
    el('p',{class:'note',text:'Drop a generator on a layer in the Layers list, or on the rows under its mask. A layer without a mask gets one.'}));}
