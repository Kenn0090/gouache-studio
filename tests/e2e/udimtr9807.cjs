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

 const stroke=async(col,yOff)=>{await p.evaluate(c=>{const g=__gs;g.v3s().model='imported';g.v3.paintOn=true;Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:4,tx:0,ty:0,tz:0});Object.assign(g.v3s(),{disp:0,showUV:false,paintAlign:'camera'});g.v3.dirty=true;g.requestRender(true);g.setTool('brush');g.brush.size=30;g.brush.opacity=1;g.brush.flow=1;g.ui.fg=c;},col);
  await W(1500);const box=await p.evaluate(()=>{const r=document.getElementById('v3Hit').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
  const sx=await p.evaluate(y=>{const g=__gs,{VP}=g.v3ViewProj(1,1);const pr=q=>{const x=VP[0]*q[0]+VP[4]*q[1]+VP[8]*q[2]+VP[12],yy=VP[1]*q[0]+VP[5]*q[1]+VP[9]*q[2]+VP[13],w=VP[3]*q[0]+VP[7]*q[1]+VP[11]*q[2]+VP[15];return [x/w,yy/w];};return [pr([-0.5,y,0]),pr([0.5,y,0])];},yOff);
  const scr=q=>[box[0]+(q[0]*.5+.5)*box[2],box[1]+(1-(q[1]*.5+.5))*box[3]];const a=scr(sx[0]),c=scr(sx[1]);
  await p.mouse.move(a[0],a[1]);await p.mouse.down();for(let i=1;i<=16;i++){await p.mouse.move(a[0]+(c[0]-a[0])*i/16,a[1]+(c[1]-a[1])*i/16);await W(40);}await p.mouse.up();await W(1200);};
 const count=()=>p.evaluate(()=>{const g=__gs,t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data;g.release(t);const o={w:t.w,h:t.h};
  for(const id of [1001,1002,1011]){const T=g.udimBox('Body').tiles.find(x=>x.id===id),R=g.udimTileRect('Body',T,t.w,t.h);let red=0,grn=0;
    for(let y=R[1];y<R[1]+R[3];y++)for(let x=R[0];x<R[0]+R[2];x++){const i=(y*t.w+x)*4;if(d[i]>200&&d[i+1]<80)red++;if(d[i+1]>200&&d[i]<80)grn++;}o[id]={R,red,grn};}return o;});
 await stroke([1,0,0],0);
 const c0=await count();console.log(JSON.stringify(c0));
 ok(c0.w===256&&c0[1001].red>200&&c0[1002].red>200,'before: equal tiles, one stroke paints both');
 await p.evaluate(async()=>{const g=__gs,bl=await g.encodeP3Project();window.__A=new File([await bl.arrayBuffer()],'A.gouache3d');});
 const nodeStat=(re)=>p.evaluate(re=>{const g=__gs;const L=[...g.allNodes(g.doc.root)].find(n=>new RegExp(re).test(n.name||''));const T=L&&g.mapT(L,'base');if(!T)return null;const d=g.captureRegionNow(T,0,0,T.w,T.h).data,o={w:T.w,h:T.h};
   for(const id of [1001,1002,1011]){const Tl=g.udimBox('Body').tiles.find(x=>x.id===id),R=g.udimTileRect('Body',Tl,T.w,T.h);let n=0;for(let y=R[1];y<R[1]+R[3];y++)for(let x=R[0];x<R[0]+R[2];x++){const i=(y*T.w+x)*4;if(d[i]>100&&d[i+1]<110&&d[i+3]>100)n++;}o[id]=n;}return o;},re);
 /* wipe the paint, then bring it back from the saved file */
 await p.evaluate(()=>{const g=__gs,L=g.layerByName('Paint')||g.doc.active;for(const k of Object.keys(L.maps||{}))g.clearTarget(L.maps[k],[0,0,0,0]);g.changedAll();});await W(500);
 const cw=await count();ok(cw[1001].red<5&&cw[1002].red<5,'the paint is wiped '+JSON.stringify(cw));
 const rep=await p.evaluate(async()=>{const g=__gs,src=await g.trReadProject(window.__A);const ok=!!src.ua;const T=src.sets[0].maps.base;const dd=g.captureRegionNow(T,0,0,T.w,T.h).data;let srcRed=0;for(let i=0;i<dd.length;i+=4)if(dd[i]>180&&dd[i+1]<80)srcRed++;window.__srcRed=srcRed;const r=await g.trRun(src,[{si:0,ti:0}],['base'],.03,g.p3.imported);return {ok,r,sets:src.sets.length,srcRed};});console.log(JSON.stringify(rep));
 ok(rep.ok&&rep.r.done>=1,'a UDIM project is read and transferred ('+JSON.stringify(rep.r)+')');
 await W(800);console.log('whole',JSON.stringify(await p.evaluate(()=>{const g=__gs;const L=[...g.allNodes(g.doc.root)].find(n=>/^Transfer/.test(n.name||''));const T=g.mapT(L,'base');const d=g.captureRegionNow(T,0,0,T.w,T.h).data;let n=0,a=0,mx=0;for(let i=0;i<d.length;i+=4){if(d[i]>180&&d[i+1]<80)n++;if(d[i+3]>10)a++;mx=Math.max(mx,d[i]);}return {n,a,mx,w:T.w,h:T.h,depth:T.depth,fmt:[T.mono,T.packed]};})));console.log('hist',JSON.stringify(await p.evaluate(()=>{const g=__gs;const L=[...g.allNodes(g.doc.root)].find(n=>/^Transfer/.test(n.name||''));const T=g.mapT(L,'base');const d=g.captureRegionNow(T,0,0,T.w,T.h).data;const h={};for(let i=0;i<d.length;i+=4){if(d[i+3]<10)continue;const k=[d[i]>>5,d[i+1]>>5,d[i+2]>>5,d[i+3]>>6].join('');h[k]=(h[k]||0)+1;}return Object.entries(h).sort((a,b)=>b[1]-a[1]).slice(0,6);})));const t=await nodeStat('^Transfer');console.log(JSON.stringify(t));
 ok(t&&t[1001]>200&&t[1002]>200,'the red from both tiles of project A is in the transfer layer '+JSON.stringify(t));
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);})();
