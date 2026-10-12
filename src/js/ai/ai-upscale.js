/* ================= AI upscaler (0.62): Real-ESRGAN makes a picture 2×, 4× or 8× bigger =================
   Runs on this computer, in small tiles so even big pictures fit in memory. 8× is two passes (4× then 2×) on each tile, so no huge
   in-between picture is kept. "AI detail" below 100% mixes in a plain smooth enlargement, which keeps the result more natural.
   img: {w,h,data RGBA8 straight}. Returns {w,h,data RGBA8}. */
const AI_UP_TILE={2:176,4:128,8:72},AI_UP_PAD=12;
const AI_UP_STAGES={2:['real_esrgan_x2.onnx'],4:['real_esrgan_x4.onnx'],8:['real_esrgan_x4.onnx','real_esrgan_x2.onnx']};
const AI_UP_FACTOR={'real_esrgan_x2.onnx':2,'real_esrgan_x4.onnx':4};
/* how big the result would be, and whether that is allowed */
function aiUpSize(w,h,s,max){max=max||MAX_DIM;const W=Math.round(w*s),H=Math.round(h*s);return {w:W,h:H,ok:W<=max&&H<=max,mp:W*H/1e6};}
function aiUpBest(w,h,max){for(const s of [8,4,2])if(aiUpSize(w,h,s,max).ok)return s;return 0;}
async function aiUpscale(img,scale,o,prog){o=o||{};prog=prog||(()=>{});const W=img.w,H=img.h,S=scale,OW=W*S,OH=H*S,T=AI_UP_TILE[S],P=AI_UP_PAD,mix=clamp((o.strength==null?100:o.strength)/100,0,1),src=img.data;
  const ort=await aiEngine(),stages=AI_UP_STAGES[S];if(!stages)throw new Error('This enlargement is not available.');
  const sess=[];for(const f of stages)sess.push(await aiSession('upscale',f));
  let hasA=false;for(let i=3;i<src.length;i+=4)if(src[i]<255){hasA=true;break;}
  const out=new Uint8ClampedArray(OW*OH*4),nx=Math.ceil(W/T),ny=Math.ceil(H/T),total=nx*ny;let done=0;
  const px=(x,y,c)=>src[(Math.min(H-1,Math.max(0,y))*W+Math.min(W-1,Math.max(0,x)))*4+c];
  /* the plain smooth enlargement of one output pixel (bilinear, centred like the AI result) */
  const bil=(fx,fy,c)=>{const x0=Math.floor(fx),y0=Math.floor(fy),ax=fx-x0,ay=fy-y0;return (px(x0,y0,c)*(1-ax)+px(x0+1,y0,c)*ax)*(1-ay)+(px(x0,y0+1,c)*(1-ax)+px(x0+1,y0+1,c)*ax)*ay;};
  for(let ty=0;ty<ny;ty++)for(let tx=0;tx<nx;tx++){
    if(o.stop&&o.stop())throw new Error('Stopped.');
    const x0=tx*T,y0=ty*T,tw=Math.min(T,W-x0),th=Math.min(T,H-y0),iw=tw+2*P,ih=th+2*P;
    let f=new Float32Array(3*iw*ih);
    for(let y=0;y<ih;y++)for(let x=0;x<iw;x++){const sx=Math.min(W-1,Math.max(0,x0-P+x)),sy=Math.min(H-1,Math.max(0,y0-P+y)),i=(sy*W+sx)*4,j=y*iw+x;f[j]=src[i]/255;f[iw*ih+j]=src[i+1]/255;f[2*iw*ih+j]=src[i+2]/255;}
    let cw=iw,ch=ih,data=f;
    for(let k=0;k<stages.length;k++){const fac=AI_UP_FACTOR[stages[k]],r=await sess[k].run({input:new ort.Tensor('float32',data,[1,3,ch,cw])});data=r.output.data;cw*=fac;ch*=fac;
      if(k<stages.length-1){const c=new Float32Array(data.length);for(let i=0;i<c.length;i++){const v=data[i];c[i]=v<0?0:v>1?1:v;}data=c;}}
    /* write the middle of the result (without the border) into the big picture */
    const ow=tw*S,oh=th*S,bx=P*S,by=P*S;
    for(let y=0;y<oh;y++){const oy=y0*S+y,row=(by+y)*cw+bx;for(let x=0;x<ow;x++){const ox=x0*S+x,i=(oy*OW+ox)*4,j=row+x;
      let r=data[j]*255,g=data[cw*ch+j]*255,b=data[2*cw*ch+j]*255;
      if(mix<1||hasA){const fx=(ox+.5)/S-.5,fy=(oy+.5)/S-.5;
        if(mix<1){r=bil(fx,fy,0)*(1-mix)+r*mix;g=bil(fx,fy,1)*(1-mix)+g*mix;b=bil(fx,fy,2)*(1-mix)+b*mix;}
        out[i+3]=hasA?bil(fx,fy,3)+.5:255;}else out[i+3]=255;
      out[i]=r+.5;out[i+1]=g+.5;out[i+2]=b+.5;}}
    done++;prog(done/total);await new Promise(r=>setTimeout(r,0));}
  return {w:OW,h:OH,data:out};}
