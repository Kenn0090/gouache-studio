/* ================= 3D Paint keeps only tools that work on the model (0.96.5, Kenn) =================
   "Remove any tools that can't be used in the 3D paint section ... and the hotkey access to them as well; these sections should act truly
   independent of each other." Move, Fill bucket / Gradient, Marquee, Lasso, Magic wand and Pen only worked on the flat texture view, so they
   are hidden in 3D Paint and their keys do nothing there (Polygon fill, the mask tools bar's Box/Lasso and the Surface Path take their place).
   Crop, Cage, Array and Shape were hidden before. The mask tools bar still uses Marquee and Lasso inside itself (setTool's force). */
const P3D_OFF_TOOLS=['move','bucket','gradient','gbucket','marquee','lasso','wand','pen','cage','crop','array','shape'];
function p3ToolOk(t){return ui.mode!=='p3d'||!P3D_OFF_TOOLS.includes(t);}
/* on entering 3D Paint with one of them chosen: back to the brush */
function p3ToolFix(){if(p3ToolFix.mode!==ui.mode){p3ToolFix.mode=ui.mode;if(typeof renderLibrary==='function')requestAnimationFrame(()=>renderLibrary());}if(ui.mode!=='p3d'||p3ToolOk(ui.tool))return;if(typeof maskToolsOn==='function'&&maskToolsOn()&&(ui.tool==='marquee'||ui.tool==='lasso'))return;setTool('brush',false,true);}

/* ---- (0.96.6, Kenn) brushes that carry their own alignment in 3D Paint, shown with a small 3D badge ----
   Graffiti brushes paint with Tangent | Wrap (their drips run down the view), and so do the blending, liquify, healing and clone brushes
   (UV alignment cannot do those). Picking one switches the Projection setting; picking a brush without one puts your own setting back. */
const ALIGN3D_NAMES={uv:'UV',wrap:'Tangent | Wrap',camera:'Camera'};
function brushAlign3d(p){if(!p)return null;if(p.align3d)return p.align3d;return ['smudge','liquify','heal','clone'].includes(p.tool)?'wrap':null;}
function p3BrushAlign(p){if(ui.mode!=='p3d')return;const s=v3s(),a=brushAlign3d(p);
  if(a){if(s.userAlign==null)s.userAlign=s.paintAlign||'uv';if((s.paintAlign||'uv')!==a){s.paintAlign=a;toast('“'+p.name+'” paints with '+ALIGN3D_NAMES[a]+' alignment in 3D Paint (switched for you).');}}
  else if(s.userAlign!=null){const back=s.userAlign;delete s.userAlign;if((s.paintAlign||'uv')!==back){s.paintAlign=back;toast('Alignment back to '+ALIGN3D_NAMES[back]+'.');}}
  if(typeof buildBrushPanel==='function')buildBrushPanel();}
{const ap=applyPreset;applyPreset=function(p){const r=ap.apply(this,arguments);try{p3BrushAlign(p);}catch(e){console.warn(e);}return r;};}
{const bt=brushLibraryTile;brushLibraryTile=function(p,recent){const b=bt.apply(this,arguments);const a=ui.mode==='p3d'?brushAlign3d(p):null;
  if(a&&b){b.classList.add('has3d');b.append(el('span',{class:'b3d',text:'3D',title:'In 3D Paint this brush paints with '+ALIGN3D_NAMES[a]+' alignment (switched for you)'}));b.title=(b.title||'')+' · 3D: '+ALIGN3D_NAMES[a];}return b;};}

/* (0.97.27, Kenn: "when brushes need specific alignment, they should have that in their brush settings so they can easily be
   switched") the Brush settings in 3D Paint start with how this brush lands on the model. Saved with the brush (align3d), so
   picking the brush again switches the alignment; "Projection setting" leaves it to the Projection panel. */
function brushAlignRow(){if(ui.mode!=='p3d'||!['brush','erase','dodge','burn','smudge','liquify','heal','clone','material'].includes(ui.tool))return null;
  const s=v3s(),fixed=typeof MESH_WRAP_ONLY!=='undefined'&&MESH_WRAP_ONLY.includes(ui.tool),need=brushAlign3d({tool:ui.tool,align3d:brush.align3d});
  const sel=el('select',{id:'brAlign3d',class:'shsel','aria-label':'Alignment on the model',disabled:fixed||null},
    el('option',{value:'',text:'Projection setting ('+ALIGN3D_NAMES[s.userAlign||s.paintAlign||'uv']+')'}),...['wrap','camera','uv'].map(k=>el('option',{value:k,text:ALIGN3D_NAMES[k]})));
  sel.value=fixed?'wrap':(brush.align3d||'');
  sel.onchange=()=>{const v=sel.value;brush.align3d=v;if(v){if(s.userAlign==null)s.userAlign=s.paintAlign||'uv';s.paintAlign=v;}else if(s.userAlign!=null){s.paintAlign=s.userAlign;delete s.userAlign;}
    if(typeof brushEdited==='function')brushEdited();buildBrushPanel();if(typeof v3Refresh==='function')v3Refresh();};
  const note=fixed?'This tool reads the paint around it, so it always uses Tangent | Wrap.':need==='wrap'&&!brush.align3d?'':brush.align3d?'Saved with the brush: picking it again switches to '+ALIGN3D_NAMES[brush.align3d]+'.':'';
  return el('div',{class:'bralign',id:'brAlignRow'},el('div',{class:'frow'},el('span',{text:'On the model'}),sel),note?el('p',{class:'note',text:note}):'');}
{const f=buildBrushPanel;buildBrushPanel=function(){const r=f.apply(this,arguments);try{const body=document.getElementById('brushBody');if(body&&!body.querySelector('#brAlignRow')){const row=brushAlignRow();if(row)body.prepend(row);}}catch(e){console.warn('brush alignment row',e);}return r;};}
