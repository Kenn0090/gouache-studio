/* 0.97.26 (Kenn): skin settings like Marmoset's Subsurface Scatter, and Metalness / Specular reflectivity */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load/.test(m.text()))console.log('CON',m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await W(3000);
 await p.evaluate(()=>{const s=__gs.v3s();s.model='sphere';__gs.v3LoadModel&&__gs.v3LoadModel(true);});await W(800);
 const shot=()=>p.evaluate(()=>{__gs.v3.dirty=true;return Array.from(__gs.v3Offscreen(200,160));});
 const diff=(a,b)=>{let d=0;for(let i=0;i<a.length;i+=4)d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return d/(a.length/4);};
 const setP=o=>p.evaluate(o=>{__gs.shadeEdit(d=>{d.p=d.p||{};d.p[d.kind]=Object.assign({},__gs.shParams(d,d.kind),o);});},o);
 /* Standard has the reflectivity drop-down */
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('shRefl')),'Standard has a Reflectivity drop-down (Metalness / Specular)');
 await p.selectOption('#shKind','skin');await W(600);await p.evaluate(()=>__gs.renderShading());await W(200);
 const ids=['skMap_sssc','sh_scatDepth','skMap_trans','sh_transmission','sh_transDepth','sh_transScatter','skMap_fuzzm','sh_fuzz','sh_fuzzScale','sh_fuzzOcc','shRefl'];
 const have=await p.evaluate(ids=>ids.filter(i=>!document.getElementById(i)),ids);
 ok(!have.length,'Skin shows Marmoset\'s Subsurface Scatter settings (missing: '+have.join(',')+')');
 await setP({fuzz:0});await W(300);const f0=await shot();await setP({fuzz:1,fuzzScale:.5,fcol:[1,1,1]});await W(300);const f1=await shot();
 ok(diff(f0,f1)>.5,'Fuzz adds a soft sheen at the edges '+diff(f0,f1).toFixed(2));
 await setP({fuzz:0,scatDepth:0});await W(300);const s0=await shot();await setP({scatDepth:4});await W(300);const s1=await shot();
 ok(diff(s0,s1)>.5,'Scatter Depth softens the light '+diff(s0,s1).toFixed(2));
 await p.evaluate(()=>{const s=__gs.v3s();s.sunAz=220;s.sunEl=10;s.sunI=2;});
 await setP({scatDepth:1,transmission:1,transScatter:0});await W(300);const t0=await shot();await setP({transScatter:1});await W(300);const t1=await shot();
 ok(diff(t0,t1)>.05,'Translucency Scatter spreads the light coming through '+diff(t0,t1).toFixed(3));
 /* Specular reflectivity */
 await p.evaluate(()=>{const s=__gs.v3s();s.sunAz=40;s.sunEl=45;s.sunI=1;});
 await p.selectOption('#shRefl','spec');await W(500);
 ok(await p.evaluate(()=>__gs.doc.maps.includes('specc')&&__gs.skReflSpec(__gs.v3ShadeOf(__gs.doc))),'Specular adds a Specular colour channel and the shader reads it');
 await setP({specDef:[.05,.05,.05]});await W(300);const d0=await shot();await setP({specDef:[.9,.9,.9]});await W(300);const d1=await shot();
 ok(diff(d0,d1)>.5,'the specular colour changes the shine '+diff(d0,d1).toFixed(2));
 const fill=await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;for(const k in L.fill.maps)L.fill.maps[k].on=false;Object.assign(L.fill.maps.specc,{on:true,src:'value',c:[.02,.02,.02]});g.fillRender(L);g.changedAll();g.setView('material');return true;});
 await W(900);const d2=await shot();ok(diff(d1,d2)>.5,'a material with a dark Specular colour takes the shine away '+diff(d1,d2).toFixed(2));
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
