/* 0.94: the new viewer window also follows the Bake and Convert tabs: the model's baked maps go to it as its textures */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 if(await p.evaluate(()=>!!(window.__gs&&__gs.NV_BANKED))){console.log('SKIPPED: the new viewer is banked for a future update (NV_BANKED)');await b.close();process.exit(0);}
 const W=ms=>p.waitForTimeout(ms||200);
 await p.addScriptTag({path:__dirname+'/fixtures/bumpy.js'});await p.evaluate(()=>{__gs.newDoc(256,256,8,[.5,.5,.5],'NvBake',false);});await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(800);
 await p.evaluate(()=>{const C=__gs.bakeCfg;C.low=__gs.primMesh('cube',0);C.high=__bumpy(__gs.primMesh('sphere',3));C.ss=1;C.pad=2;C.front=20;C.back=20;C.match=false;C.cage=null;});
 ok(await p.evaluate(()=>!!document.getElementById('v3Nv')),'the Bake tab\'s 3D bar has the New viewer button');
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__open=null;window.__tex=[];
   P.invoke=async(cmd,body)=>{if(cmd==='viewer_open'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true);window.__open=JSON.parse(new TextDecoder().decode(body.slice(4,4+jl)));return {name:'Test card',backend:'Vulkan',kind:'DiscreteGpu',software:false};}
     if(cmd==='viewer_textures'){window.__tex.push(body.length);return true;}if(cmd==='viewer_update')return true;return true;};});
 await p.evaluate(()=>__gs.nvOpen());await W(3500);
 const g=await p.evaluate(()=>window.__open&&window.__open.groups);
 ok(g&&g.length>=1&&g[0].idx>0,'the Bake tab\'s model goes to the window ('+JSON.stringify(g&&g.map(x=>[x.name,x.idx,x.tex&&x.tex.base]))+')');
 ok(g&&g[0].tex.base>0,'its colour picture goes along');
 /* the Unfold slider */
 await p.evaluate(()=>{window.__gs.bk.fold=.5;});
 ok(await p.evaluate(()=>window.__gs.nvSettings().fold)===.5,'the Unfold slider goes to the window');
 await p.evaluate(()=>{window.__gs.bk.fold=0;});
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();process.exit(fails?1:0);
})();
