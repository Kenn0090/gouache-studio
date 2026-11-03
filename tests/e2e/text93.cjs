/* 0.93.4: live text on the model (3D Paint): place, edit, move, material, undo */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.setMode('p3d',true);});await p.waitForTimeout(1500);
 ok(await p.evaluate(()=>{const b=document.querySelector('#tools [data-tool="text"]');return !!b&&b.getClientRects().length>0;}),'the Text tool shows in 3D Paint');
 await p.locator('#tools [data-tool="text"]').click();await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('t3Text')),'the Text panel opens');
 const hit=p.locator('#v3Hit'),hr=await hit.boundingBox();
 await p.mouse.click(hr.x+hr.width*.5,hr.y+hr.height*.5);await p.waitForTimeout(800);
 const info=()=>p.evaluate(()=>{const L=__gs.t3Layer();if(!L)return null;const r=__gs.t3Row(L);return {name:L.name,content:L.text3d.spec.content,rowT:r&&r.t?[r.t.w,r.t.h]:null,s:r?r.p.xf.s.map(v=>+v.toFixed(3)):null,t:r?r.p.xf.t.map(v=>+v.toFixed(3)):null,proj:r&&r.p.proj,layers:__gs.allLayers().length};});
 let s=await info();ok(s&&s.content==='Text'&&s.rowT&&s.proj==='planar','a click on the model places live text ('+JSON.stringify(s)+')');
 const cov=()=>p.evaluate(()=>{const L=__gs.t3Layer();__gs.msUpdate&&__gs.msUpdate(L);const d=__gs.captureRegionNow(L.mask.target,0,0,256,256).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>40)n++;return n;});
 const c0=await cov();ok(c0>30,'the letters cover part of the model ('+c0+' pixels)');
 // edit the words
 await p.evaluate(()=>__gs.t3Prop('content','HELLO WORLD'));await p.waitForTimeout(600);s=await info();
 ok(s.content==='HELLO WORLD'&&/HELLO/.test(s.name)&&s.rowT[0]>(await Promise.resolve(0)),'editing the words redraws the text');
 ok(s.s[0]/s.s[1]>1.5,'the picture keeps the proportions of the words ('+s.s+')');
 // click again: moves
 const t0=s.t;await p.mouse.click(hr.x+hr.width*.62,hr.y+hr.height*.42);await p.waitForTimeout(700);s=await info();
 ok(s.layers===(await info()).layers&&JSON.stringify(s.t)!==JSON.stringify(t0),'clicking the model again moves the text ('+t0+' → '+s.t+')');
 // a material on the letters
 const mat=await p.evaluate(()=>{const L=__gs.t3Layer();return {fill:!!L.fill,base:L.fill.maps.base.on};});ok(mat.fill&&mat.base,'the text layer is a material layer (colour, roughness, metal… all editable)');
 // undo one edit
 await p.evaluate(()=>__gs.t3Prop('content','ONE'));await p.waitForTimeout(1200);await p.evaluate(()=>__gs.t3Commit());await p.evaluate(()=>__gs.t3Prop('content','TWO'));await p.waitForTimeout(1200);await p.evaluate(()=>__gs.t3Commit());
await p.evaluate(()=>__gs.undo());await p.waitForTimeout(900);s=await info();ok(s.content==='ONE','undo takes an edit of the words back ('+s.content+')');
 // save and reopen the project: the text is still live
  const re=await p.evaluate(async()=>{const g=__gs,blob=await g.encodeP3Project();g.p3.savedAt=g.p3Sig();await g.openP3Project(await blob.arrayBuffer(),'Text reopen',null);const L=g.allLayers().find(L=>L.text3d);if(!L)return null;g.selectOnly(L);const r=g.t3Row(L);return {content:L.text3d.spec.content,row:!!(r&&r.t),proj:r&&r.p.proj,xf:JSON.stringify(r&&r.p.xf),keys:r&&Object.keys(r.p)};});
 ok(re&&re.content==='ONE'&&re.row&&re.proj==='planar','a saved project reopens with live text ('+JSON.stringify(re)+')');
 await p.evaluate(()=>__gs.t3Prop('content','AGAIN'));await p.waitForTimeout(800);s=await info();ok(s&&s.content==='AGAIN','and the reopened text can be edited again');
 // undo the edit
 await p.evaluate(()=>__gs.t3Prop('bold',false));await p.waitForTimeout(1200);
 // new text with Shift
 const n0=s.layers;await p.keyboard.down('Shift');await p.mouse.click(hr.x+hr.width*.40,hr.y+hr.height*.60);await p.keyboard.up('Shift');await p.waitForTimeout(800);s=await info();ok(s.layers===n0+1,'Shift+click adds another text layer');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
