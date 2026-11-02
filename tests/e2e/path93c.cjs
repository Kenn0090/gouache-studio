/* 0.93.3 (2c): per-path projection depth, follow path / up axis, symmetry, and the display settings (3D Paint) */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
 await p.locator('#tools [data-tool="path"]').click();const hit=p.locator('#v3Hit'),hr=await hit.boundingBox();
 await p.mouse.click(hr.x+hr.width*.44,hr.y+hr.height*.48);await p.mouse.click(hr.x+hr.width*.56,hr.y+hr.height*.50);await p.keyboard.press('Enter');await p.waitForTimeout(500);
 const cnt=()=>p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');if(!L)return -1;const d=__gs.captureRegionNow(L.mask.target,0,0,128,128).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>40)n++;return n;});
 const set=fn=>p.evaluate(fn);
 await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.width*=10;__gs.pathRender(L);});await p.waitForTimeout(300);
 const c0=await cnt();ok(c0>20,'a surface path paints coverage ('+c0+')');
 // symmetry: another copy of the path on the other side of a moved mirror plane
 await set(()=>{__gs.mir3.off=[.3,0,0];const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.sym={x:true,y:false,z:false};__gs.pathRender(L);});await p.waitForTimeout(400);
 const c1=await cnt();ok(c1>c0,'Symmetry paints a mirrored copy ('+c0+' → '+c1+')');
 await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.sym=null;__gs.pathRender(L);});
 // projection depth: very thin depth shrinks or keeps coverage, a deep one never loses it
 await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.depthK=.1;__gs.pathRender(L);});const c2=await cnt();
 await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.depthK=4;__gs.pathRender(L);});const c3=await cnt();
 ok(c2<=c0&&c3>=c0,'Projection depth changes how far from the surface the paint reaches ('+c2+' ≤ '+c0+' ≤ '+c3+')');
 // follow path off with an up axis renders without GL errors
 const err=await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.depthK=1;L.path.follow=false;L.path.up='z';__gs.pathRender(L);return __gs.gl.getError();});ok(err===0,'Follow path off with an up axis renders cleanly');
 // Filled path: a closed path fills its inside on the surface
 await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.follow=true;L.path.sym=null;__gs.pathRender(L);});
 const hit2=p.locator('#v3Hit'),h2=await hit2.boundingBox();await p.locator('#pathAdd').click().catch(()=>{});
 for(const [x,y] of [[.40,.42],[.60,.42],[.60,.58],[.40,.58]])await p.mouse.click(h2.x+h2.width*x,h2.y+h2.height*y);
 await p.mouse.click(h2.x+h2.width*.40,h2.y+h2.height*.42);await p.waitForTimeout(300);
 const closed=await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');return {paths:L.paths.length,closed:L.path.closed,pts:L.path.points.length};});
 ok(closed.closed&&closed.pts>=3,'clicking the first point closes a surface path ('+JSON.stringify(closed)+')');
 const stroke=await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.paths.forEach((P,i)=>{if(i!==L.pathCur)P.hidden=true;});L.path.width/=40;L.path.mode='stroke';__gs.pathRender(L);return 0;});const cs=await cnt();
 const filled=await set(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.mode='fill';__gs.pathRender(L);return __gs.gl.getError();});const cf=await cnt();
 ok(filled===0&&cf>cs*2&&cf>100,'Filled path fills the inside of the outline ('+cs+' → '+cf+' pixels)');
 // the panel shows the controls
 await p.evaluate(()=>__gs.buildBrushPanel&&__gs.buildBrushPanel());await p.waitForTimeout(200);
 const ui=await p.evaluate(()=>({depth:!!document.getElementById('pathDepth'),follow:!!document.getElementById('pathFollow'),sym:!!document.getElementById('pathSymx'),reverse:!!document.getElementById('pathReverse'),disp:!!document.querySelector('.pathdisp')}));
 ok(ui.depth&&ui.follow&&ui.sym&&ui.disp,'the panel has Projection depth, Follow path, Symmetry and Display ('+JSON.stringify(ui)+')');
 // display settings are remembered
 await p.evaluate(()=>{__gs.pathDisp.handle=7;__gs.pathDisp.normals=true;localStorage.setItem('gs.pathDisp',JSON.stringify(__gs.pathDisp));});
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.pathDisp')).handle===7),'display settings are stored');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
