/* ================= Ribbon path (0.93.3, Kenn: like Substance Painter) =================
   A surface path in Ribbon mode repeats or stretches a picture along its curve, following the curve's bends. The picture can be text (so words bend
   along the path) or any picture; its alpha (or brightness, for pictures without alpha) is the shape, and the layer's material fills it.
   Settings follow Painter's: stroke width and opacity, image orientation, flip, corner (round fills the outer side of a bend with a disc; bevel leaves it cut), stretch along path or keep aspect ratio,
   tiling (none, auto, custom), mirror every 2nd tile, start and end offsets, ratio, alignment, aspect ratio factor, and how overlapping parts blend. */
const RB_DEFAULT={img:null,orient:0,flip:false,corner:'round',omit:false,fit:'stretch',between:false,startOff:.1,endOff:.1,tiling:'auto',tiles:4,mirror:false,aspectK:1,ratio:'width',remove:false,align:'start',blend:'max'};
const FS_SURFACERIBBON=`in vec3 vP; in vec3 vN; uniform vec3 uA; uniform vec3 uB; uniform vec3 uNA; uniform vec3 uNB; uniform vec2 uW; uniform vec2 uS; uniform float uDepth;
uniform sampler2D uRibImg; uniform int uChan; uniform float uTotal; uniform float uTileLen; uniform float uTiles; uniform float uNTiles; uniform int uFit; uniform float uOffS; uniform int uMirror; uniform int uFlip; uniform int uRot;
uniform float uStartOff; uniform float uEndOff; uniform float uIStart; uniform float uIEnd; uniform int uRemove; uniform int uRound; uniform vec2 uCap;
void main(){vec3 ab=uB-uA;float l2=max(dot(ab,ab),1e-10);float t0=dot(vP-uA,ab)/l2;float t=clamp(t0,0.0,1.0);vec3 n=normalize(mix(uNA,uNB,t)),q=vP-mix(uA,uB,t);float z=dot(q,n),w=mix(uW.x,uW.y,t);
  if(dot(normalize(vN),n)<0.0||abs(z)>uDepth){o=vec4(0.0);return;}
  vec3 tangent=ab-n*dot(ab,n);tangent=normalize(length(tangent)>1e-6?tangent:cross(n,abs(n.y)<0.9?vec3(0,1,0):vec3(1,0,0)));vec3 side=normalize(cross(n,tangent));
  float lat=dot(q,side),along=dot(q,tangent);if(abs(lat)>0.5*w){o=vec4(0.0);return;}
  if(t0<0.0||t0>1.0){if(uRound==0||(t0<0.0?uCap.x:uCap.y)<0.5||length(vec2(along,lat))>0.5*w){o=vec4(0.0);return;}}
  float s=mix(uS.x,uS.y,t);if(t0<0.0||t0>1.0)s+=along;float f,k=0.0;
  if(uFit==0){float L=uTotal;
    if(uStartOff+uEndOff>0.0){if(s<uStartOff)f=s/max(uStartOff,1e-6)*uIStart;else if(s>L-uEndOff)f=1.0-uIEnd+(s-(L-uEndOff))/max(uEndOff,1e-6)*uIEnd;else f=uIStart+(s-uStartOff)/max(L-uStartOff-uEndOff,1e-6)*(1.0-uIStart-uIEnd);}
    else{float xi=s/L*uTiles;if(uTiles<=1.0){f=clamp(xi,0.0,1.0);}else{k=floor(xi);f=fract(xi);}}}
  else{float x=(s-uOffS)/uTileLen;if(uRemove==1&&(x<0.0||x>=uNTiles)){o=vec4(0.0);return;}if(uTiles<=1.0){f=clamp(x,0.0,1.0);}else{k=floor(x);f=fract(x);}}
  if(uMirror==1&&mod(k,2.0)>0.5)f=1.0-f;
  vec2 uv=vec2(f,0.5-lat/w);if(uFlip==1)uv.y=1.0-uv.y;
  if(uRot==1)uv=vec2(uv.y,1.0-uv.x);else if(uRot==2)uv=vec2(1.0-uv.x,1.0-uv.y);else if(uRot==3)uv=vec2(1.0-uv.y,uv.x);
  vec4 c=texture(uRibImg,uv);float a=uChan==2?c.r:uChan==1?dot(c.rgb,vec3(0.299,0.587,0.114))*c.a:c.a;o=vec4(a,a,a,a);}`;
