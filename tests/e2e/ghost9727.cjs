/* 0.97.27 (Georgian: "a layer that I deleted but still showing, now it's an overlay"): the mask view closes when its layer is deleted,
   and the wireframe it turned on goes back off */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(3000);
 const st=()=>p.evaluate(()=>({view:!!__gs.ui.viewMask,wire:__gs.v3WireMode(),bar:!!document.getElementById('maskBar')&&!document.getElementById('maskBar').hidden,layers:__gs.allLayers().map(l=>l.name)}));
 await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;L.name='Curvature test';g.msAdd(L,'gen',{});L.editMask=true;g.ui.viewMask=true;g.renderLayers();g.maskBarSync();g.v3SetWireMode('overlay');});await p.waitForTimeout(400);
 const a=await st();ok(a.view&&a.wire==='overlay','mask view open, wireframe turned on in it '+JSON.stringify(a));
 /* another layer below also has a mask, so the view could jump to it */
 await p.evaluate(()=>{const g=__gs,B=g.allLayers().find(l=>l.name==='Base material');if(B&&!B.mask){const keep=g.doc.active;g.doc.active=B;g.doc.sel=new Set([B]);g.cmdAddMask(true);g.doc.active=keep;g.doc.sel=new Set([keep]);}g.cmdDelete();g.renderLayers();g.maskBarSync();});await p.waitForTimeout(500);
 const c=await st();
 ok(!c.layers.includes('Curvature test'),'the layer is deleted');
 ok(!c.view&&c.wire==='shaded','the mask view closes and the wireframe goes back off '+JSON.stringify(c));
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
