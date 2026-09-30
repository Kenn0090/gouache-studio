/* 0.24: smart materials (folders of live layers) and smart masks: built-ins, save, apply, undo. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:__dirname+'/../../assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{__gs.useModel(__gs.primMesh('sphere',1));__gs.showPanel('mats');});await W(900);
 // a smart material made from library materials and grunge maps
 await p.click('#smGrid .mattile:has-text("Worn Steel")');await p.click('#lFill');
 for(let i=0;i<80;i++){if(await p.evaluate(()=>__gs.doc.root.children.some(n=>n.name==='Worn Steel')))break;await W(250);}
 const a=await p.evaluate(()=>{const G=__gs.doc.root.children.find(n=>n.name==='Worn Steel');if(!G)return null;const L=G.children;return {n:L.length,names:L.map(c=>c.name).join(),img:L.map(c=>c._fillImg?Object.keys(c._fillImg).length:0).join(),rows:L.map(c=>c.mask?c.mask.stack.map(r=>r.kind).join('+'):'').join('|'),pic:L.map(c=>c.mask?c.mask.stack.filter(r=>r.kind==='image'&&r.t).length:0).join()};});
 ok(a&&a.n===4,'Worn Steel adds a folder of 4 layers '+JSON.stringify(a));
 ok(a&&a.img.split(',')[0]>0&&a.img.split(',')[1]>0&&a.img.split(',')[2]>0,'the library layers carry their pictures');
 ok(a&&a.pic.split(',').slice(1,4).every(v=>v>='1'),'the masks carry grunge pictures '+(a&&a.pic));
 // a smart mask with a grunge picture
 await p.evaluate(()=>{__gs.act('addLayer');});await W(300);
 await p.click('#smMaskGrid .mattile:has-text("Cracks")');
 await p.evaluate(()=>__gs.matMaskSelected&&__gs.matMaskSelected());
 for(let i=0;i<60;i++){if(await p.evaluate(()=>{const A=__gs.doc.active;return A&&A.mask&&A.mask.stack&&A.mask.stack.some(r=>r.kind==='image'&&r.t);}))break;await W(250);}
 ok(await p.evaluate(()=>{const A=__gs.doc.active;return !!(A.mask&&A.mask.stack.some(r=>r.kind==='image'&&r.t));}),'the Cracks smart mask puts a picture row on the layer');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
