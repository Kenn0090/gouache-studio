/* Color Range selects matching colours throughout the image, independent of connectivity.
   Only the two small previews and a sampled pixel are read back; the full mask stays on the GPU. */
const FS_COLOR_RANGE=`uniform sampler2D uSrc; uniform vec3 uColors[16]; uniform int uCount; uniform float uFuzz; uniform int uInvert;
void main(){vec4 s=texelFetch(uSrc,ivec2(gl_FragCoord.xy),0);vec3 c=s.a>1e-6?s.rgb/s.a:vec3(0);float d=1.0;
 for(int i=0;i<16;i++){if(i>=uCount)break;vec3 a=abs(c-uColors[i]);d=min(d,max(max(a.r,a.g),a.b));}
 float k=uFuzz<=0.0?(d<0.00002?1.0:0.0):1.0-smoothstep(0.0,uFuzz/255.0,d);if(uInvert==1)k=1.0-k;
 o=vec4(vec3(k*s.a),1.0);}`;
let P_COLOR_RANGE=null;
function dlgColorRange(){if(stroke||selBusy())return;
 const st={source:'merged',mode:'new',colors:[ui.fg.slice()],fuzz:40,invert:false},A=doc.active;
 let source=null,owned=false,thumb=null,upd=null;
 const scale=Math.min(360/doc.w,230/doc.h),W=Math.max(1,Math.round(doc.w*scale)),H=Math.max(1,Math.round(doc.h*scale));
 const image=el('canvas',{id:'crImage',width:W,height:H,tabindex:0,'aria-label':'Sample colours from the image'}),mask=el('canvas',{id:'crMask',width:W,height:H,'aria-label':'Color Range selection preview'}),samples=el('div',{class:'chips',id:'crSamples'});
 const picker=el('input',{type:'color',id:'crColor',value:toHex(st.colors[0]),'aria-label':'Sampled colour'});
 const drawThumb=(t,c,grey)=>{if(!thumb)thumb=makeTarget(W,H,8,false);copyScaled(t,thumb);const d=captureRegionNow(thumb,0,0,W,H).data,x=c.getContext('2d'),id=x.createImageData(W,H);
  for(let i=0;i<d.length;i+=4){const a=grey?255:d[i+3];for(let j=0;j<3;j++)id.data[i+j]=grey?d[i]:a?Math.min(255,Math.round(d[i+j]*255/a)):0;id.data[i+3]=a;}x.putImageData(id,0,0);};
 const swatches=()=>{picker.value=toHex(st.colors[0]);samples.replaceChildren(...st.colors.map((c,i)=>el('button',{class:'crSample',type:'button',title:'Remove sampled colour '+toHex(c),'aria-label':'Remove sampled colour '+(i+1),style:'background:'+toHex(c),onclick:()=>{if(st.colors.length>1){st.colors.splice(i,1);swatches();upd();}}})));};
 const setSource=()=>{if(owned&&source)release(source);owned=true;
  if(st.source==='layer'&&A){if(isLayer(A)){source=mapT(A,doc.map)||emptyFor(mapDepth(doc.map));owned=false;}else source=renderNodesMap(A.children,doc.map);}
  else source=compositeMap(doc.map);drawThumb(source,image,false);};
 setSource();
 image.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();const r=image.getBoundingClientRect(),x=clamp(Math.floor((e.clientX-r.left)/r.width*doc.w),0,doc.w-1),y=clamp(Math.floor((e.clientY-r.top)/r.height*doc.h),0,doc.h-1),s=captureRegionNow(source,x,y,1,1),v=s.depth===16?Array.from(s.data,h=>h2fLut()[h]):Array.from(s.data,n=>n/255);if(v[3]<=1e-6)return;const c=v.slice(0,3).map(n=>clamp(n/v[3],0,1));
  if(e.altKey){if(st.colors.length>1){let best=0,d=Infinity;st.colors.forEach((s,i)=>{const q=s.reduce((a,n,j)=>a+(n-c[j])**2,0);if(q<d){d=q;best=i;}});st.colors.splice(best,1);}}
  else if(e.shiftKey){if(st.colors.length>=16){toast('Up to 16 sampled colours. Alt-click removes one.');return;}st.colors.push(c);}else st.colors=[c];swatches();upd();});
 picker.addEventListener('input',()=>{const h=picker.value;st.colors=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);st.colors=[st.colors];swatches();upd();});
 openLiveSel({title:'Color Range',overlay:true,note:'Click the image preview to sample a colour. Shift-click adds a colour; Alt-click removes the nearest sample. White in the selection preview is selected. Transparent pixels stay unselected.',
  controls:changed=>{upd=changed;const src=el('select',{id:'crSource','aria-label':'Color Range source'},el('option',{value:'merged',text:'Visible image'}),...(A?[el('option',{value:'layer',text:'Active layer'})]:[]));src.onchange=()=>{st.source=src.value;setSource();upd();};swatches();
   return [el('div',{class:'frow'},el('label',{for:'crSource',text:'Sample from'}),src),el('div',{class:'crPreviews'},el('div',{},el('div',{class:'sub',text:'Image — click to sample'}),image),el('div',{},el('div',{class:'sub',text:'Selection'}),mask)),el('div',{class:'frow'},el('label',{for:'crColor',text:'Sampled colour'}),picker,samples),makeSlider({id:'crFuzz',label:'Fuzziness',min:0,max:200,step:1,value:st.fuzz,fmt:n=>String(n),onInput:n=>{st.fuzz=n;upd();}}).el,seg([['new','New'],['add','Add'],['sub','Subtract'],['int','Intersect']],st.mode,v=>{st.mode=v;upd();},'Color Range operation'),chk('crInv','Invert colour range',st.invert,v=>{st.invert=v;upd();})];},
  compute:(orig,dst,b)=>{if(!P_COLOR_RANGE)P_COLOR_RANGE=program(FS_COLOR_RANGE);const shape=acquireS(),colors=new Float32Array(48);st.colors.forEach((c,i)=>colors.set(c,i*3));run(P_COLOR_RANGE,shape,{uSrc:source.tex,'uColors[0]':{v3:colors},uCount:{int:st.colors.length},uFuzz:st.fuzz,uInvert:st.invert});const m=modeIndex(st.mode),had=b.active&&!!b.bb;run(P.selop,dst,{uOld:orig.tex,uShape:shape.tex,uMode:{int:m},uOldOn:had});release(shape);return {bb:m>=2?(had?b.bb:null):fullRect(),active:m>=2?had:true};},
  afterRender:t=>drawThumb(t,mask,true),onFinish:()=>{if(owned&&source)release(source);if(thumb)disposeTarget(thumb);}});
}
