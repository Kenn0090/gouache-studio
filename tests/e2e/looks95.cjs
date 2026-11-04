/* 0.95: the seven new viewer shaders (hologram, glass, fur, iridescent, car paint, cloth sheen, wax) in the 3D view. OUT=dir saves pictures. */
const {chromium}=require('playwright'),crypto=require('crypto'),fs=require('fs');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(/shader|compile|GLSL/i.test(m.text()))errs.push(m.text().slice(0,300));});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>{const G=__gs;G.closeWelcome();G.setMode('p3d',true);G.useModel(G.primMesh('sphere',1));G.cmdNewFillLayer({name:'Red',maps:{base:{c:[.8,.25,.2]}}});});await W(1500);
 const box=await p.locator('#gl').boundingBox(),hash=async()=>crypto.createHash('md5').update(await p.screenshot({clip:box,timeout:120000})).digest('hex');
 const kinds=['std','hologram','glass','fur','iridescent','car','cloth','wax'],seen={};
 for(const k of kinds){await p.evaluate(k=>{__gs.doc.v3shade={kind:k,p:k==='fur'?{fur:{wind:0}}:k==='hologram'?{hologram:{speed:0,flicker:0}}:{}};__gs.v3.dirty=true;__gs.requestRender(true);},k);await W(900);
  console.log('shot',k);const h=await hash();seen[k]=h;if(process.env.OUT)fs.writeFileSync(process.env.OUT+'/'+k+'.png',await p.screenshot({clip:box}));}
 for(const k of kinds.slice(1))ok(seen[k]!==seen.std,k+' looks different from Standard');
 ok(new Set(Object.values(seen)).size===kinds.length,'all eight pictures differ');
 /* presets */
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'iridescent',p:{}};__gs.renderShading();});await W(300);
 ok(await p.locator('#shPre_beetle').count()===1,'Iridescent shows its preset buttons');
 await p.evaluate(()=>document.getElementById('shPre_beetle').click());await W(300);
 const pv=await p.evaluate(()=>__gs.doc.v3shade.p.iridescent);
 ok(pv&&pv.shift===.55&&pv.preset==='beetle','clicking Beetle shell sets its settings '+JSON.stringify(pv));
 for(const [k,id] of [['hologram','green'],['glass','frosted'],['fur','peach'],['car','candy'],['cloth','satin'],['wax','jade']]){await p.evaluate(k=>{__gs.doc.v3shade={kind:k,p:{}};__gs.renderShading();},k);await W(150);ok(await p.locator('#shPre_'+id).count()===1,k+' has its presets');}
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
