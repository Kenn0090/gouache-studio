/* ================= Photo tab: depth map, Lens blur, Relight (0.61) =================
   The depth map is made once per photo (File › AI add-ons: Depth) and saved with the photo's edits. Lens blur blurs by distance from
   the focus you pick; Relight puts a light on the picture and shades it like a surface made from the depth map. */
/* The depth map goes to the graphics card as a smooth float picture, and a pass turns it into slopes at the size of the preview
   (red, green = how steeply the depth changes across and down, blue = depth). Sampling it in the shaders is smooth, so lighting has
   no steps (the old 8-bit map made terraces). */
const FS_PHSLOPE=`uniform sampler2D uD; uniform vec2 uSz; uniform vec2 uDsz; uniform float uAr;
vec4 cubic(float v){ vec4 n=vec4(1.0,2.0,3.0,4.0)-v; vec4 s=n*n*n; float x=s.x; float y=s.y-4.0*s.x; float z=s.z-4.0*s.y+6.0*s.x; float w=6.0-x-y-z; return vec4(x,y,z,w)*(1.0/6.0); }
float bic(vec2 uv){ vec2 tc=uv*uDsz-.5; vec2 fx=fract(tc); vec2 base=floor(tc)+.5; vec4 cx=cubic(fx.x), cy=cubic(fx.y);
  vec4 c=base.xxyy+vec2(-.5,1.5).xyxy; vec4 s=vec4(cx.xz+cx.yw,cy.xz+cy.yw); vec4 off=c+vec4(cx.yw,cy.yw)/s;
  float a=texture(uD,vec2(off.x,off.z)/uDsz).r, b=texture(uD,vec2(off.y,off.z)/uDsz).r, cc=texture(uD,vec2(off.x,off.w)/uDsz).r, d=texture(uD,vec2(off.y,off.w)/uDsz).r;
  float sx=s.x/(s.x+s.y), sy=s.z/(s.z+s.w); return mix(mix(d,cc,sx),mix(b,a,sx),sy); }
void main(){ vec2 uv=gl_FragCoord.xy/uSz; vec2 h=1.5/uDsz; float d0=bic(uv);
  float ddx=(bic(uv+vec2(h.x,0.0))-bic(uv-vec2(h.x,0.0)))/(2.0*h.x*uAr), ddy=(bic(uv+vec2(0.0,h.y))-bic(uv-vec2(0.0,h.y)))/(2.0*h.y);
  o=vec4(ddx,ddy,d0,1.0); }`;
let phSlopeProg=null;
function phDepthTex(p){if(!p||!p.depth)return null;const d=p.depth;if(p._dtex&&p._dv===d.v&&p._dpx===p.pw)return p._dtex;
  const raw=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,raw);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R16F,d.w,d.h,0,gl.RED,gl.FLOAT,d.f);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  if(!phSlopeProg)phSlopeProg=program(FS_PHSLOPE);const W=Math.max(256,Math.min(2048,d.w*3)),H=Math.max(2,Math.round(W*d.h/d.w));
  if(p._dtarget)disposeTarget(p._dtarget);const t=p._dtarget=makeTarget(W,H,16,false);run(phSlopeProg,t,{uD:raw,uSz:[W,H],uDsz:[d.w,d.h],uAr:p.pw/p.ph});gl.deleteTexture(raw);
  p._dtex=t.tex;p._dv=d.v;p._dpx=p.pw;return p._dtex;}
async function phDepthEnsure(){const p=phP();if(!p||!p.psrc)return false;if(p.depth)return true;if(phAiNeed(['engine','depth']))return false;
  try{await aiBusy('Measuring depth',async prog=>{const img=aiPixels(p.psrc,1024);prog(.2);const d=await aiDepthRun(img);d.f=aiBlurFloat(d.f,d.w,d.h,1.5);d.v=1;p.depth=d;});phDirty();return true;}
  catch(err){console.warn(err);toast('The depth map failed: '+(err.message||err));return false;}}
