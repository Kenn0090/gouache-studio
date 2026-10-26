/* ================= Dual brush (0.65.1) =================
   A second brush tip works as a mask for the first one, like Photoshop's Dual Brush: the dab only shows where the second tip's
   pattern is (Multiply) or everywhere except there (Knock out). The second tip has its own size, spacing, scatter and count and
   is built once as a small repeating picture that sits fixed on the canvas (a steady texture), or is shifted at random for every dab
   ("Random for every dab": a stippled look, because the dabs add up). Settings are plain data (brush.dual), so they
   are saved with brushes: {on, tipKey 'b:name' (built in) or 'u:name' (your tips), size px, spacing %, scatter %, count, mode 0/1, amount %}. */
const DUAL_DEFAULTS={on:true,tipKey:'b:sponge',size:40,spacing:130,scatter:80,count:1,mode:0,amount:100,random:false};
const dualRoundTips=new WeakMap();
function dualPresetTip(p){if(p.tip)return p.tip;
  const key=[p.hardness,p.roundness,p.grain].join('|'),old=dualRoundTips.get(p);if(old&&old.key===key)return old.tip;
  const c=tileCanvas(p),rgba=c.getContext('2d').getImageData(0,0,c.width,c.height).data,A=new Uint8Array(c.width*c.height);for(let i=0;i<A.length;i++)A[i]=rgba[i*4+3];
  const tip=makeTip(p.name,c.width,c.height,A);dualRoundTips.set(p,{key,tip});return tip;}
/* Names and duplicate occurrence are stable across saves and library reloads.
   Retain the old built-in/art/import keys for existing brush presets. */
function dualLibraryKey(set,p,index){return 'p:'+JSON.stringify([set.id,p.name,set.presets.slice(0,index).filter(q=>q.name===p.name).length]);}
function dualTip(d){const k=d&&d.tipKey||'';
  if(k.startsWith('p:')){try{const [id,name,n]=JSON.parse(k.slice(2)),set=library.find(s=>s.id===id),p=set&&set.presets.filter(q=>q.name===name)[n];return p?dualPresetTip(p):null;}catch(e){return null;}}
  if(k.startsWith('b:'))return TIPS[k.slice(2)]||null;if(k.startsWith('a:'))return (typeof ART_TIPS!=='undefined'&&ART_TIPS[k.slice(2)])||null;
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
function dualUniforms(d,randomize=true){if(!d||!d.on||d.amount===0)return null;const t=dualTexOf(d);if(!t)return null;
  return {uUseDual:true,uDual:t.tex,uDualSize:[t.size,t.size],uDualOff:d.random&&randomize?[Math.random()*t.size,Math.random()*t.size]:[0,0],uDualMode:{int:d.mode|0},uDualAmt:(d.amount==null?100:d.amount)/100};}
/* Refresh just this picker whenever the main library changes, preserving sliders,
   its search and scroll position. Selection changes never apply the primary preset. */
function renderDualPicker(){const host=$('#bDualTip');if(!host)return;const scroll=host.scrollTop,query=($('#bDualSearch')?.value||'').trim().toLowerCase(),d=brush.dual,tip=dualTip(d),presets=library.flatMap(s=>s.presets);
  const legacy=!d?.tipKey?.startsWith('p:')&&tip?(presets.find(p=>p.tip===tip&&p.name===tip.name)||presets.find(p=>p.tip===tip)):null;host.replaceChildren();let found=false,selectedName='';
  for(const set of library){const tiles=el('div',{class:'tiles'});set.presets.forEach((p,i)=>{const key=dualLibraryKey(set,p,i),selected=d?.tipKey===key||p===legacy;
    if(selected)selectedName=p.name;if(query&&!p.name.toLowerCase().includes(query)&&!set.name.toLowerCase().includes(query))return;
    const b=el('button',{type:'button',title:p.name,'aria-label':p.name,'aria-pressed':String(selected),class:selected?'on':null,onclick:()=>{brush.dual=Object.assign({},DUAL_DEFAULTS,brush.dual||{},{tipKey:key});brushEdited();renderDualPicker();}},tileCanvas(p));tiles.append(b);found=true;});
    if(tiles.childNodes.length)host.append(el('div',{class:'libset'},el('div',{class:'libset-h',text:set.name}),tiles));}
  if(!found)host.append(el('p',{class:'note',text:'No matching brushes.'}));host.scrollTop=scroll;
  const label=$('#bDualSelected');if(label)label.textContent=selectedName||tip?.name||'Tip unavailable — choose a brush';}
/* ---- the settings section ---- */
function buildDualSection(box,S){const d=brush.dual,set=patch=>{brush.dual=Object.assign({},DUAL_DEFAULTS,brush.dual||{},patch);brushEdited();};
  const on=!!(d&&d.on),det=el('details',{class:'more',id:'dualBox'});det.open=on||dualOpen;det.addEventListener('toggle',()=>{dualOpen=det.open;});
  const body=el('div',{},chk('bDualOn','Use a second brush tip as a mask',on,v=>{if(v)set({on:true});else brush.dual=Object.assign({},brush.dual||DUAL_DEFAULTS,{on:false});brushEdited();buildBrushPanel();}));
  if(on){const cur=Object.assign({},DUAL_DEFAULTS,d),search=el('input',{type:'search',id:'bDualSearch',placeholder:'Search brushes','aria-label':'Search second brush tips',oninput:renderDualPicker}),picker=el('div',{id:'bDualTip',class:'dual-tip-grid','aria-label':'Second brush tip'});
    const sl=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:cur[key],fmt,onInput:v=>set({[key]:v})}).el;
    body.append(el('div',{class:'note',id:'bDualSelected'}),search,picker,sl('bDualSize','Size','size',2,600,1,v=>Math.round(v)+'px'),sl('bDualSpace','Spacing','spacing',5,400,1,v=>Math.round(v)+'%'),
      sl('bDualScatter','Scatter','scatter',0,400,1,v=>Math.round(v)+'%'),sl('bDualCount','Count','count',1,8,1,v=>String(Math.round(v))),sl('bDualAmt','Amount','amount',0,100,1,v=>Math.round(v)+'%'),
      seg([[0,'Multiply','The brush only shows where the second tip is'],[1,'Knock out','The second tip cuts holes in the brush']],cur.mode|0,v=>set({mode:+v}),'How the second tip works'),
      el('div',{class:'chips'},chk('bDualRand','Random for every dab (stippled)',!!cur.random,v=>set({random:v}))));}
  det.append(el('summary',{text:'Dual brush'}),body);box.append(det);if(on)renderDualPicker();}
