/* A procedural material brush for painting raised, metallic weld beads. */
const WELD_STYLES=[
  {id:'tig',name:'TIG · even',detail:'Fine, regular ripple',size:18,spacing:.17,rough:.3,color:[.58,.6,.62],height:.68,irregularity:.08,heat:.12},
  {id:'mig',name:'MIG · heavy',detail:'Wide, strong ripple',size:30,spacing:.2,rough:.38,color:[.48,.5,.52],height:.68,irregularity:.18,heat:.08},
  {id:'walking',name:'Walking the cup',detail:'Wider, woven bead',size:28,spacing:.12,rough:.34,color:[.59,.61,.64],height:.68,irregularity:.42,heat:.2},
  {id:'convex',name:'Convex',detail:'Full crowned bead',size:26,spacing:.16,rough:.32,color:[.6,.62,.64],height:.82,irregularity:.12,heat:.1},
  {id:'concave',name:'Concave',detail:'Low, shallow bead',size:22,spacing:.2,rough:.36,color:[.53,.56,.59],height:.42,irregularity:.14,heat:.08},
  {id:'angular',name:'Angular',detail:'Tight, faceted ripple',size:24,spacing:.24,rough:.4,color:[.55,.57,.6],height:.7,irregularity:.24,heat:.12},
  {id:'double',name:'Double weld',detail:'Two close parallel runs',size:30,spacing:.18,rough:.34,color:[.6,.62,.64],height:.74,irregularity:.2,heat:.16},
  {id:'tack',name:'Tack weld',detail:'Short overlapping welds',size:25,spacing:.48,rough:.42,color:[.65,.58,.42],height:.68,irregularity:.3,heat:.05}
];
const weldOptions={height:.68,width:18,spacing:.17,irregularity:.08,heat:.12,style:'tig'};
function weldSet(id){const s=WELD_STYLES.find(x=>x.id===id)||WELD_STYLES[0];weldOptions.style=s.id;weldOptions.width=s.size;weldOptions.spacing=s.spacing;weldOptions.height=s.height;weldOptions.irregularity=s.irregularity;weldOptions.heat=s.heat;return s;}
let weldTip=null,weldBusy=false,weldNormalPixels=null;
function weldNormalImage(){
  if(weldNormalPixels)return {w:192,h:96,data:weldNormalPixels};
  const w=192,h=96,pixels=new Uint8Array(w*h*4),tau=Math.PI*2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const u=(x+.5)/w-.5,v=(y+.5)/h,across=u/.18,ripple=.88+.12*Math.sin(v*tau*8),gaussian=Math.exp(-2*across*across);
    const dzdx=.72*(-4*across/.18)*gaussian*ripple,dzdy=.72*gaussian*.12*Math.cos(v*tau*8)*tau*8;
    let nx=-dzdx,ny=-dzdy,nz=1,len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
    const i=(y*w+x)*4;pixels[i]=Math.round((nx*.5+.5)*255);pixels[i+1]=Math.round((ny*.5+.5)*255);
    pixels[i+2]=Math.round((nz*.5+.5)*255);pixels[i+3]=255;
  }
  weldNormalPixels=pixels;return {w,h,data:pixels};
}
function weldTipGet(){if(weldTip)return weldTip;weldTip=genTip('Weld bead',192,96,(x,w,h)=>{
  x.beginPath();x.moveTo(w*.025,h*.5);x.bezierCurveTo(w*.03,h*.2,w*.12,h*.12,w*.2,h*.2);
  for(let i=0;i<8;i++){const a=w*(.2+i*.1),b=a+w*.05;x.bezierCurveTo(a+w*.012,h*.34,a+w*.035,h*.68,b,h*.78);x.bezierCurveTo(b+w*.018,h*.86,b+w*.032,h*.86,a+w*.1,h*.78);}
  x.bezierCurveTo(w*.93,h*.7,w*.98,h*.38,w*.975,h*.5);x.bezierCurveTo(w*.96,h*.82,w*.9,h*.97,w*.8,h*.88);
  for(let i=7;i>=0;i--){const a=w*(.2+i*.1),b=a+w*.05;x.bezierCurveTo(b-w*.018,h*.72,b-w*.035,h*.33,a,h*.24);x.bezierCurveTo(a-w*.025,h*.16,a-w*.045,h*.17,a-w*.1,h*.24);}
  x.bezierCurveTo(w*.08,h*.11,w*.025,h*.26,w*.025,h*.5);x.closePath();x.fill();});return weldTip;}