let P_SURFACERIBBON=null;
const rbKey=P=>'rb:'+P.id;
function rbImage(L,P){return L._fillImg&&L._fillImg[rbKey(P)]||null;}
function rbSetImage(L,P,target,kind,spec){L._fillImg=L._fillImg||{};const old=L._fillImg[rbKey(P)];L._fillImg[rbKey(P)]=target;if(old&&old!==target)disposeTarget(old);P.ribbon=Object.assign({},RB_DEFAULT,P.ribbon);P.ribbon.img={kind,spec:spec||null,w:target.w,h:target.h};}
/* text as the ribbon's picture */
async function rbTextImage(L,P,spec){const B=await t3Bitmap(spec,false);rbSetImage(L,P,B.T,'text',Object.assign({},spec));}
function pathSurfaceRibbon(L,P,samples,T){const R=P.ribbon||RB_DEFAULT,img=rbImage(L,P);if(!img||samples.length<2)return;if(!P_SURFACERIBBON)P_SURFACERIBBON=prog3(VS_3DPROJ,FS_SURFACERIBBON);
  const m=v3.mesh,g=v3.gpu,C=pathMeshIndex(m),RG=p3Range(),V=gl.createVertexArray(),E=gl.createBuffer(),W=P.width,S=[0];for(let i=1;i<samples.length;i++)S.push(S[i-1]+Math.hypot(...sub3d(samples[i].p,samples[i-1].p)));
  const total=Math.max(S[S.length-1],1e-6),turned=R.orient%180!==0,imgAspect=(turned?img.h/img.w:img.w/img.h)*(R.aspectK||1);let tiles=1,tileLen=W*imgAspect,ntiles=1,shift=0;
  if(R.fit==='stretch'){tiles=R.tiling==='none'?1:R.tiling==='custom'?Math.max(1,R.tiles|0):Math.max(1,Math.round(total/Math.max(W*imgAspect,1e-6)));}
  else{if(R.ratio==='length'){const n=Math.max(1,Math.round(total/Math.max(W*imgAspect,1e-6)));tileLen=total/n;}if(R.tiling==='none')tiles=1;else if(R.tiling==='custom'){tiles=Math.max(1,R.tiles|0);tileLen=total/tiles;}else tiles=2;
    ntiles=Math.max(1,Math.floor(total/tileLen+1e-6));const rest=total-ntiles*tileLen;shift=R.align==='center'?rest/2:R.align==='end'?rest:0;}
  const so=R.fit==='stretch'&&R.between?total*R.startOff:0,eo=R.fit==='stretch'&&R.between?total*R.endOff:0;
  gl.bindVertexArray(V);gl.bindBuffer(gl.ARRAY_BUFFER,g.vb);for(const [a,n,o] of [[0,3,0],[1,3,12],[2,2,24],[4,3,48]]){gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,n,gl.FLOAT,false,60,o);}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,E);
  try{for(let i=1;i<samples.length;i++){const a=samples[i-1],b=samples[i],pad=W*.7*Math.max(1,P.depthK||1),lo=a.p.map((v,k)=>Math.min(v,b.p[k])-pad),hi=a.p.map((v,k)=>Math.max(v,b.p[k])+pad),tris=[],bb=[Infinity,Infinity,-Infinity,-Infinity];
      const overlaps=(l,h)=>l.every((v,k)=>v<=hi[k]&&h[k]>=lo[k]);const visit=N=>{if(!overlaps(N.lo,N.hi))return;if(N.l){visit(N.l);visit(N.r);}else for(let j=N.a;j<N.b;j++){const t=C.ids[j],q=t*6;if(t<RG.start||t>=RG.start+RG.count||!overlaps(C.bounds.subarray(q,q+3),C.bounds.subarray(q+3,q+6)))continue;for(let k=0;k<3;k++){const v=m.idx[t*3+k];tris.push(v);bb[0]=Math.min(bb[0],m.uv[v*2]*doc.w);bb[1]=Math.min(bb[1],m.uv[v*2+1]*doc.h);bb[2]=Math.max(bb[2],m.uv[v*2]*doc.w);bb[3]=Math.max(bb[3],m.uv[v*2+1]*doc.h);}}};visit(C.tree);if(!tris.length)continue;
      gl.bindVertexArray(V);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,E);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(tris),gl.STREAM_DRAW);bindTarget(T);gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.SCISSOR_TEST);gl.scissor(Math.max(0,Math.floor(bb[0]-1)),Math.max(0,Math.floor(bb[1]-1)),Math.ceil(bb[2]-bb[0]+2),Math.ceil(bb[3]-bb[1]+2));gl.enable(gl.BLEND);
      if(R.blend==='add'){gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE);}else if(R.blend==='normal'){gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ZERO);}else{gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);}
      const dirOf=(u,v)=>{const d=sub3d(v.p,u.p),l=Math.hypot(...d)||1;return d.map(x=>x/l);},bend=(u,v,w2)=>{const d1=dirOf(u,v),d2=dirOf(v,w2);return Math.acos(Math.max(-1,Math.min(1,d1[0]*d2[0]+d1[1]*d2[1]+d1[2]*d2[2])));},
        thr=.07,n=samples.length,capA=i>1&&bend(samples[i-2],a,b)>thr?1:0,capB=i<n-1&&bend(a,b,samples[i+1])>thr?1:0;/* Round corners: at a bend the outer side is filled with a disc round the joint, the picture carrying straight on past the end of the segment */
      useProg(P_SURFACERIBBON,{uCap:[capA,capB],uUVs:1,uShift:[0,0],uH:dummy,uDisp:0,uUseH:false,uA:a.p,uB:b.p,uNA:a.n,uNB:b.n,uW:[W*(P.pressure?a.pressure:1),W*(P.pressure?b.pressure:1)],uS:[S[i-1],S[i]],uDepth:W*.6*(P.depthK||1),uRibImg:img.tex,uChan:{int:img.mono?2:(R.luma?1:0)},
        uTotal:total,uTileLen:tileLen,uTiles:tiles,uNTiles:ntiles,uFit:{int:R.fit==='stretch'?0:1},uOffS:shift,uMirror:{int:R.mirror?1:0},uFlip:{int:R.flip?1:0},uRot:{int:Math.round(R.orient/90)%4},uStartOff:so,uEndOff:eo,uIStart:.15,uIEnd:.15,uRemove:{int:R.remove&&R.ratio!=='length'?1:0},uRound:{int:R.corner==='round'?1:0}});
      gl.drawElements(gl.TRIANGLES,tris.length,gl.UNSIGNED_INT,0);}}
  finally{gl.disable(gl.SCISSOR_TEST);gl.disable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.bindVertexArray(vao);gl.deleteVertexArray(V);gl.deleteBuffer(E);}}