/* the depth map's value (0..100) under a point on the shown picture */
function phDepthAt(ix,iy){const p=phP(),M=phMapper();if(!p||!p.depth||!M)return null;const sp=M.fwd(ix/doc.w,iy/doc.h),d=p.depth,x=clamp(Math.floor(sp[0]*d.w),0,d.w-1),y=clamp(Math.floor(sp[1]*d.h),0,d.h-1);return d.f[y*d.w+x]*100;}
async function phLensOn(v){const s=phS();if(v&&!(await phDepthEnsure()))return;s.lens.on=v;phCommit('Lens blur');phBuildPanel();phDirty();}
async function phRelightOn(v){const s=phS();if(v&&!(await phDepthEnsure()))return;s.relight.on=v;phCommit('Relight');phBuildPanel();phDirty();drawXfOverlay();}
function phDSl(obj,key,label,min,max,step,hist,fmt){const sl=makeSlider({id:'phd_'+key,label,min,max,step,value:obj[key],fmt:fmt||(v=>Math.round(v)),onInput:v=>{obj[key]=v;phDirty();drawXfOverlay();phHistLater(hist);},onChange:v=>{obj[key]=v;phDirty();drawXfOverlay();phHistLater(hist);}});return sl.el;}
function phLensPanel(){const s=phS(),L=s.lens,body=[],need=!aiHas('engine')||!aiHas('depth');
  if(need)body.push(el('p',{class:'note',text:'Lens blur needs the AI add-on (File › AI add-ons: Depth).'}),el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'AI add-ons…',onclick:dlgAddons})));
  body.push(chk('phLensOn','Blur by distance',!!L.on,v=>phLensOn(v)));
  if(L.on)body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm',text:'Pick the focus…',title:'Click the part of the picture that stays sharp',onclick:()=>{ph.pick='lensfocus';stage.classList.add('phpicking');toast('Click what should stay sharp.');}})),
    phDSl(L,'focus','Focus distance',0,100,1,'Lens blur'),phDSl(L,'range','In focus range',2,60,1,'Lens blur'),phDSl(L,'amount','Blur amount',0,100,1,'Lens blur'),phDSl(L,'hl','Bright highlights',0,100,1,'Lens blur'),
    chk('phShowDepth','Show the depth map',!!ph.showDepth,v=>{ph.showDepth=v;phDirty();}));
  return body;}
/* ---- Relight: up to four lights (point, spotlight, sun), shadows, shine, rim light, a coloured ambient, and ready-made lightings ---- */
const PH_LTYPES=[[0,'Point light'],[1,'Spotlight'],[2,'Sun (parallel light)']];
const PH_LIGHTS=[
 ['Golden hour',{type:2,x:.92,y:.28,ax:.2,ay:.7,z:.22,int:115,hue:35,sat:62,amb:30,ambH:220,ambS:22,shad:60,rim:25,dep:60}],
 ['Window light',{type:2,x:.04,y:.35,ax:.6,ay:.6,z:.5,int:90,hue:210,sat:12,amb:20,shad:35,dep:55}],
 ['Studio (two lights)',{type:0,x:.25,y:.25,z:.45,int:80,rad:90,hue:40,sat:8,amb:18,shine:25,more:[{on:true,type:0,x:.85,y:.4,z:.4,int:35,rad:90,hue:210,sat:15}]}],
 ['Spotlight',{type:1,x:.5,y:.04,ax:.5,ay:.6,z:.6,int:135,rad:150,cone:28,soft:50,hue:45,sat:10,amb:58,shad:40}],
 ['Moonlight',{type:2,x:.8,y:.1,ax:.4,ay:.7,z:.55,int:75,hue:220,sat:45,amb:45,ambH:225,ambS:30,shine:20}],
 ['Sunset rim light',{type:2,x:.95,y:.3,ax:.3,ay:.6,z:.15,int:100,hue:20,sat:75,amb:35,ambH:285,ambS:25,shad:50,rim:70}],
 ['Neon',{type:0,x:.15,y:.5,z:.3,int:90,rad:70,hue:320,sat:85,amb:55,shine:40,gloss:40,more:[{on:true,type:0,x:.85,y:.5,z:.3,int:90,rad:70,hue:185,sat:85}]}],
 ['Candle',{type:0,x:.5,y:.66,z:.25,int:100,rad:45,hue:28,sat:80,amb:60,ambH:25,ambS:30,shad:40}],
 ['Overhead',{type:2,x:.5,y:.04,ax:.5,ay:.8,z:.75,int:90,hue:45,sat:8,amb:25,shad:50}]];
async function phRelightPreset(name){const e=PH_LIGHTS.find(x=>x[0]===name);if(!e)return;if(!(await phDepthEnsure()))return;const n=phClone(phS()),keep=n.relight.dep;
  n.relight=Object.assign({},phDefaults().relight,phClone(e[1]),{on:true});if(e[1].dep==null)n.relight.dep=keep;n.relight.more=(e[1].more||[]).map(m=>Object.assign({},phLightDefaults(),phClone(m)));ph.rlSel=0;phApply(n,'Lighting: '+name);phBuildPanel();drawXfOverlay();}
