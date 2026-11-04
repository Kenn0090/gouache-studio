/* 0.93.3: Ribbon path (3D Paint): a picture or text bent along a surface path */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
 await p.locator('#tools [data-tool="path"]').click();const hit=p.locator('#v3Hit'),hr=await hit.boundingBox();
 for(const [x,y] of [[.30,.58],[.46,.46],[.62,.58]])await p.mouse.click(hr.x+hr.width*x,hr.y+hr.height*y);await p.keyboard.press('Enter');await p.waitForTimeout(400);
 const grab=()=>p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');return Array.from(__gs.captureRegionNow(L.mask.target,0,0,512,512).data.filter((v,i)=>i%4===0));});
 const cnt=()=>p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');const d=__gs.captureRegionNow(L.mask.target,0,0,512,512).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>40)n++;return n;});
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.width=(__gs.v3.mesh.radius||1)*.2;L.path.pressure=false;L.path.mode='stroke';__gs.pathRender(L);});const solid=await cnt();
 // switch to ribbon through the panel
 await p.evaluate(()=>__gs.buildBrushPanel());await p.waitForTimeout(200);
 await p.evaluate(async()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.mode='ribbon';await __gs.rbUseText(L,L.path,{content:'RIBBON TEXT',font:'Sans',size:96,bold:true,italic:false,align:'left',lineHeight:1.15,tracking:0,outline:0});});await p.waitForTimeout(600);
 const rib=await cnt();ok(rib>30&&rib<solid,'text along the path paints only the letters ('+rib+' of '+solid+' pixels of a solid stroke)');
 ok(await p.evaluate(()=>!!document.getElementById('rbText')&&!!document.getElementById('rbTiling')),'the Ribbon controls show in the panel');
 // tiling custom changes the result
 const g0=await grab();
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.ribbon=Object.assign({},L.path.ribbon,{tiling:'custom',tiles:3});__gs.pathRender(L);});const g1=await grab();let diff=0;for(let i=0;i<g0.length;i++)if(Math.abs(g0[i]-g1[i])>60)diff++;
 ok(diff>150,'Tiling amount repeats the picture along the path ('+diff+' pixels differ)');
 // keep aspect ratio with clipped tiles removed
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.ribbon=Object.assign({},L.path.ribbon,{fit:'aspect',tiling:'auto',remove:true,align:'center'});__gs.pathRender(L);});const ka=await cnt();ok(ka>0,'Keep aspect ratio paints too ('+ka+')');
 // blend add is stronger or equal than max
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.ribbon=Object.assign({},L.path.ribbon,{fit:'stretch',tiling:'auto',remove:false,blend:'add'});__gs.pathRender(L);});const ad=await cnt();ok(ad>=rib*.8,'Alpha blending options render ('+ad+')');
 // 0.95: round corners fill the outer side of a bend; bevel leaves it cut
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.ribbon=Object.assign({},L.path.ribbon,{corner:'bevel',fit:'stretch',tiling:'none',blend:'max'});__gs.pathRender(L);});const cb=await cnt();
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.ribbon=Object.assign({},L.path.ribbon,{corner:'round'});__gs.pathRender(L);});const cr=await cnt();
 ok(cr>=cb,'round corners never paint less than bevel corners ('+cb+' -> '+cr+')');
 // text tool: Put on a path
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');L.path.mode='stroke';__gs.pathRender(L);});
 await p.evaluate(async()=>{__gs.t3.style.content='ON A PATH';__gs.setTool('text');await __gs.t3PutOnPath();});await p.waitForTimeout(600);
 const put=await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path?.kind==='3d');return {mode:L.path.mode,txt:L.path.ribbon&&L.path.ribbon.img&&L.path.ribbon.img.spec&&L.path.ribbon.img.spec.content,tool:__gs.ui.tool};});
 ok(put.mode==='ribbon'&&put.txt==='ON A PATH','Put on a path turns the words into a Ribbon path ('+JSON.stringify(put)+')');
 // the picture survives a save
 const re=await p.evaluate(async()=>{const g=__gs,blob=await g.encodeP3Project();g.p3.savedAt=g.p3Sig();await g.openP3Project(await blob.arrayBuffer(),'Ribbon reopen',null);const L=g.allLayers().find(L=>L.path?.kind==='3d');return L?{mode:L.path.mode,img:!!g.rbImage(L,L.path)}:null;});
 ok(re&&re.mode==='ribbon'&&re.img,'a saved project reopens with the ribbon and its picture ('+JSON.stringify(re)+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
