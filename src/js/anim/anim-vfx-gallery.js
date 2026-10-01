/* ================= VFX preview gallery ================= */
function dlgVfxGallery(preselect){if(!ensureAnimMode())return;
  const search=el('input',{type:'search',placeholder:'Find an effect…','aria-label':'Search VFX',class:'afxsearch'}),nav=el('div',{class:'chips'}),grid=el('div',{class:'vfxcards'});
  let category='All',closed=false,tmp=makeTarget(120,120,8),hover=null,time=0,timer=0,index=0;
  const cards=[],section=k=>k>=19&&k<=21?'Anime':k>=22?'Stylized':'Standard';
  const dispose=()=>{closed=true;clearTimeout(timer);if(tmp){disposeTarget(tmp);tmp=null;}};
  const show=()=>{const q=search.value.trim().toLowerCase();cards.forEach(c=>c.button.hidden=(category!=='All'&&c.category!==category)||!c.name.toLowerCase().includes(q));nav.replaceChildren(...['All','Standard','Anime','Stylized'].map(cat=>el('button',{class:'chip'+(cat===category?' on':''),text:cat,onclick:()=>{category=cat;show();}})));};
  const draw=(c,t)=>{const opt=vfxOpts(c.kind);vfxGenInto(tmp,opt,t,null);const px=captureRegionNow(tmp,0,0,120,120).data,id=new ImageData(120,120);for(let i=0;i<px.length;i+=4){const a=px[i+3];if(a){id.data[i]=Math.min(255,px[i]*255/a);id.data[i+1]=Math.min(255,px[i+1]*255/a);id.data[i+2]=Math.min(255,px[i+2]*255/a);id.data[i+3]=a;}}c.canvas.getContext('2d').putImageData(id,0,0);};
  for(const [kind,name] of VFX_KINDS){const canvas=el('canvas',{width:120,height:120}),c={kind,name,canvas,category:section(kind)};
    const button=el('button',{class:'vfxcard',id:'vfxCard_'+kind,'aria-label':'Edit '+name,title:name+' — hover to preview, click to edit',onclick:()=>{dispose();dlgGenerate(kind);}},canvas,el('b',{text:name}),el('span',{class:'dim',text:c.category+' · '+(VFX_ONESHOT.includes(kind)?'Plays once':'Loops')}));
    c.button=button;button.onpointerenter=()=>{hover=c;time=0;};button.onpointerleave=()=>{hover=null;if(!closed)draw(c,VFX_ONESHOT.includes(kind)?.12:.3);};button.onfocus=()=>{hover=c;time=0;};button.onblur=()=>{hover=null;};cards.push(c);grid.append(button);}
  search.oninput=show;show();
  const body=el('div',{class:'vfxgallery'},el('p',{class:'note',text:'Hover to play a preview. Choose an effect to edit its colours, shape and animation.'}),search,nav,grid);
  openDialog({title:'VFX gallery',body,cancelLabel:'Close',onCancel:dispose});
  const tick=()=>{if(closed)return;try{if(index<cards.length){draw(cards[index],VFX_ONESHOT.includes(cards[index].kind)?.12:.3);index++;}if(hover&&!hover.button.hidden){time+=.065;draw(hover,VFX_ONESHOT.includes(hover.kind)?Math.min(1,time%1.35):time%1);}}catch(e){console.warn('VFX preview',e);}timer=setTimeout(tick,index<cards.length?20:90);};tick();
  if(preselect!=null){const c=cards.find(c=>c.kind===preselect);if(c){c.button.focus();c.button.scrollIntoView({block:'nearest'});}}
}