/* the Ribbon part of the Paths panel */
let rbPick=null;
function rbSet(P,patch,label){pathChange(q=>{q.ribbon=Object.assign({},RB_DEFAULT,q.ribbon,patch);},label||'Ribbon path',P);}
function ribbonPanel(box,L,P){const R=Object.assign({},RB_DEFAULT,P.ribbon),img=R.img;
  const sub=t=>box.append(el('div',{class:'sub',text:t}));
  const sel=(id,label,val,opts,fn)=>{const s=el('select',{id,'aria-label':label,title:label},...opts.map(([v,t])=>el('option',{value:String(v),text:label+': '+t})));s.value=String(val);s.onchange=()=>fn(s.value);return s;};
  const sl=(id,label,val,min,max,step,fmt,fn)=>makeSlider({id,label,min,max,step,value:val,fmt,onInput:v=>{if(lockStop({node:L}))return;clearTimeout(rbTimer);rbPending={fn,v};rbTimer=setTimeout(()=>{const x=rbPending;rbPending=null;x.fn(x.v);},160);}}).el;
  sub('Ribbon picture');
  box.append(segChips([['text','Text'],['tex','Picture']],()=>img&&img.kind||'text',v=>{if(v==='text')rbUseText(L,P,(img&&img.spec)||Object.assign({},t3.style,{content:'Ribbon text',align:'left'}));else rbChoosePicture(L,P);}));
  if(!img||img.kind==='text'){const spec=img&&img.spec||Object.assign({},t3.style,{content:'Ribbon text',align:'left'}),ta=el('textarea',{id:'rbText',rows:2,'aria-label':'Ribbon text',spellcheck:'false',style:'width:100%'});ta.value=spec.content||'';
    ta.oninput=()=>{clearTimeout(rbTimer);rbTimer=setTimeout(()=>rbUseText(L,P,Object.assign({},spec,{content:ta.value})),250);};box.append(ta);
    const fonts=[...Object.keys(typeof FONT_STACKS!=='undefined'?FONT_STACKS:{}),...GFONTS].filter((f,i,a)=>a.indexOf(f)===i),fs=el('select',{id:'rbFont','aria-label':'Font'},...fonts.map(f=>el('option',{value:f,text:f})));fs.value=spec.font;fs.onchange=()=>rbUseText(L,P,Object.assign({},spec,{font:fs.value}));
    box.append(fs,el('div',{class:'chips'},chk('rbBold','Bold',!!spec.bold,v=>rbUseText(L,P,Object.assign({},spec,{bold:v}))),chk('rbItal','Italic',!!spec.italic,v=>rbUseText(L,P,Object.assign({},spec,{italic:v})))),...t3Extras(spec,(k,v)=>{clearTimeout(rbTimer);rbTimer=setTimeout(()=>rbUseText(L,P,Object.assign({},spec,{[k]:v})),180);},'rb'));}
  else box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'rbPicture',text:'Choose another picture…',onclick:()=>rbChoosePicture(L,P)}),el('button',{class:'btn sm',id:'rbTexture',text:'Use a texture…',title:'Then click a texture in the Textures shelf',onclick:()=>rbArmTexture(L,P)})),
    chk('rbLuma','Use brightness as the shape',!!R.luma,v=>rbSet(P,{luma:v},'Ribbon shape')));
  if(!img)box.append(el('div',{class:'chips'},el('button',{class:'btn sm',id:'rbTexture0',text:'Use a texture…',onclick:()=>rbArmTexture(L,P)})));
  sub('Stroke');
  box.append(sel('rbOrient','Image orientation',R.orient,[[0,'0°'],[90,'90°'],[180,'180°'],[270,'270°']],v=>rbSet(P,{orient:+v})),chk('rbFlip','Flip image',R.flip,v=>rbSet(P,{flip:v})));
  sub('Stretching & tiling');
  box.append(segChips([['stretch','Stretch along path'],['aspect','Keep aspect ratio']],()=>R.fit,v=>rbSet(P,{fit:v})));
  if(R.fit==='stretch'){box.append(chk('rbBetween','Stretch between offsets only',R.between,v=>rbSet(P,{between:v})));
    if(R.between)box.append(sl('rbSO','Start offset',R.startOff,0,.45,.01,pct,v=>rbSet(P,{startOff:v})),sl('rbEO','End offset',R.endOff,0,.45,.01,pct,v=>rbSet(P,{endOff:v})));}
  else box.append(sel('rbRatio','Ratio',R.ratio,[['width','Fit to path width'],['length','Fit to path length']],v=>rbSet(P,{ratio:v})),
    ...(R.ratio==='length'?[]:[chk('rbRemove','Remove clipped tiles',R.remove,v=>rbSet(P,{remove:v}))]),sel('rbAlign','Alignment',R.align,[['start','Align at start'],['center','Align at center'],['end','Align at end']],v=>rbSet(P,{align:v})));
  box.append(sel('rbTiling','Tiling mode',R.tiling,[['none','None'],['auto','Auto'],['custom','Custom']],v=>rbSet(P,{tiling:v})));
  if(R.tiling==='custom')box.append(sl('rbTiles','Tiling amount',R.tiles,1,60,1,v=>Math.round(v),v=>rbSet(P,{tiles:Math.round(v)})));
  box.append(chk('rbMirror','Mirror every 2nd tile',R.mirror,v=>rbSet(P,{mirror:v})),sl('rbAspect','Aspect ratio factor',R.aspectK,.2,4,.05,v=>v.toFixed(2),v=>rbSet(P,{aspectK:v})));
  sub('Channel blending');
  box.append(sel('rbBlend','Alpha',R.blend,[['normal','Normal'],['max','Lighten (Max)'],['add','Linear dodge (Add)']],v=>rbSet(P,{blend:v}),'Ribbon alpha blending'));}
