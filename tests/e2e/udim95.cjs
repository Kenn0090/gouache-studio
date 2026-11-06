/* 0.95 (Kenn): UDIMs = one texture set per material with its tiles inside one canvas; painting carries across tile borders */
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
 ok(r.sets.length===2&&r.sets[0].tiles.join()==='1001,1002,1011'&&r.sets[1].tiles.join()==='1011','one texture set per material, with its tiles inside '+JSON.stringify(r.sets));
 ok(r.w===256&&r.h===256,'the Body set is one canvas holding its tiles in their grid places ('+r.w+'×'+r.h+')');
 ok(r.lo>=-1e-6&&r.hi<=1+1e-6&&r.impUV>1.5,'the drawn model uses canvas UVs; the model file keeps its own ('+r.lo.toFixed(2)+'..'+r.hi.toFixed(2)+', file up to '+r.impUV+')');
 const chips=await p.evaluate(()=>{__gs.buildP3Panel&&__gs.buildP3Panel();const b=[...document.querySelectorAll('.p3tile')].map(x=>x.textContent);const c=document.querySelector('.p3tile[data-tile="1002"]');if(c)c.click();return b;});
 ok(chips.includes('1001')&&chips.includes('1002')&&chips.includes('1011'),'the set list shows each set\'s tiles '+JSON.stringify(chips));
 /* paint a stroke across the tile border on the model */
 await p.evaluate(()=>{const g=__gs;g.v3s().model='imported';g.setP3Layout&&0;g.v3.paintOn=true;Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:4,tx:0,ty:0,tz:0});Object.assign(g.v3s(),{disp:0,showUV:false,paintAlign:'camera'});g.v3.dirty=true;g.requestRender(true);g.setTool('brush');g.brush.size=30;g.brush.opacity=1;g.brush.flow=1;g.ui.fg=[1,0,0];});
 await W(1500);
 const box=await p.evaluate(()=>{const r=document.getElementById('v3Hit').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
 const sx=await p.evaluate(()=>{const g=__gs,{VP}=g.v3ViewProj(1,1);const pr=q=>{const x=VP[0]*q[0]+VP[4]*q[1]+VP[8]*q[2]+VP[12],y=VP[1]*q[0]+VP[5]*q[1]+VP[9]*q[2]+VP[13],w=VP[3]*q[0]+VP[7]*q[1]+VP[11]*q[2]+VP[15];return [x/w,y/w];};return [pr([-0.5,0,0]),pr([0.5,0,0])];});
 const scr=q=>[box[0]+(q[0]*.5+.5)*box[2],box[1]+(1-(q[1]*.5+.5))*box[3]];
 const a=scr(sx[0]),c=scr(sx[1]);await p.mouse.move(a[0],a[1]);await p.mouse.down();for(let i=1;i<=16;i++){await p.mouse.move(a[0]+(c[0]-a[0])*i/16,a[1]+(c[1]-a[1])*i/16);await W(40);}await p.mouse.up();await W(1200);
 const red=await p.evaluate(()=>{const g=__gs,t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data;g.release(t);let L=0,R=0;for(let y=0;y<t.h;y++)for(let x=0;x<t.w;x++){const i=(y*t.w+x)*4;if(d[i]>200&&d[i+1]<80){if(x<t.w/2)L++;else R++;}}return {L,R};});
 /* export: one picture per tile, the paint in 1001 and 1002, none in 1011 */
 const ex=await p.evaluate(async()=>{const g=__gs;g.texCfg.fmt='png';g.texCfg.size=0;g.texCfg.allSets=false;g.texCfg.model='none';const fs=await g.exportTextures();const out={};for(const f of fs||[]){if(!/_BC\.|BaseColor|Albedo|Diffuse/i.test(f.name))continue;const bm=await createImageBitmap(new Blob([f.data],{type:'image/png'}));const c=new OffscreenCanvas(bm.width,bm.height),x=c.getContext('2d');x.drawImage(bm,0,0);const d=x.getImageData(0,0,bm.width,bm.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<80)n++;out[f.name]={n,w:bm.width};}return out;});
 console.log(JSON.stringify(ex));const ek=Object.keys(ex),tn=id=>{const k=ek.find(k=>k.includes('.'+id+'.'));return k?ex[k]:null;};
 ok(ek.length===3&&tn(1001)&&tn(1002)&&tn(1011)&&tn(1001).w===128,'export writes one base colour picture per tile, 128 px each');
 ok(tn(1001).n>200&&tn(1002).n>200&&tn(1011).n===0,'the paint lands in the right tile files (1001 '+tn(1001).n+', 1002 '+tn(1002).n+', 1011 '+tn(1011).n+')');
 ok(red.L>200&&red.R>200,'one stroke across the tile border paints both tiles '+JSON.stringify(red));
 /* baking inside 3D Paint bakes into the tiles' canvas */
 const bk=await p.evaluate(async()=>{const g=__gs;await g.p3Bake(['position'],64,['Body']);await new Promise(r=>setTimeout(r,500));const S=g.p3.sets[g.p3.cur],t=g.doc.meshMaps&&g.doc.meshMaps.position;if(!t)return {none:true,set:S.name};
  const d=g.captureRegionNow(t,0,0,t.w,t.h).data,R=(x,y)=>{const i=(Math.round(y)*t.w+Math.round(x))*4;return [d[i],d[i+1],d[i+2],d[i+3]];};
  const r1=g.udimTileRect('Body',{u:0,v:0},t.w,t.h),r2=g.udimTileRect('Body',{u:1,v:0},t.w,t.h);return {set:S.name,w:t.w,h:t.h,a:R(r1[0]+r1[2]/2,r1[1]+r1[3]/2),b:R(r2[0]+r2[2]/2,r2[1]+r2[3]/2)};});
 console.log(JSON.stringify(bk));
 ok(bk.set==='Body'&&bk.w===256&&bk.h===256&&bk.a&&bk.b&&Math.abs(bk.a[0]-bk.b[0])>30,'a bake lands on the tiles\' canvas: the left and right tiles get their own positions');
 /* save and reopen keeps the layout */
 const rt=await p.evaluate(async()=>{const g=__gs,blob=await g.encodeP3Project(),buf=await blob.arrayBuffer();g.p3.savedAt=g.p3Sig();await g.openP3Project(buf,'udim.gouache3d');return {ua:!!g.p3.ua,w:g.doc.w,h:g.doc.h,sets:g.p3.sets.length};});
 ok(rt.ua&&rt.w===256&&rt.h===256&&rt.sets===2,'saving and opening keeps the tiles '+JSON.stringify(rt));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
