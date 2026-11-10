/* 0.96.6 (Kenn) part 1: high-poly Match size, bake groups (name / material / hand), explode, move gizmo; smart materials on double-click;
   painting defaults; outline tick on Standard/Skin; maps that are no baked map still come into the project; Ctrl smooth under UV alignment. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:880}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 ok(await p.evaluate(()=>__gs.PROJ_DEF.paintAlign==='uv'&&__gs.PROJ_DEF.noBack===true&&__gs.PROJ_DEF.cullAngle===90&&__gs.PROJ_DEF.sizeSpace==='object'),'painting defaults: UV alignment, backface culling on at 90°, object size');
 ok(await p.evaluate(()=>{const s=__gs.shOutline({kind:'std',p:{std:{oline:true,outline:3,ocol:[1,0,0]}}}),k=__gs.shOutline({kind:'skin',p:{skin:{oline:true}}}),n=__gs.shOutline({kind:'std',p:{}});return s&&s.w===3&&s.col[0]===1&&k&&k.w===2&&n===null;}),'Standard and Skin have an outline tick (off by default)');
 /* Bake: two cubes per model, the high-poly exported 100× smaller, with part names and materials */
 await p.click('#modeTabs [data-mode=bake]');await W(1200);
 const r=await p.evaluate(async()=>{const G=__gs;const cube=(s,x,name,mat)=>{let t='o '+name+'\nusemtl '+mat+'\n';const v=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];return {v:v.map(q=>[(q[0]+x)*s,q[1]*s,q[2]*s]),name,mat};};
   const obj=(cs)=>{let t='',base=1;t+='vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\n';for(const c of cs){t+='o '+c.name+'\nusemtl '+c.mat+'\n';for(const q of c.v)t+='v '+q.join(' ')+'\n';for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]])t+='f '+f.map((i,j)=>(i+base)+'/'+(j+1)).join(' ')+'\n';base+=8;}return new TextEncoder().encode(t);};
   const L=await G.parseModelBytes('crate_low.obj',obj([cube(1,-2,'a_low','Metal'),cube(1,2,'b_low','Wood')]));
   const H=await G.parseModelBytes('crate_high.obj',obj([cube(.01,-2,'a_high','Metal'),cube(.01,2,'b_high','Wood')]));
   G.bakeSetModel('low',L);G.bakeSetModel('high',H);const hint=G.bgSizeHint();G.bgMatchSize();const k=G.bakeCfg.hiScale;
   const C=G.bgCfg();C.groupMode='name';let P=G.bakePrep(G.bkLow());const nameLow=[...new Set(P.low.vertPart)].sort().join(),nameHigh=[...new Set(P.high.bakePart)].sort().join();
   /* both cubes of the high-poly sit on the low-poly's cubes after Match size */
   const hx=[Math.min(...P.high.pos.filter((v,i)=>i%3===0)),Math.max(...P.high.pos.filter((v,i)=>i%3===0))],lx=[Math.min(...P.low.pos.filter((v,i)=>i%3===0)),Math.max(...P.low.pos.filter((v,i)=>i%3===0))];
   C.groupMode='material';P=G.bakePrep(G.bkLow());const matHigh=[...new Set(P.high.bakePart)].sort().join(),matLow=[...new Set(P.low.vertPart)].sort().join();
   C.groupMode='hand';C.groupsHand={low:{a_low:1,b_low:1},high:{a_high:1,b_high:2}};P=G.bakePrep(G.bkLow());const handHigh=[...new Set(P.high.bakePart)].sort().join(),handLow=[...new Set(P.low.vertPart)].sort().join();
   C.groupMode='name';C.groupsHand={low:{},high:{}};
   /* explode: the shown low-poly's two cubes move apart, the bake does not */
   C.explode=true;const S=G.bgLowShown(G.bkLow()),dx=S.pos[0]-G.bkLow().pos[0],dx2=S.pos[S.pos.length-3]-G.bkLow().pos[G.bkLow().pos.length-3];P=G.bakePrep(G.bkLow());const sameBake=P.low.pos===G.bkLow().pos||P.low.pos[0]===G.bkLow().pos[0];C.explode=false;
   /* move: the high-poly moved up moves it in the bake */
   C.off.high=[0,.5,0];P=G.bakePrep(G.bkLow());const P0=G.bgPlaceHigh(G.bakeAlign(C.high,G.bkLow()),G.bkLow());C.off.high=[0,0,0];
   return {hint,k,nameLow,nameHigh,hx,lx,matHigh,matLow,handHigh,handLow,dx,dx2,sameBake,moved:P.high.pos[1]-G.bgPlaceHigh(G.bakeAlign(C.high,G.bkLow()),G.bkLow()).pos[1]};});
 ok(/100× smaller/.test(r.hint),'a tiny high-poly is noticed: '+r.hint);
 ok(Math.abs(r.k-100)<1,'Match size scales it ×100 ('+r.k+')');
 ok(Math.abs(r.hx[0]-r.lx[0])<1e-3&&Math.abs(r.hx[1]-r.lx[1])<1e-3,'after Match size the high-poly sits on the low-poly '+JSON.stringify([r.hx,r.lx]));
 ok(r.nameLow===r.nameHigh&&r.nameLow.split(',').length===2,'groups by name pair a_low/a_high and b_low/b_high '+r.nameLow+' / '+r.nameHigh);
 ok(r.matLow==='0,1'&&r.matHigh==='0,1','groups by material');
 ok(r.handLow==='1'&&r.handHigh==='1,2','groups by hand follow the numbers you give');
 ok(r.dx!==r.dx2&&Math.abs(r.dx-r.dx2)>.1&&r.sameBake,'Explode spreads the groups in the view only '+JSON.stringify([r.dx,r.dx2]));
 ok(Math.abs(r.moved-.5)<1e-4,'moving the high-poly moves it in the bake ('+r.moved+')');
 /* the panel: Bake groups list, Match size, Move buttons */
 await p.evaluate(()=>__gs.buildBakePanel&&__gs.buildBakePanel());await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('bkGroups')&&!!document.getElementById('bkMatchSize')&&!!document.getElementById('bkMoveHigh')&&!!document.getElementById('bkExplode')),'the Bake tab has Bake groups, Explode, Match size and Move');
 /* the move gizmo: drag the high-poly's X arrow */
 await p.evaluate(()=>{if(!__gs.v3.on)__gs.toggle3D(true);});await W(500);
 await p.click('#bkMoveHigh');await W(500);
 const G=await p.evaluate(()=>{const g=__gs.bmvGeom(document.getElementById('v3Hit'));const r=document.getElementById('v3Hit').getBoundingClientRect();return g&&{p0:[g.p0[0]+r.left,g.p0[1]+r.top],t:[g.tips[0][0]+r.left,g.tips[0][1]+r.top]};});
 if(G){const m=[(G.p0[0]+G.t[0]*2)/3,(G.p0[1]+G.t[1]*2)/3];await p.mouse.move(m[0],m[1]);await p.mouse.down();await p.mouse.move(m[0]+(G.t[0]-G.p0[0]),m[1]+(G.t[1]-G.p0[1]),{steps:5});await p.mouse.up();await W(400);}
 const off=await p.evaluate(()=>__gs.bakeCfg.off.high.slice());
 ok(G&&off[0]>.05&&Math.abs(off[1])<1e-6,'dragging the red arrow moves the high-poly along X '+JSON.stringify(off));
 /* 3D Paint: double-click a saved smart material adds it; a picture that is no baked map comes into the project */
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);await p.evaluate(()=>__gs.useModel(__gs.primMesh('sphere',1)));await W(500);
 await p.evaluate(()=>{const G=__gs,L=G.cmdNewFillLayer();L.fill.maps.base.c=[.9,.2,.1];G.fillRender(L);G.smPut({kind:'smart',name:'DblTest',tree:{t:'G',name:'DblTest',open:true,kids:[G.smSer(L)]}});G.showPanel('mats');});await W(800);
 const n0=await p.evaluate(()=>__gs.doc.root.children.length);const tile=await p.$('#smGrid .mattile[title^="DblTest"]');await tile.scrollIntoViewIfNeeded();await tile.dblclick();await W(1000);
 ok(await p.evaluate(()=>__gs.doc.root.children.length)===n0+1,'double-clicking a smart material adds it');
 const m=await p.evaluate(async()=>{const G=__gs,c=document.createElement('canvas');c.width=c.height=16;c.getContext('2d').fillRect(0,0,16,16);const b=await new Promise(r=>c.toBlob(r,'image/png'));
   const before=(G.doc.projectAssets||[]).length;await G.p3MapBatch([new File([b],'Crate_Albedo.png',{type:'image/png'})]);await (G.paReady?G.paReady():0);await new Promise(r=>setTimeout(r,500));return {before,after:(G.doc.projectAssets||[]).length,toast:document.getElementById('toast').textContent};});
 ok(m.after===m.before+1&&/not a baked map/.test(m.toast),'an Albedo picture dropped as mesh maps still comes into the project '+JSON.stringify(m));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