const phLights=R=>[R,...(Array.isArray(R.more)?R.more:[])];
function phRelightPanel(){const s=phS(),R=s.relight,body=[],need=!aiHas('engine')||!aiHas('depth');
  if(need)body.push(el('p',{class:'note',text:'Relight needs the AI add-on (File › AI add-ons: Depth).'}),el('div',{class:'phlmbtns'},el('button',{class:'btn sm primary',text:'AI add-ons…',onclick:dlgAddons})));
  body.push(chk('phRelightOn','Add light',!!R.on,v=>phRelightOn(v)));
  if(!R.on)return body;
  if(!Array.isArray(R.more))R.more=[];const lights=phLights(R);ph.rlSel=clamp(ph.rlSel|0,0,lights.length-1);const i=ph.rlSel,l=lights[i];l.z=phLightZ(l.z);
  const pre=el('select',{id:'phLightPre','aria-label':'Ready-made lighting'},el('option',{value:'',text:'Ready-made lighting…'}),...PH_LIGHTS.map(([n])=>el('option',{value:n,text:n})));pre.onchange=()=>{const v=pre.value;pre.value='';if(v)phRelightPreset(v);};
  body.push(el('div',{class:'frow'},pre),el('p',{class:'note',text:'Drag a light on the picture to move it. A spotlight or the sun also has a small square: drag it to aim.'}));
  body.push(el('div',{class:'chips phlights'},...lights.map((_,k)=>el('button',{class:'chip'+(k===i?' on':''),id:'phLight'+k,text:'Light '+(k+1),onclick:()=>{ph.rlSel=k;phBuildPanel();drawXfOverlay();}})),
    lights.length<4?el('button',{class:'chip',id:'phLightAdd',text:'+ Add a light',onclick:()=>{const d=phLightDefaults();d.on=true;d.x=clamp(.7-.15*R.more.length,.1,.9);d.y=.3;d.int=45;d.hue=210;d.sat=15;R.more.push(d);ph.rlSel=R.more.length;phCommit('Add a light');phBuildPanel();phDirty();drawXfOverlay();}}):null));
  const ts=el('select',{id:'phLightType','aria-label':'Kind of light'},...PH_LTYPES.map(([v,t])=>el('option',{value:String(v),text:t})));ts.value=String(l.type|0);ts.onchange=()=>{l.type=+ts.value;phCommit('Relight');phBuildPanel();phDirty();drawXfOverlay();};
  body.push(el('div',{class:'frow'},el('label',{for:'phLightType',text:'Kind'}),ts));
  body.push(phDSl(l,'int',(l.type|0)===2?'Sun strength':'Intensity',0,150,1,'Relight'));
  if((l.type|0)!==2)body.push(phDSl(l,'rad','Reach',5,200,1,'Relight'));
  body.push(phDSl(l,'z',(l.type|0)===2?'Sun height':'Height',0,1,.01,'Relight',v=>Math.round(v*100)));
  if((l.type|0)===2)body.push(el('p',{class:'note',text:'A low sun makes long shadows. Drag the light and its square to turn the direction.'}));
  if((l.type|0)===1)body.push(phDSl(l,'cone','Cone angle',5,90,1,'Relight'),phDSl(l,'soft','Soft edge',0,100,1,'Relight'));
  body.push(phDSl(l,'hue','Colour',0,360,1,'Relight'),phDSl(l,'sat','Tint',0,100,1,'Relight'));
  if(i>0)body.push(el('div',{class:'phlmbtns'},el('button',{class:'btn sm',id:'phLightDel',text:'Remove this light',onclick:()=>{R.more.splice(i-1,1);ph.rlSel=Math.max(0,i-1);phCommit('Remove a light');phBuildPanel();phDirty();drawXfOverlay();}})));
  body.push(el('div',{class:'sub',text:'The whole picture'}),phDSl(R,'dep','Depth',0,100,1,'Relight'),phDSl(R,'amb','Darken rest',0,80,1,'Relight'),phDSl(R,'ambH','Dark colour',0,360,1,'Relight'),phDSl(R,'ambS','Dark tint',0,100,1,'Relight'),
    el('div',{class:'sub',text:'Shadows, shine and rim'}),phDSl(R,'shad','Shadows',0,100,1,'Relight'),phDSl(R,'shine','Shine',0,100,1,'Relight'),phDSl(R,'gloss','Tightness',2,120,1,'Relight'),phDSl(R,'rim','Rim light',0,100,1,'Relight'));
  return body;}
