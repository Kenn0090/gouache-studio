/* Wiki pictures that wikishots/quickshots/p3dshots no longer reach (0.96.9 layout): fill layer, layer menu, options bar,
   masks, library, filters, ... Usage: node wikishots2.cjs [group ...]   groups: layers filters p3d (p3d: library-leather and decals-on-model do not show the material/decals under SwiftShader yet; keep the old pictures) */
const {open}=require('./wiki2-lib.cjs');
const want=process.argv.slice(2);const on=g=>!want.length||want.includes(g);
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const {b,p,W,click,shot,setFG,el,errs,OUT}=await open({w:1900,h:1500});
 const doc=()=>p.evaluate(()=>{__gs.newDoc(640,420,8,[.93,.91,.87],'fills',false);__gs.setDocMaps(['base','rough','metal','height','normal'],'maps');__gs.act('fit');});
 if(on('layers')){
  await doc();await W();await setFG('#8a8f96');
  await p.evaluate(()=>__gs.cmdNewFillLayer());await W(600);
  await p.evaluate(()=>{const L=__gs.doc.active;L.name='Steel';__gs.showPanel('matEd');});await W(600);
  /* the Material editor group is short by default: give it room just for the picture */
  await p.evaluate(()=>{const g=document.querySelector('#matEdSec').closest('.dkgrp');g.style.flex='none';g.style.height='900px';g.style.maxHeight='none';});await W(500);
  await el('fill-layer','.dkgrp:has(#matEdSec)');
  await p.evaluate(()=>{const g=document.querySelector('#matEdSec').closest('.dkgrp');g.style.flex='';g.style.height='';g.style.maxHeight='';});
  await p.evaluate(()=>__gs.showPanel('layers'));await W(400);
  await p.locator('#layerList .lrow').first().click({button:'right'});await W(400);
  await el('layer-menu','#menuPop');await p.keyboard.press('Escape');await p.mouse.click(600,600);await W();
  await click('#obMore');await W(300);await el('options-more','#optBar');await click('#obMore');
 }
 if(on('filters')){
  await p.evaluate(()=>__gs.EXAMPLES[0].run());await W(2500);
  await p.evaluate(()=>{const L=__gs.allLayers().find(l=>/stone|cobble/i.test(l.name))||__gs.allLayers()[1];__gs.doc.active=L;__gs.doc.sel=new Set([L]);});
  await p.evaluate(()=>__gs.act('gallery'));await W(3500);await p.evaluate(()=>document.activeElement.blur());
  await el('filter-gallery','#modal .dialog');await click('#dlgCancel');await W(300);
 }
 if(on('p3d')){
  await p.evaluate(()=>__gs.p3NewProject(1024,{modelKey:'rcube'}));await W(2500);
  await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:.6,pitch:.35});__gs.v3.dirty=true;});
  await click('#vp_3d');await W(800);
  /* a library material on the whole model (its pictures load from dist-web/materials) */
  await p.evaluate(async()=>{await __gs.gmApply({name:'Brown leather',file:'brown-leather.gmat'});});await W(5000);
  await p.mouse.move(5,900);await W(400);await el('library-leather','#work');
  /* decals, larger than usual so they read in a picture */
  await p.evaluate(()=>{__gs.showPanel('decals');__gs.dc.size=.2;});await W(500);
  const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
  for(const [id,dx,dy] of [['bolt',-110,-90],['bolt',110,-90],['bolt',-110,90],['bolt',110,90],['vent',0,0]]){
    await click('#dc_'+id);await W(200);await p.mouse.click(cx+dx,cy+dy);await W(1000);}
  await p.keyboard.press('Escape');await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Base material')||__gs.allLayers()[0];__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.v3.dirty=true;});await p.mouse.move(5,900);await W(800);await el('decals-on-model','#work');
 }
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();
})();
