/* 0.97.32 (Kenn: "we don't support UDIM baking"): the Bake tab bakes a low-poly with UV tiles tile by tile, shows every tile on the
   model, re-bakes one tile, exports one picture per tile and sends each tile into its place in 3D Paint */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* three quads side by side in 3D: tile 1001 (x -3..-1), 1002 (x -1..1), 1011 (x 1..3, the row above) */
const quad=(x0,x1,u0,v0,n)=>({v:[`v ${x0} -1 0`,`v ${x1} -1 0`,`v ${x1} 1 0`,`v ${x0} 1 0`],t:[`vt ${u0} ${v0}`,`vt ${u0+1} ${v0}`,`vt ${u0+1} ${v0+1}`,`vt ${u0} ${v0+1}`],n});
const Q=[quad(-3,-1,0,0),quad(-1,1,1,0),quad(1,3,0,1)];let L=[],T=[],F=[];Q.forEach((q,i)=>{L.push(...q.v);T.push(...q.t);const b=i*4;F.push(`f ${b+1}/${b+1} ${b+2}/${b+2} ${b+3}/${b+3} ${b+4}/${b+4}`);});
const OBJ=[...L,...T,...F].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1500,height:950},acceptDownloads:true})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);const waitIdle=async()=>{for(let i=0;i<900;i++){if(await p.evaluate(()=>!__gs.bk.busy&&!(__gs.bk.ud&&__gs.bk.ud.busy)))return;await W(150);}};
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'painting',false));await p.click('#modeTabs [data-mode=bake]');await W(600);
 await p.evaluate(obj=>{const G=__gs,C=G.bakeCfg;C.low=G.parseOBJ(obj,'tiles_low.obj');C.high=null;C.cage=null;C.size=64;C.ss=1;C.pad=2;C.match=false;C.perMat=false;for(const k in C.kinds)C.kinds[k]=k==='position';G.bakeSetModel('low',C.low);},OBJ);
 await W(800);await p.evaluate(()=>__gs.act('bake'));await W(400);
 const s0=await p.evaluate(()=>{const G=__gs,M=G.v3.mesh;let lo=9,hi=-9;for(const v of M.uv){lo=Math.min(lo,v);hi=Math.max(hi,v);}return {card:!!document.getElementById('bkUdim'),tiles:[...document.querySelectorAll('#bkUdim .bkudt')].map(e=>e.dataset.tile),lo,hi,atlas:!!M.bkUdAtlas};});
 ok(s0.card&&s0.tiles.join()==='1001,1002,1011','the Bake tab lists the UV tiles '+JSON.stringify(s0.tiles));
 ok(s0.atlas&&s0.lo>=-1e-6&&s0.hi<=1+1e-6,'the model is shown with its tiles side by side on one canvas');
 await p.click('#bkGo');await W(500);await waitIdle();await W(400);
 const r=await p.evaluate(()=>{const G=__gs,U=G.bk.ud;if(!U)return null;const px=(t,x,y)=>{const d=G.captureRegionNow(t,0,0,t.w,t.h).data,i=(Math.round(y*(t.h-1))*t.w+Math.round(x*(t.w-1)))*4;return [d[i],d[i+1],d[i+2],d[i+3]];};
  const out={ids:Object.keys(U.by),w:{}};for(const id in U.by){const t=U.by[id].res.position;out.w[id]=t&&t.w;out[id]=t&&px(t,.5,.5);}
  const D=G.bk.res.position;out.disp={};for(const T of U.B.tiles){const R=[(T.u-U.B.x0)/U.B.nx,(U.B.ny-1-(T.v-U.B.y0))/U.B.ny,1/U.B.nx,1/U.B.ny];out.disp[T.id]=px(D,R[0]+R[2]/2,R[1]+R[3]/2);}return out;});
 console.log(JSON.stringify(r));
 ok(r&&r.ids.join()==='1001,1002,1011'&&r.w[1001]===64&&r.w[1011]===64,'each tile is baked on its own at the bake size (64 px each)');
 const dif=(a,c)=>Math.abs(a[0]-c[0])+Math.abs(a[1]-c[1])+Math.abs(a[2]-c[2]);const near=(a,c)=>dif(a,c)<=.015*(a[0]+a[1]+a[2]+1);
 ok(r[1001][3]>0&&r[1002][3]>0&&r[1011][3]>0&&dif(r[1001],r[1002])>40&&dif(r[1002],r[1011])>40,'each tile holds its own part of the model (positions differ)');
 ok(near(r.disp[1001],r[1001])&&near(r.disp[1002],r[1002])&&near(r.disp[1011],r[1011]),'the model shows every tile\'s bake in its place');
 const re=await p.evaluate(async()=>{const G=__gs,U=G.bk.ud,a=U.by[1001].res,b2=U.by[1002].res;document.getElementById('bkUdRe_1002').click();await new Promise(r=>setTimeout(r,300));for(let i=0;i<300&&(G.bk.busy||G.bk.ud.busy);i++)await new Promise(r=>setTimeout(r,150));return {same1001:G.bk.ud.by[1001].res===a,new1002:G.bk.ud.by[1002].res!==b2};});
 ok(re.same1001&&re.new1002,'↻ re-bakes just that tile '+JSON.stringify(re));
 const fl=await p.evaluate(()=>{document.querySelector('#bkUdim .bkudt[data-tile="1011"] .bkudid').click();return __gs.udimFlashS.on&&__gs.udimFlashS.id===1011;});
 ok(fl,'clicking a tile flashes it on the model');
 const ex=await p.evaluate(async()=>{const fs=await __gs.bakeExport();return (fs||[]).map(f=>f.name);});
 ok(ex.length===3&&ex.every(n=>/_Position\.(1001|1002|1011)\.png$/.test(n)),'export writes one picture per tile '+JSON.stringify(ex));
 /* send to 3D Paint: the set gets UV tiles and each tile's bake in its place */
 await p.evaluate(()=>{__gs.bakeCfg.send=Object.assign({},__gs.bakeCfg.send||{},{position:true});window.__toasts=[];const t=document.getElementById('toast');new MutationObserver(()=>window.__toasts.push(t.textContent)).observe(t,{childList:true,characterData:true,subtree:true});__gs.bakeSendP3();});await W(2500);console.log('TOASTS',JSON.stringify(await p.evaluate(()=>window.__toasts)));
 const sp=await p.evaluate(()=>{const G=__gs;if(G.ui.mode!=='p3d')return {mode:G.ui.mode};const S=G.p3.sets[G.p3.cur],n=G.p3Binding(S),B=G.udimBox(n),t=G.doc.meshMaps&&G.doc.meshMaps.position;if(!t||!B)return {ua:!!G.p3.ua,t:!!t,mode:G.ui.mode,sets:G.p3.sets.map(S=>[S.name,G.p3Binding(S),!!S.missing]),mats:G.v3.imported&&G.v3.imported.matNames,mm:Object.keys(G.doc.meshMaps||{}),B:!!B};
  const d=G.captureRegionNow(t,0,0,t.w,t.h).data,o={};for(const T of B.tiles){const R=G.udimTileRect(n,T,t.w,t.h),x=R[0]+(R[2]>>1),y=R[1]+(R[3]>>1),i=(y*t.w+x)*4;o[T.id]=[d[i],d[i+1],d[i+2],d[i+3]];}return {ua:true,o};});
 console.log(JSON.stringify(sp));
 ok(sp.ua&&sp.o&&sp.o[1001][3]>200&&sp.o[1001][0]+20<sp.o[1002][0]&&sp.o[1002][0]+20<sp.o[1011][0],'Send to 3D Paint puts each tile\'s bake in its place in the texture set');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