/* the lights' handles on the picture: a ring and dot for each light, and a small square (with a line) for the aim of a spotlight or the sun */
function phRelightOverlay(f){const s=phS();if(ui.mode!=='photo'||ph.crop||!s||!s.relight||!s.relight.on)return '';const M=phMapper();if(!M)return '';const R=s.relight,lights=phLights(R).filter(l=>l.on!==false);let out='';
  phLights(R).forEach((l,k)=>{if(l.on===false)return;const u=M.inv(l.x,l.y),p0=f([u[0]*doc.w,u[1]*doc.h]).split(' ').map(Number),sel=k===(ph.rlSel|0),c=phHsvRGB(l.hue==null?40:l.hue,.35+(l.sat||0)/160,1).map(v=>Math.round(v*255)).join(','),t=l.type|0;
    if(t>0){const a=M.inv(l.ax==null?.5:l.ax,l.ay==null?.5:l.ay),p1=f([a[0]*doc.w,a[1]*doc.h]).split(' ').map(Number);
      out+='<line x1="'+p0[0]+'" y1="'+p0[1]+'" x2="'+p1[0]+'" y2="'+p1[1]+'" stroke="rgb('+c+')" stroke-width="'+(sel?2:1)+'" stroke-dasharray="5 4" opacity=".8"/><rect class="phlma" x="'+(p1[0]-6)+'" y="'+(p1[1]-6)+'" width="12" height="12" fill="rgb('+c+')" stroke="#000" stroke-width="1" opacity=".9"/>';}
    if(t<2){const rr=phRelightR(M,l);out+='<circle class="phlm" cx="'+p0[0]+'" cy="'+p0[1]+'" r="'+rr+'" style="opacity:'+(sel?.55:.25)+'"/>';}
    out+='<circle class="phlmh" cx="'+p0[0]+'" cy="'+p0[1]+'" r="'+(sel?9:7)+'" style="fill:rgb('+c+');stroke:#000;stroke-width:1.5"/><text x="'+(p0[0]+11)+'" y="'+(p0[1]-9)+'" fill="#fff" font-size="11" stroke="#000" stroke-width=".6">'+(k+1)+'</text>';});
  return out;}
function phRelightR(M,l){const u=M.inv(l.x,l.y),v=M.inv(l.x,l.y+l.rad/100*.5),a=scrPt([u[0]*doc.w,u[1]*doc.h]),b=scrPt([v[0]*doc.w,v[1]*doc.h]);return Math.max(10,Math.hypot(a[0]-b[0],a[1]-b[1]));}
/* pressing on a light's dot or an aim square picks it up (and makes it the light the sliders show) */
function phRelightDown(e,ix,iy){const s=phS();if(!s||!s.relight||!s.relight.on||ph.crop||e.button!==0)return false;const M=phMapper();if(!M)return false;const R=s.relight,r=stage.getBoundingClientRect();let best=null,bd=18;
  phLights(R).forEach((l,k)=>{if(l.on===false)return;for(const aim of ((l.type|0)>0?[false,true]:[false])){const u=M.inv(aim?(l.ax==null?.5:l.ax):l.x,aim?(l.ay==null?.5:l.ay):l.y),sp=scrPt([u[0]*doc.w,u[1]*doc.h]),d=Math.hypot(e.clientX-r.left-sp[0],e.clientY-r.top-sp[1]);if(d<bd){bd=d;best={k,aim};}}});
  if(!best)return false;if(ph.rlSel!==best.k){ph.rlSel=best.k;phBuildPanel();}ptr={mode:'phrl',id:e.pointerId,M,k:best.k,aim:best.aim};drawXfOverlay();return true;}
function phRelightMove(ix,iy){const R=phS().relight,l=phLights(R)[ptr.k]||R,sp=ptr.M.fwd(ix/doc.w,iy/doc.h),x=clamp(sp[0],-.2,1.2),y=clamp(sp[1],-.2,1.2);if(ptr.aim){l.ax=x;l.ay=y;}else{l.x=x;l.y=y;}phDirty();drawXfOverlay();}
function phRelightUp(){ptr=null;phCommit('Move light');phSidecarSoon();drawXfOverlay();}
function phDepthPack(p){if(!p.depth)return null;const d=p.depth;if(!d.png||d.pngV!==d.v){const c=document.createElement('canvas');c.width=d.w;c.height=d.h;const x=c.getContext('2d'),id=x.createImageData(d.w,d.h);for(let i=0;i<d.w*d.h;i++){const v=Math.round(clamp(d.f[i],0,1)*65535);id.data[i*4]=v>>8;id.data[i*4+1]=v&255;id.data[i*4+2]=0;id.data[i*4+3]=255;}x.putImageData(id,0,0);d.png=c.toDataURL('image/png');d.pngV=d.v;}return d.png;}
/* new files keep 16 bits (two bytes in red and green); files from 0.61.0 hold 8-bit grey, which is blurred a little to lose its steps */
async function phDepthUnpack(p,png,old){if(!png||p.depth)return;try{const bm=await createImageBitmap(await (await fetch(png)).blob()),c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d',{willReadFrequently:true});x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data,n=bm.width*bm.height,f=new Float32Array(n),u8=new Uint8Array(n);
  for(let i=0;i<n;i++){f[i]=old?d[i*4]/255:((d[i*4]<<8)|d[i*4+1])/65535;u8[i]=Math.round(f[i]*255);}
  p.depth={w:bm.width,h:bm.height,data:u8,f:old?aiBlurFloat(f,bm.width,bm.height,2):f,v:1,png:old?null:png};phDirty();}catch(e){console.warn('depth not read',e);}}
