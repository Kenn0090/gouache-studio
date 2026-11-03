/* 0.93.3: Warp projection (3D Paint): a grid of points bends the projected picture */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' @ '+String(e.stack).split('\n').slice(1,3).join(' | ')));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
 await p.locator('#tools [data-tool="text"]').click();const hit=p.locator('#v3Hit'),hr=await hit.boundingBox();
 await p.mouse.click(hr.x+hr.width*.5,hr.y+hr.height*.5);await p.waitForTimeout(800);
 const cnt=()=>p.evaluate(()=>{const L=__gs.t3Layer();__gs.msUpdate(L);const d=__gs.captureRegionNow(L.mask.target,0,0,256,256).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>40)n++;return n;});
 const mod=fn=>p.evaluate(fn);
 const planar=await cnt();ok(planar>30,'text as a planar sticker ('+planar+')');
 // warp, identity grid
 await mod(()=>{const L=__gs.t3Layer(),r=__gs.t3Row(L);r.p.proj='warp';r.p.rep=true;r.p.tile=1;r.p.xf=Object.assign({},r.p.xf,{s:[1,.6,1],depth:2,crop:true});r.p.xf.warp=__gs.wpjDefault(3,3);r.p.rev=(r.p.rev||0)+1;__gs.changed(L);});
 const ident=await cnt();ok(ident>30&&Math.abs(ident-await cnt())<5,'an unmoved Warp grid shows the picture ('+ident+')');
 // squeeze the grid in x: the picture takes less room
 await mod(()=>{const L=__gs.t3Layer(),r=__gs.t3Row(L),w=r.p.xf.warp;w.pts=w.pts.map(q=>[q[0]*.5,q[1],q[2]]);w.moved=true;r.p.rev=(r.p.rev||0)+1;__gs.changed(L);});
 const sq=await cnt();ok(sq>0&&sq<ident*.8,'moving the points bends the picture ('+ident+' → '+sq+')');
 // split adds points
 const sp=await mod(()=>{const L=__gs.t3Layer(),r=__gs.t3Row(L),w=r.p.xf.warp,a=__gs.wpjSplit(w,'x'),h=__gs.wpjSplit(w,'h'),v=__gs.wpjSplit(w,'v');return {a:a.n.join('x'),h:h.n.join('x'),v:v.n.join('x'),n:w.n.join('x'),pts:a.pts.length};});
 ok(sp.n==='3x3'&&sp.a==='4x4'&&sp.h==='4x3'&&sp.v==='3x4'&&sp.pts===16,'the split tools add rows and columns ('+JSON.stringify(sp)+')');
 // moving a point with the mouse in Edit vertices mode
 await mod(()=>{const L=__gs.t3Layer(),r=__gs.t3Row(L);r.p.xf.warp=__gs.wpjDefault(3,3);r.p.xf.s=[1,.6,1];__gs.wpjUI.edit=true;__gs.selectOnly(L);__gs.ui.msSel={L,where:'m',id:r.id};__gs.renderMatEd&&__gs.renderMatEd(true);});
 await p.waitForTimeout(500);
 console.log('active',await mod(()=>!!__gs.wpjActive()),'tool',await mod(()=>__gs.ui.tool));
 console.log('after setup',await mod(()=>{const r=__gs.t3Row(__gs.t3Layer());return JSON.stringify({keys:Object.keys(r.p.xf),warp:!!r.p.xf.warp,proj:r.p.proj});}));
 const pos=await mod(()=>{const L=__gs.t3Layer(),r=__gs.t3Row(L),w=r.p.xf.warp,hit=document.getElementById('v3Hit'),b=hit.getBoundingClientRect(),q=__gs.pathProject(__gs.wpjToWorld(r.p.xf,w.pts[4]),'3d',hit);return q?{x:b.left+q[0],y:b.top+q[1]}:null;});
 if(pos){await p.mouse.move(pos.x,pos.y);await p.mouse.down();await p.mouse.move(pos.x+40,pos.y-20,{steps:6});await p.mouse.up();await p.waitForTimeout(500);}
 console.log('after drag',await mod(()=>{const r=__gs.t3Row(__gs.t3Layer());return JSON.stringify({keys:Object.keys(r.p.xf),warp:!!r.p.xf.warp});}));
 const moved=await mod(()=>{const L=__gs.t3Layer(),r=__gs.t3Row(L),w=r.p.xf.warp;return {moved:!!w.moved,p:w.pts[4].map(v=>+v.toFixed(2))};});
 ok(pos&&moved.moved,'dragging a point moves it over the model ('+JSON.stringify(moved)+')');
 const err=await mod(()=>__gs.gl.getError());ok(err===0,'no graphics errors');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
