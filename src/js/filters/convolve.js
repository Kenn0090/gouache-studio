/* ================= Convolution kernel (0.95.8, Kenn's video) =================
   A 3×3 or 5×5 grid of numbers: each pixel becomes the weighted sum of its neighbours. Presets (sharpen, edges, emboss,
   outline, blur, ridges…) fill the grid; every cell can be typed. Divide by the sum (or a number of your own), add an
   offset, take the absolute value for edge kernels, and work on the brightness only (keeps the colours) or on each colour.
   Strength mixes the result with the picture. Works as a one-off filter, a filter layer, a content effect and a mask filter. */
const CONV_PRESETS={
  sharpen:['Sharpen',3,[0,-1,0,-1,5,-1,0,-1,0]],
  sharpen5:['Sharpen more',5,[0,0,-1,0,0, 0,-1,-2,-1,0, -1,-2,17,-2,-1, 0,-1,-2,-1,0, 0,0,-1,0,0]],
  edges:['Edges',3,[-1,-1,-1,-1,8,-1,-1,-1,-1],{abs:true,bias:0}],
  outline:['Outline',3,[-1,-1,-1,-1,8,-1,-1,-1,-1],{abs:false,bias:.5}],
  sobelX:['Edges left/right (Sobel)',3,[-1,0,1,-2,0,2,-1,0,1],{abs:true}],
  sobelY:['Edges up/down (Sobel)',3,[-1,-2,-1,0,0,0,1,2,1],{abs:true}],
  emboss:['Emboss',3,[-2,-1,0,-1,1,1,0,1,2]],
  emboss5:['Emboss deep',5,[-2,-1,-1,0,0, -1,-2,-1,0,0, -1,-1,1,1,1, 0,0,1,2,1, 0,0,1,1,2]],
  ridge:['Ridges',3,[0,-1,0,-1,4,-1,0,-1,0],{abs:true}],
  blur:['Box blur',3,[1,1,1,1,1,1,1,1,1]],
  gauss:['Gaussian blur',5,[1,4,6,4,1, 4,16,24,16,4, 6,24,36,24,6, 4,16,24,16,4, 1,4,6,4,1]],
  motion:['Motion blur',5,[1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0, 0,0,0,0,1]],
  identity:['Nothing (start here)',3,[0,0,0,0,1,0,0,0,0]]};
const FS_CONV=`in vec2 vUV;uniform sampler2D uSrc;uniform vec4 uK[7];uniform int uN;uniform float uDiv,uBias,uStep,uMix;uniform bool uAbs,uLum,uWrap;
float kk(int i){vec4 v=uK[i/4];int j=i-(i/4)*4;return j==0?v.x:j==1?v.y:j==2?v.z:v.w;}
vec4 at(vec2 uv){return texture(uSrc,uWrap?fract(uv):clamp(uv,0.0,1.0));}
void main(){vec2 px=uStep/vec2(textureSize(uSrc,0));int h=uN/2;vec4 c0=texture(uSrc,vUV);vec3 s=vec3(0.0);
  for(int y=0;y<5;y++){if(y>=uN)break;for(int x=0;x<5;x++){if(x>=uN)break;float w=kk(y*uN+x);if(w==0.0)continue;vec4 t=at(vUV+vec2(float(x-h),float(h-y))*px);
    vec3 c=t.a>0.0?t.rgb/t.a:vec3(0.0);s+=w*(uLum?vec3(dot(c,vec3(.2126,.7152,.0722))):c);}}
  s=s/uDiv+uBias;if(uAbs)s=abs(s);vec3 b=c0.a>0.0?c0.rgb/c0.a:vec3(0.0);vec3 r;
  if(uLum){float l0=dot(b,vec3(.2126,.7152,.0722));r=clamp(b+(s.r-l0),0.0,1.0);}else r=clamp(s,0.0,1.0);
  r=mix(b,r,uMix);o=vec4(r*c0.a,c0.a);}`;
let P_CONV=null;
function convKernel(v){const n=v.n===5?5:3,k=(v.k||[]).slice(0,n*n);while(k.length<n*n)k.push(0);return {n,k};}
function convRun(src,dst,v){if(!P_CONV)P_CONV=program(FS_CONV);const {n,k}=convKernel(v),K=new Float32Array(28);K.set(k);
  const sum=k.reduce((a,b)=>a+b,0),div=v.divAuto!==false?(Math.abs(sum)<1e-6?1:sum):(v.div||1);
  run(P_CONV,dst,{uSrc:src.tex,uK:{v4a:K},uN:{int:n},uDiv:div,uBias:v.bias||0,uStep:v.step||1,uMix:v.mix??1,uAbs:!!v.abs,uLum:v.lum!==false,uWrap:!!doc.wrap});}
