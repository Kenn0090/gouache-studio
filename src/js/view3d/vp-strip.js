/* ================= The viewport strip in 3D Paint (0.35) =================
   A small pill at the bottom of the painting area with 3D · Split · 2D and a UV switch, so the layout is one
   click away without opening a panel. In Split the divider between the two views drags; the flat texture keeps
   its own zoom. */
const vps={el:null};
function vpStripSync(show){
  const on=show===undefined?ui.mode==='p3d':!!show,work=$('#work');
  if(!work)return;
  if(!vps.el){
    vps.el=el('div',{class:'vpstrip',id:'vpStrip',role:'group','aria-label':'Viewport layout'});
    for(const [k,l,t] of [['3d','3D','Only the 3D view'],['split','Split','3D and the flat texture side by side; drag the divider'],['2d','2D','Only the flat texture']])
      vps.el.append(el('button',{class:'vpb',id:'vp_'+k,text:l,title:t,'data-k':k,onclick:()=>{if(typeof p3SetLayout==='function')p3SetLayout(k);}}));
    vps.el.append(el('span',{class:'vpsep'}),el('button',{class:'vpb',id:'vp_uv',text:'UV',title:'Show the model\'s UV layout over the flat texture',onclick:()=>{const s=v3s();s.showUV=!s.showUV;v3.dirty=true;requestRender(true);vpStripSync();}}));
    work.append(vps.el);}
  vps.el.hidden=!on;if(!on)return;
  for(const b of vps.el.querySelectorAll('.vpb[data-k]'))b.setAttribute('aria-pressed',String(p3.layout===b.dataset.k));
  const uv=$('#vp_uv');if(uv)uv.setAttribute('aria-pressed',String(!!v3s().showUV));}
