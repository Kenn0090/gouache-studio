/* ================= Metal normal maps in Textures (0.53.1) =================
   Kenn: "Bare Metal Normal Maps, Dents Normal Maps, Brushed Metal Normal Maps, Galvanized Metal Maps ... with a Normals tag,
   similar to Substance Painter." Each one is a seamless, generated tangent-space normal map (made from a height pattern with the
   app's own height-to-normal step, so it follows the same green-channel direction as the rest of the app). They sit in Textures
   under the tag "Normals". A normal texture goes into a material's Normal channel, or becomes a layer in the Normal map.
   One small program per kind (#define NK), like the wrinkles, so no graphics driver compiles them all at once. */
const TX_NORMALS=[
  ['nm-bare-machined','Normal · Bare metal · Machined'],['nm-bare-sanded','Normal · Bare metal · Sanded'],['nm-bare-cast','Normal · Bare metal · Cast'],['nm-bare-worn','Normal · Bare metal · Worn'],
  ['nm-dent-small','Normal · Dents · Small dings'],['nm-dent-large','Normal · Dents · Large dents'],['nm-dent-hammered','Normal · Dents · Hammered'],['nm-dent-hail','Normal · Dents · Hail'],['nm-dent-beaten','Normal · Dents · Beaten panel'],
  ['nm-brush-fine','Normal · Brushed metal · Fine'],['nm-brush-coarse','Normal · Brushed metal · Coarse'],['nm-brush-vertical','Normal · Brushed metal · Vertical'],['nm-brush-cross','Normal · Brushed metal · Cross'],['nm-brush-wavy','Normal · Brushed metal · Wavy'],
  ['nm-galv-large','Normal · Galvanized · Large spangle'],['nm-galv-fine','Normal · Galvanized · Fine spangle'],['nm-galv-hotdip','Normal · Galvanized · Hot-dip'],['nm-galv-diamond','Normal · Galvanized · Diamond plate'],['nm-galv-corrugated','Normal · Galvanized · Corrugated sheet']];
