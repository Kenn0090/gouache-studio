/* ================= Decals (0.28, 3D Paint) =================
   Kenn: a library of bolts, rivets, vents, screws, labels, logos, cracks and bullet holes. Click one, then click the
   model: it lands there facing the surface, carrying colour, height (so the normal shows it), roughness and metal.
   Each decal is its own live sticker layer (a material projected on the model), so it stays movable with the gizmo.
   Import your own (a logo, a label: PNG with transparency); they are kept on this computer. */
const DC_LIST=[['bolt','Hex bolt'],['rivet','Rivet'],['phillips','Screw (cross)'],['slotted','Screw (slot)'],['vent','Vent grille'],['roundvent','Round vent'],
  ['warning','Warning label'],['hazard','Hazard stripes'],['plate','Serial plate'],['crack','Crack'],['bullet','Bullet hole'],['scratches','Scratches']];
const dc={armed:null,size:(()=>{try{return +localStorage.getItem('gs.dcSize')||.08;}catch(e){return .08;}})(),tint:false,mine:[],loaded:false,prev:new Map()};
/* each decal drawn four times: colour, height (grey, .5 = flat), roughness, metal; all share one outline (alpha) */
function dcDraw(kind,ch,S){const c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),k=S/256;x.scale(k,k);
  const V=(b,h,r,m)=>ch==='base'?b:ch==='height'?h:ch==='rough'?r:m;
  const g=v=>{const q=Math.round(Math.max(0,Math.min(1,v))*255);return 'rgb('+q+','+q+','+q+')';};
  const P=(b,h,r,m)=>V(b,g(h),g(r),g(m));/* paint: colour or a grey value */
  const dome=(cx,cy,R,b,h0,h1,r,m)=>{if(ch==='height'){const gr=x.createRadialGradient(cx-R*.2,cy-R*.2,0,cx,cy,R);gr.addColorStop(0,g(h1));gr.addColorStop(1,g(h0));x.fillStyle=gr;}
    else if(ch==='base'){const gr=x.createRadialGradient(cx-R*.35,cy-R*.35,R*.1,cx,cy,R);gr.addColorStop(0,'#d8dadd');gr.addColorStop(1,b);x.fillStyle=gr;}else x.fillStyle=P(b,0,r,m);
    x.beginPath();x.arc(cx,cy,R,0,7);x.fill();};
  let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
  const steel='#8d9196',dark='#2a2c2f';
  if(kind==='bolt'){x.fillStyle=P('#6f7378',.56,.45,1);x.beginPath();x.arc(128,128,112,0,7);x.fill();/* washer */
    x.beginPath();for(let i=0;i<6;i++){const a=i/6*Math.PI*2+Math.PI/6;x.lineTo(128+Math.cos(a)*92,128+Math.sin(a)*92);}x.closePath();
    if(ch==='height'){const gr=x.createRadialGradient(128,128,20,128,128,92);gr.addColorStop(0,g(.9));gr.addColorStop(1,g(.72));x.fillStyle=gr;}else x.fillStyle=P(steel,0,.35,1);x.fill();
    if(ch==='base'){x.strokeStyle='rgba(255,255,255,.25)';x.lineWidth=3;x.stroke();}}
  else if(kind==='rivet')dome(128,128,110,'#7d8186',.5,.92,.4,1);
  else if(kind==='phillips'||kind==='slotted'){dome(128,128,112,'#80858a',.52,.8,.38,1);x.fillStyle=P(dark,.42,.6,1);
    if(kind==='phillips'){x.fillRect(116,58,24,140);x.fillRect(58,116,140,24);}else{x.save();x.translate(128,128);x.rotate(.5);x.fillRect(-84,-11,168,22);x.restore();}}
  else if(kind==='vent'){x.fillStyle=P('#5c6166',.6,.5,.9);x.beginPath();x.roundRect(14,40,228,176,18);x.fill();
    for(let i=0;i<6;i++){x.fillStyle=P('#0d0e10',.18,.8,0);x.beginPath();x.roundRect(36,58+i*25,184,14,7);x.fill();}}
  else if(kind==='roundvent'){x.fillStyle=P('#5c6166',.6,.5,.9);x.beginPath();x.arc(128,128,118,0,7);x.fill();
    for(let r=22;r<=94;r+=24)for(let i=0,n=Math.round(r/5);i<n;i++){const a=i/n*Math.PI*2;x.fillStyle=P('#0d0e10',.2,.8,0);x.beginPath();x.arc(128+Math.cos(a)*r,128+Math.sin(a)*r,6,0,7);x.fill();}
    x.fillStyle=P('#0d0e10',.2,.8,0);x.beginPath();x.arc(128,128,9,0,7);x.fill();}
  else if(kind==='warning'){x.fillStyle=P('#121212',.53,.6,0);x.beginPath();x.roundRect(8,62,240,132,14);x.fill();x.fillStyle=P('#f2c11d',.56,.55,0);x.beginPath();x.roundRect(16,70,224,116,9);x.fill();
    x.fillStyle=P('#121212',.53,.6,0);x.beginPath();x.moveTo(60,92);x.lineTo(86,142);x.lineTo(34,142);x.closePath();x.fill();x.fillStyle=P('#f2c11d',.56,.55,0);x.font='bold 34px sans-serif';x.fillText('!',54,137);
    x.fillStyle=P('#121212',.53,.6,0);x.font='bold 30px sans-serif';x.fillText('WARNING',96,128);x.font='bold 14px sans-serif';x.fillText('HIGH VOLTAGE',100,152);}
  else if(kind==='hazard'){x.save();x.beginPath();x.rect(8,86,240,84);x.clip();for(let i=-6;i<12;i++){x.fillStyle=P(i%2?'#151515':'#f2c11d',.54,.6,0);x.beginPath();x.moveTo(i*28,86);x.lineTo(i*28+28,86);x.lineTo(i*28-56,170);x.lineTo(i*28-84,170);x.closePath();x.fill();}x.restore();}
  else if(kind==='plate'){x.fillStyle=P('#a7abb0',.58,.3,1);x.beginPath();x.roundRect(10,58,236,140,10);x.fill();
    for(const [cx,cy] of [[28,76],[228,76],[28,180],[228,180]])dome(cx,cy,9,'#7d8186',.58,.85,.4,1);
    x.fillStyle=P('#2b2d30',.52,.6,1);x.font='bold 20px sans-serif';x.fillText('MODEL  GS-28',54,104);x.font='14px monospace';x.fillText('SERIAL 0042-1187',54,130);x.fillText('24V   3.2A   IP65',54,152);x.fillRect(54,166,146,3);}
  else if(kind==='crack'||kind==='scratches'){const line=(x0,y0,a,L,w,d)=>{x.lineCap='round';let px=x0,py=y0;for(let i=0;i<L;i+=6){a+=(rnd()-.5)*.6;const nx=px+Math.cos(a)*6,ny=py+Math.sin(a)*6;
        x.strokeStyle=P(kind==='crack'?'#141210':'#c9cbcd',kind==='crack'?.18:.44,kind==='crack'?.85:.25,kind==='crack'?0:1);x.lineWidth=Math.max(.7,w*(1-i/L));x.beginPath();x.moveTo(px,py);x.lineTo(nx,ny);x.stroke();px=nx;py=ny;
        if(kind==='crack'&&d<3&&rnd()<.08)line(px,py,a+(rnd()<.5?-1:1)*(.5+rnd()*.6),L*.45,w*.6,d+1);}};
    if(kind==='crack')line(128,128,rnd()*6,130,7,0),line(128,128,rnd()*6+3,110,6,0),line(128,128,rnd()*6+1.5,90,5,0);
    else for(let i=0;i<14;i++)line(20+rnd()*160,30+rnd()*200,-.3+rnd()*.25,60+rnd()*140,1.5+rnd()*2.5,5);}
  else if(kind==='bullet'){if(ch==='base'){const gr=x.createRadialGradient(128,128,10,128,128,110);gr.addColorStop(0,'rgba(20,16,12,1)');gr.addColorStop(.35,'rgba(40,34,28,.85)');gr.addColorStop(1,'rgba(40,34,28,0)');x.fillStyle=gr;}
    else x.fillStyle=ch==='height'?'rgba(128,128,128,.9)':ch==='rough'?g(.8):g(0);
    x.beginPath();x.arc(128,128,110,0,7);x.fill();
    x.strokeStyle=P('#9a9ea3',.66,.35,1);x.lineWidth=9;x.beginPath();x.arc(128,128,30,0,7);x.stroke();/* raised petal rim */
    for(let i=0;i<9;i++){const a=i/9*Math.PI*2+rnd()*.4;x.strokeStyle=P('#1a1612',.3,.8,0);x.lineWidth=2;x.beginPath();x.moveTo(128+Math.cos(a)*34,128+Math.sin(a)*34);x.lineTo(128+Math.cos(a+.1)*(60+rnd()*40),128+Math.sin(a+.1)*(60+rnd()*40));x.stroke();}
    x.fillStyle=P('#050505',.05,.9,0);x.beginPath();x.arc(128,128,24,0,7);x.fill();}
  return c;}