let dualOpen=false;
/* Dense max-coverage strokes can submit many independent dabs in one draw. Each
   instance retains its own pressure, angle, flips and random mask offset. Ordered
   buildup, tinted strokes and smudge keep the ordinary path. Flush within the
   pointer sample, before projection, compositing or undo can read the coverage. */
const dualWork={enabled:true,batches:0,dabs:0};
let dualBatchGPU=null;
function dualBatchStart(s){if(!dualWork.enabled||!s.dualU||s.tint||s.o.buildup||s.o.pFlow||!['brush','erase','dodge','burn'].includes(s.o.tool))return;
  const dst=s.space?s.space.buf:strokeT;if(dst.packed)return;s.dualBatch={dst,data:[],u:null};}
function dualBatchFlush(s){const b=s.dualBatch;s.dualBatch=null;if(!b||!b.data.length)return;
  if(!dualBatchGPU){
    const vs=`#version 300 es
      in vec2 a; layout(location=1) in vec4 dab0; layout(location=2) in vec4 dab1; layout(location=3) in vec2 dab2;
      uniform vec2 uSize; flat out vec2 uCenter; flat out float uRadius; flat out float uAngle; flat out float uAlpha; flat out vec2 uFlip; flat out vec2 uDualOff;
      void main(){uCenter=dab0.xy;uRadius=dab0.z;uAngle=dab1.x;uAlpha=dab1.y;uFlip=dab1.zw;uDualOff=dab2;
        vec2 p=dab0.xy+(a*2.0-1.0)*dab0.w;gl_Position=vec4(p/uSize*2.0-1.0,0.0,1.0);}`;
    let fs=FS_STAMP;for(const decl of ['vec2 uCenter','float uRadius','float uAngle','float uAlpha','vec2 uFlip','vec2 uDualOff'])fs=fs.replace('uniform '+decl+';','flat in '+decl+';');
    const prog=program(fs,vs),array=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(array);gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(const [at,n,offset] of [[1,4,0],[2,4,16],[3,2,32]]){gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,n,gl.FLOAT,false,40,offset);gl.vertexAttribDivisor(at,1);}
    dualBatchGPU={prog,array,buffer};gl.bindVertexArray(vao);}
  const g=dualBatchGPU,u={...P.stamp.defaults,...b.u};for(const k of ['uCenter','uRadius','uExtent','uAngle','uAlpha','uFlip','uDualOff'])delete u[k];
  useProg(g.prog,u);bindTarget(b.dst);gl.bindVertexArray(g.array);gl.bindBuffer(gl.ARRAY_BUFFER,g.buffer);gl.enable(gl.BLEND);gl.blendEquation(gl.MAX);gl.blendFunc(gl.ONE,gl.ONE);
  try{gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(b.data),gl.STREAM_DRAW);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,b.data.length/10);dualWork.batches++;dualWork.dabs+=b.data.length/10;
    runStat.n++;const area=scissorNow?Math.min(b.dst.w*b.dst.h,scissorNow[2]*scissorNow[3]):b.dst.w*b.dst.h;runStat.px+=area;runStat.by.dualBatch=(runStat.by.dualBatch||0)+area;}
  finally{gl.disable(gl.BLEND);gl.bindVertexArray(vao);}
}
