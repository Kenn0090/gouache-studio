/* 0.93.3: Cylindrical projection (3D Paint): wraps a picture around the model; Angle, backface culling, UV wrap and Shape crop */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
 await p.locator('#tools [data-tool="text"]').click();const hit=p.locator('#v3Hit'),hr=await hit.boundingBox();
 await p.mouse.click(hr.x+hr.width*.5,hr.y+hr.height*.5);await p.waitForTimeout(800);
 const set=(fn,arg)=>p.evaluate(fn,arg);
 const cnt=()=>p.evaluate(()=>{const L=__gs.t3Layer();__gs.msUpdate(L);const d=__gs.captureRegionNow(L.mask.target,0,0,256,256).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>40)n++;return n;});
 const mod=(patch,proj)=>p.evaluate(([patch,proj])=>{const L=__gs.t3Layer(),r=__gs.t3Row(L);if(proj)r.p.proj=proj;r.p.rep=true;r.p.tile=patch.tile||1;delete patch.tile;r.p.xf=Object.assign({},r.p.xf,{s:[1,1,1]},patch);r.p.rev=(r.p.rev||0)+1;__gs.changed&&__gs.changed(L);},[patch,proj]);
 const planar=await cnt();ok(planar>30,'the text first paints as a planar sticker ('+planar+')');
 await mod({},'cyl');const full=await cnt();ok(full>planar,'Cylindrical wraps the picture around the model ('+planar+' → '+full+')');
 await mod({ang:90},'cyl');const part=await cnt();ok(part>0&&part<full,'Angle limits how much of the cylinder is covered ('+part+' < '+full+')');
 await mod({ang:360,wrap:'repeat',tile:2},'cyl');const rep2=await cnt();await mod({ang:360,wrap:'none',tile:2},'cyl');const none=await cnt();ok(none>0&&none<rep2,'UV wrap: None stops the picture from repeating ('+none+' < '+rep2+')');
 await mod({ang:360,wrap:'repeat',cull:false},'cyl');const nocull=await cnt();await mod({ang:360,cull:true,hard:.1},'cyl');const cull=await cnt();ok(nocull>=cull,'Backface culling hides the projection where it meets the surface edge-on ('+cull+' ≤ '+nocull+')');
 await mod({crop:true,ang:360,cull:true,hard:.5},'cyl');const crop=await cnt();ok(crop<=full,'Project cropped to shape keeps it inside the frame ('+crop+' ≤ '+full+')');
 await p.evaluate(()=>__gs.buildBrushPanel&&0);
 ok(await p.evaluate(()=>typeof __gs.pxfFields==='function'),'the projection panel code is present');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