/* the decal's four pictures as targets (every map keeps the colour's outline) */
function dcTargets(kind){const S=512,out={},base=dcDraw(kind,'base',S);
  const up=c=>{const tex=uploadStraight({el:c,w:S,h:S}),t=makeTarget(S,S,8,true);premultInto(t,tex,[0,0],null);gl.deleteTexture(tex);return t;};
  out.base=up(base);for(const ch of ['height','rough','metal']){const c=dcDraw(kind,ch,S),x=c.getContext('2d');x.globalCompositeOperation='destination-in';x.setTransform(1,0,0,1,0,0);x.drawImage(base,0,0);out[ch]=up(c);}
  return out;}
/* your own decal: the picture's colour and outline, a little raised */
function dcFromTarget(src){const S=Math.max(src.w,src.h),out={base:makeTarget(src.w,src.h,8,true)};blit(src,out.base,0,0,src.w,src.h,0,0);
  const d=captureRegionNow(src,0,0,src.w,src.h).data;const mk=f=>{const a=new Uint8Array(d.length);for(let i=0;i<d.length;i+=4){const al=d[i+3],v=f(al?(d[i]*.3+d[i+1]*.59+d[i+2]*.11)/al:0)*al;a[i]=a[i+1]=a[i+2]=Math.round(v);a[i+3]=al;}const t=makeTarget(src.w,src.h,8,true);writeRegion(t,0,0,src.w,src.h,a);return t;};
  out.height=mk(l=>.55+l*.05);out.rough=mk(()=>.55);out.metal=mk(()=>0);return out;}
