/* ================= Painting several maps at once =================
   The map being viewed gets the brush colour. Every other map switched on in the brush's
   Maps section is painted by the same stroke with its own value, as one undo step. */
ui.mapBrush={rough:{on:false,v:.5},metal:{on:false,v:0},height:{on:false,v:.75},ao:{on:false,v:1},emis:{on:false,c:[0,0,0]},opac:{on:false,v:1}};
const MAP_BRUSH_KEYS=['rough','metal','height','ao','emis','opac'];
/* height is stored 0..1 with 0.5 flat; the slider shows it as -100%..+100% */
function mapBrushColor(k){const m=ui.mapBrush[k];if(k==='emis')return m.c.slice();return [m.v,m.v,m.v];}
/* maps (besides the viewed one) that the current tool paints */
function mapBrushTargets(){if(doc.maps.length<2||ui.mode==='anim')return [];
  return MAP_BRUSH_KEYS.filter(k=>k!==doc.map&&doc.maps.includes(k)&&ui.mapBrush[k].on);}
function strokeExtras(o,et){if(!et||et.isMask||o.chan||!['brush','erase'].includes(o.tool)||!et.L.maps)return [];
  return mapBrushTargets().map(k=>({key:k,mode:strokeMode(o),color:mapBrushColor(k)}));}
function mapBrushSnapshot(){const o={};for(const k of MAP_BRUSH_KEYS)o[k]=Object.assign({},ui.mapBrush[k],ui.mapBrush[k].c?{c:ui.mapBrush[k].c.slice()}:{});return o;}
function applyMapBrush(m){if(!m)return;for(const k of MAP_BRUSH_KEYS)if(m[k])ui.mapBrush[k]=Object.assign({},ui.mapBrush[k],m[k],m[k].c?{c:m[k].c.slice()}:{});}
/* the Maps section of the brush, eraser and fill panels */
function buildMapBrushSection(box,what){if(doc.maps.length<2||ui.mode==='anim')return;
  const erase=what==='erase',keys=MAP_BRUSH_KEYS.filter(k=>doc.maps.includes(k));
  const sec=el('div',{class:'mapbrush'},el('div',{class:'sub',text:erase?'Also erase from':what==='fill'?'Also fill':'Also paint'}));
  sec.append(el('p',{class:'note',text:MAP_DEFS[doc.map].label+' (the map you are viewing) '+(erase?'is erased':'gets the foreground colour')+'. Edit › Fill and Delete follow these switches too.'}));
  for(const k of keys){if(k===doc.map)continue;const m=ui.mapBrush[k],D=MAP_DEFS[k];
    const row=el('div',{class:'mbrow'},chk('mb_'+k,D.label,m.on,v=>{m.on=v;brushEdited();buildBrushPanel();}));
    if(!erase&&m.on){
      if(k==='emis'){const c=el('input',{type:'color','aria-label':'Emissive colour',value:toHex(m.c)});c.addEventListener('input',()=>{m.c=fromHex(c.value);brushEdited();});row.append(c);}
      else if(k==='height')row.append(makeSlider({id:'mbv_'+k,label:'Height',min:-1,max:1,step:.01,value:m.v*2-1,fmt:v=>(v>0?'+':'')+Math.round(v*100)+'%',onInput:v=>{m.v=(v+1)/2;brushEdited();}}).el);
      else row.append(makeSlider({id:'mbv_'+k,label:'Value',min:0,max:1,step:.01,value:m.v,fmt:pct,onInput:v=>{m.v=v;brushEdited();}}).el);}
    sec.append(row);}
  box.append(sec);}
