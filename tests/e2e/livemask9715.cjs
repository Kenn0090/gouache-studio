/* 0.97.15 (Kenn): painting a mask that has filter rows shows on the model while you paint, not only when you let go; High pass has an Invert tick */
const {chromium}=require('playwright'),path=require('path'),fs=require('fs'),{execSync}=require('child_process');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:950}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(3500);
await p.evaluate(()=>{const G=__gs;G.cmdNewFillLayer({name:'Red',maps:{base:{on:true,src:'value',c:[.95,.05,.05]}}});const L=G.doc.active;G.cmdAddMask(0);G.msAdd(L,'filter',{fx:'invert'});G.msAdd(L,'filter',{fx:'invert'});/* two inversions: no change to the look, but a stack with rows */
  const row=L.mask.stack.find(r=>r.kind==='paint');G.ui.fg=[1,1,1];L.editMask=true;G.renderLayers();G.setTool('brush');Object.assign(G.brush,{size:90,hardness:1,opacity:1,flow:1,pSize:false,smoothing:0,spacing:.1});G.v3.paintOn=true;});await p.waitForTimeout(1500);
/* count the red the model's base-colour picture would show right now (the same picture the 3D view is drawn from) */
const red=()=>p.evaluate(()=>{const G=__gs;return G.withWeldMask(null,()=>{const t=G.compositeMap('base'),d=G.readRGBA8(t);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<90&&d[i+2]<90&&d[i+3]>200)n++;return n;});});
const r0=await red();
const hit=await p.locator('#v3Hit').boundingBox();
await p.mouse.move(hit.x+hit.width*.35,hit.y+hit.height*.5);await p.mouse.down();for(let i=1;i<=12;i++)await p.mouse.move(hit.x+hit.width*(.35+.03*i),hit.y+hit.height*.5,{steps:2});
await p.waitForTimeout(800);/* the button is still held */
const rMid=await red();
await p.mouse.up();await p.waitForTimeout(1500);const rEnd=await red();
console.log('red pixels: before',r0,'mid-stroke',rMid,'after',rEnd);
ok(r0<50,'before painting nothing is red');
ok(rMid>500,'the red is in the picture the model uses while the button is still down ('+rMid+')');
ok(rEnd>500,'and stays after you let go ('+rEnd+')');
/* High pass: Invert */
await p.evaluate(()=>__gs.setMode('paint'));await p.waitForTimeout(800);
const hp=await p.evaluate(()=>{const d=__gs.FX.highPass;return {has:!!d,checks:(d.checks||[]).map(c=>c[0])};});
ok(hp.has&&hp.checks.includes('inv'),'High pass has an Invert tick');
const px=await p.evaluate(()=>{const G=__gs;G.newDoc(32,32,8,[1,1,1],'hp',false);const t=G.doc.active.target;G.clearTarget(t,[.4,.4,.4,1]);G.scissorDo([8,8,8,8],()=>G.clearTarget(t,[.8,.8,.8,1]));
  const src=G.captureRegionNow(t,0,0,32,32);const run=(inv)=>{const a=G.acquire(),d=G.acquire();G.copy&&0;G.blit(t,a,0,0,32,32,0,0);G.FX.highPass.render(a,d,{r:3,inv});const o=G.captureRegionNow(d,0,0,32,32).data;G.release(a);G.release(d);return o[(12*32+9)*4];};
  return {normal:run(false),inverted:run(true)};});
console.log('edge of a bright square: normal',px.normal,'inverted',px.inverted);
ok(px.normal>128&&px.inverted<128,'Invert swaps light and dark detail');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