/* the normal strength each kind looks right at (slope per pixel is scaled with the size, so every size looks the same) */
const TX_NM_AMP=[.8,.7,.9,.8, .85,1.0,.9,.8,.9, .6,.7,.6,.6,.6, 1.0,.9,.9,1.4,.45];
TX_GEN.push(...TX_NORMALS);
const FS_TXNM=`uniform float uSeed; uniform vec2 uOut; uniform vec2 uPhase;
const float TP=6.2831853;
float hs(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7))+uSeed*13.17)*43758.5453); }
vec2 hs2(vec2 p){ return vec2(hs(p),hs(p+vec2(19.3,7.9))); }
float vn2(vec2 p,vec2 P){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hs(mod(i,P)),hs(mod(i+vec2(1,0),P)),f.x),mix(hs(mod(i+vec2(0,1),P)),hs(mod(i+vec2(1,1),P)),f.x),f.y); }
float fbm2(vec2 p,vec2 P){ float v=0.0,a=0.5; for(int i=0;i<5;i++){ v+=a*vn2(p,P); p*=2.0; P*=2.0; a*=0.5; } return v/0.969; }
float fbm(vec2 p,float P){ return fbm2(p,vec2(P)); }
/* hair lines along x: a long stretched noise, so it repeats seamlessly across the tile */
float hair(vec2 uv,float py,float px){ vec2 P=vec2(px,py); return vn2(uv*P,P)*0.5+vn2(uv*P*vec2(2.0,2.1)+3.7,P*vec2(2.0,2.1))*0.3+vn2(uv*P*vec2(4.0,4.3)+9.1,P*vec2(4.0,4.3))*0.2; }
vec3 vor(vec2 p,float P){ vec2 i=floor(p),f=fract(p); float d1=9.0,d2=9.0,id=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=mod(i+g,P); vec2 o=hs2(c); float d=length(g+o-f); if(d<d1){ d2=d1; d1=d; id=hs(c+3.1); } else if(d<d2) d2=d; }
  return vec3(d1,d2,id); }
/* round dents scattered over the tile (period P cells); prob = share of cells with a dent, r = radius range in cells; a rim lifts around each one */
float dents(vec2 uv,float P,float prob,float r0,float r1,float rim){ vec2 p=uv*P,i=floor(p),f=fract(p); float h=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=mod(i+g,P); vec2 o=hs2(c)*0.7+0.15; float on=step(hs(c+11.3),prob);
    float r=mix(r0,r1,hs(c+5.7)), dpt=0.45+0.55*hs(c+8.1), d=length(g+o-f)/r; float bowl=(1.0-smoothstep(0.0,1.0,d)); bowl=bowl*bowl;
    float rm=exp(-pow((d-1.05)/0.22,2.0))*rim; h+=on*(-dpt*bowl+rm*dpt*0.35); }
  return h; }
/* a bowl-shaped dent: soft walls, a faint rim, an irregular outline (the distance is warped), many sizes */
float dents2(vec2 uv,float P,float prob,float r0,float r1,float rim,float irr,vec2 wv){ vec2 p=uv*P+wv*irr,i=floor(p),f=fract(p); float h=0.0;
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=mod(i+g,P); vec2 o=hs2(c)*0.7+0.15; float on=step(hs(c+11.3),prob);
    float r=mix(r0,r1,pow(hs(c+5.7),1.6)), dpt=0.3+0.7*hs(c+8.1); vec2 dv=(g+o-f); float ang=atan(dv.y,dv.x);
    float d=length(dv)/r*(1.0+0.07*sin(ang*2.0+hs(c)*6.0)+0.04*sin(ang*4.0+hs(c+2.0)*6.0)); float bowl=1.0-smoothstep(0.0,1.0,d); bowl=bowl*bowl*(3.0-2.0*bowl);
    float rm=exp(-pow((d-1.08)/0.3,2.0))*rim; h+=on*dpt*(-bowl+rm*0.28); }
  return h; }
void main(){ vec2 uv=gl_FragCoord.xy/uOut+uPhase; float v=0.5; vec2 w=vec2(fbm(uv*3.0,3.0),fbm(uv*3.0+vec2(7.7,2.3),3.0))-0.5;
  vec2 w2=vec2(fbm(uv*7.0+4.1,7.0),fbm(uv*7.0+9.3,7.0))-0.5;
#if NK==0
{ /* machined: fine tool marks along x; each line has its own depth, with slow chatter bands and a micro grain */
  float lines=hair(uv,520.0,2.0); float depthMod=0.45+0.55*fbm2(uv*vec2(2.0,9.0),vec2(2.0,9.0)); float chatter=0.5+0.5*sin(TP*(uv.x*14.0+w.x*2.0));
  v=0.5+(lines-0.5)*0.9*depthMod+0.05*(chatter-0.5)*fbm(uv*6.0,6.0)+0.06*(fbm(uv*160.0,160.0)-0.5); }
#elif NK==1
{ /* sanded: many fine scratches in every direction over a micro grain */ float s=0.0;
  for(int k=0;k<6;k++){ vec2 q; float f=float(k);
    if(k==0)q=uv; else if(k==1)q=uv.yx; else if(k==2)q=vec2(uv.x+uv.y,uv.x-uv.y); else if(k==3)q=vec2(uv.x-uv.y,uv.x+uv.y); else if(k==4)q=vec2(2.0*uv.x+uv.y,uv.x-2.0*uv.y); else q=vec2(uv.x+2.0*uv.y,2.0*uv.x-uv.y);
    s+=(hair(q,380.0+f*61.0,2.0)-0.5)*(0.5+0.5*hs(vec2(f,3.0))); }
  v=0.5+s*0.55+0.08*(fbm(uv*220.0,220.0)-0.5); }
#elif NK==2
{ /* sand cast: a fine sandy grain, rare small pits and soft swelling */ float g=fbm(uv*190.0,190.0),g2=fbm(uv*70.0+w2,70.0); vec3 c=vor(uv*34.0+w*0.6,34.0);
  float pit=(1.0-smoothstep(0.0,0.3,c.x))*step(0.78,hs(vec2(c.z*53.1,c.z*7.7)));
  v=0.5+0.34*(g-0.5)+0.26*(g2-0.5)+0.25*(fbm(uv*5.0+w,5.0)-0.5)-0.3*pit; }
#elif NK==3
{ /* worn: slow undulations, soft scuffs and a fine grain */ float lo=fbm(uv*3.0+w,3.0); float scuff=smoothstep(0.6,0.78,fbm2(uv*vec2(14.0,3.0)+w*0.5,vec2(14.0,3.0)));
  v=0.5+0.5*(lo-0.5)+0.18*(fbm(uv*18.0+w2,18.0)-0.5)+0.06*(fbm(uv*210.0,210.0)-0.5)-0.18*scuff+0.12*(hair(uv,260.0,3.0)-0.5); }
#elif NK==4
{ /* small dings, scattered, mixed sizes */ v=0.6+0.55*dents2(uv,12.0,0.5,0.35,0.7,0.5,0.35,w2)+0.025*(fbm(uv*120.0,120.0)-0.5)+0.05*(fbm(uv*6.0,6.0)-0.5); }
#elif NK==5
{ /* large soft dents with raised edges, on a slightly uneven sheet */ v=0.6+0.5*dents2(uv,4.0,0.75,0.55,1.0,0.7,0.8,w2)+0.05*(fbm(uv*3.0,3.0)-0.5)+0.02*(fbm(uv*80.0,80.0)-0.5); }
#elif NK==6
{ /* hammered: overlapping peen marks, soft-edged, no two alike */ vec3 c=vor(uv*8.0+w*0.7+w2*0.25,8.0); float bowl=1.0-smoothstep(0.0,0.7,c.x); float d=0.35+0.65*hs(vec2(c.z*77.7,c.z*5.1));
  v=0.72-0.5*d*bowl*bowl*(3.0-2.0*bowl)+0.05*smoothstep(0.0,0.14,c.y-c.x)+0.03*(fbm(uv*90.0,90.0)-0.5); }
#elif NK==7
{ /* hail: many small, shallow dimples */ v=0.6+0.45*dents2(uv,24.0,0.45,0.3,0.55,0.3,0.25,w2)+0.02*(fbm(uv*160.0,160.0)-0.5); }
#elif NK==8
{ /* beaten panel: broad uneven waves with dings and hammer marks */ float waves=fbm(uv*4.0+w*1.2,4.0); v=0.5+0.28*(waves-0.5)+0.16*sin(TP*(uv.x*2.0+uv.y)+waves*5.0)+0.3*dents2(uv,8.0,0.35,0.45,0.9,0.4,0.5,w2)+0.025*(fbm(uv*70.0,70.0)-0.5); }
#elif NK==9
{ /* brushed, fine: very fine long scratches; their strength drifts slowly */ float a=hair(uv,700.0,2.0); float m=0.4+0.6*fbm2(uv*vec2(2.0,6.0),vec2(2.0,6.0)); v=0.5+(a-0.5)*0.9*m+0.05*(fbm2(uv*vec2(4.0,90.0),vec2(4.0,90.0))-0.5); }
#elif NK==10
{ /* brushed, coarse: wider grooves of different depth */ float a=hair(uv,170.0,2.0),b=hair(uv+vec2(0.31,0.17),330.0,3.0); float m=0.5+0.5*fbm2(uv*vec2(3.0,8.0),vec2(3.0,8.0)); v=0.5+(a-0.5)*0.75*m+(b-0.5)*0.45; }
#elif NK==11
{ float a=hair(uv.yx,700.0,2.0); float m=0.4+0.6*fbm2(uv.yx*vec2(2.0,6.0),vec2(2.0,6.0)); v=0.5+(a-0.5)*0.9*m+0.05*(fbm2(uv.yx*vec2(4.0,90.0),vec2(4.0,90.0))-0.5); }
#elif NK==12
{ /* cross brushed: two directions, the second weaker */ v=0.5+(hair(uv,560.0,2.0)-0.5)*0.7+(hair(uv.yx,480.0,2.0)-0.5)*0.45+0.04*(fbm(uv*70.0,70.0)-0.5); }
#elif NK==13
{ /* wavy brushing: the lines bend slowly */ vec2 q=uv+vec2(0.0,0.02*sin(TP*uv.x*2.0)+0.01*sin(TP*uv.x*5.0+1.3)+0.015*(fbm(uv*4.0,4.0)-0.5)); v=0.5+(hair(q,520.0,2.0)-0.5)*0.9+0.04*(fbm(uv*50.0,50.0)-0.5); }
#elif NK==14||NK==15
{ /* galvanized spangle: crystals, each a faintly tilted facet with feathery grain growing out of its centre */
  float P=(NK==14)?6.0:16.0; vec2 p=uv*P+w*0.3,i=floor(p),f=fract(p); float d1=9.0,id=0.0; vec2 dv=vec2(0.0);
  for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++){ vec2 g=vec2(x,y),c=mod(i+g,P); vec2 o=hs2(c); vec2 d=g+o-f; float dl=length(d); if(dl<d1){ d1=dl; dv=d; id=hs(c+3.1); } }
  float a=id*TP; vec2 dir=vec2(cos(a),sin(a)),nrm2=vec2(-dir.y,dir.x); vec2 tilt=dir*(0.1+0.25*hs(vec2(id*91.7,id*3.3)));
  float along=dot(dv,dir),across=dot(dv,nrm2); float feather=vn2(vec2(across*14.0,along*2.5)+id*40.0,vec2(1000.0))*0.7+vn2(vec2(across*31.0,along*5.0)+id*70.0,vec2(1000.0))*0.3;
  v=0.5+dot(tilt,dv)*0.5+0.10*(id-0.5)+0.09*(feather-0.5)+0.035*(fbm(uv*160.0,160.0)-0.5)+0.03*smoothstep(0.0,0.07,d1); }
#elif NK==16
{ /* hot-dip: soft spangle under slow runs and drips */ vec3 c=vor(uv*6.0+w*0.5,6.0); float run=fbm2(uv*vec2(10.0,2.0)+w.x,vec2(10.0,2.0)); float lump=fbm(uv*14.0+w,14.0);
  v=0.5+0.1*(c.z-0.5)+0.06*(0.5-c.x)+0.3*(run-0.5)+0.2*(lump-0.5)+0.03*(fbm(uv*190.0,190.0)-0.5); }
#elif NK==17
{ /* diamond tread plate: raised lugs, turned a quarter between neighbours */ vec2 g=uv*vec2(8.0,8.0),i=floor(g),f=fract(g)-0.5; float alt=mod(i.x+i.y,2.0); vec2 q=alt>0.5?f:vec2(f.y,f.x);
  vec2 a=vec2(q.x*0.9+q.y*0.45,q.y*0.9-q.x*0.45); float d=abs(a.x)/0.5+abs(a.y)/0.24; float lug=1.0-smoothstep(0.8,1.05,d);
  v=0.25+0.6*lug*(0.9+0.1*cos(q.y*5.0))+0.02*(fbm(uv*60.0,60.0)-0.5)+0.03*(fbm(uv*3.0,3.0)-0.5); }
#else
{ /* corrugated sheet: round ribs along y, with a little wobble */ float x=uv.x*12.0+0.12*sin(TP*uv.y*3.0)+0.25*(fbm(uv*3.0,3.0)-0.5); v=0.5+0.4*sin(TP*x)+0.02*(fbm(uv*60.0,60.0)-0.5); }
#endif
  v=clamp(v,0.0,1.0); o=vec4(v,v,v,1.0); }`;
