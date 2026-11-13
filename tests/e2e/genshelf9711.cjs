/* 0.97.11 (Kenn): a Generators category in the 3D Paint shelf; click adds to the selected layer's mask, drag onto a layer adds it there */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1600,height:950}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(3500);
const tabs=await p.evaluate(()=>[...document.querySelectorAll('#dkShelf .dktab')].map(b=>b.textContent.trim()));
ok(tabs.includes('Generators'),'the shelf has a Generators category: '+tabs.join(', '));
await p.evaluate(()=>__gs.showPanel('shgen'));await p.waitForTimeout(1200);
ok(await p.evaluate(()=>document.querySelectorAll('#shGenBody .gentile').length)>=30,'it lists the generators as tiles');
await p.evaluate(()=>{const L=__gs.allLayers().find(l=>!l.fill);__gs.selectOnly(L);__gs.renderLayers()});
await p.locator('#shGenBody .gentile[aria-label="Dirt in cavities"]').click();await p.waitForTimeout(800);
ok(await p.evaluate(()=>{const L=__gs.allLayers().find(l=>!l.fill);return !!L.mask&&(L.mask.stack||[]).some(r=>r.kind==='gen'&&r.p.g==='dirt');}),'clicking a tile adds it to the selected layer\'s mask');
/* drag onto the other layer */
await p.evaluate(()=>{const L=__gs.allLayers().find(l=>!!l.fill);__gs.selectOnly(__gs.allLayers().find(l=>!l.fill));__gs.renderLayers()});await p.waitForTimeout(300);
const tile=await p.locator('#shGenBody .gentile[aria-label="Rust streaks"]').boundingBox();
const row=await p.evaluate(()=>{const r=[...document.querySelectorAll('.lrow')].find(x=>x._node&&x._node.fill);const b=r.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2}});
await p.mouse.move(tile.x+20,tile.y+20);await p.mouse.down();await p.mouse.move(tile.x+60,tile.y-40,{steps:5});await p.mouse.move(row.x,row.y,{steps:10});await p.mouse.up();await p.waitForTimeout(900);
ok(await p.evaluate(()=>{const L=__gs.allLayers().find(l=>!!l.fill);return !!L.mask&&(L.mask.stack||[]).some(r=>r.kind==='gen'&&r.p.g==='rust');}),'dragging a tile onto a layer adds the generator to that layer\'s mask');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
