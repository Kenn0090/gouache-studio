/* 0.97.24 (Kenn): generator settings in cards with each grunge beside its sliders (like Marmoset), more edge controls on the
   edge presets, and a clear Invert button. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1300}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.removeItem('gs.msCards');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>__gs.useModel(__gs.primMesh('rcube',2)));await W(600);
 await p.evaluate(()=>{const G=__gs;G.cmdAddLayer();const L=G.doc.active;G.msAdd(L,'gen',{p:G.msGenDefaults('edge')});G.showPanel('matEd');G.renderMatEd(true);});await W(600);
 const cards=await p.evaluate(()=>Object.fromEntries([...document.querySelectorAll('.msccard')].map(c=>[c.id,[...c.querySelectorAll('[id]')].map(i=>i.id)])));
 ok(cards.msC_edges&&['ms_w','ms_edgeStrength','ms_edgeGrow','ms_edgeSharp','ms_edgeMin','ms_edgeCorner','ms_edgeDist','ms_cavityProtection','msEGrungeSlot'].every(k=>cards.msC_edges.includes(k)),'Edge wear: an Edges card with its width, the new edge controls and the Edges grunge together');
 ok(cards.msC_breakup&&cards.msC_breakup.includes('ms_brk')&&cards.msC_breakup.includes('msGrungeSlot'),'the Breakup slider sits with the Breakup grunge');
 ok(cards.msC_proj&&cards.msC_mask,'Mask and Projection cards too '+Object.keys(cards).join(','));
 const mean=()=>p.evaluate(()=>{const G=__gs,L=G.doc.active;L.mask._key=null;G.msUpdate(L);const t=L.mask.target,d=G.captureRegionNow(t,0,0,t.w,t.h).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s/(d.length/4);});
 const set=(k,v)=>p.evaluate(([k,v])=>{const G=__gs,L=G.doc.active,r=L.mask.stack[L.mask.stack.length-1];r.p[k]=v;},[k,v]);
 const m0=await mean();
 await set('edgeStrength',0);const m1=await mean();await set('edgeStrength',1);
 await set('edgeGrow',.6);const m2=await mean();await set('edgeGrow',0);
 await set('edgeMin',.85);const m3=await mean();await set('edgeMin',0);
 const m4=await mean();
 ok(m1<m0*.6,'Edge strength 0 removes the edge wear ('+[m0,m1].map(Math.round)+')');
 ok(m2>m0*1.1,'Edge growth spreads it ('+[m0,m2].map(Math.round)+')');
 ok(m3<m0,'Sharp edges only keeps less ('+[m0,m3].map(Math.round)+')');
 ok(Math.abs(m4-m0)<1,'back at the defaults the mask is as before');
 /* the Invert button */
 const iv=await p.evaluate(()=>{const b=document.getElementById('msInvBtn');const before=b&&b.textContent;b.click();const L=__gs.doc.active,r=L.mask.stack[L.mask.stack.length-1];return {before,after:document.getElementById('msInvBtn').textContent,on:r.p.inv,hiddenTick:document.getElementById('ms_inv').closest('label').hidden,underPreset:document.querySelector('#ms_g').closest('.frow').nextElementSibling===document.getElementById('msInvBtn')};});
 ok(iv.on===true&&/Inverted/.test(iv.after)&&iv.hiddenTick&&iv.underPreset,'Invert is a clear button under Preset and inverts the mask '+JSON.stringify(iv));
 const mi=await mean();ok(Math.abs(mi-(255-m0))<25,'the mask is inverted ('+Math.round(mi)+' vs '+Math.round(255-m0)+')');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
