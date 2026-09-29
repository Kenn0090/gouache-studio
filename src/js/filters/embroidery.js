/* ================= Embroidery (0.28) =================
   Kenn: an embroidery filter for patches. The picture becomes a stitched patch on a new layer: its colours are
   reduced to a few thread colours, each colour area gets a satin band along its edges (threads running across the
   band, like satin columns) and fill stitches inside (rows of short stitches at an angle, staggered like bricks),
   the patch's outline gets a rolled merrow border, and every thread has a little shine. It also writes Height (so
   the normal shows the threads) and Roughness when the document has it. */
const EMB_MAX=16;
/* a small copy of the picture for choosing the thread colours */
const FS_EMB_DOWN=`uniform sampler2D uSrc; uniform vec2 uOut;
void main(){ vec2 sz=vec2(textureSize(uSrc,0)); o=texelFetch(uSrc,ivec2((floor(gl_FragCoord.xy)+0.5)*sz/uOut),0); }`;
/* each pixel's nearest thread colour (R = its number), and whether it is inside the patch (G) */
const FS_EMB_LABEL=GL_ST+`uniform sampler2D uSrc; uniform vec4 uPal[${EMB_MAX}]; uniform int uN; uniform int uWhole;
void main(){ vec4 c=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0); vec3 s=st(c); int bi=0; float bd=1e9;
  for(int i=0;i<${EMB_MAX};i++){ if(i>=uN) break; vec3 d=s-uPal[i].rgb; float e=dot(d*d,vec3(0.3,0.59,0.11)); if(e<bd){ bd=e; bi=i; } }
  o=vec4(float(bi)/255.0,(uWhole==1||c.a>=0.5)?1.0:0.0,0.0,1.0); }`;
/* tidy: every pixel takes the most common thread colour around it (removes specks too small to stitch) */
const FS_EMB_MAJ=`uniform sampler2D uL; uniform int uR;
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uL,0); vec4 me=texelFetch(uL,p,0); int cnt[${EMB_MAX}];
  for(int i=0;i<${EMB_MAX};i++) cnt[i]=0;
  for(int y=-2;y<=2;y++) for(int x=-2;x<=2;x++){ if(abs(x)>uR||abs(y)>uR) continue; vec4 q=texelFetch(uL,clamp(p+ivec2(x,y),ivec2(0),s-1),0); if(q.g<0.5) continue; int k=int(q.r*255.0+0.5); cnt[k]+=1; }
  int bi=int(me.r*255.0+0.5),bc=cnt[bi]; for(int i=0;i<${EMB_MAX};i++) if(cnt[i]>bc){ bc=cnt[i]; bi=i; }
  o=vec4(float(bi)/255.0,me.g,0.0,1.0); }`;
/* seeds for the distance fields: uWhat 0 = edges between thread colours (and the patch's outline), 1 = the patch's outline only */
const FS_EMB_SEED=`uniform sampler2D uL; uniform int uWhat;
vec2 lab(ivec2 q,ivec2 s){ if(any(lessThan(q,ivec2(0)))||any(greaterThanEqual(q,s))) return vec2(-1.0,0.0); vec4 c=texelFetch(uL,q,0); return vec2(c.g<0.5?-1.0:c.r*255.0,c.g); }
void main(){ ivec2 p=ivec2(gl_FragCoord.xy),s=textureSize(uL,0); vec2 me=lab(p,s); bool e=false;
  if(me.y<0.5){ o=vec4(-1.0,-1.0,0.0,0.0); return; }
  for(int k=0;k<4;k++){ ivec2 d=k==0?ivec2(1,0):k==1?ivec2(-1,0):k==2?ivec2(0,1):ivec2(0,-1); vec2 n=lab(p+d,s);
    if(uWhat==1){ if(n.y<0.5) e=true; } else if(n.x!=me.x) e=true; }
  o=e?vec4(vec2(p),0.0,1.0):vec4(-1.0,-1.0,0.0,0.0); }`;