/* a result as a canvas (for saving) */
function aiUpCanvas(res){const c=document.createElement('canvas');c.width=res.w;c.height=res.h;const g=c.getContext('2d');
  const band=Math.max(1,Math.floor(4e6/res.w));for(let y=0;y<res.h;y+=band){const h=Math.min(band,res.h-y);g.putImageData(new ImageData(res.data.subarray(y*res.w*4,(y+h)*res.w*4),res.w,h),0,y);}return c;}
/* the upscale choice that goes into a dialog: size choice, AI detail slider and a before/after preview.
   o: {size:[w,h] or a function giving it, max, allowNone, scale, crop:async(n)=>img (the middle n×n of the picture), onChange} */
function aiUpBox(o){const st={scale:o.scale===undefined?4:o.scale,strength:100},box=el('div',{class:'aiup'}),size=()=>typeof o.size==='function'?o.size():o.size;
  const opts=[...(o.allowNone?[[0,'Not enlarged']]:[]),[2,'2× (twice as big)'],[4,'4×'],[8,'8× (two passes, softer)']];
  const sel=el('select',{id:'aiUpScale','aria-label':'Enlarge'},...opts.map(([v,t])=>el('option',{value:String(v),text:t})));sel.value=String(st.scale);
  const det=makeSlider({id:'aiUpDetail',label:'AI detail',min:0,max:100,step:1,value:100,fmt:v=>Math.round(v)+'%',onInput:v=>{st.strength=Math.round(v);o.onChange&&o.onChange(st);},onChange:v=>{st.strength=Math.round(v);o.onChange&&o.onChange(st);}});
  const note=el('p',{class:'note',id:'aiUpNote'}),need=el('div',{class:'frow',id:'aiUpNeed'}),bef=el('canvas',{id:'aiUpBef',class:'aiupc'}),aft=el('canvas',{id:'aiUpAft',class:'aiupc'}),pnote=el('p',{class:'note',id:'aiUpPNote'});
  const btn=el('button',{class:'btn sm',id:'aiUpPrev',text:'Preview',onclick:()=>preview()});
  const refresh=()=>{const [w,h]=size(),s=st.scale;det.el.hidden=!s;btn.disabled=!s;
    if(!s){note.textContent='The picture keeps its size.';}else{const z=aiUpSize(w,h,s,o.max);note.textContent=w+' × '+h+' px becomes '+z.w+' × '+z.h+' px ('+z.mp.toFixed(1)+' million pixels).'+(z.ok?(z.mp>100?' That is very big: it can take a long time and a lot of memory.':''):' This is bigger than the '+(o.max||MAX_DIM)+' px limit. '+(aiUpBest(w,h,o.max)?'Choose '+aiUpBest(w,h,o.max)+'× or less.':'Use a smaller picture.'));}
    note.classList.toggle('warn',!!s&&!aiUpSize(w,h,s,o.max).ok);
    need.replaceChildren();if(s&&!(aiHas('engine')&&aiHas('upscale')))need.append(el('span',{class:'note',text:'The upscaler is an optional download ('+aiMB(aiSize('upscale'))+').'}),el('button',{class:'btn sm primary',id:'aiUpGet',text:'Get the upscaler',onclick:async()=>{await aiGet(['upscale']);refresh();}}));
    box.classList.toggle('off',!s);};
  sel.onchange=()=>{st.scale=+sel.value;refresh();o.onChange&&o.onChange(st);};
  let busy=false;
  async function preview(){if(busy||!st.scale)return;if(!(aiHas('engine')&&aiHas('upscale'))){refresh();return;}
    const s=st.scale,[w,h]=size(),n=Math.max(8,Math.min(Math.round(300/s),Math.min(w,h)));busy=true;btn.disabled=true;pnote.textContent='Working…';
    try{const img=await o.crop(n),a=await aiUpscale(img,s,{strength:st.strength}),ac=aiUpCanvas(a);
      for(const [c,src] of [[bef,null],[aft,ac]]){c.width=a.w;c.height=a.h;const g=c.getContext('2d');g.imageSmoothingQuality='high';
        if(src)g.drawImage(src,0,0);else{const t=new OffscreenCanvas(img.w,img.h);t.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(img.data),img.w,img.h),0,0);g.drawImage(t,0,0,a.w,a.h);}}
      pnote.textContent='Left: plain enlargement. Right: AI upscale (middle of the picture, at its real size).';}
    catch(e){console.warn(e);pnote.textContent='The preview did not work: '+(e.message||e);}finally{busy=false;btn.disabled=!st.scale;}}
  box.append(el('div',{class:'frow'},el('label',{for:'aiUpScale',text:'Enlarge'}),sel),det.el,note,need,el('div',{class:'frow'},btn),el('div',{class:'aiupcmp'},bef,aft),pnote);refresh();
  return {el:box,state:st,refresh,preview};}