/* ---- placing: a planar projection at the clicked point, facing the surface ---- */
function dcXf(pos,n,size,aspect){const c=v3.cam,eye=v3Eye(),tg=[c.tx,c.ty,c.tz],cf=norm3(sub3(tg,eye));let up=cross3(cross3(cf,[0,1,0]),cf);if(Math.hypot(...up)<1e-4)up=[0,1,0];
  const f=[-n[0],-n[1],-n[2]];let r=cross3(f,norm3(up));if(Math.hypot(...r)<1e-4)r=cross3(f,[1,0,0]);r=norm3(r);const u=cross3(r,f),bk=n;
  const R=[[r[0],u[0],bk[0]],[r[1],u[1],bk[1]],[r[2],u[2],bk[2]]].map(row=>row.map((v,j)=>j===1?v:-v)),{c:mc}=pxfModel();
  return {t:[pos[0]-mc[0],pos[1]-mc[1],pos[2]-mc[2]],r:pxfEuler(R),s:aspect>1?[size/aspect,size,1]:[size,size*aspect,1]};}
function dcNormalAt(p){const m=v3.mesh,src=m;const t=sel3Tri(src,p.eye,p.dir,{start:0,count:src.idx.length/3});if(t<0)return null;const I=src.idx,P=src.pos,a=I[t*3]*3,b=I[t*3+1]*3,cc=I[t*3+2]*3;
  let n=norm3(cross3(sub3([P[b],P[b+1],P[b+2]],[P[a],P[a+1],P[a+2]]),sub3([P[cc],P[cc+1],P[cc+2]],[P[a],P[a+1],P[a+2]])));if(n[0]*p.dir[0]+n[1]*p.dir[1]+n[2]*p.dir[2]>0)n=n.map(v=>-v);return n;}
async function dcPlace(it,p){const n=dcNormalAt(p)||[-p.dir[0],-p.dir[1],-p.dir[2]];let imgs;
  if(it.kind==='mine'){const t=makeTarget(it.rec.w,it.rec.h,8,true);writeRegion(t,0,0,it.rec.w,it.rec.h,it.rec.data);imgs=dcFromTarget(t);disposeTarget(t);}else imgs=dcTargets(it.id);
  if(dc.tint&&imgs.base){const d=captureRegionNow(imgs.base,0,0,imgs.base.w,imgs.base.h).data,f=ui.fg;for(let i=0;i<d.length;i+=4){d[i]*=f[0];d[i+1]*=f[1];d[i+2]*=f[2];}writeRegion(imgs.base,0,0,imgs.base.w,imgs.base.h,d);}
  const chans={};for(const k in imgs)if(doc.maps.includes(k))chans[k]={on:true,src:'image',name:it.name,tile:1,rot:0};
  const L=cmdNewFillLayer({name:it.name,maps:chans,proj:'planar',rep:false,front:true,decal:true,xf:dcXf(p.pos,n,dc.size,imgs.base.h/imgs.base.w),imgs});
  for(const k in imgs)disposeTarget(imgs[k]);if(L){L.fill.decal=true;fillRender(L);renderLayers();v3.dirty=true;requestRender(true);}return L;}
