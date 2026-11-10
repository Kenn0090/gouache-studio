/* 0.97.1 (Kenn: "like Painter"): clicking a layer's thumbnail shows only its effect rows, clicking its mask only the mask rows,
   clicking the same thumbnail again hides them; other layers show no rows. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'Rows',false));await W(300);
 /* a layer with a mask (two rows) and a content effect, and a second layer with an effect */
 await p.evaluate(()=>{const G=__gs;G.cmdAddLayer();const A=G.doc.active;A.name='Patina';G.msAdd(A,'fill',{p:{v:1}});G.msAdd(A,'paint');G.cfxAdd(A,'invert');
   G.cmdAddLayer();const B=G.doc.active;B.name='Other';G.cfxAdd(B,'invert');G.selectOnly(A);A.editMask=false;A.fxFold=false;G.renderLayers();});await W(300);
 const rows=()=>p.evaluate(()=>({m:document.querySelectorAll('.msrow.m').length,c:document.querySelectorAll('.msrow.c').length}));
 const thumb=async(name,mask)=>{await p.evaluate(([name,mask])=>{const G=__gs,L=G.allNodes(G.doc.root).find(n=>n.name===name);const t=mask?L.mask.thumb:L.thumb;
   const r=t.getBoundingClientRect();t.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.left+3,clientY:r.top+3,button:0,pointerId:1}));t.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,clientX:r.left+3,clientY:r.top+3,button:0,pointerId:1}));},[name,mask]);await W(250);};
 let r=await rows();ok(r.c===1&&r.m===0,'the selected layer shows only its effect rows; the other layer none '+JSON.stringify(r));
 await thumb('Patina',true);r=await rows();ok(r.m===2&&r.c===0,'clicking the mask shows only the mask rows '+JSON.stringify(r));
 await thumb('Patina',true);r=await rows();ok(r.m===0&&r.c===0,'clicking the mask again hides them '+JSON.stringify(r));
 await thumb('Patina',false);r=await rows();ok(r.c===1&&r.m===0,'clicking the layer thumbnail shows its effects again '+JSON.stringify(r));
 await thumb('Patina',false);r=await rows();ok(r.c===0&&r.m===0,'clicking the layer thumbnail again hides it all '+JSON.stringify(r));
 await thumb('Patina',false);r=await rows();ok(r.c===1,'and once more shows them '+JSON.stringify(r));
 await thumb('Other',false);r=await rows();ok(r.c===1&&r.m===0&&await p.evaluate(()=>__gs.doc.active.name==='Other'),'another layer shows only its own rows '+JSON.stringify(r));
 await p.evaluate(()=>{const G=__gs,A=G.doc.active;A.fxFold=true;G.cfxAdd(A,'invert');G.renderLayers();});await W(200);r=await rows();ok(r.c===2,'adding an effect shows the rows '+JSON.stringify(r));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
