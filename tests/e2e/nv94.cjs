/* 0.27: Send an export straight into Blender, Unity, Godot or Unreal (desktop, with a stand-in for the disk) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* the browser version only explains */
 await p.evaluate(()=>__gs.dlgExportTextures());await W(300);
 ok(await p.locator('#txSend').count()===0&&await p.evaluate(()=>/desktop app/.test(document.querySelector('#dlgBody').textContent)),'the browser version says sending needs the desktop app');
 await p.click('#dlgCancel');await W(200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 /* the browser version only explains */
 await p.evaluate(()=>__gs.nvOpen());await W(200);
 ok(await p.evaluate(()=>/desktop app/.test(document.body.textContent)),'the browser says the new viewer is in the desktop app');
 /* pretend to be the desktop app and catch what would go to the viewer */
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__calls=[];
   P.invoke=async(cmd,body,opt)=>{window.__calls.push({cmd,len:body&&body.length,meta:opt&&opt.headers&&opt.headers['x-meta'],first:body?Array.from(body.slice(Math.max(0,body.length-8))):null});
     if(cmd==='viewer_open')return {name:'Test card',backend:'Vulkan',kind:'DiscreteGpu',software:false};return null;};});
 await p.evaluate(()=>__gs.nvOpen());await W(500);
 const c=await p.evaluate(()=>window.__calls.find(x=>x.cmd==='viewer_open'));
 ok(!!c,'the new viewer is asked to open');
 const m=c&&JSON.parse(c.meta);
 ok(m&&m.pos>0&&m.idx>0&&m.tw>0&&m.th>0,'it sends the model and a picture '+JSON.stringify(m));
 ok(m&&c.len===(m.pos+m.nrm+m.uv+m.idx)*4+m.tw*m.th*4,'the body is exactly as long as the header says ('+(c&&c.len)+')');
 ok(m&&c.first[3]===255,'the picture is opaque');
 ok(await p.evaluate(()=>/New viewer open on Test card/.test(document.body.textContent)),'it tells you what it runs on');
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
