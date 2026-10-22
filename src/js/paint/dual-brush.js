/* ================= Dual brush (0.65.1) =================
   A second brush tip works as a mask for the first one, like Photoshop's Dual Brush: the dab only shows where the second tip's
   pattern is (Multiply) or everywhere except there (Knock out). The second tip has its own size, spacing, scatter and count and
   is built once as a small repeating picture that sits fixed on the canvas (a steady texture), or is shifted at random for every dab
   ("Random for every dab": a stippled look, because the dabs add up). Settings are plain data (brush.dual), so they
   are saved with brushes: {on, tipKey 'b:name' (built in) or 'u:name' (your tips), size px, spacing %, scatter %, count, mode 0/1, amount %}. */
const DUAL_DEFAULTS={on:true,tipKey:'b:sponge',size:40,spacing:130,scatter:80,count:1,mode:0,amount:100,random:false};
function dualTip(d){const k=d&&d.tipKey||'';if(k.startsWith('b:'))return TIPS[k.slice(2)]||null;if(k.startsWith('a:'))return (typeof ART_TIPS!=='undefined'&&ART_TIPS[k.slice(2)])||null;
  if(k.startsWith('u:')){const n=k.slice(2);for(const s of library)for(const t of s.tips)if(t.name===n)return t;}return null;}
const dualCache=new Map();
function dualTexOf(d){const tip=dualTip(d);if(!tip||!tip.alpha)return null;
  const key=[tip.id,d.size,d.spacing,d.scatter,d.count].join('|');let e=dualCache.get(key);if(e)return e;
  const sz=clamp(+d.size||40,2,600),S=sz>180?1024:512,T=new Uint8Array(S*S),TA=tip.alpha,tw=tip.w,th=tip.h;
  const R=rng(Math.round(sz*31+(d.spacing||0)*17+(d.scatter||0)*13+(d.count||1)*7+tw)),cell=Math.max(2,sz*(clamp(+d.spacing||70,5,400)/100)),cnt=clamp(Math.round(+d.count||1),1,8),sc=.2+clamp(+d.scatter||0,0,400)/100;
  const asp=tw/th,dw=asp>=1?sz:sz*asp,dh=asp>=1?sz/asp:sz,half=Math.ceil(Math.hypot(dw,dh)/2),cells=Math.ceil(S/cell);let drawn=0;
  /* each dab is laid in with "the stronger of the two", so overlapping dabs do not fill the gaps between them */
  for(let j=0;j<cells&&drawn<20000;j++)for(let i=0;i<cells&&drawn<20000;i++)for(let k=0;k<cnt;k++){
    const cx=(i+.5)*cell+(R()-.5)*cell*sc,cy=(j+.5)*cell+(R()-.5)*cell*sc,a=R()*Math.PI*2,ca=Math.cos(a),sa=Math.sin(a);drawn++;
    for(let y=-half;y<=half;y++)for(let x=-half;x<=half;x++){
      const u=(ca*x+sa*y)/dw+.5,v=(-sa*x+ca*y)/dh+.5;if(u<0||v<0||u>=1||v>=1)continue;
      const val=TA[(Math.min(th-1,v*th|0)*tw+Math.min(tw-1,u*tw|0))];if(!val)continue;
      const px=((Math.round(cx+x)%S)+S)%S,py=((Math.round(cy+y)%S)+S)%S,ix=py*S+px;if(val>T[ix])T[ix]=val;}}
  const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,S,S,0,gl.RED,gl.UNSIGNED_BYTE,T);gl.pixelStorei(gl.UNPACK_ALIGNMENT,4);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);
  e={tex,size:S};if(dualCache.size>=8){const [k0,v0]=dualCache.entries().next().value;gl.deleteTexture(v0.tex);dualCache.delete(k0);}dualCache.set(key,e);return e;}
/* the uniforms for one dab (stampOne) */
function dualUniforms(d){if(!d||!d.on)return null;const t=dualTexOf(d);if(!t)return null;
  return {uUseDual:true,uDual:t.tex,uDualSize:[t.size,t.size],uDualOff:d.random?[Math.random()*t.size,Math.random()*t.size]:[0,0],uDualMode:{int:d.mode|0},uDualAmt:(d.amount==null?100:d.amount)/100};}
/* ---- the settings section ---- */
function buildDualSection(box,S){const d=brush.dual,set=patch=>{brush.dual=Object.assign({},DUAL_DEFAULTS,brush.dual||{},patch);brushEdited();};
  const on=!!(d&&d.on),det=el('details',{class:'more',id:'dualBox'});det.open=on||dualOpen;det.addEventListener('toggle',()=>{dualOpen=det.open;});
  const body=el('div',{},chk('bDualOn','Use a second brush tip as a mask',on,v=>{if(v)set({on:true});else brush.dual=Object.assign({},brush.dual||DUAL_DEFAULTS,{on:false});brushEdited();buildBrushPanel();}));
  if(on){const cur=Object.assign({},DUAL_DEFAULTS,d),sel=el('select',{id:'bDualTip','aria-label':'Second brush tip'});
    for(const [k,t] of Object.entries(TIPS))if(t&&t.name)sel.append(el('option',{value:'b:'+k,text:t.name}));
    if(typeof ART_TIPS!=='undefined')for(const [k,t] of Object.entries(ART_TIPS))if(t&&t.name)sel.append(el('option',{value:'a:'+k,text:t.name}));
    for(const s of library)for(const t of s.tips)if(t&&t.name)sel.append(el('option',{value:'u:'+t.name,text:'My tip: '+t.name}));
    sel.value=cur.tipKey;if(sel.value!==cur.tipKey)sel.value='b:sponge';sel.onchange=()=>{set({tipKey:sel.value});};
    const sl=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:cur[key],fmt,onInput:v=>set({[key]:v})}).el;
    body.append(el('div',{class:'frow'},el('label',{for:'bDualTip',text:'Tip'}),sel),sl('bDualSize','Size','size',2,600,1,v=>Math.round(v)+'px'),sl('bDualSpace','Spacing','spacing',5,400,1,v=>Math.round(v)+'%'),
      sl('bDualScatter','Scatter','scatter',0,400,1,v=>Math.round(v)+'%'),sl('bDualCount','Count','count',1,8,1,v=>String(Math.round(v))),sl('bDualAmt','Amount','amount',0,100,1,v=>Math.round(v)+'%'),
      seg([[0,'Multiply','The brush only shows where the second tip is'],[1,'Knock out','The second tip cuts holes in the brush']],cur.mode|0,v=>set({mode:+v}),'How the second tip works'),
      el('div',{class:'chips'},chk('bDualRand','Random for every dab (stippled)',!!cur.random,v=>set({random:v}))));}
  det.append(el('summary',{text:'Dual brush'}),body);box.append(det);}
let dualOpen=false;
