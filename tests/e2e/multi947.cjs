/* 0.94.7 (Kenn): several pictures dropped at once; Hand-painted materials show their settings at once; the new viewer is banked */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* a tiny PNG made in the page */
 const drop=(sel,names)=>p.evaluate(async([sel,names])=>{const mk=async(n,c)=>{const cv=document.createElement('canvas');cv.width=cv.height=8;const x=cv.getContext('2d');x.fillStyle=c;x.fillRect(0,0,8,8);const bl=await new Promise(r=>cv.toBlob(r,'image/png'));return new File([bl],n,{type:'image/png'});};
   const dt=new DataTransfer();let i=0;for(const n of names)dt.items.add(await mk(n,['#f00','#0f0','#00f','#888'][i++%4]));const t=document.querySelector(sel);
   t.dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));t.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));},[sel,names]);
 /* Paint: three pictures dropped on the canvas → three layers */
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await drop('#work',['a.png','b.png','c.png']);await W(2500);
 ok(await p.evaluate(n=>__gs.allLayers().length===n+3,n0),'three pictures dropped on the canvas become three layers ('+await p.evaluate(()=>__gs.allLayers().length)+')');
 /* 3D Paint: pictures dropped on a material go to their channels by name */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{__gs.cmdNewFillLayer();__gs.showPanel('matEd');__gs.renderMatEd(true);});await W(500);
 await drop('[data-material-channel=base]',['Rock_BaseColor.png','Rock_Roughness.png','Rock_Metallic.png']);await W(2500);
 const ch=await p.evaluate(()=>{const m=__gs.doc.active.fill.maps;return {base:m.base.src+':'+m.base.name,rough:m.rough.on&&m.rough.src+':'+m.rough.name,metal:m.metal.on&&m.metal.src+':'+m.metal.name};});
 ok(/image:Rock_BaseColor/.test(ch.base)&&/image:Rock_Roughness/.test(ch.rough)&&/image:Rock_Metallic/.test(ch.metal),'several pictures dropped on a material go to the channels their names say '+JSON.stringify(ch));
 /* a Hand-painted material shows its settings straight away */
 await p.evaluate(()=>{__gs.cmdNewHandPaintMaterial('Gold');});await W(600);
 ok(await p.evaluate(()=>!!document.getElementById('hpOverBelow')),'a new Hand-painted material shows its look settings');
 await p.evaluate(()=>{const L=__gs.doc.active;__gs.selectOnly(__gs.layerByName('Paint'));__gs.renderMatEd(true);__gs.selectOnly(L);__gs.ui.msSel=null;__gs.renderMatEd(true);});await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('hpOverBelow')),'…and again when it is selected later');
 await p.evaluate(()=>document.getElementById('hpMatChannels').click());await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('fl_name')&&!!document.getElementById('hpMatLook')),'Material channels shows the channels, with the way back');
 /* the new viewer is banked */
 ok(await p.evaluate(()=>__gs.NV_BANKED===true&&(!document.getElementById('v3Nv')||document.getElementById('v3Nv').hidden)),'the new viewer has no button');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
