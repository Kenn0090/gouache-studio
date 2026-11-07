/* (0.95.5, Kenn: "the shortcuts change when you're in different sections") a tool's tooltip names the key that works in the
   tab you are in (Brush is B in Paint, 1 in 3D Paint; P is the Pen in Paint and the Surface Path in 3D Paint), and a key you
   changed in Edit › Keyboard shortcuts. The title is written when the pointer reaches the button, so it is never out of date. */
function toolKeyFor(tool){const id='tool:'+tool,user=typeof kbUser!=='undefined'&&id in kbUser;if(user)return kbUser[id]||'';
  const p3=ui.mode==='p3d';
  if(tool==='brush')return p3?'1':'B';
  if(tool==='pen')return p3?'':'P';
  if(tool==='path')return p3?'P':'';
  if(p3&&['crop','text','shape','array'].includes(tool))return '';
  if(tool==='bucket'||tool==='gbucket')return kbKeyOf('tool:gradient');
  if(tool==='burn')return kbKeyOf('tool:dodge');
  return kbKeyOf(id)||'';}
const TOOL_KEY_EXTRA={picker:'or hold Alt',hand:'or hold Space',zoom:'Shift-click to zoom out',gradient:'Shift+G switches',dodge:'Shift+O switches',burn:'Shift+O switches',bucket:'Shift+G switches',gbucket:'Shift+G switches'};
function toolTitleSync(b){const t=b&&b.dataset&&b.dataset.tool;if(!t)return;
  if(!b.dataset.name)b.dataset.name=(b.getAttribute('aria-label')||b.title||t).replace(/ \(.*$/,'').replace(/ — .*$/,'');
  const k=toolKeyFor(t),ex=TOOL_KEY_EXTRA[t],menu=b.classList.contains('has-tool-menu');
  const inside=[k,ex].filter(Boolean).join(', ');
  b.title=b.dataset.name+(inside?' ('+inside+')':'')+(menu?' — click the arrow or hold the left mouse button for more tools':'');}
document.addEventListener('pointerover',e=>{const b=e.target&&e.target.closest&&e.target.closest('#tools .tool[data-tool]');if(b)toolTitleSync(b);},true);
document.addEventListener('focusin',e=>{const b=e.target&&e.target.closest&&e.target.closest('#tools .tool[data-tool]');if(b)toolTitleSync(b);},true);