/* the stitches: uMap 0 = colour, 1 = height, 2 = roughness */
const FS_EMB=GL_ST+`uniform sampler2D uL; uniform sampler2D uE; uniform sampler2D uP; uniform vec4 uPal[${EMB_MAX}]; uniform int uMap;
uniform float uSp; uniform float uSat; uniform float uAng; uniform int uVary; uniform float uMw; uniform vec3 uMc; uniform float uShine; uniform float uDepth; uniform float uSeed;
float h1(float n){ return fract(sin(n*12.9898+uSeed*7.1)*43758.5453); }
float h2(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed)*43758.5453); }
vec2 rot2(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x-s*p.y,s*p.x+c*p.y); }
void main(){ ivec2 ip=ivec2(gl_FragCoord.xy); vec2 p=gl_FragCoord.xy; vec4 L=texelFetch(uL,ip,0);
  if(L.g<0.5){ o=vec4(0.0); return; }
  int k=int(L.r*255.0+0.5); vec3 col=uPal[k].rgb;
  vec4 E=texelFetch(uE,ip,0),P=texelFetch(uP,ip,0);
  float dp=P.x>=0.0?length(P.xy-(p-0.5))+0.5:1e4, de=E.x>=0.0?length(E.xy-(p-0.5))+0.5:1e4;
  float a=clamp(dp,0.0,1.0);
  float prof,groove,body,ph; vec2 td; float along;
  if(uMw>0.0&&dp<uMw){
    /* merrow: a rolled edge, threads wrapped over it at a slant */
    vec2 n=dp>0.6?normalize((p-0.5)-P.xy):vec2(0.0,1.0),t=vec2(-n.y,n.x); float x=dp/uMw;
    ph=(dot(P.xy,t)+dp*0.9)/(uSp*1.3); float f=fract(ph); prof=sin(3.14159*f);
    body=sqrt(max(0.0,1.0-pow(2.0*x-1.0,2.0)))*1.25; groove=1.0-prof; td=normalize(n+t*0.6); along=x; col=uMc;
    col*=0.9+0.2*h1(floor(ph));
  } else if(de<uSat){
    /* satin: long threads straight across the band, side by side along the edge */
    vec2 n=de>0.6?normalize((p-0.5)-E.xy):vec2(0.0,1.0),t=vec2(-n.y,n.x); float x=de/uSat;
    ph=dot(E.xy,t)/uSp; float f=fract(ph); prof=sin(3.14159*f);
    body=0.75+0.35*sqrt(clamp(x*(2.0-x),0.0,1.0)); groove=1.0-prof; td=n; along=x;
    col*=0.93+0.14*h1(floor(ph)+float(k)*31.0);
  } else {
    /* fill (tatami): rows of short stitches, each row shifted a third */
    float ang=uAng+(uVary==1?float(k)*0.785398:0.0); vec2 q=rot2(p,-ang); float row=floor(q.y/uSp),f=fract(q.y/uSp);
    float Ls=uSp*7.0,u=fract((q.x+mod(row,3.0)*Ls/3.0)/Ls); float hole=smoothstep(0.0,0.07,u)*smoothstep(1.0,0.93,u);
    prof=sin(3.14159*f)*(0.55+0.45*hole); body=0.62; groove=1.0-prof; td=rot2(vec2(1.0,0.0),ang); along=u; ph=row;
    col*=0.95+0.1*h1(row+float(k)*17.0);
  }
  /* fibres: fine lengthwise streaks in each thread */
  float fib=h2(floor(vec2(dot(p,vec2(-td.y,td.x))*1.7,dot(p,td)*0.12)))-0.5;
  /* shine: bright along the top of each thread, stronger where the thread faces the light */
  float face=0.45+0.55*abs(dot(td,normalize(vec2(0.55,0.83))));
  float spec=uShine*pow(prof,6.0)*face;
  if(uMap==0){ vec3 c=col*(0.62+0.38*prof)*(1.0+fib*0.12)+vec3(spec*0.32); o=outC(c,a); }
  else if(uMap==1){ float h=0.5+uDepth*0.5*(body*0.7+prof*0.3+fib*0.03-groove*0.08); o=outC(vec3(clamp(h,0.0,1.0)),a); }
  else { float r=clamp(0.78-0.3*prof*uShine+groove*0.15,0.05,1.0); o=outC(vec3(r),a); } }`;
