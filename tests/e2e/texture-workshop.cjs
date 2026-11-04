const {chromium}=require('playwright'),path=require('path');
let failures=0;const ok=(v,s)=>{console.log((v?'PASS ':'FAIL ')+s);if(!v)failures++;};
(async()=>{
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];
 await p.addInitScript(()=>localStorage.setItem('gs.p3d',JSON.stringify({size:64,layout:'3d'})));
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|compile|link/i.test(m.text()))errors.push(m.text());});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({body:''}));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.newDoc(64,64,8,[1,1,1],'Workshop',false);__gs.showPanel('brushes');});
 async function number(id,v){await p.locator('#'+id).locator('..').locator('output').click();await p.locator('#'+id+'_value').fill(String(v));await p.locator('#'+id+'_value').press('Enter');}
 await number('bFlow',37.5);ok(await p.evaluate(()=>Math.abs(__gs.brush.flow-.375)<1e-8),'precise percentage entry preserves decimals');
 await number('bSize',1234);ok(await p.evaluate(()=>__gs.brush.size===1234),'mapped brush-size slider accepts exact pixels');
 await p.locator('#bFlow').locator('..').locator('output').click();await p.locator('#bFlow_value').fill('88');await p.locator('#bFlow_value').press('Escape');ok(await p.evaluate(()=>__gs.brush.flow===.375),'Escape cancels numerical editing');
 await number('bFlow',999);ok(await p.evaluate(()=>__gs.brush.flow===1),'numerical editing respects bounds');
 await p.evaluate(()=>{__gs.setMode('p3d');window.L=__gs.cmdNewFillLayer();__gs.matEd.openAll=true;__gs.renderMatEd(true);});
 async function field(id,v){await p.locator('#'+id).fill(String(v));await p.locator('#'+id).press('Tab');}
 await field('pxf_s0',12.345);ok(await p.evaluate(()=>Math.abs(L.fill.xf.s[1]-1/12.345)<1e-8)&&await p.locator('#pxf_s1').inputValue()==='12.345','locked U input updates V and its display');
 await field('pxf_s1',7);ok(await p.locator('#pxf_s0').inputValue()==='7'&&await p.evaluate(()=>L.fill.xf.s[0]===L.fill.xf.s[1]),'locked V input updates U');
 await p.locator('#pxfLock').click();await field('pxf_s0',3);ok(await p.locator('#pxf_s1').inputValue()==='7','unlocked tiling keeps the other axis independent');
 await p.evaluate(()=>{__gs.matEdCommit();__gs.msAdd(L,'fill',{p:{v:.25}});window.level=__gs.msAdd(L,'filter',{fx:'levels'});});
 await p.getByRole('button',{name:'Auto',exact:true}).click();ok(await p.evaluate(()=>Math.abs(level.v.lv.m[0]-.25)<.01),'mask Levels Auto reads the mask histogram');
 await p.getByRole('button',{name:'Reset',exact:true}).click();await p.waitForTimeout(800);
 const cv=p.locator('.lvsimple'),r=await cv.boundingBox();await p.mouse.move(r.x+r.width*8/256,r.y+r.height*95/132);await p.mouse.down();await p.mouse.move(r.x+r.width*.2,r.y+r.height*95/132,{steps:8});await p.mouse.up();await p.waitForTimeout(800);
 ok(await p.evaluate(()=>{__gs.msUpdate(L);return level.v.lv.m[0]>.15&&__gs.readRGBA8(L.mask.target)[0]<35;}),'simple Levels handle changes actual mask pixels');
 await p.evaluate(()=>__gs.undo());ok(await p.evaluate(()=>L.mask.stack.at(-1).v.lv.m[0]===0),'Levels undo restores the state before a later edit');
 await p.getByRole('button',{name:'Sliders',exact:true}).click();await number('lvIb',32);ok(await p.evaluate(()=>Math.abs(L.mask.stack.at(-1).v.lv.m[0]-32/255)<1e-8),'Levels precise input uses 0–255 values');
 const builder=await p.evaluate(()=>{
  const G=__gs;G.msCommit();window.builder=G.msAdd(L,'gen',{p:G.msGenDefaults('builder')});
  const map=v=>{const t=G.makeTarget(64,64,8,false);G.clearTarget(t,v);return t;};
  G.doc.meshMaps={curv:map([.9,.9,.9,1]),ao:map([.15,.15,.15,1]),height:map([.8,.8,.8,1]),thick:map([.1,.1,.1,1]),wnormal:map([.5,1,.5,1]),position:map([.3,.8,.5,1])};
  const read=weights=>{Object.assign(builder.p,{edgeWeight:0,cavityWeight:0,aoWeight:0,directionWeight:0,positionWeight:0,heightWeight:0,thicknessWeight:0,breakup:0},weights);L.mask._key=null;G.msUpdate(L);return G.readRGBA8(L.mask.target)[0];};
  const result={empty:read({})===0};for(const k of ['edgeWeight','aoWeight','directionWeight','positionWeight','heightWeight','thicknessWeight'])result[k]=read({[k]:1})>170;
  G.clearTarget(G.doc.meshMaps.curv,[.1,.1,.1,1]);result.cavity=read({cavityWeight:1})>170;
  result.invert=read({cavityWeight:1,inv:true})<85;return result;
 });for(const [k,v]of Object.entries(builder))ok(v,'mesh-map builder '+k);
 ok(await p.locator('#ms_edgeWeight').isVisible(),'mask builder has separate editable map strengths');
 const patterns=await p.evaluate(()=>{const G=__gs,result={},hashes=[];window.patternImages=[];
  for(const id of ['twill','herringbone','knit','basket','checker','chevron','hexagons','scales']){
   const t=G.txGenTarget(id,256),d=G.captureRegionNow(t,0,0,256,256).data;let lo=255,hi=0,dx=0,dy=0;for(let i=0;i<d.length;i+=4){lo=Math.min(lo,d[i]);hi=Math.max(hi,d[i]);}for(let i=0;i<256;i++){dx+=Math.abs(d[i*256*4]-d[(i*256+255)*4]);dy+=Math.abs(d[i*4]-d[(255*256+i)*4]);}
   let diff=0;for(const phase of [[1,0],[0,1]]){const shifted=G.txGenTarget(id,256,phase),sd=G.captureRegionNow(shifted,0,0,256,256).data;for(let i=0;i<d.length;i+=4)diff=Math.max(diff,Math.abs(d[i]-sd[i]));}result[id]=hi-lo>100&&diff<=2;
   const c=document.createElement('canvas');c.width=c.height=256;const im=c.getContext('2d').createImageData(256,256);im.data.set(d);c.getContext('2d').putImageData(im,0,0);patternImages.push({id,url:c.toDataURL()});
  }return result;});for(const [k,v]of Object.entries(patterns))ok(v,'pattern has detail and repeats '+k);
 await p.evaluate(()=>{__gs.tx.show='gen';__gs.showPanel('textures');document.querySelector('#txSize_m').click();});
 await p.locator('#txSize_l').click();ok(await p.locator('.txtile img').first().evaluate(e=>Math.round(e.getBoundingClientRect().width)===104),'large texture thumbnail size applies');
 await p.locator('#txSize_s').click();ok(await p.locator('.txtile img').first().evaluate(e=>Math.round(e.getBoundingClientRect().width)===44)&&await p.evaluate(()=>localStorage.getItem('gs.txSize')==='s'),'small texture thumbnail size persists');
 await p.locator('#txCategory').selectOption('Fabric');ok(await p.locator('.txtile').count()===5,'Fabric category separates fabric patterns');
 await p.locator('#txCategory').selectOption('Patterns');ok(await p.locator('.txtile').count()===6,'Patterns category separates geometric patterns');
 await p.getByRole('button',{name:'Photo grunge',exact:true}).click();await p.locator('#txCategory').selectOption('Scratches');await p.locator('#txSearch').fill('Jagged');
 ok(await p.locator('.txtile').count()===1&&await p.locator('#tx_photo_jagged-long-gashes').isVisible(),'category and search find jagged gashes');
 ok(await p.evaluate(()=>localStorage.getItem('gs.txCategory')==='Scratches'),'texture category persists');
 const sources=require('../../assets/grunge/workshop-sources.json');
 const assets=await p.evaluate(async sources=>{const G=__gs;for(const s of sources){const t=await G.txTarget({kind:'photo',id:s.slug});if(t.w!==1024||t.h!==1024)return false;}return true;},sources);
 ok(sources.length===24&&assets,'all twenty-four sourced grunge textures decode and load into the GPU');
 const imgs=await p.evaluate(()=>patternImages);const fs=require('fs');for(const x of imgs)fs.writeFileSync(path.resolve(__dirname,'../../../pattern-'+x.id+'.png'),Buffer.from(x.url.split(',')[1],'base64'));
 ok(errors.length===0,'no application or shader errors '+errors.join(' | '));await b.close();process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
