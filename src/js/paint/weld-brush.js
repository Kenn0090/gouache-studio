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
  if(weldNormalPixels)return {w:128,h:128,data:weldNormalPixels};
  const w=128,h=128,pixels=new Uint8Array(w*h*4),heightAt=(x,y)=>{
    const u=(x+.5)/w*2-1,v=(y+.5)/h*2-1,r=Math.hypot(u,v),ang=Math.atan2(v,u);
    const e=Math.max(0,Math.min(1,(r-.88)/.14)),edge=1-e*e*(3-2*e),crown=.22*Math.exp(-r*r*5.5),halo=.32*Math.exp(-Math.pow((r-.58)/.13,2));
    const pulse=1+.09*Math.sin(ang*7+weldOptions.irregularity*4)*weldOptions.irregularity;
    return edge*(crown+halo*pulse)*(0.35+weldOptions.height*.85);
  };
  const eps=1/w;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const dx=(heightAt(x+1,y)-heightAt(x-1,y))/(2*eps),dy=(heightAt(x,y+1)-heightAt(x,y-1))/(2*eps);
    let nx=-dx*.12,ny=-dy*.12,nz=1,len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;
    const i=(y*w+x)*4;pixels[i]=Math.round((nx*.5+.5)*255);pixels[i+1]=Math.round((ny*.5+.5)*255);pixels[i+2]=Math.round((nz*.5+.5)*255);pixels[i+3]=255;
  }
  weldNormalPixels=pixels;return {w,h,data:pixels};
}
function weldTipGet(){if(weldTip)return weldTip;weldTip=genTip('Weld bead',128,128,(x,w,h)=>{
  const g=x.createRadialGradient(w/2,h/2,0,w/2,h/2,w*.49);
  g.addColorStop(0,'rgba(255,255,255,.5)');g.addColorStop(.32,'rgba(255,255,255,.62)');g.addColorStop(.48,'rgba(255,255,255,.82)');g.addColorStop(.58,'rgba(255,255,255,1)');g.addColorStop(.7,'rgba(255,255,255,.82)');g.addColorStop(.88,'rgba(255,255,255,.28)');g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g;x.fillRect(0,0,w,h);
});return weldTip;}
function weldMaterial(style,options=weldOptions){const h=options.height,heat=options.heat,base=style.color.map((v,i)=>Math.min(1,v+(i===0?heat*.35:i===1?heat*.12:0)));return {weldPaint:true,id:'weld:'+style.id+':'+h.toFixed(2)+':'+heat.toFixed(2),name:'Weld · '+style.name,fill:{proj:'uv',triSharp:4,hStr:1,maps:{
  base:{on:true,src:'value',c:base},rough:{on:true,src:'value',v:style.rough},metal:{on:true,src:'value',v:1},
  height:{on:true,src:'value',v:.5+h*.5},normal:{on:false,src:'image',tile:1}}},imgs:{normal:weldNormalImage()}};}
/* Editable weld paths store their recipe and ordinary painted channels. Coverage is
   a disposable render buffer, never a mask attached to the user's layer. */
let P_WELDPIXELS=null;
function weldPathPixels(L){if(!L.fill&&!L.mask)return;
  if(L.mask){maskDispose(L.mask);L.mask=null;}L.editMask=false;L.fill=null;delete L._fillSolid;delete L._fillLive;
  for(const k in L.maps){if(L.maps[k]&&!L.maps[k].empty)disposeTarget(L.maps[k]);}L.maps={};L.target=emptyFor(mapDepth(doc.map));}
function weldPathSetup(L){const style=WELD_STYLES.find(s=>s.id===weldOptions.style)||WELD_STYLES[0];weldPathPixels(L);
  L.path.weld={style:style.id,height:weldOptions.height,width:weldOptions.width,spacing:weldOptions.spacing,irregularity:weldOptions.irregularity,heat:weldOptions.heat};
  const tip=weldTipGet();if(L._fillImg?.pathTip)disposeTarget(L._fillImg.pathTip);L._fillImg=L._fillImg||{};L._fillImg.pathTip=makeTarget(tip.w,tip.h,8,false);blit(tip,L._fillImg.pathTip,0,0,tip.w,tip.h,0,0);
  L.path.tipName=tip.name;L.path.width=(v3.mesh?.radius||1)*weldOptions.width/100;L.path.spacing=weldOptions.spacing;L.name='Weld · '+style.name+' path';}
function weldPathUpdate(L){if(!L?.path?.weld)return;const P=L.path;P.weld={style:weldOptions.style,height:weldOptions.height,width:weldOptions.width,spacing:weldOptions.spacing,irregularity:weldOptions.irregularity,heat:weldOptions.heat};
  P.width=(v3.mesh?.radius||1)*weldOptions.width/100;P.spacing=weldOptions.spacing;weldPathRender(L);}
