/* 0.23: Mesh maps from a material (curvature, AO, edges, roughness, metallic from its height) and the Converted source. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const comp=(k,pts)=>p.evaluate(([k,pts])=>{const t=__gs.compositeMap(k),d=__gs.readRGBA8(t),W=__gs.doc.w;__gs.release(t);return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'mstack',false));await W(300);
 await p.evaluate(()=>{__gs.newDoc(128,128,8,[1,1,1],'mc',false);__gs.setDocMaps(['base','rough','metal','height','normal'],'maps');});await W(300);
 await p.evaluate(()=>{const L=__gs.cmdNewFillLayer({name:'Bumps',maps:{base:{c:[.6,.6,.6]},rough:{v:.5},metal:{v:0}}});
   const n=128,t=__gs.makeTarget(n,n,8,true),g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const cx=(x%32)-16,cy=(y%32)-16,h=Math.max(0,1-Math.hypot(cx,cy)/10);const v=Math.round(40+h*200);px.set([v,v,v,255],(y*n+x)*4);}
   g.bindTexture(g.TEXTURE_2D,t.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);
   L._fillImg={height:t};Object.assign(L.fill.maps.height,{on:true,src:'image',tile:1,rot:0,name:'bumps'});__gs.fillRender(L);});await W(300);
 const vary=(t)=>{let lo=255,hi=0;for(let i=0;i<t.length;i+=4){lo=Math.min(lo,t[i]);hi=Math.max(hi,t[i]);}return hi-lo;};
 await p.evaluate(()=>__gs.act('matConvert'));await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#mc_curv')&&!!document.querySelector('#mc_toMat')&&/Mesh maps from a material/.test(document.querySelector('#dlgTitle').textContent)),'Filter › Mesh maps from material… opens its dialog');
 await p.evaluate(()=>{for(const [k,v] of [['mc_rough',1],['mc_metal',1],['mc_toMat',1]]){const c=document.querySelector('#'+k+' input')||document.querySelector('#'+k);if(c&&!c.checked)c.click();}});
 await p.click('#dlgOk');await W(600);
 const r=await p.evaluate(()=>{const M=__gs.doc.meshMaps||{},L=__gs.doc.active;return {keys:Object.keys(M).sort().join(),rough:L.fill.maps.rough.src+':'+L.fill.maps.rough.mm,metal:L.fill.maps.metal.src+':'+L.fill.maps.metal.mm};});
 ok(/cv:ao/.test(r.keys)&&/cv:curv/.test(r.keys)&&/cv:rough/.test(r.keys)&&/cv:metal/.test(r.keys),'converted maps land in the mesh maps '+r.keys);
 ok(r.rough==='conv:cv:rough'&&r.metal==='conv:cv:metal','the material’s roughness and metallic now use them '+JSON.stringify(r));
 const rv=await p.evaluate(()=>{const L=__gs.doc.active;return Array.from(__gs.readRGBA8(__gs.mapT(L,'rough')));});ok(vary(rv)>40,'roughness follows the bumps (range '+vary(rv)+')');
 const cv=await p.evaluate(()=>Array.from(__gs.readRGBA8(__gs.doc.meshMaps['cv:curv'])));ok(vary(cv)>40,'curvature shows the bumps (range '+vary(cv)+')');
 await p.evaluate(()=>{__gs.showPanel('matEd');});await W(200);
 ok(await p.evaluate(()=>document.querySelectorAll('#matEdBody .cvtile').length>=4&&[...document.querySelectorAll('#matEdBody .segb')].some(b=>b.textContent==='Converted')),'the Material panel has a Converted tab with the maps as tiles');
 await p.keyboard.press('Control+z');await W(400);
 ok(await p.evaluate(()=>!Object.keys(__gs.doc.meshMaps||{}).some(k=>k.startsWith('cv:'))&&__gs.doc.active.fill.maps.rough.src==='value'),'undo takes them away and puts the roughness back');
 await p.keyboard.press('Control+y');await W(400);ok(await p.evaluate(()=>!!__gs.doc.meshMaps['cv:curv']),'redo brings them back');
 /* a mask row can use a converted map */
 await p.evaluate(()=>__gs.msAdd(__gs.doc.active,'mesh',{p:{k:'cv:curvEdge',inv:false}}));await W(400);
 const mv=await p.evaluate(()=>Array.from(__gs.readRGBA8(__gs.doc.active.mask.target)));ok(vary(mv)>40,'a mask row reads the converted edges (range '+vary(mv)+')');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
