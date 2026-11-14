/* wiki screenshots for 0.97.25: generator settings in cards, edge controls, the Invert button */
const {chromium}=require('playwright'),path=require('path');
const OUT=path.resolve(__dirname,'../../docs/wiki/images')+'/';
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1500}})).newPage();p.setDefaultTimeout(120000);
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.removeItem('gs.msCards');localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>__gs.useModel(__gs.primMesh('rcube',2)));await W(800);
 /* a light paint material with Edge wear in its mask, a few edge controls changed */
 await p.evaluate(()=>{const G=__gs;G.cmdNewFillLayer({name:'Worn paint',maps:{base:{on:true,c:[.85,.82,.75]},rough:{on:true,v:.45},metal:{on:true,v:0}}});const L=G.doc.active;
   G.msAdd(L,'gen',{p:Object.assign(G.msGenDefaults('edge'),{edgeStrength:1.3,edgeGrow:.25,edgeSharp:.4,edgeCorner:.5})});G.showPanel('matEd');G.renderMatEd(true);G.changedAll();});await W(1500);
 const sec=await p.$('#matEdSec');
 await p.evaluate(()=>{document.getElementById('msC_cav')&&document.querySelector('#msCard_cav').click();document.querySelector('#msCard_flat')&&document.querySelector('#msCard_flat').click();});await W(300);
 await p.evaluate(()=>document.getElementById('matEdSec').scrollTop=0);
 await sec.screenshot({path:OUT+'gen-cards.png'});
 /* the Edges card with a grunge picked: the picture first, its controls after it */
 await p.evaluate(async()=>{const G=__gs;await G.txLoad();const it=G.fxdAllTex().find(x=>x.kind==='photo');const L=G.doc.active,r=L.mask.stack[L.mask.stack.length-1];
   G.msEdit(L,r,x=>{x.p.egimg={kind:it.kind,id:it.id,name:it.name};});G.renderMatEd(true);});await W(1500);
 const card=await p.$('#msC_edges');await card.scrollIntoViewIfNeeded();await card.screenshot({path:OUT+'gen-card-edges.png'});
 console.log(errs.length?'page errors: '+errs.join(' | '):'done');await b.close();})();
