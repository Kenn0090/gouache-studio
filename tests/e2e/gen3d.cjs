/* Guide pictures for 3D Paint (docs/wiki/images/p3d-tab.png, material-panel.png, mask-tools.png, levels-simple.png, bake-tabs.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+"/out/";
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);await p.evaluate(()=>__gs.useModel(__gs.primMesh('cylinder',2)));await W(1200);
 const shot=async()=>{};
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.ui.viewMask=true;Object.assign(__gs.v3.cam,{yaw:.7,pitch:.45});__gs.v3.dirty=true;});
 for(const [n,kind,pp] of [['noise','noise',{type:'grunge',scale:4,contrast:2,level:0,seed:2,tri:true,inv:false}],['dir','dir',{axis:'up',angle:50,soft:15,inv:false}],['grad','grad',{axis:'up',from:0,to:1,inv:false}],
   ['edge','gen',{g:'edge',amount:.5,width:.5,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false}],['dust','gen',{g:'dust',amount:.5,width:.5,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false}],['scratch','noise',{type:'scratches',scale:3,contrast:2,level:0,seed:2,tri:true,inv:false}]])
   await shot(n,{fn:null}) , await p.evaluate(([kind,pp])=>{const A=__gs.doc.active;if(A.mask&&A.mask.stack){A.mask.stack.length=0;}__gs.msAdd(A,kind,{p:pp});__gs.ui.viewMask=true;__gs.v3.dirty=true;},[kind,pp]),await W(900),await p.locator('#work').screenshot({path:OUT+'gen-'+n+'.png'});
 console.log(errs.length?'ERR '+errs.slice(0,3).join('\n'):'ALL PASSED');await b.close();})();
