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
 await stroke([1,0,0],-0.5);
 const c0=await count();console.log(JSON.stringify(c0));
 ok(c0.w===256&&c0[1001].red>200&&c0[1002].red>200,'before: equal tiles, one stroke paints both');
 const cent=()=>p.evaluate(()=>{const g=__gs,t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data;g.release(t);const T=g.udimBox('Body').tiles.find(x=>x.id===1001),R=g.udimTileRect('Body',T,t.w,t.h);let n=0,sx=0;
   for(let y=R[1];y<R[1]+R[3];y++)for(let x=R[0];x<R[0]+R[2];x++){const i=(y*t.w+x)*4;if(d[i]>200&&d[i+1]<80){n++;sx+=(y-R[1])/R[3];}}return {n,cx:n?sx/n:0};});
 const k0=await cent();console.log('before',JSON.stringify(k0),JSON.stringify(c0));ok(k0.n>60&&Math.abs(k0.cx-.5)>.15,'before: the stroke is off-centre in tile 1001 '+JSON.stringify(k0));
 const flipped=OBJ.replace('vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nvt 1 0\nvt 2 0\nvt 2 1\nvt 1 1','vt 0 1\nvt 1 1\nvt 1 0\nvt 0 0\nvt 1 1\nvt 2 1\nvt 2 0\nvt 1 0');
 ok(flipped!==OBJ,'the test model has its UVs mirrored inside each tile');
 const rr=await p.evaluate(async q=>{const g=__gs,old=g.p3.imported,m=g.parseOBJ(q,'udim.obj');m.srcPath=old.srcPath;const differ=g.rpUVsDiffer(old,m);g.mwSwap(old,m);return {differ};},flipped);
 await W(6000);
 const k1=await cent();const c1=await count();console.log('after',JSON.stringify(k1),JSON.stringify(c1));
 ok(rr.differ,'the new UVs are seen as different');
 ok(k1.n>k0.n*.7&&k1.n<k0.n*1.4&&Math.abs((k1.cx+k0.cx)-1)<.12,'the paint followed the surface: same amount, mirrored position in the tile '+JSON.stringify(k1));
 ok(c1[1002].red>c0[1002].red*.7,'tile 1002 kept its paint too '+c0[1002].red+' -> '+c1[1002].red);
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);})();