/* ---- Paint: Image › Upscale (AI)… makes the picture on screen into a new, bigger document in its own tab ---- */
function aiPaintUpscale(){if(ui.mode!=='paint'){toast('Open the Paint tab for this.');return;}
  const R=renderNodesMap(doc.root.children,'base');let img;try{img=aiPixels(R,Math.max(R.w,R.h));}finally{release(R);}
  const name=doc.name||'Untitled',max=MAX_DIM,def=aiUpBest(img.w,img.h,max);if(!def){toast('This picture is already as big as the app can open ('+max+' px).');return;}
  const box=aiUpBox({size:[img.w,img.h],max,scale:Math.min(4,def),crop:async n=>{const x=Math.max(0,Math.round((img.w-n)/2)),y=Math.max(0,Math.round((img.h-n)/2)),d=new Uint8ClampedArray(n*n*4);
    for(let j=0;j<n;j++)d.set(img.data.subarray(((y+j)*img.w+x)*4,((y+j)*img.w+x+n)*4),j*n*4);return {w:n,h:n,data:d};}});
  const body=el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Makes a bigger copy of the picture you see now (all layers flattened) in a new tab. Your own document is not changed.'}),box.el);
  openDialog({title:'Upscale (AI)',body,okLabel:'Upscale',wide:true,onOk(){setTimeout(()=>aiPaintUpscaleRun(img,name,box.state),0);}});}
async function aiPaintUpscaleRun(img,name,st){const s=st.scale;if(!s)return;if(!(aiHas('engine')&&aiHas('upscale'))){toast('This needs the upscaler add-on. Opening File › AI add-ons…');dlgAddons();return;}
  if(!aiUpSize(img.w,img.h,s,MAX_DIM).ok){toast('That is bigger than '+MAX_DIM+' px. Choose a smaller enlargement.');return;}
  let stop=false;
  try{const res=await aiBusy('Upscaling ×'+s,async prog=>{loadCancel(()=>{stop=true;});return aiUpscale(img,s,{strength:st.strength,stop:()=>stop},prog);});
    if(!dtNewTab())return;openRaw({w:res.w,h:res.h,data:res.data,bits:8},name+' ×'+s);}
  catch(e){if(!/Stopped/.test(e.message||''))console.warn(e);toast(/Stopped/.test(e.message||'')?'Stopped.':'The upscale did not work: '+(e.message||e));}}
/* ---- Convert: Upscale the picture (AI) swaps the source for a bigger version ---- */
function cvAiUpscale(){if(!cvS.src){toast('Load a picture first.');return;}
  const img=aiPixels(cvS.src,Math.max(cvS.src.w,cvS.src.h)),max=MAX_DIM,def=aiUpBest(img.w,img.h,max);if(!def){toast('This picture is already as big as the Convert tab can take ('+max+' px).');return;}
  const box=aiUpBox({size:[img.w,img.h],max,scale:Math.min(4,def),crop:async n=>{const x=Math.max(0,Math.round((img.w-n)/2)),y=Math.max(0,Math.round((img.h-n)/2)),d=new Uint8ClampedArray(n*n*4);
    for(let j=0;j<n;j++)d.set(img.data.subarray(((y+j)*img.w+x)*4,((y+j)*img.w+x+n)*4),j*n*4);return {w:n,h:n,data:d};}});
  openDialog({title:'Upscale the picture (AI)',body:el('div',{class:'dlg-grid'},el('p',{class:'note',text:'Replaces the picture with a bigger, sharper one, so every map comes out at the bigger size.'}),box.el),okLabel:'Upscale',wide:true,onOk(){setTimeout(()=>cvAiUpscaleRun(img,box.state),0);}});}
async function cvAiUpscaleRun(img,st){const s=st.scale;if(!s)return;if(!(aiHas('engine')&&aiHas('upscale'))){toast('This needs the upscaler add-on. Opening File › AI add-ons…');dlgAddons();return;}
  if(!aiUpSize(img.w,img.h,s,MAX_DIM).ok){toast('That is bigger than '+MAX_DIM+' px. Choose a smaller enlargement.');return;}
  let stop=false;
  try{const res=await aiBusy('Upscaling ×'+s,async prog=>{loadCancel(()=>{stop=true;});return aiUpscale(img,s,{strength:st.strength,stop:()=>stop},prog);});
    const name=cvS.srcName||'Texture';if(ui.mode==='convert')tabDocResize(res.w,res.h,'Convert');const t=makeTarget(doc.w,doc.h,cvDepth(),false);drawRawStretch(t,{w:res.w,h:res.h,data:res.data,bits:8});cvSetSource(t,name+' ×'+s,true);toast('The picture is now '+res.w+' × '+res.h+' px.');}
  catch(e){if(!/Stopped/.test(e.message||''))console.warn(e);toast(/Stopped/.test(e.message||'')?'Stopped.':'The upscale did not work: '+(e.message||e));}}
