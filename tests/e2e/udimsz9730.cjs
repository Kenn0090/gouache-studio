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
 const sel=await p.evaluate(()=>{__gs.buildP3Panel();return !!document.getElementById('p3TileSz_1001');});
 ok(sel,'each tile in the set list has a size picker');
 const ch=await p.evaluate(async()=>{const g=__gs,ok=await g.udimSetTileSize('Body',1001,256),B=g.udimBox('Body'),M=g.v3.mesh;let lo=9,hi=-9;for(let i=0;i<M.uv.length;i++){lo=Math.min(lo,M.uv[i]);hi=Math.max(hi,M.uv[i]);}
  const u=g.udimGU('Body');return {ok,lay:B.lay,size:B.size,w:g.doc.w,h:g.doc.h,lo,hi,n:u.uUdN.int};});
 console.log(JSON.stringify(ch));
 ok(ch.ok&&ch.lay&&ch.size&&ch.size[1001]===256,'tile 1001 is set to 256 px, the others follow the set');
 ok(Math.max(ch.w,ch.h)===384&&Math.min(ch.w,ch.h)===256,'the tiles are packed on one canvas: 256 + two 128 tiles = 384 × 256 ('+ch.w+'×'+ch.h+')');
 ok(ch.lo>=-1e-6&&ch.hi<=1+1e-6&&ch.n===3,'the drawn model and the patterns follow the packing');
 const c1=await count();console.log(JSON.stringify(c1));
 ok(c1[1001].R[2]===256&&c1[1002].R[2]===128,'tile 1001 is 256 px on the canvas, 1002 stays 128');
 const ratio=c1[1001].red/Math.max(1,c0[1001].red);
 ok(ratio>2.8&&ratio<5.2&&c1[1002].red>c0[1002].red*.7&&c1[1002].red<c0[1002].red*1.4,'the stroke is rebuilt into the new places, same size on the model (1001 ×'+ratio.toFixed(2)+', 1002 '+c0[1002].red+' → '+c1[1002].red+')');
 ok(c1[1011].red===0,'nothing lands in tile 1011');
 await stroke([0,1,0],0.4);
 const c2=await count();console.log(JSON.stringify(c2));
 const gr=c2[1001].grn/Math.max(1,c2[1002].grn);
 ok(c2[1001].grn>200&&c2[1002].grn>100&&gr>2.5&&gr<5.5,'a new stroke across the border keeps the same size on the model: 4× the pixels in the bigger tile (×'+gr.toFixed(2)+')');
 const ex=await p.evaluate(async()=>{const g=__gs;g.texCfg.fmt='png';g.texCfg.size=0;g.texCfg.allSets=false;g.texCfg.model='none';const fs=await g.exportTextures();const out={};for(const f of fs||[]){if(!/_BC\.|BaseColor|Albedo|Diffuse/i.test(f.name))continue;const bm=await createImageBitmap(new Blob([f.data],{type:'image/png'}));out[f.name]=bm.width+'x'+bm.height;}return out;});
 console.log(JSON.stringify(ex));const ek=Object.keys(ex),tn=id=>{const k=ek.find(k=>k.includes('.'+id+'.'));return k?ex[k]:null;};
 ok(tn(1001)==='256x256'&&tn(1002)==='128x128'&&tn(1011)==='128x128','export writes each tile at its own size');
 const rt=await p.evaluate(async()=>{const g=__gs,blob=await g.encodeP3Project(),buf=await blob.arrayBuffer();g.p3.savedAt=g.p3Sig();await g.openP3Project(buf,'udim.gouache3d');const B=g.udimBox('Body');return {w:g.doc.w,h:g.doc.h,lay:!!B.lay,size:B.size};});
 ok(rt.w===ch.w&&rt.h===ch.h&&rt.lay&&rt.size[1001]===256,'saving and opening keeps the tile sizes '+JSON.stringify(rt));
 const cR=await count();console.log('after reopen',JSON.stringify(cR));
 const back=await p.evaluate(async()=>{const g=__gs;await g.udimSetTileSize('Body',1001,0);const B=g.udimBox('Body');return {w:g.doc.w,h:g.doc.h,lay:!!B.lay,size:B.size||null};});
 const c3=await count();console.log(JSON.stringify(back),JSON.stringify(c3));
 ok(back.w===256&&back.h===256&&!back.lay&&!back.size,'back to the set size: the plain grid again');
 ok(c3[1001].red>c0[1001].red*.7&&c3[1001].grn>100&&c3[1002].grn>100,'the paint survives the round trip');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
