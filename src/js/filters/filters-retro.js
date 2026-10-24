/* ================= Retro texture filter (0.70) =================
   Kenn: a Pixelate filter that makes things look like old-school N64 and PSX textures, with settings that help.
   The picture is cut into a small grid of texels (the console's texture size), each texel keeps one averaged colour,
   the texels are filtered the way the console did it (PSX: none, N64: the 3-point triangle filter), the colour is
   cut down to a few bits per channel (15-bit / 16-bit colour), and a small ordered dither hides the banding. */
const FX_RETRO_FS=FX2_H+`uniform sampler2D uSrc; uniform float uCell; uniform int uFilter; uniform int uPre; uniform vec3 uLv; uniform int uDith; uniform float uDA; uniform int uDPx;
uniform float uSat; uniform float uCon; uniform float uBri; uniform int uGrey; uniform float uCut; uniform float uGrid; uniform float uGamma;
vec4 texel(vec2 t){ /* one texel: the average of a few samples inside it (or just its middle) */
  vec2 sz=SZ(uSrc); vec3 acc=vec3(0.0); float aa=0.0;
  if(uPre==1){ vec4 c=at(uSrc,(t+0.5)*uCell); return vec4(st(c),c.a); }
  for(int y=0;y<3;y++)for(int x=0;x<3;x++){ vec4 c=at(uSrc,(t+(vec2(x,y)+0.5)/3.0)*uCell); acc+=st(c)*c.a; aa+=c.a; }
  return vec4(aa>0.0?acc/aa:vec3(0.0),aa/9.0); }
float bayer4(vec2 p){ ivec2 i=ivec2(mod(p,4.0)); int v=0; for(int k=0;k<2;k++){ int x=(i.x>>k)&1,y=(i.y>>k)&1; v|=(((x^y)<<1)|y)<<(2*(1-k)); } return (float(v)+0.5)/16.0; }
void main(){ vec2 p=gl_FragCoord.xy; vec2 q=p/uCell; vec4 c;
  if(uFilter==0) c=texel(floor(q));
  else { vec2 g=q-0.5,i=floor(g),f=fract(g); vec4 a=texel(i),b=texel(i+vec2(1,0)),d=texel(i+vec2(0,1)),e=texel(i+vec2(1,1));
    if(uFilter==2) c=mix(mix(a,b,f.x),mix(d,e,f.x),f.y);
    else c=(f.x+f.y<1.0)?a+(b-a)*f.x+(d-a)*f.y:e+(d-e)*(1.0-f.x)+(b-e)*(1.0-f.y); }
  vec3 s=c.rgb; s=pow(max(s,0.0),vec3(uGamma)); s=(s-0.5)*uCon+0.5+uBri; float l=lumOf(s); s=mix(vec3(l),s,uSat); if(uGrey==1) s=vec3(lumOf(s));
  vec2 dp=uDPx==1?p:floor(q); float t=uDith==1?bayer4(dp)-0.5:uDith==2?hash1(dp*1.37)-0.5:0.0; s=clamp(s,0.0,1.0);
  s=floor(s*uLv+0.5+t*uDA)/uLv;
  float a=c.a; if(uCut>0.0) a=a>=uCut?1.0:0.0;
  if(uGrid>0.0){ vec2 f2=fract(q); float e=min(min(f2.x,1.0-f2.x),min(f2.y,1.0-f2.y)); s*=1.0-uGrid*(1.0-smoothstep(0.0,1.0,e*uCell)); }
  o=outC(s,a); }`;
const PX_RETRO=program(FX_RETRO_FS);PX_RETRO.tiled=true;
/* the consoles: texture size, filter, colour bits (R,G,B), dither, dither size, colour tweaks */
const RETRO_PRESETS=[
  ['n64','Nintendo 64',{res:32,filt:'n64',br:5,bg:5,bb:5,dith:'bayer',da:.6,dpx:'pixel',sat:1.1,con:1.05,gam:1,cut:.5,grid:0}],
  ['psx','PlayStation',{res:64,filt:'near',br:5,bg:5,bb:5,dith:'bayer',da:.9,dpx:'pixel',sat:1.05,con:1.1,gam:1,cut:.5,grid:0}],
  ['saturn','Saturn',{res:64,filt:'near',br:5,bg:5,bb:5,dith:'none',da:0,dpx:'pixel',sat:1,con:1.15,gam:1,cut:.5,grid:0}],
  ['dc','Dreamcast',{res:128,filt:'bilinear',br:5,bg:6,bb:5,dith:'bayer',da:.4,dpx:'pixel',sat:1.05,con:1.05,gam:1,cut:.5,grid:0}],
  ['gb','Game Boy Colour',{res:32,filt:'near',br:5,bg:5,bb:5,dith:'none',da:0,dpx:'texel',sat:.9,con:1,gam:1,cut:.5,grid:.25}],
  ['chunky','Chunky 8-colour',{res:24,filt:'near',br:1,bg:1,bb:1,dith:'bayer',da:.9,dpx:'texel',sat:1.2,con:1.1,gam:1,cut:.5,grid:0}]];
