/* ================= Canvas tab (0.92, Kenn) =================
   Papers and new-document sizes in one tab next to Brushes and Textures. Click a paper to put it on the canvas
   (it becomes the bottom layer, same as Layer › New › Paper…); pick a size to start a new document. */
const cvsT={drawn:false,thumbs:[]};
function cvsRender(){const box=$('#cvsBody');if(!box||typeof paperThumb!=='function'||typeof PAPER_NAMES==='undefined')return;
  const cur=paperLayer(),on=cur?cur.paper.t:-1;
  if(!cvsT.thumbs.length){try{for(let t=0;t<PAPER_NAMES.length;t++)cvsT.thumbs.push(paperThumb(t,true,1));}catch(e){cvsT.thumbs=[];return;}}
  const grid=el('div',{class:'cvsgrid'});
  PAPER_NAMES.forEach((n,t)=>{const c=document.createElement('canvas');c.width=c.height=96;c.getContext('2d').drawImage(cvsT.thumbs[t],0,0);
    grid.append(el('button',{class:'cvstile'+(t===on?' on':''),title:n+(t===on?' (on the canvas)':' — click to put it on the canvas'),'data-paper':String(t),onclick:()=>{cvsPutPaper(t);}},c,el('span',{text:n})));});
  const sizes=el('select',{id:'cvsPreset','aria-label':'New document size'},...NEW_PRESETS.map(([g,list],gi)=>{const og=el('optgroup',{label:g});list.forEach(([n],i)=>og.append(el('option',{value:gi+':'+i,text:n})));return og;}));
  const dpi=el('select',{id:'cvsDpi','aria-label':'Resolution for inch and millimetre sizes',title:'Used for sizes given in inches or millimetres'},...[72,150,300,600].map(v=>el('option',{value:String(v),text:v+' dpi'})));dpi.value='300';
  box.replaceChildren(el('div',{class:'cvssub',text:'Paper'}),grid,
    el('div',{class:'frow'},el('button',{class:'btn sm',text:'Paper settings…',title:'Texture size, tooth strength and printed lines',onclick:()=>dlgPaper()}),
      el('button',{class:'btn sm',id:'cvsNoPaper',text:'Remove paper',disabled:!cur,title:'Delete the paper layer',onclick:()=>{const L=paperLayer();if(L){selectOnly(L);cmdDelete();cvsRender();}}})),
    el('div',{class:'cvssub',text:'New document'}),el('div',{class:'frow'},sizes),el('div',{class:'frow'},dpi,
      el('button',{class:'btn sm primary',id:'cvsMake',text:'Create',onclick:cvsCreate}),el('button',{class:'btn sm',text:'More options…',onclick:()=>dlgNew()})));}
function cvsPutPaper(t){const cur=paperLayer();paperApply(Object.assign({},PAPER_DEF,cur?cur.paper:{},{t}));cvsRender();}
function cvsCreate(){const v=$('#cvsPreset').value.split(':').map(Number),[,w,h,u]=NEW_PRESETS[v[0]][1][v[1]],dpi=+$('#cvsDpi').value;
  const per={in:dpi,cm:dpi/2.54,mm:dpi/25.4}[u]||1,W=Math.max(1,Math.round(w*per)),H=Math.max(1,Math.round(h*per));
  if(typeof dtNewTab==='function'&&!dtNewTab())return;try{tbDocReset();}catch(e){}
  newDoc(W,H,8,[1,1,1],typeof dtUntitled==='function'?dtUntitled():'Untitled',false,'hand');doc.dpi=u?dpi:72;}
(function(){const go=()=>{const s=$('#cvsSec');if(!s)return;new IntersectionObserver(es=>{if(es.some(e=>e.isIntersecting))cvsRender();}).observe(s);};
  if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',go);else setTimeout(go,0);})();