let rbTimer=0,rbPending=null;
async function rbUseText(L,P,spec){await rbTextImage(L,P,spec);rbSet(P,{luma:false},'Ribbon text');pathRender(L);buildBrushPanel();}
function rbChoosePicture(L,P){const f=el('input',{type:'file',accept:'image/*',style:'display:none'});document.body.append(f);f.onchange=async()=>{const file=f.files[0];f.remove();if(!file)return;
  try{const bmp=await createImageBitmap(file),c=document.createElement('canvas');c.width=Math.min(bmp.width,2048);c.height=Math.round(bmp.height*c.width/bmp.width);const x=c.getContext('2d');x.drawImage(bmp,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height),tex=uploadStraight({w:c.width,h:c.height,data:d.data,bits:8}),T=makeTarget(c.width,c.height,8,false);premultInto(T,tex,[0,0],null);gl.deleteTexture(tex);
    let alpha=false;for(let i=3;i<d.data.length;i+=4)if(d.data[i]<250){alpha=true;break;}rbSetImage(L,P,T,'tex',{name:file.name});pathChange(q=>{q.ribbon=Object.assign({},RB_DEFAULT,q.ribbon,{luma:!alpha});},'Ribbon picture',P);pathRender(L);buildBrushPanel();}
  catch(e){toast('That picture could not be read.');}};f.click();}
function rbArmTexture(L,P){rbPick={L,P};if(typeof showPanel==='function')showPanel('textures');toast('Click a texture to use it as the ribbon picture.');}
async function rbUseTexture(it){const x=rbPick;rbPick=null;if(!x||!inDoc(x.L))return;const t=txCopy(await txTarget(it));rbSetImage(x.L,x.P,t,'tex',{name:it.name});pathChange(q=>{q.ribbon=Object.assign({},RB_DEFAULT,q.ribbon,{luma:true});},'Ribbon picture',x.P);pathRender(x.L);buildBrushPanel();toast('“'+it.name+'” is the ribbon picture.');}