function weldPathRender(L){if(!pathValid(L))return;weldPathPixels(L);const P=L.path,options=P.weld,style=WELD_STYLES.find(s=>s.id===options.style)||WELD_STYLES[0],rec=weldMaterial(style,options);
  const coverage=makeTarget(doc.w,doc.h,8,false,false,true);
  try{clearTarget(coverage,[0,0,0,1]);if(P.points.length>=2&&P.mode!=='none')pathSurfaceMask(L,pathSamples(P,true),coverage,true);
    if(!P_WELDPIXELS)P_WELDPIXELS=program('uniform sampler2D uCoverage; uniform vec3 uColor; void main(){float a=texelFetch(uCoverage,ivec2(gl_FragCoord.xy),0).r; o=vec4(uColor*a,a);}');
    for(const k of doc.maps){const v=rec.fill.maps[k];if(!v?.on)continue;const color=MAP_DEFS[k].grey?[v.v,v.v,v.v]:v.c;
      run(P_WELDPIXELS,ensureMapTarget(L,k),{uCoverage:coverage.tex,uColor:color});}
    L.opacity=P.opacity;L.name=rec.name+' path';changed(L);
  }finally{disposeTarget(coverage);}}
function weldLiveUpdate(key,value){weldOptions[key]=value;weldNormalPixels=null;const L=typeof pathActive==='function'?pathActive():null;if(L?.path?.weld){const b=pathCopy(L.path);weldPathUpdate(L);clearTimeout(L._pathTimer);if(!L._pathBefore)L._pathBefore=b;L._pathTimer=setTimeout(()=>{const old=L._pathBefore;L._pathBefore=null;if(old)pathRecord(L,old,'Weld '+key);},400);}}
async function weldUse(style){if(weldBusy)return;style=weldSet(style.id);weldBusy=true;try{
  const ok=await materialBrushUse(weldMaterial(style));if(!ok)return;
  applyPreset({name:'Weld · '+style.name,tool:'material',tip:weldTipGet(),size:weldOptions.width,hardness:.92,flow:1,opacity:1,spacing:weldOptions.spacing,
    pSize:true,minSize:.55,pOpacity:false,smoothing:.2,followDir:true,angleJitter:weldOptions.irregularity*16,sizeJitter:weldOptions.irregularity*.2,scatter:weldOptions.irregularity*.08,buildup:false});
  toast(style.name+' ready. Paint directly on a pixel layer to add a raised metal bead.');weldToolsRender();
 }finally{weldBusy=false;}}
function weldCard(style){const cv=el('canvas',{width:112,height:54,role:'img','aria-label':style.name+' bead preview'}),x=cv.getContext('2d');
  x.fillStyle='#202329';x.fillRect(0,0,112,54);x.strokeStyle='#58606a';x.lineWidth=1;x.beginPath();x.moveTo(4,43);x.lineTo(108,43);x.stroke();
  x.lineCap='round';x.lineJoin='round';x.lineWidth=style.id==='mig'?13:style.id==='tack'?10:8;x.strokeStyle='#87909a';x.beginPath();x.moveTo(12,34);x.bezierCurveTo(22,17,30,17,39,30);x.bezierCurveTo(49,43,57,39,66,26);x.bezierCurveTo(77,12,88,17,100,30);x.stroke();
  x.lineWidth=2;x.strokeStyle='#d5d7d8';x.beginPath();x.moveTo(15,31);x.bezierCurveTo(25,19,31,19,39,30);x.bezierCurveTo(50,42,58,37,67,26);x.bezierCurveTo(78,14,88,18,98,29);x.stroke();
  const b=el('button',{class:'mattile weld-card',type:'button',title:'Select '+style.name+' and start painting raised metallic weld beads'},cv,el('span',{text:style.name}),el('small',{text:style.detail}));b.onclick=()=>weldUse(style);return b;}
function weldShelfContent(){const grid=el('div',{class:'matgrid weld-grid'});for(const s of WELD_STYLES)grid.append(weldCard(s));
  const select=el('select',{'aria-label':'Weld bead style'},...WELD_STYLES.map(s=>el('option',{value:s.id,text:s.name})));select.value=weldOptions.style;select.onchange=()=>{weldSet(select.value);weldLiveUpdate('style',select.value);};
  const row=(label,key,min,max,step,unit)=>makeSlider({id:'weld-'+key,label,min,max,step,value:weldOptions[key],fmt:v=>v.toFixed(key==='width'?0:2)+(unit||''),onInput:v=>weldLiveUpdate(key,v)});
  const width=row('Bead width','width',4,48,1,' px'),height=row('Bead height','height',0,1,.01,''),spacing=row('Ripple spacing','spacing',.06,.55,.01,''),irregularity=row('Irregularity','irregularity',0,1,.01,''),heat=row('Heat tint','heat',0,.65,.01,'');
  const path=el('button',{class:'btn',type:'button',text:'Draw on a 3D surface path',title:'Activate the editable 3D surface path tool'},);path.onclick=()=>{if(typeof setTool==='function'){weldOptions.pathMode=true;setTool('path');toast('Weld path is ready. Draw on the model; the weld controls update the path live.');}else toast('Open 3D Paint to use Surface Path.');};
  return el('div',{class:'weld-shelf'},el('p',{class:'note',text:'Choose a bead profile, then paint directly on a pixel layer or use the editable Surface Path tool in 3D Paint. Surface paths keep control points so you can adjust the route.'}),select,grid,el('div',{class:'chips'},path),width.el,height.el,spacing.el,irregularity.el,heat.el,
    el('p',{class:'note',text:'Heat tint warms the metal colour. Height controls the raised material channel; visible relief depends on layer height strength and 3D material settings.'}));}

function weldToolsRender(){const L=typeof pathActive==='function'?pathActive():null;if(L?.path?.weld)Object.assign(weldOptions,L.path.weld);const box=document.getElementById('weldToolsBody');if(box&&typeof weldShelfContent==='function')box.replaceChildren(weldShelfContent());}
