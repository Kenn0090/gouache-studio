/* Wiki pictures that wikishots/quickshots/p3dshots no longer reach (0.96.9 layout): fill layer, layer menu, options bar,
   masks, library, filters, ... Usage: node wikishots2.cjs [group ...]   groups: layers mask3d lib filters render */
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
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();
})();