const P_TXNM={};
let P_TXNRM=null;
/* a normal texture: the height pattern, then the app's height-to-normal step with the repeat turned on */
function txNormalTarget(k,S,phase){const i=TX_NORMALS.findIndex(g=>g[0]===k);if(i<0)return null;
  const pr=P_TXNM[i]||(P_TXNM[i]=program(FS_TXNM.replace('void main(){','#define NK '+i+'\nvoid main(){'))),h=makeTarget(S,S,16,true);
  run(pr,h,{uSeed:1,uOut:[S,S],uPhase:phase||[0,0]});setWrap(h,true);
  const t=makeTarget(S,S,8,true);run(P.nrm,t,{uH:h.tex,uN:dummy,uUseN:{int:0},uStr:TX_NM_AMP[i]*S/16,uWrap:{int:1},uFlipY:{int:0}});disposeTarget(h);setWrap(t,true);return t;}
/* (0.53.1, Kenn) the normal maps are 4096 x 4096; the little previews stay small */
{const g0=txGenTarget;txGenTarget=function(k,S,phase){return /^nm-/.test(k)?txNormalTarget(k,S>=1024?4096:S,phase):g0(k,S,phase);};}
/* the Normals tag */
TX_CATEGORIES.push('Normals');
const txIsNormal=it=>!!it&&(/^nm-/.test(it.id||'')||it.category==='Normals');
{const c0=txCategory;txCategory=function(id,name,category){return /^nm-/.test(id||'')||/\bnormals?\b|_nrm\b|_nor\b/i.test(name||'')&&!category?'Normals':c0(id,name,category);};}
/* a normal texture as a layer: it goes into the Normal map (not the colour) */
async function txNormalToLayer(it,at){if(ui.mode!=='paint'&&ui.mode!=='p3d'){toast('Switch to Paint or 3D Paint first.');return;}
  const src=await txTarget(it);if(!P_TXLAYER)P_TXLAYER=program(FS_TXLAYER);
  if(!doc.maps.includes('normal'))setDocMaps([...doc.maps,'normal'],'Add a Normal map');
  const A=doc.active,parent=at?at.parent:A?(A.parent||doc.root):doc.root,idx=at?at.index:A?parent.children.indexOf(A)+1:doc.root.children.length,L=newLayerObj(it.name);
  const sc=Math.max(doc.w,doc.h)/Math.max(src.w,src.h);run(P_TXLAYER,ensureMapTarget(L,'normal'),{uSrc:src.tex,uDoc:[doc.w,doc.h],uScale:sc});
  structOp('New layer from '+it.name.toLowerCase(),()=>{insertNode(L,parent,idx);selectOnly(L);});changedAll();toast('Added “'+it.name+'” as a layer in the Normal map.');}
{const l0=txToLayer;txToLayer=function(it,at){return txIsNormal(it)?txNormalToLayer(it,at):l0(it,at);};}