/* armed: the next click on the model places it (Esc or the tile again stops) */
function dcArm(it){dc.armed=dc.armed&&dc.armed.kind===it.kind&&dc.armed.id===it.id?null:it;renderDecals();
  if(dc.armed)toast('Click the model to place “'+it.name+'”. Keep clicking for more; Esc stops.');}
document.addEventListener('pointerdown',async e=>{if(!dc.armed||ui.mode!=='p3d'||e.button!==0||e.altKey||!e.target||e.target.id!=='v3Hit')return;
  const p=v3PickAt(e.target,e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();await dcPlace(dc.armed,p);},true);
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&dc.armed){dc.armed=null;renderDecals();}});
/* your own decals: kept in the textures store, marked as decals */
async function dcLoad(){if(dc.loaded)return;dc.loaded=true;try{dc.mine=((await store.all('textures'))||[]).filter(r=>r.decal).sort((a,b)=>(a.t||0)-(b.t||0));}catch(e){dc.mine=[];}renderDecals();}
async function dcImport(){const fs=await pickFiles('image/*',true,'Pictures (PNG with transparency works best)',['png','webp','jpg','jpeg','tga']);let n=0;
  for(const f of fs){try{const t=await fileTarget(f);const rec={id:'d'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),name:baseName(f.name),t:Date.now(),decal:true,w:t.w,h:t.h,data:captureRegionNow(t,0,0,t.w,t.h).data};disposeTarget(t);
      dc.mine.push(rec);await store.put(rec,'textures');n++;}catch(e){toast('Could not read '+f.name+': '+(e.message||e));}}
  if(n){renderDecals();toast('Added '+n+' decal'+(n>1?'s':'')+'. Click one, then click the model.');}}
function dcPreview(it){const key=it.kind+':'+it.id;if(dc.prev.has(key))return dc.prev.get(key);let u='';
  if(it.kind==='mine'){const c=document.createElement('canvas');c.width=it.rec.w;c.height=it.rec.h;const id=c.getContext('2d').createImageData(it.rec.w,it.rec.h),d=it.rec.data;
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;id.data[i]=d[i]*255/a;id.data[i+1]=d[i+1]*255/a;id.data[i+2]=d[i+2]*255/a;id.data[i+3]=d[i+3];}c.getContext('2d').putImageData(id,0,0);
    const s=document.createElement('canvas');s.width=s.height=64;const x=s.getContext('2d'),k=Math.min(64/c.width,64/c.height);x.drawImage(c,(64-c.width*k)/2,(64-c.height*k)/2,c.width*k,c.height*k);u=s.toDataURL();}
  else u=dcDraw(it.id,'base',64).toDataURL();
  dc.prev.set(key,u);return u;}
function renderDecals(){const box=$('#dcBody');if(!box)return;if(!dc.loaded)dcLoad();
  const items=[...DC_LIST.map(([id,name])=>({kind:'built',id,name})),...dc.mine.map(rec=>({kind:'mine',id:rec.id,name:rec.name,rec}))];
  const on=it=>dc.armed&&dc.armed.kind===it.kind&&dc.armed.id===it.id;
  box.replaceChildren(el('div',{class:'chips'},el('button',{class:'btn sm',id:'dcImport',text:'Import your own…',title:'A logo or label: PNG with transparency',onclick:dcImport})),
    makeSlider({id:'dcSize',label:'Size',min:.01,max:.5,step:.005,value:dc.size,fmt:pct,onInput:v=>{dc.size=v;try{localStorage.setItem('gs.dcSize',String(v));}catch(e){}}}).el,
    chk('dcTint','Tint with the foreground colour',dc.tint,v=>{dc.tint=v;}),
    el('div',{class:'matgrid',id:'dcGrid'},...items.map(it=>{const b=el('button',{class:'mattile dctile'+(on(it)?' on':''),id:'dc_'+it.id,'aria-pressed':String(!!on(it)),title:it.name+': click, then click the model',onclick:()=>dcArm(it)},
      el('img',{src:dcPreview(it),alt:'',width:56,height:56}),el('span',{text:it.name}));
      if(it.kind!=='mine')return b;return el('div',{class:'matwrap'},b,el('div',{class:'matacts'},el('button',{class:'btn sm',text:'×',title:'Delete','aria-label':'Delete '+it.name,onclick:()=>confirmDlg('Delete decal','Delete “'+it.name+'”? Decals on models stay.','Delete',()=>{dc.mine.splice(dc.mine.indexOf(it.rec),1);store.del(it.rec.id,'textures');renderDecals();})})));})),
    el('p',{class:'note',text:ui.mode==='p3d'?'Click a decal, then click the model. Each decal is a layer you can move, turn and scale with the gizmo; right-click › Convert to pixels fixes it.':'Decals are placed on the model in 3D Paint.'}));}
