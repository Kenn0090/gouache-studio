/* 0.95.7: generator rows take your own grunge texture (Textures item) instead of the built-in noise; Polygon fill follows symmetry */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* ---- generator with a grunge picture ---- */
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'gen',false));await W(300);
 await p.evaluate(()=>{__gs.act('addLayer');__gs.setFG([.9,.1,.1]);__gs.act('fill');});await W(300);
 await p.evaluate(()=>__gs.msAdd(__gs.doc.active,'gen',{p:{g:'builder',edgeWeight:0,positionWeight:1,amount:.5,width:.5,breakup:1,contrast:1.5,scale:6,seed:1,inv:false}}));await W(500);
 const mask=()=>p.evaluate(()=>{const A=__gs.doc.active;__gs.compositeMap('base');const t=A.mask.target,d=__gs.captureRegionNow(t,0,0,t.w,t.h).data;const o=[];for(let i=0;i<d.length;i+=4*97)o.push(d[i]);return o;});
 const m0=await mask();
 const item=await p.evaluate(async()=>{await __gs.txLoad();const it=__gs.fxdAllTex().find(x=>x.kind==='gen')||__gs.fxdAllTex()[0];return it&&{kind:it.kind,id:it.id,name:it.name};});
 ok(!!item,'a Textures item to use '+JSON.stringify(item));
 await p.evaluate(g=>{const A=__gs.doc.active,r=A.mask.stack.find(x=>x.kind==='gen');__gs.msEdit(A,r,x=>{x.p.gimg=g;x.p.gtile=2;});},item);
 for(let i=0;i<40&&!(await p.evaluate(()=>{const r=__gs.doc.active.mask.stack.find(x=>x.kind==='gen');return !!__gs.msGrungeTex(r.p);}));i++)await W(250);
 await W(500);const m1=await mask();
 const diff=(a,c)=>a.reduce((s,v,i)=>s+Math.abs(v-c[i]),0)/a.length;
 ok(diff(m0,m1)>3,'the grunge picture changes the generator (mean difference '+diff(m0,m1).toFixed(1)+')');
 await p.evaluate(()=>{const A=__gs.doc.active,r=A.mask.stack.find(x=>x.kind==='gen');__gs.msEdit(A,r,x=>{x.p.ginv=true;});});await W(500);const m2=await mask();
 ok(diff(m1,m2)>3,'Invert grunge changes it again ('+diff(m1,m2).toFixed(1)+')');
 /* the row editor shows the Grunge section */
 await p.evaluate(()=>{const A=__gs.doc.active;__gs.ui.msSel={L:A,where:'m',id:A.mask.stack.find(x=>x.kind==='gen').id};__gs.ui.editMask=true;__gs.showPanel('matEd');__gs.renderMatEd&&__gs.renderMatEd(true);});await W(400);
 ok(await p.evaluate(()=>!!document.getElementById('msGrungePick')&&!!document.getElementById('ms_gtile')),'Properties: Grunge section with Choose from Textures and tiling');
 /* ---- Polygon fill with symmetry ---- */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const G=__gs;G.v3s().model='plane';G.v3.mesh=null;G.v3.dirty=true;G.requestRender(true);Object.assign(G.v3.cam,{yaw:0,pitch:0});});await W(1200);
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.evaluate(()=>{const G=__gs;G.selectOnly(G.layerByName('Paint'));G.setFG([.1,.2,.9]);G.setTool('pfill');G.pf.kind='tri';G.mir3.off=[0,0,0];G.mir3.x=false;G.mir3.y=false;G.mir3.z=false;G.mir3.radial=0;});await W(300);
 const blue=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let n=0,l=0,r=0;for(let i=0;i<d.length;i+=4)if(d[i+2]>180&&d[i]<80&&d[i+3]>200){n++;if(((i/4)%T.w)<T.w/2)l++;else r++;}return {n,l,r};});
 const x0=cx-hb.width*.2;
 await p.mouse.move(x0,cy);await W(100);await p.mouse.down();await p.mouse.up();await W(600);const a=await blue();
 ok(a.n>0&&a.n<40000,'without symmetry one triangle fills '+JSON.stringify(a));
 await p.evaluate(()=>__gs.undo());await W(300);
 await p.evaluate(()=>{__gs.mir3.x=true;});await p.mouse.move(x0,cy+1);await W(100);await p.mouse.down();await p.mouse.up();await W(600);const c=await blue();
 ok(c.n>a.n*1.5,'with Mirror X the mirrored triangle fills too '+JSON.stringify(c));
 await p.evaluate(()=>{__gs.mir3.x=false;});
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
