/* A procedural material brush for painting raised, metallic weld beads. */
const WELD_STYLES=[
  {id:'tig',name:'TIG bead',detail:'Fine, even ripples',size:18,spacing:.17,rough:.3,color:[.58,.6,.62],height:.68},
  {id:'mig',name:'MIG bead',detail:'Wider, heavier bead',size:30,spacing:.2,rough:.38,color:[.48,.5,.52],height:.68},
  {id:'tack',name:'Tack weld',detail:'Short overlapping welds',size:25,spacing:.48,rough:.42,color:[.65,.58,.42],height:.68}
];
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
function weldMaterial(style){const h=style.height;return {id:'weld:'+style.id+':'+h.toFixed(2),name:style.name,fill:{proj:'uv',triSharp:4,hStr:1,maps:{
  base:{on:true,src:'value',c:style.color},rough:{on:true,src:'value',v:style.rough},metal:{on:true,src:'value',v:1},
  height:{on:true,src:'value',v:.5+h*.5},normal:{on:true,src:'image',tile:1}}},imgs:{normal:weldNormalImage()}};}
async function weldUse(style){if(weldBusy)return;weldBusy=true;try{
  const ok=await materialBrushUse(weldMaterial(style));if(!ok)return;
  applyPreset({name:'Weld · '+style.name,tool:'material',tip:weldTipGet(),size:style.size,hardness:.92,flow:1,opacity:1,spacing:style.spacing,
    pSize:true,minSize:.55,pOpacity:false,smoothing:.2,followDir:true,angleJitter:0,sizeJitter:.035,scatter:0,buildup:false});
  toast(style.name+' ready. Paint on the material thumbnail to add a raised metal bead.');
 }finally{weldBusy=false;}}
function weldCard(style){const cv=el('canvas',{width:112,height:54,role:'img','aria-label':style.name+' bead preview'}),x=cv.getContext('2d');
  x.fillStyle='#202329';x.fillRect(0,0,112,54);x.strokeStyle='#58606a';x.lineWidth=1;x.beginPath();x.moveTo(4,43);x.lineTo(108,43);x.stroke();
  x.lineCap='round';x.lineJoin='round';x.lineWidth=style.id==='mig'?13:style.id==='tack'?10:8;x.strokeStyle='#87909a';x.beginPath();x.moveTo(12,34);x.bezierCurveTo(22,17,30,17,39,30);x.bezierCurveTo(49,43,57,39,66,26);x.bezierCurveTo(77,12,88,17,100,30);x.stroke();
  x.lineWidth=2;x.strokeStyle='#d5d7d8';x.beginPath();x.moveTo(15,31);x.bezierCurveTo(25,19,31,19,39,30);x.bezierCurveTo(50,42,58,37,67,26);x.bezierCurveTo(78,14,88,18,98,29);x.stroke();
  const b=el('button',{class:'mattile weld-card',type:'button',title:'Select '+style.name+' and start painting raised metallic weld beads'},cv,el('span',{text:style.name}),el('small',{text:style.detail}));b.onclick=()=>weldUse(style);return b;}
function weldShelfContent(){const height=makeSlider({id:'weldHeight',label:'Bead height',min:0,max:1,step:.01,value:.68,fmt:v=>Math.round(v*100)+'%',onInput:v=>{for(const s of WELD_STYLES)s.height=v;}});
  const grid=el('div',{class:'matgrid weld-grid'});for(const s of WELD_STYLES)grid.append(weldCard(s));
  return el('div',{class:'weld-shelf'},el('p',{class:'note',text:'Paint raised metallic beads on a layer’s colour thumbnail. The brush adds a metallic base, roughness and height channel together; adjust bead size in Brush and height here.'}),grid,height.el,
    el('p',{class:'note',text:'Bead height changes the material’s height value. The visible relief depends on the layer’s height strength and the 3D material settings.'}));}