let EMBP=null;const embProgs=()=>EMBP||(EMBP={down:program(FS_EMB_DOWN),label:program(FS_EMB_LABEL),maj:program(FS_EMB_MAJ),seed:program(FS_EMB_SEED),jfa:program(FS_LKJFA),emb:program(FX2_H+FS_EMB.replace(GL_ST,''))});
/* thread colours: sharp samples of the picture (transparent pixels left out), split where the colours spread most
   (so a small yellow detail still gets its own thread), refined by a few rounds of k-means, near-twins merged */
function embPalette(src,n){const E=embProgs(),S=128,t=makeTarget(S,S,8);run(E.down,t,{uSrc:src.tex,uOut:[S,S]});const d=captureRegionNow(t,0,0,S,S).data;disposeTarget(t);
  const px=[];for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<128)continue;px.push([d[i]/a,d[i+1]/a,d[i+2]/a]);}
  if(!px.length)return [[1,1,1]];
  const range=b=>{const r=[0,1,2].map(c=>{let lo=1,hi=0;for(const p of b){lo=Math.min(lo,p[c]);hi=Math.max(hi,p[c]);}return hi-lo;});return r;};
  let boxes=[px];
  while(boxes.length<n){let bi=-1,bs=0;boxes.forEach((b,i)=>{if(b.length<2)return;const s=Math.max(...range(b))*Math.pow(b.length,.25);if(s>bs){bs=s;bi=i;}});
    if(bi<0||bs<.02)break;const b=boxes.splice(bi,1)[0],r=range(b),c=r.indexOf(Math.max(...r));b.sort((x,y)=>x[c]-y[c]);
    /* split at the biggest jump in that channel (a clean border between colours), else in the middle */
    let m=b.length>>1,gap=0;for(let i=1;i<b.length;i++){const g=b[i][c]-b[i-1][c];if(g>gap){gap=g;m=i;}}boxes.push(b.slice(0,m),b.slice(m));}
  let pal=boxes.map(b=>{const s=[0,0,0];for(const p of b){s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];}return s.map(v=>v/Math.max(1,b.length));});
  const dist=(a,b)=>(a[0]-b[0])**2*.3+(a[1]-b[1])**2*.59+(a[2]-b[2])**2*.11;
  for(let it=0;it<6;it++){const sum=pal.map(()=>[0,0,0,0]);for(const p of px){let bi=0,bd=1e9;pal.forEach((c,i)=>{const e=dist(p,c);if(e<bd){bd=e;bi=i;}});const s=sum[bi];s[0]+=p[0];s[1]+=p[1];s[2]+=p[2];s[3]++;}
    pal=pal.map((c,i)=>sum[i][3]?[sum[i][0]/sum[i][3],sum[i][1]/sum[i][3],sum[i][2]/sum[i][3]]:c);}
  const out=[];for(const c of pal)if(!out.some(o=>dist(o,c)<.0015))out.push(c.map(v=>Math.min(1,Math.max(0,v))));return out;}
/* jump flooding from the seeds: each pixel finds its nearest seed */
function embField(E,L,what,A,B){run(E.seed,A,{uL:L.tex,uWhat:{int:what}});let st=1;while(st<Math.max(doc.w,doc.h))st*=2;
  for(st>>=1;st>=1;st>>=1){run(E.jfa,B,{uSrc:A.tex,uStep:{int:st}});const t=A;A=B;B=t;}return [A,B];}
