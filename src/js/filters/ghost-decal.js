/* A decal's alpha defines the footprint, with separate paper and adhesive. */
const FS_GHOST_DECAL=MS_NOISE_GLSL+`
uniform sampler2D uSource;
uniform vec2 uSize;
uniform vec4 uDamage;
uniform vec3 uGlue,uGhost;
uniform int uOutput,uMask;
void main(){
  vec2 uv=gl_FragCoord.xy/uSize;
  vec4 original=texture(uSource,uv);
  if(original.a<.00001){o=vec4(0);return;}
  vec3 p=vec3(uv*uSize/min(uSize.x,uSize.y)*uDamage.y,0.0);
  float crease=vn(p*vec3(.9,2.1,1.0));
  float noise=fbm(p+vec3(crease*.8,crease*.35,0.0))*.68+vn(p*4.3)*.22+vn(p*15.0)*.10;
  float paper=smoothstep(uDamage.x-.055,uDamage.x+.055,noise);
  float edge=(1.0-smoothstep(.016,.09,abs(noise-uDamage.x)))*paper*step(.002,uDamage.x);
  float patches=smoothstep(.20,.72,fbm(p*2.8+12.9))*(.55+.45*vn(p*24.0));
  float source=uMask==1?original.r:original.a;
  float footprint=source*uDamage.w, adhesive=source*(1.0-paper)*uDamage.z*patches;
  if(uMask==1){
    float print=source*paper;
    float value=uOutput==1?print:uOutput==2?adhesive:uOutput==3?footprint:max(print,max(adhesive,footprint));
    o=vec4(vec3(value),1.0);return;
  }
  vec3 pigment=mix(original.rgb/original.a,vec3(.85,.79,.66),edge*.9);
  vec4 ghost=vec4(uGhost*footprint,footprint), glue=vec4(uGlue*adhesive,adhesive);
  vec4 print=vec4(pigment,1.0)*(original.a*paper);
  o=uOutput==1?print:uOutput==2?glue:uOutput==3?ghost:print+(glue+ghost*(1.0-glue.a))*(1.0-print.a);
}`;
let ghostDecalProgram=null;
fxDef('ghostDecal',{
  title:'Ghost Decal',
  note:'Apply to a decal with transparency. Its original outline defines the protected paint underneath.',
  init:()=>({output:'all',glue:[.60,.42,.23],ghost:[.77,.77,.70]}),
  controls(v,upd){
    const picker=el('select',{id:'fx_ghostOutput','aria-label':'Output'},
      ...[['all','Combined'],['paper','Torn decal'],['glue','Adhesive residue'],['ghost','Protected paint']].map(([value,text])=>el('option',{value,text})));
    picker.value=v.output||'all';
    picker.onchange=()=>{v.output=picker.value;upd();};
    const color=(key,label,def)=>el('label',{class:'frow'},el('span',{text:label}),
      colourBtn('fx_ghost_'+key,()=>v[key]||def,c=>{v[key]=c;upd();},label));
    return [el('label',{class:'frow'},el('span',{text:'Output'}),picker),
      color('glue','Adhesive color',[.60,.42,.23]),color('ghost','Protected paint color',[.77,.77,.70])];
  },
  defs:[
    {key:'tear',label:'Decal loss',min:0,max:1,step:.01,value:.50,fmt:pct},
    {key:'scale',label:'Tear scale',min:2,max:48,step:.5,value:7},
    {key:'residue',label:'Adhesive residue',min:0,max:1,step:.01,value:.51,fmt:pct},
    {key:'footprint',label:'Protected paint',min:0,max:1,step:.01,value:.19,fmt:pct},
    {key:'seed',label:'Seed',min:1,max:999,step:1,value:1}
  ],
  presets:[
    ['Torn Paper',{tear:.39,scale:6,residue:.42,footprint:.12}],
    ['Aged Adhesive',{tear:.72,scale:10,residue:.64,footprint:.23}],
    ['Faded Outline',{tear:.91,scale:7,residue:.17,footprint:.34}]
  ],
  render(src,dst,v,ctx){
    const key=ctx?.k||doc.map;
    if(key!=='base'&&!ctx?.mask){blit(src,dst,0,0,dst.w,dst.h,0,0);return;}
    if(!ghostDecalProgram)ghostDecalProgram=program(FS_GHOST_DECAL);
    run(ghostDecalProgram,dst,{uSource:src.tex,uSize:[src.w,src.h],
      uDamage:[v.tear<=0?-.1:v.tear,Math.max(2,v.scale),v.residue,v.footprint],uSeed:v.seed,
      uGlue:v.glue||[.60,.42,.23],uGhost:v.ghost||[.77,.77,.70],
      uMask:{int:ctx?.mask?1:0},uOutput:{int:Math.max(0,['all','paper','glue','ghost'].indexOf(v.output))}});
  }
});
