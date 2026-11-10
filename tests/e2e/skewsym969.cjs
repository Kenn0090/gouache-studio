/* 0.96.9 (Kenn): skew and offset painting in the Bake tab never use symmetry (2D or 3D mirror); Paint and 3D Paint still do. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:880}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>{const G=__gs;G.setSym('vertical');G.mir3.x=true;G.mir3.radial=0;});await W(200);
 const a=await p.evaluate(()=>{const G=__gs;return {sym:!!G.symFor({}),mats:G.mir3Mats().length,sel:!![...document.querySelectorAll('#optBar select,.optbar select')].find(s=>s.getAttribute('aria-label')==='Symmetry')};});
 ok(a.sym&&a.mats===2,'in Paint the symmetry and the 3D mirror are on '+JSON.stringify(a));
 await p.click('#modeTabs [data-mode=bake]');await W(1200);
 const c=await p.evaluate(()=>{const G=__gs;G.buildOptBar();return {sym:!!G.symFor({}),mats:G.mir3Mats().length,sel:!![...document.querySelectorAll('select')].find(s=>s.getAttribute('aria-label')==='Symmetry'&&s.offsetParent),reset:!!document.getElementById('obSymReset')};});
 ok(!c.sym&&c.mats===1,'in the Bake tab skew painting uses no symmetry and no 3D mirror '+JSON.stringify(c));
 ok(!c.sel&&!c.reset,'and the symmetry controls are not shown there');
 await p.click('#modeTabs [data-mode=paint]');await W(800);
 const d=await p.evaluate(()=>({sym:!!__gs.symFor({}),mats:__gs.mir3Mats().length}));
 ok(d.sym&&d.mats===2,'back in Paint they work again '+JSON.stringify(d));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
