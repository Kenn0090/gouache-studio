/* ---- (0.38, Kenn) Turn the canvas (or one layer) into a texture: Grunge, Decal, Material, Brush tip or Stencil ----
   Transparency is kept. With a selection only its box is used. A Decal or Material goes to the Convert tab, where
   "Turn into material" makes the real material; for a Decal the cut-out (alpha) is kept on every map. */
const TT_TYPES=[['grunge','Grunge'],['decal','Decal'],['material','Material'],['tip','Brush tip'],['stencil','Stencil']];
/* the picture to convert: a layer's own colour, or the whole painting; cropped to the selection when there is one */
function ttSource(L){
  let full=null,rel=false;
  if(L&&isLayer(L)&&mapT(L,'base')&&!mapT(L,'base').empty){full=mapT(L,'base');}
  else{full=compositeMap('base');rel=true;}
  const bb=selOn(null)&&sel.bb?sel.bb:null,x=bb?Math.max(0,bb[0]):0,y=bb?Math.max(0,bb[1]):0,w=bb?Math.min(doc.w,bb[2])-x:doc.w,h=bb?Math.min(doc.h,bb[3])-y:doc.h;
  if(w<2||h<2){if(rel)release(full);return null;}
  const t=makeTarget(w,h,8,false);blit(full,t,x,y,w,h,0,0);if(rel)release(full);return t;}
function dlgToTexture(L){
  if(ui.mode!=='paint'){toast('Turn into a texture works in the Paint tab.');return;}
  if(L&&!isLayer(L))L=null;
  let type='grunge',name=((L&&L.name)||doc.name||'Texture').replace(/\.[a-z0-9]+$/i,'').trim()||'Texture';
  const nm=el('input',{type:'text',id:'ttName',value:name});nm.addEventListener('input',()=>{name=nm.value;});
  const note=el('p',{class:'note',id:'ttNote'});
  const NOTES={grunge:'Saved in Textures. Use it as a mask, a material channel, a new layer, a stencil or a brush tip.',decal:'Opens the Convert tab with the picture. Make the maps, then press Turn into material: it keeps the cut-out, so it sits on the model like a sticker.',
    material:'Opens the Convert tab with the picture. Make the maps, then press Turn into material.',tip:'Made from how dark the picture is. It is added to Custom tips and selected.',stencil:'Becomes the stencil in 3D Paint.'};
  const sync=()=>{note.textContent=NOTES[type]+(selOn(null)&&sel.bb?' Only the selected area is used.':'')+' Transparent parts stay transparent.';};
  const types=seg(TT_TYPES.map(([k,l])=>[k,l]),type,v=>{type=v;sync();},'Texture type');types.classList.add('themeseg');
  sync();
  openDialog({title:L?'Turn layer into a texture':'Turn canvas into a texture',body:el('div',{class:'dlg-grid'},el('div',{class:'frow'},el('label',{for:'ttName',text:'Name'}),nm),el('div',{class:'sub',text:'What is it?'}),types,note),okLabel:'Make texture',
    onOk(){ttMake(L,type,(name||'Texture').trim()||'Texture');}});}
async function ttMake(L,type,name){
  const t=ttSource(L);if(!t){toast('Nothing to turn into a texture: the area is empty.');return;}
  if(type==='grunge'){doc.projectAssets=doc.projectAssets||[];const owner=docState().doc;try{const rec=await txAddTarget(t,name),raw=await store.getRaw(rec.id,'textures');await paRemember('tex',raw,owner,true);}catch(e){disposeTarget(t);toast('Could not save the texture: '+(e.message||e));return;}
    if(typeof renderTextures==='function')renderTextures();if(typeof showPanel==='function')try{showPanel('textures');}catch(e){}toast('Added “'+name+'” to Textures.');return;}
  if(type==='tip'){const S=Math.min(512,Math.max(t.w,t.h)),s=makeTarget(S,S,8,false);copyScaled(t,s);const d=captureRegionNow(s,0,0,S,S).data;disposeTarget(s);disposeTarget(t);
    const v=new Uint8Array(S*S);for(let i=0;i<S*S;i++)v[i]=Math.round((d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11)*(d[i*4+3]/255));
    const p=addCustomTip(name+' tip',S,S,v);toast(p?'Made the brush tip “'+p.name+'”: it is in Custom tips and selected.':'This picture is too dark to make a brush tip from.');return;}
  if(type==='stencil'){setMode('p3d');st3Use(t,name);if(st3.mode==='off')st3.mode='mask';if(typeof buildP3Panel==='function')buildP3Panel();toast('“'+name+'” is the stencil. S + drag moves it over the model.');return;}
  /* decal / material: through the Convert tab */
  setMode('convert');tabDocResize(t.w,t.h,'Convert');cvSetSource(t,name,true);cvS.decal=type==='decal';
  toast(type==='decal'?'Make the maps you want, then press Turn into material. It keeps the cut-out.':'Make the maps you want, then press Turn into material.');}