/* the whole thing, into the layer's maps */
function embRender(src,v,maps){const E=embProgs(),pal=v.pal,n=pal.length,P=new Float32Array(EMB_MAX*4);pal.forEach((c,i)=>P.set([c[0],c[1],c[2],1],i*4));
  const sm=v.simplify>.25?blurOf(src,v.simplify):null,L0=makeTarget(doc.w,doc.h,8),L1=makeTarget(doc.w,doc.h,8);
  run(E.label,L0,{uSrc:(sm||src).tex,uPal:{v4a:P},uN:{int:n},uWhole:{int:v.shape==='whole'?1:0}});if(sm)release(sm);
  let a=L0,b=L1;for(let i=0;i<v.clean;i++){run(E.maj,b,{uL:a.tex,uR:{int:2}});const t=a;a=b;b=t;}
  const F1=lkTex(gl.RG32F),F2=lkTex(gl.RG32F),F3=lkTex(gl.RG32F),F4=lkTex(gl.RG32F);
  const [Ed]=embField(E,a,0,F1,F2),[Pd]=embField(E,a,1,F3,F4);
  const u={uL:a.tex,uE:Ed.tex,uP:Pd.tex,uPal:{v4a:P},uSp:v.sp,uSat:v.satin,uAng:v.ang*Math.PI/180,uVary:{int:v.vary?1:0},uMw:v.merrow?v.mw:0,uMc:v.mc,uShine:v.shine,uDepth:v.depth,uSeed:v.seed};
  for(const [k,m] of [['base',0],['height',1],['rough',2]])if(maps[k])run(E.emb,maps[k],Object.assign({uMap:{int:m}},u));
  [F1,F2,F3,F4].forEach(disposeTarget);disposeTarget(L0);disposeTarget(L1);}
function embBorderColour(v){const pal=v.pal,lum=c=>c[0]*.3+c[1]*.59+c[2]*.11;
  return v.mcFrom==='fg'?ui.fg.slice(0,3):v.mcFrom==='light'?pal.reduce((a,c)=>lum(c)>lum(a)?c:a,pal[0]):pal.reduce((a,c)=>lum(c)<lum(a)?c:a,pal[0]);}