fxDef('convolve',{title:'Convolution kernel',note:'Each pixel becomes the weighted sum of its neighbours in the grid. Pick a preset or type your own numbers.',
  init:()=>({n:3,k:CONV_PRESETS.sharpen[2].slice(),divAuto:true,div:1,bias:0,abs:false,lum:true,mix:1,step:1,pre:'sharpen'}),
  controls:(v,upd)=>{const box=el('div',{class:'dlg-grid convbox'});
    const draw=()=>{const {n}=convKernel(v);v.n=n;v.k=convKernel(v).k;
      const pre=el('select',{id:'conv_pre','aria-label':'Kernel preset'},el('option',{value:'',text:'Presets…'}),...Object.entries(CONV_PRESETS).map(([id,[t]])=>el('option',{value:id,text:t})));pre.value=v.pre||'';
      pre.onchange=()=>{const p=CONV_PRESETS[pre.value];if(!p)return;v.pre=pre.value;v.n=p[1];v.k=p[2].slice();Object.assign(v,{abs:false,bias:0},p[3]||{});v.divAuto=true;draw();upd();};
      const grid=el('div',{class:'convgrid',id:'conv_grid',style:'display:grid;gap:3px;grid-template-columns:repeat('+n+',1fr)'});
      v.k.forEach((w,i)=>{const c=el('input',{type:'number',step:'any',value:String(w),'aria-label':'Kernel row '+(Math.floor(i/n)+1)+' column '+(i%n+1),class:'convcell'+(i===(n*n-1)/2?' mid':''),style:'width:100%;min-width:0;text-align:center'});
        c.oninput=()=>{const x=parseFloat(c.value);if(isFinite(x)){v.k[i]=x;v.pre='';upd();}};grid.append(c);});
      const sum=v.k.reduce((a,b)=>a+b,0);
      box.replaceChildren(el('div',{class:'chips'},pre,seg([[3,'3 × 3'],[5,'5 × 5']],n,x=>{if(x===n)return;const o=v.k,nk=new Array(x*x).fill(0);const h0=(n-1)/2,h1=(x-1)/2;
          for(let y=0;y<n;y++)for(let q=0;q<n;q++){const yy=y-h0+h1,xx=q-h0+h1;if(yy>=0&&yy<x&&xx>=0&&xx<x)nk[yy*x+xx]=o[y*n+q];}v.n=x;v.k=nk;draw();upd();},'Kernel size')),
        grid,
        el('div',{class:'chips'},seg([['lum','Brightness'],['col','Colour']],v.lum===false?'col':'lum',x=>{v.lum=x==='lum';upd();},'Work on'),
          el('button',{class:'btn sm',type:'button',id:'conv_reset',text:'Reset',onclick:()=>{v.pre='identity';v.n=3;v.k=CONV_PRESETS.identity[2].slice();v.abs=false;v.bias=0;v.divAuto=true;draw();upd();}})),
        chk('conv_divAuto','Divide by the sum ('+(Math.abs(sum)<1e-6?'0, so 1':+sum.toFixed(3))+')',v.divAuto!==false,x=>{v.divAuto=x;draw();upd();}),
        ...(v.divAuto===false?[makeSlider({id:'conv_div',label:'Divide by',min:.1,max:64,step:.1,value:v.div||1,def:1,onInput:x=>{v.div=x;upd();}}).el]:[]),
        makeSlider({id:'conv_bias',label:'Offset',min:-1,max:1,step:.01,value:v.bias||0,def:0,fmt:pct,onInput:x=>{v.bias=x;upd();}}).el,
        chk('conv_abs','Absolute value (for edge kernels)',!!v.abs,x=>{v.abs=x;upd();}),
        makeSlider({id:'conv_step',label:'Spread',min:1,max:8,step:.5,value:v.step||1,def:1,fmt:px,onInput:x=>{v.step=x;upd();}}).el,
        makeSlider({id:'conv_mix',label:'Strength',min:0,max:1,step:.01,value:v.mix??1,def:1,fmt:pct,onInput:x=>{v.mix=x;upd();}}).el);};
    draw();return [box];},
  render(src,dst,v){convRun(src,dst,v);}});