fxDef('retroPixel',{title:'Retro pixelate (N64 / PSX)',note:'Old-school console textures: a small grid of texels, console-style filtering, 15/16-bit colour and a little dither. Pick a console, then adjust.',
  init:()=>Object.assign({preset:'n64'},RETRO_PRESETS[0][2],{grey:false,pre:'avg',bri:0}),
  defs:[],
  controls:(v,upd)=>{const sl={},mk=(key,label,min,max,step,fmt,numericMax)=>{const s=makeSlider(Object.assign({id:'rt_'+key,label,min,max,step,value:v[key],fmt,onInput:x=>{v[key]=x;v.preset='custom';chips.refresh();upd();}},numericMax?{numericMax}:{}));sl[key]=s;return s.el;};
    const chips={refresh(){for(const b of chipRow.querySelectorAll('[data-pre]'))b.classList.toggle('on',b.dataset.pre===v.preset);}};
    const setAll=o=>{Object.assign(v,o);for(const k in sl)sl[k].set(v[k]);};
    const chipRow=el('div',{class:'chips'},...RETRO_PRESETS.map(([id,name,o])=>el('button',{class:'chip'+(v.preset===id?' on':''),'data-pre':id,id:'rt_pre_'+id,text:name,onclick:()=>{v.preset=id;setAll(o);chips.refresh();upd();}})));
    const seg2=(key,opts,label)=>seg(opts,v[key],x=>{v[key]=x;v.preset='custom';chips.refresh();upd();},label);
    const sizes=el('div',{class:'chips'},el('span',{class:'note',text:'Texture size:'}),...[8,16,32,64,128,256].map(n=>el('button',{class:'chip',id:'rt_sz_'+n,text:n+'×'+n,title:'Texels along the longest side',onclick:()=>{v.res=n;v.preset='custom';sl.res.set(n);chips.refresh();upd();}})));
    return [el('div',{class:'sub',text:'Console'}),chipRow,el('div',{class:'sub',text:'Texture'}),sizes,mk('res','Texels across',4,512,1,x=>x+' texels'),
      el('div',{class:'sub',text:'Filtering'}),seg2('filt',[['near','None (PSX)'],['n64','3-point (N64)'],['bilinear','Bilinear']],'Texture filtering'),
      seg2('pre',[['avg','Average each texel'],['point','Sharp sample']],'Shrinking'),
      el('div',{class:'sub',text:'Colour depth (bits per channel)'}),mk('br','Red bits',1,8,1,x=>x+' bits ('+(1<<x)+' levels)'),mk('bg','Green bits',1,8,1,x=>x+' bits ('+(1<<x)+' levels)'),mk('bb','Blue bits',1,8,1,x=>x+' bits ('+(1<<x)+' levels)'),
      el('div',{class:'sub',text:'Dither'}),seg2('dith',[['none','None'],['bayer','4×4 pattern'],['noise','Noise']],'Dither'),seg2('dpx',[['pixel','Per screen pixel'],['texel','Per texel']],'Dither size'),mk('da','Dither strength',0,1.5,.01,pct),
      el('div',{class:'sub',text:'Look'}),mk('sat','Saturation',0,2,.01,pct),mk('con','Contrast',.5,2,.01,pct),mk('bri','Brightness',-.4,.4,.01,pct),mk('gam','Gamma',.5,2.2,.01,x=>x.toFixed(2)),mk('grid','Texel edges',0,1,.01,pct),
      mk('cut','Cut out see-through areas',0,1,.01,x=>x?'1-bit at '+Math.round(x*100)+'%':'off')];},
  checks:[['grey','Black and white',false]],
  render(src,dst,v){run(PX_RETRO,dst,{uSrc:src.tex,uCell:Math.max(1,Math.max(doc.w,doc.h)/Math.max(1,v.res)),uFilter:{int:v.filt==='n64'?1:v.filt==='bilinear'?2:0},uPre:{int:v.pre==='point'?1:0},
    uLv:[(1<<v.br)-1,(1<<v.bg)-1,(1<<v.bb)-1],uDith:{int:v.dith==='bayer'?1:v.dith==='noise'?2:0},uDA:v.dith==='none'?0:v.da,uDPx:{int:v.dpx==='texel'?0:1},
    uSat:v.sat,uCon:v.con,uBri:v.bri||0,uGrey:{int:v.grey?1:0},uCut:v.cut||0,uGrid:v.grid||0,uGamma:v.gam||1});}});
