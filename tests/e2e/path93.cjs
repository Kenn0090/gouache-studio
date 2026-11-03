/* 0.93.4: Substance Painter style paths: several paths in one layer and a Paths panel (new, select, hide, rename, duplicate, copy, paste, delete, undo, save) */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(300,300,8,[1,1,1],'P',false,'hand');});await p.waitForTimeout(400);
 await p.locator('#tools [data-tool="pen"]').click();await p.waitForTimeout(200);
 const at=async(x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('stage').getBoundingClientRect(),v=__gs.view;return [r.left+v.x+x*v.zoom,r.top+v.y+y*v.zoom];},[x,y]);
 const click=async(x,y)=>p.mouse.click(...await at(x,y));
 const st=()=>p.evaluate(()=>{const L=__gs.allLayers().filter(L=>L.path);return {layers:L.length,paths:L[0]?L[0].paths.length:0,names:L[0]?L[0].paths.map(q=>q.name):[],hidden:L[0]?L[0].paths.map(q=>!!q.hidden):[],cur:L[0]?L[0].pathCur:-1,pts:L[0]?L[0].paths.map(q=>q.points.length):[]};});
 await p.evaluate(()=>{const P=__gs.ui;});
 // a first path: three clicks, then Enter
 for(const [x,y] of [[40,60],[120,40],[200,90]])await click(x,y);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 let s=await st();ok(s.layers===1&&s.paths===1&&s.pts[0]===3,'the first path makes a path layer with one path');
 // click empty canvas after Enter: a new path in the SAME layer
 for(const [x,y] of [[40,200],[120,230],[220,200]])await click(x,y);await p.keyboard.press('Enter');await p.waitForTimeout(200);
 s=await st();ok(s.layers===1&&s.paths===2&&s.pts.join()==='3,3','clicking empty canvas starts a second path in the same layer ('+JSON.stringify(s)+')');
 // the panel lists both
 ok(await p.evaluate(()=>document.querySelectorAll('.pathrow').length===2),'the Paths panel lists both paths');
 // the coverage holds both paths
 const cov=()=>p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);let top=0,bot=0;for(let x=30;x<230;x+=6)for(let y=30;y<250;y+=6){const v=__gs.captureRegionNow(L.mask.target,x,y,1,1).data[0];if(v>40){if(y<120)top++;else bot++;}}return {top,bot};});
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.path);L.paths.forEach(P=>{P.mode='stroke';P.width=10;});__gs.pathRender(L);});await p.waitForTimeout(300);
 let c0=await cov();ok(c0.top>10&&c0.bot>10,'both paths paint into the layer\'s coverage ('+JSON.stringify(c0)+')');
 // hide the first path: its coverage goes
 await p.locator('.pathrow').nth(0).locator('.patheye').click();await p.waitForTimeout(300);
 s=await st();c0=await cov();ok(s.hidden[0]===true&&c0.top===0&&c0.bot>10,'the eye hides a path and its coverage goes ('+JSON.stringify(c0)+')');
 await p.locator('.pathrow').nth(0).locator('.patheye').click();await p.waitForTimeout(300);
 // select by clicking a row, rename by double-click
 await p.locator('.pathrow').nth(0).click();await p.waitForTimeout(150);s=await st();ok(s.cur===0,'a click on a row selects that path');
 await p.locator('.pathrow').nth(0).dblclick();await p.fill('.pathrename','Handrail');await p.keyboard.press('Enter');await p.waitForTimeout(250);
 s=await st();ok(s.names[0]==='Handrail','double-click renames a path');
 // duplicate, copy, paste, delete
 await p.click('#pathDup');await p.waitForTimeout(250);s=await st();ok(s.paths===3&&/Handrail copy/.test(s.names[1]),'Duplicate adds a copy next to it');
 await p.click('#pathCopyBtn');await p.click('#pathPasteBtn');await p.waitForTimeout(250);s=await st();ok(s.paths===4,'Copy and Paste add another path');
 await p.click('#pathDel');await p.waitForTimeout(250);s=await st();ok(s.paths===3,'Delete removes the selected path');
 // undo steps back one change at a time
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(250);s=await st();ok(s.paths===4,'Undo brings the deleted path back');
 // save and reopen
 const re=await p.evaluate(async()=>{const blob=await __gs.encodeGouache(),buf=await blob.arrayBuffer();await __gs.openGouache(buf,'Paths');const L=__gs.allLayers().find(L=>L.path);return {paths:L.paths.length,cur:L.pathCur,same:L.path===L.paths[L.pathCur],names:L.paths.map(q=>q.name)};});
 ok(re.paths===4&&re.same,'a saved project reopens with all its paths ('+JSON.stringify(re)+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
