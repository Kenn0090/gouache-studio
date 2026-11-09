/* 0.96.1 (Kenn): texture tiles drop onto every grunge/picture input: the Mask builder's Grunge box and a mask Picture row */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 const dragTo=async sel=>{await p.evaluate(()=>__gs.showPanel('textures'));await W(600);const tile=p.locator('.txtile').first(),box=p.locator(sel);await box.scrollIntoViewIfNeeded();await tile.scrollIntoViewIfNeeded();await W(200);
   const tb=await tile.boundingBox(),bb=await box.boundingBox();if(!tb||!bb)return false;await p.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2);await p.mouse.down();await p.mouse.move(tb.x+40,tb.y+10,{steps:4});await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:8});await p.mouse.up();await W(1200);return true;};
 const show=kind=>p.evaluate(kind=>{const G=__gs;G.selectOnly(G.layerByName('Paint'));const L=G.doc.active;if(L.mask)L.mask.stack.splice(0);const r=G.msAdd(L,kind==='builder'?'gen':'image',kind==='builder'?{p:G.msGenDefaults('builder')}:{});
   const row=L.mask.stack.at(-1);G.ui.msSel={L,where:'m',id:row.id};G.ui.editMask=true;G.showPanel('matEd');G.renderMatEd(true);},kind);
 await show('builder');await W(500);await dragTo('#msGrungeDrop');
 ok(await p.evaluate(()=>!!__gs.doc.active.mask.stack.at(-1).p.gimg),'a tile dropped on the Mask builder’s Grunge box becomes its grunge');
 await show('image');await W(500);await dragTo('#msImageDrop');
 ok(await p.evaluate(()=>{const r=__gs.doc.active.mask.stack.at(-1);return !!r.t&&!!r.p.name;}),'a tile dropped on a Picture row becomes its picture');
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
