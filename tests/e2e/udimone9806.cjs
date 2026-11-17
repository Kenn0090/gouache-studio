/* 0.97.30 (Kenn: per-tile UDIM sizes, "B: real sizes"): a tile gets its own texture size; the tiles are packed on the canvas,
   the set is rebuilt from the strokes, painting and export follow */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* material A: two quads side by side in 3D (x -1..0 on tile 1001, x 0..1 on tile 1002, sharing the edge at x=0), material B: a quad on tile 1011 below */
const OBJ=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0','v -1 -2.2 0','v 1 -2.2 0','v 1 -1.2 0','v -1 -1.2 0','v -1 1.2 0','v 1 1.2 0','v 1 2.2 0','v -1 2.2 0',
 'vt 0 0','vt 1 0','vt 1 1','vt 0 1','vt 1 0','vt 2 0','vt 2 1','vt 1 1','vt 0.05 1.05','vt 0.95 1.05','vt 0.95 1.95','vt 0.05 1.95','vt 0.1 1.1','vt 0.9 1.1','vt 0.9 1.9','vt 0.1 1.9',
 'usemtl Body','f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 2/5 5/6 6/7','f 2/5 6/7 3/8','f 11/13 12/14 13/15','f 11/13 13/15 14/16','usemtl Head','f 7/9 8/10 9/11','f 7/9 9/11 10/12'].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const r=await p.evaluate(async obj=>{const g=__gs;g.setMode('paint');g.p3.started=false;g.p3.imported=null;g.v3.imported=null;g.v3.mesh=null;
  const mesh=g.parseOBJ(obj,'udim.obj');await g.p3NewProject(128,{modelKey:'imported',imported:mesh,udim:true});
  const M=g.v3.mesh;let lo=9,hi=-9;for(let i=0;i<M.uv.length;i++){lo=Math.min(lo,M.uv[i]);hi=Math.max(hi,M.uv[i]);}
  return {ua:g.p3.ua,sets:g.p3.sets.map(S=>({n:S.name,tiles:(S.udimTiles||[]).map(t=>t.id)})),cur:g.p3.sets[g.p3.cur].name,w:g.doc.w,h:g.doc.h,lo,hi,impUV:Math.max(...g.v3.imported.uv)};},OBJ);

 const make=await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;const n=64,t=g.makeTarget(n,n,8,true),px=new Uint8Array(n*n*4);for(let i=0;i<n*n;i++)px.set([220,30,30,255],i*4);
  g.writeRegion(t,0,0,n,n,px);L._fillImg={base:t};Object.assign(L.fill.maps.base,{on:true,src:'image',tile:1,rot:0,name:'red'});g.fillRender(L);return {w:g.doc.w,h:g.doc.h};});await W(500);
 const red=async()=>p.evaluate(()=>{const g=__gs,t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data;g.release(t);const o={};
   for(const id of [1001,1002,1011]){const T=g.udimBox('Body').tiles.find(x=>x.id===id),R=g.udimTileRect('Body',T,t.w,t.h);let n=0,tot=0;for(let y=R[1];y<R[1]+R[3];y++)for(let x=R[0];x<R[0]+R[2];x++){const i=(y*t.w+x)*4;tot++;if(d[i]>180&&d[i+1]<80)n++;}o[id]=Math.round(n/tot*100);}return o;});
 let r0=await red();console.log(JSON.stringify(r0));ok(r0[1001]>80&&r0[1002]>80,'a picture covers every tile by default '+JSON.stringify(r0));
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;g.matEdBegin&&g.matEdBegin(L);L.fill.maps.base.tiles=[1001];g.fillRender(L);g.changedAll&&g.changedAll();});await W(600);
 const r1=await red();console.log(JSON.stringify(r1));ok(r1[1001]>80&&r1[1002]<5&&r1[1011]<5,'with Tiles = 1001 only that tile has it '+JSON.stringify(r1));
 const chips=await p.evaluate(()=>{const g=__gs;g.showPanel('matEd');g.renderMatEd&&g.renderMatEd(true);return [...document.querySelectorAll('[id^=fl_tile_base_]')].map(b=>b.id+':'+b.getAttribute('aria-pressed'));});console.log(chips.join());
 ok(chips.length===4,'the card shows All and each tile');
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;delete L.fill.maps.base.tiles;g.fillRender(L);g.changedAll&&g.changedAll();});await W(600);
 const r2=await red();ok(r2[1002]>80,'All brings the other tiles back '+JSON.stringify(r2));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);})();
