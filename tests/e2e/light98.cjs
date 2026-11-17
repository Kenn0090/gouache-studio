/* 0.98.11: gizmos for the lights in the 3D view (sun, bulbs, spots: move, turn, size), more skies from Poly Haven, the Eye shader. */
const {chromium}=require('playwright'),crypto=require('crypto');
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
 await p.evaluate(()=>{const G=__gs;G.closeWelcome();G.setMode('p3d',true);G.useModel(G.primMesh('sphere',1));});await W(1500);
 /* the studio sun gets a gizmo and turns */
 const sun=await p.evaluate(()=>{const s=__gs.v3s();s.env='none';s.sunI=1;s.rigLive=false;__gs.v3.dirty=true;__gs.requestRender(true);return null;});await W(500);
 const r1=await p.evaluate(()=>{const hit=document.getElementById('v3Hit'),G=__gs.lgzGeom(hit);if(!G)return {none:true};const it=G.items[0],r=hit.getBoundingClientRect(),az0=__gs.v3s().sunAz;
   const e=(dx,dy)=>({clientX:r.left+it.p[0]+dx,clientY:r.top+it.p[1]+dy,pointerId:1,shiftKey:false,preventDefault(){},button:0});
   const down=__gs.lgzDown(hit,e(0,0));__gs.lgzMove(hit,e(40,0));__gs.lgz.drag&&(__gs.lgz.drag.m=[it.p[0]+40,it.p[1]]);__gs.lgzApply();__gs.lgzUp();return {sun:G.sun,down,az0,az1:__gs.v3s().sunAz,ring:!!G.gz};});
 ok(r1.sun&&r1.down,'the studio sun shows a gizmo and can be grabbed '+JSON.stringify(r1));ok(r1.az1!==r1.az0,'dragging the sun turns it ('+r1.az0+' → '+r1.az1+')');
 /* rig lights: size handles */
 const r2=await p.evaluate(()=>{const s=__gs.v3s();s.rigLive=true;const R=__gs.lightRig();R.lights=[];R.lights.push(__gs.lightNew('spot',{name:'Spot'}));R.sel=R.lights[0].id;R.show=true;__gs.v3.dirty=true;__gs.requestRender(true);
   const hit=document.getElementById('v3Hit'),G=__gs.lgzGeom(hit);if(!G||!G.gz)return {none:true};const L=R.lights[0],ids=(G.gz.sz||[]).map(q=>q.id),q=G.gz.sz.find(q=>q.id==='reach'),r=hit.getBoundingClientRect(),range0=L.range;
   const m=q.at,part=__gs.lgzPart(G,m);__gs.lgzDown(hit,{clientX:r.left+m[0],clientY:r.top+m[1],pointerId:1,preventDefault(){},button:0});__gs.lgz.drag.m=[m[0]+75,m[1]];__gs.lgzApply();const range1=L.range;
   const q2=G.gz.sz.find(q=>q.id==='cone'),cone0=L.cone??35;__gs.lgzUp();__gs.lgzDown(hit,{clientX:r.left+q2.at[0],clientY:r.top+q2.at[1],pointerId:1,preventDefault(){},button:0});__gs.lgz.drag.m=[q2.at[0],q2.at[1]+20];__gs.lgzApply();const cone1=L.cone;__gs.lgzUp();
   return {ids,part,range0,range1,cone0,cone1};});
 ok(r2.ids&&r2.ids.includes('reach')&&r2.ids.includes('cone'),'a spot shows Reach and Cone handles '+JSON.stringify(r2.ids));
 ok(r2.part==='sz:reach'&&r2.range1>r2.range0*1.5,'dragging Reach out makes the light reach further '+r2.range0+' → '+r2.range1);
 ok(r2.cone1>r2.cone0,'dragging Cone changes the spot cone '+r2.cone0+' → '+r2.cone1);
 /* more skies: a made-up Poly Haven */
 const sk=await p.evaluate(async()=>{__gs.platform.isDesktop=true;
   const hdr=new Uint8Array([...new TextEncoder().encode('#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y 2 +X 4\n'),...Array.from({length:8},()=>[128,160,200,129]).flat()]);
   __gs.platform.invoke=async(cmd,a)=>{if(cmd==='net_get_text'){if(a.url.includes('/assets'))return JSON.stringify({test_sky:{name:'Test Sky',categories:['outdoor','skies'],tags:['sunset'],authors:{Someone:'x'},thumbnail_url:'about:blank',download_count:5,max_resolution:[4096,2048]}});
       return JSON.stringify({hdri:{'2k':{hdr:{url:'https://x/test_2k.hdr'}},'1k':{hdr:{url:'https://x/test_1k.hdr'}}}});}
     if(cmd==='net_download')return hdr.buffer.slice(0);throw new Error('no '+cmd);};
   __gs.dlgMoreSkies();await new Promise(r=>setTimeout(r,400));const tiles=document.querySelectorAll('#hvGrid .hvtile').length;
   document.querySelector('#hvGrid .hvget').click();await new Promise(r=>setTimeout(r,1500));
   return {tiles,in:__gs.ENV_LIST.some(e=>e[0]==='ph_test_sky'),env:__gs.v3s().env,by:(__gs.ENV_LIST.find(e=>e[0]==='ph_test_sky')||[])[3],mine:__gs.hv.mine.length,err:__gs.hv.err,stored:!!(await __gs.aiDB.get('hdri/test_sky_2k.hdr'))};});
 ok(sk.tiles===1,'the sky list shows the Poly Haven skies '+JSON.stringify(sk));ok(sk.in&&sk.mine===1&&sk.stored,'a downloaded sky is kept and listed');ok(sk.env==='ph_test_sky','the new sky is used at once');ok(sk.by==='Someone','its creator is kept');
 await p.evaluate(()=>{document.querySelector('#modal .dialog button.cancel,#modal [data-cancel]')?.click();});
 /* Eye shader */
 const eye=await p.evaluate(()=>{__gs.cmdNewFillLayer({name:'Eye',maps:{base:{c:[.8,.5,.2]}}});const sh=__gs.SHADERS.map(x=>x[0]);__gs.doc.v3shade={kind:'eye',p:{}};__gs.renderShading();__gs.v3.dirty=true;__gs.requestRender(true);return {has:sh.includes('eye'),idx:sh.indexOf('eye'),ui:!!document.getElementById('sh_iris'),pick:!!document.getElementById('eyePick'),pre:!!document.getElementById('shPre_human')};});
 await W(1200);
 ok(eye.has&&eye.idx===20,'Eye is a shader in the list (index 20)');ok(eye.ui&&eye.pick&&eye.pre,'its settings, Pick button and presets show '+JSON.stringify(eye));
 const box=await p.locator('#gl').boundingBox(),hash=async()=>crypto.createHash('md5').update(await p.screenshot({clip:box,timeout:120000})).digest('hex');
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'eye',p:{eye:{iris:.7}}};__gs.v3.dirty=true;__gs.requestRender(true);});await W(900);const h1=await hash();await p.evaluate(()=>{__gs.doc.v3shade={kind:'eye',p:{eye:{iris:.7,depth:1,pupil:.9,limbal:1,tint:[1,0,0]}}};__gs.v3.dirty=true;__gs.requestRender(true);});await W(900);const h2=await hash();
 ok(h1!==h2,'changing depth, pupil and ring changes the picture');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
