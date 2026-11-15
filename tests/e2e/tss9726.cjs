/* 0.97.26 (Kenn, Painter's Texture Set Settings): channel list with + / − and formats, channel buttons on materials and on the brush */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))console.log('CON',m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await W(3000);
 await p.evaluate(()=>{__gs.showPanel('tsset');__gs.tssRender();});await W(300);
 const t0=await p.evaluate(()=>({vis:!!document.querySelector('#tssSec')&&document.querySelector('#tssSec').offsetParent!==null,rows:[...document.querySelectorAll('.tssrow')].map(r=>r.id.slice(7)),maps:__gs.doc.maps.slice()}));
 ok(t0.vis&&t0.rows.join()===t0.maps.join(),'Texture Set Settings lists the set\'s channels '+t0.rows.join(','));
 await p.selectOption('#tssAdd','sss');await W(300);
 ok(await p.evaluate(()=>__gs.doc.maps.includes('sss')&&!!document.getElementById('tssRow_sss')),'+ Add a channel adds Scattering to the set');
 /* material: a button per channel; clicking one turns that input on */
 const mat=await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();g.showPanel('matEd');g.renderMatEd(true);const chips=[...document.querySelectorAll('#tssMatChips .tsschip')].map(c=>c.textContent);return {chips};});
 ok(mat.chips.includes('scatt')&&mat.chips.includes('color')&&mat.chips.includes('rough'),'the material editor shows a button per channel '+mat.chips.join(','));
 await p.evaluate(()=>document.getElementById('tssMat_sss').click());await W(300);
 ok(await p.evaluate(()=>__gs.doc.active.fill.maps.sss.on===true&&document.getElementById('tssMat_sss').classList.contains('on')),'clicking scatt turns Scattering on in this material');
 /* format: 16-bit converts the pictures, undo goes back */
 const fmt=await p.evaluate(async()=>{const g=__gs,L=g.layerByName("Paint");const t=g.ensureMapTarget(L,"rough");const d0=t.depth;g.tssSetFormat("rough",16);const d1=L.maps.rough.depth;await g.undo();const d2=L.maps.rough.depth;await g.redo();return {d0,d1,d2,d3:L.maps.rough.depth,md:g.mapDepth("rough")};});
 ok(fmt.d0===8&&fmt.d1===16&&fmt.d2===8&&fmt.d3===16&&fmt.md===16,'Roughness to 16-bit converts the layers and undoes '+JSON.stringify(fmt));
 /* a channel of your own */
 await p.evaluate(()=>{__gs.showPanel('tsset');__gs.tssRender();});await p.selectOption('#tssAdd','own');await W(300);
 await p.fill('#tssName_u1','Wetness');await p.press('#tssName_u1','Enter');await W(300);
 ok(await p.evaluate(()=>__gs.doc.maps.includes('u1')&&__gs.MAP_DEFS.u1.label==='Wetness'),'a channel of your own can be added and named');
 /* brush: the same buttons, each with a value; checked ones are painted by the stroke */
 await p.evaluate(()=>{__gs.setTool('brush');__gs.showPanel('tool');__gs.buildBrushPanel();});await W(300);
 const br=await p.evaluate(()=>[...document.querySelectorAll('#tssBrushChips .tsschip')].map(c=>c.textContent.trim()));
 ok(br.includes('scatt')&&br.includes('wetness')&&br.includes('rough'),'the brush has a button per channel '+br.join(','));
 await p.check('#mb_sss');await W(300);
 ok(await p.evaluate(()=>__gs.mapBrushTargets().includes('sss')&&!!document.getElementById('mbv_sss')),'lighting scatt on the brush paints Scattering too, with its own value');
 /* Shader panel Paint lights the brush button */
 await p.evaluate(()=>{__gs.shadeEdit(d=>{d.kind='skin';});__gs.slotPaint('trans');});await W(300);
 ok(await p.evaluate(()=>__gs.doc.maps.includes('trans')&&__gs.ui.mapBrush.trans.on&&__gs.doc.map==='base'),'the Shader panel\'s Paint lights that channel on the brush (you keep painting colour)');
 /* − removes a channel */
 await p.evaluate(()=>{__gs.showPanel('tsset');__gs.tssRender();});await p.click('#tssDel_u1');await W(300);
 const m=await p.$('#modal:not([hidden]) .dlg-actions button.primary');if(m){await m.click();await W(200);}
 ok(await p.evaluate(()=>!__gs.doc.maps.includes('u1')),'− removes the channel');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