let embDlg=null;
function dlgEmbroidery(){if(stroke||preview||selLive||embDlg){toast('Finish the current edit first.');return;}
  if(ui.mode==='anim'){toast('Switch to paint mode to make an embroidery patch.');return;}
  if(!canFloat){toast('This needs float textures, which this graphics card lacks.');return;}
  const A=doc.active,fromLayer=isLayer(A)&&hasMap(A,'base');
  let srcT=acquireD(doc.depth);if(fromLayer)blit(mapT(A,'base'),srcT,0,0,doc.w,doc.h,0,0);else{release(srcT);srcT=compositeMap('base');}
  const v={threads:6,simplify:1.5,clean:2,sp:Math.max(2,Math.round(Math.max(doc.w,doc.h)/340)),satin:Math.max(4,Math.round(Math.max(doc.w,doc.h)/110)),ang:45,vary:true,
    merrow:true,mw:Math.max(6,Math.round(Math.max(doc.w,doc.h)/70)),mcFrom:'dark',shine:.6,depth:.6,seed:1,shape:'outline'};
  const prev={map:doc.map,view:doc.view};let added=null;
  if(!doc.maps.includes('height')){setDocMaps([...doc.maps,'height'],'Add Height map');added=hist.undo[hist.undo.length-1];}
  const parent=A?(A.parent||doc.root):doc.root,idx=A?parent.children.indexOf(A)+1:doc.root.children.length;
  const L=newLayerObj('Embroidery');ensureMapTarget(L,'height');if(doc.maps.includes('rough'))ensureMapTarget(L,'rough');insertNode(L,parent,idx);
  preview={off:true,conv:true};embDlg={L};
  const draw=()=>{v.pal=embPalette(srcT,v.threads);v.mc=embBorderColour(v);const M={};for(const k of ['base','height','rough'])if(L.maps[k]&&doc.maps.includes(k))M[k]=L.maps[k];
    embRender(srcT,v,M);L.visible=prefs.livePreview&&!embDlg.hidden;scheduleThumb(L);changedAll();chips();};
  let tm=0;const later=()=>{clearTimeout(tm);tm=setTimeout(draw,120);};
  const sw=el('div',{class:'chips',id:'embPal','aria-label':'Thread colours'});
  const chips=()=>sw.replaceChildren(...(v.pal||[]).map(c=>el('span',{class:'embsw',style:'background:'+toHex(c),title:toHex(c)})));
  const S=(key,label,min,max,step,fmt)=>makeSlider({id:'emb_'+key,label,min,max,step,value:v[key],fmt,onInput:x=>{v[key]=x;later();}}).el;
  const body=el('div',{class:'dlg-grid'},
    el('p',{class:'note',text:'Turns '+(fromLayer?'the layer “'+A.name+'”':'the picture')+' into a stitched patch on a new layer: thread colours, satin edges, fill stitches, a merrow border and thread shine. It also writes Height'+(doc.maps.includes('rough')?' and Roughness':'')+'.'}),
    el('div',{class:'sub',text:'Threads'}),S('threads','Thread colours',2,EMB_MAX,1,x=>String(x)),sw,S('simplify','Simplify',0,12,.5,px),S('clean','Clean up small bits',0,6,1,x=>String(x)),
    el('div',{class:'sub',text:'Stitches'}),S('sp','Thread width',1.5,12,.5,px),S('satin','Satin edge width',2,80,1,px),S('ang','Fill angle',0,180,1,x=>x+'°'),
    chk('emb_vary','Different angle for each colour',v.vary,x=>{v.vary=x;later();}),
    el('div',{class:'sub',text:'Merrow border'}),chk('emb_merrow','Rolled border around the patch',v.merrow,x=>{v.merrow=x;later();}),S('mw','Border width',2,80,1,px),
    seg([['dark','Darkest thread'],['light','Lightest thread'],['fg','Foreground colour']],v.mcFrom,x=>{v.mcFrom=x;later();},'Border colour'),
    el('div',{class:'sub',text:'Patch shape'}),seg([['outline','The picture’s outline'],['whole','Whole canvas']],v.shape,x=>{v.shape=x;later();},'Patch shape'),
    el('div',{class:'sub',text:'Look'}),S('shine','Thread shine',0,1,.01,pct),S('depth','Height',0,1,.01,pct),S('seed','Variation',1,99,1,x=>String(x)),
    previewChk('embPrev',prefs.livePreview,x=>{embDlg.hidden=!x;L.visible=x;changed(L);requestRender(true);}));
  draw();
  const finish=()=>{clearTimeout(tm);preview=null;embDlg=null;if(srcT)release(srcT);srcT=null;};
  openDialog({title:'Embroidery patch',body,float:true,okLabel:'Create layer',
    onOk(){clearTimeout(tm);draw();detachNode(L);L.visible=true;structOp('Embroidery patch',()=>{insertNode(L,parent,idx);selectOnly(L);});finish();syncTargets();changedAll();refreshMapsUI();
      toast('Added the layer “'+L.name+'”: colour and Height'+(L.maps.rough?' and Roughness':'')+'. Paint on it, or hide the picture under it.');},
    onCancel(){detachNode(L);disposeLayer(L);finish();
      if(added&&hist.undo[hist.undo.length-1]===added){hist.undo.pop();added.undo();dropRecords([added]);}
      if(doc.maps.includes(prev.map))setEditMap(prev.map);doc.view=doc.maps.includes(prev.view)||prev.view==='material'||prev.view==='nfinal'?prev.view:doc.map;changedAll();refreshMapsUI();}});}