function weldMaterial(style){const h=weldOptions.height,heat=weldOptions.heat,base=style.color.map((v,i)=>Math.min(1,v+(i===0?heat*.35:i===1?heat*.12:0)));return {id:'weld:'+style.id+':'+h.toFixed(2)+':'+heat.toFixed(2),name:'Weld · '+style.name,fill:{proj:'uv',triSharp:4,hStr:1,maps:{
  base:{on:true,src:'value',c:base},rough:{on:true,src:'value',v:style.rough},metal:{on:true,src:'value',v:1},
  height:{on:true,src:'value',v:.5+h*.5},normal:{on:true,src:'image',tile:1}}},imgs:{normal:weldNormalImage()}};}
function weldPathSetup(L){const style=WELD_STYLES.find(s=>s.id===weldOptions.style)||WELD_STYLES[0],rec=weldMaterial(style),im=rec.imgs.normal,t=makeTarget(im.w,im.h,8,true);writeRegion(t,0,0,im.w,im.h,im.data);L.fill=rec.fill;L.fill.name=rec.name;L._fillImg={normal:t};L.fill.coverH=false;L.fill.proj='uv';fillRender(L);L.name=rec.name+' path';}
async function weldUse(style){if(weldBusy)return;style=weldSet(style.id);weldBusy=true;try{
  const ok=await materialBrushUse(weldMaterial(style));if(!ok)return;
  applyPreset({name:'Weld · '+style.name,tool:'material',tip:weldTipGet(),size:weldOptions.width,hardness:.92,flow:1,opacity:1,spacing:weldOptions.spacing,
    pSize:true,minSize:.55,pOpacity:false,smoothing:.2,followDir:true,angleJitter:weldOptions.irregularity*16,sizeJitter:weldOptions.irregularity*.2,scatter:weldOptions.irregularity*.08,buildup:false});
  toast(style.name+' ready. Paint on the material thumbnail to add a raised metal bead.');
 }finally{weldBusy=false;}}
function weldCard(style){const cv=el('canvas',{width:112,height:54,role:'img','aria-label':style.name+' bead preview'}),x=cv.getContext('2d');
  x.fillStyle='#202329';x.fillRect(0,0,112,54);x.strokeStyle='#58606a';x.lineWidth=1;x.beginPath();x.moveTo(4,43);x.lineTo(108,43);x.stroke();
  x.lineCap='round';x.lineJoin='round';x.lineWidth=style.id==='mig'?13:style.id==='tack'?10:8;x.strokeStyle='#87909a';x.beginPath();x.moveTo(12,34);x.bezierCurveTo(22,17,30,17,39,30);x.bezierCurveTo(49,43,57,39,66,26);x.bezierCurveTo(77,12,88,17,100,30);x.stroke();
  x.lineWidth=2;x.strokeStyle='#d5d7d8';x.beginPath();x.moveTo(15,31);x.bezierCurveTo(25,19,31,19,39,30);x.bezierCurveTo(50,42,58,37,67,26);x.bezierCurveTo(78,14,88,18,98,29);x.stroke();
  const b=el('button',{class:'mattile weld-card',type:'button',title:'Select '+style.name+' and start painting raised metallic weld beads'},cv,el('span',{text:style.name}),el('small',{text:style.detail}));b.onclick=()=>weldUse(style);return b;}
function weldShelfContent(){const grid=el('div',{class:'matgrid weld-grid'});for(const s of WELD_STYLES)grid.append(weldCard(s));
  const select=el('select',{'aria-label':'Weld bead style'},...WELD_STYLES.map(s=>el('option',{value:s.id,text:s.name})));select.value=weldOptions.style;select.onchange=()=>{weldSet(select.value);renderMats();};
  const row=(label,key,min,max,step,unit)=>makeSlider({id:'weld-'+key,label,min,max,step,value:weldOptions[key],fmt:v=>v.toFixed(key==='width'?0:2)+(unit||''),onInput:v=>weldOptions[key]=v});
  const width=row('Bead width','width',4,48,1,' px'),height=row('Bead height','height',0,1,.01,''),spacing=row('Ripple spacing','spacing',.06,.55,.01,''),irregularity=row('Irregularity','irregularity',0,1,.01,''),heat=row('Heat tint','heat',0,.65,.01,'');
  const path=el('button',{class:'btn',type:'button',text:'Draw on a 3D surface path',title:'Activate the editable 3D surface path tool'},);path.onclick=()=>{if(typeof setTool==='function'){setTool('path');toast('Surface Path is ready. Draw a path on the model; edit its control points in the Paths panel.');}else toast('Open 3D Paint to use Surface Path.');};
  return el('div',{class:'weld-shelf'},el('p',{class:'note',text:'Choose a bead profile, then paint the weld material or use the editable Surface Path tool in 3D Paint. Surface paths keep control points so you can adjust the route.'}),select,grid,el('div',{class:'chips'},path),width.el,height.el,spacing.el,irregularity.el,heat.el,
    el('p',{class:'note',text:'Heat tint warms the metal colour. Height controls the raised material channel; visible relief depends on layer height strength and 3D material settings.'}));}
