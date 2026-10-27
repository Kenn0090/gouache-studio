/* 0.79: the painted-look layers on a real model with real baked mesh maps (the 3D Paint preview model: its shipped AO, normal,
   curvature, height and thickness maps, plus a world normal and position baked in the app). Each layer must follow those maps.
   SHOTS=<folder> also saves pictures of the 3D view. */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/',SHOTS=process.env.SHOTS||'';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:1024,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const waitIdle=async()=>{for(let i=0;i<1200;i++){if(await p.evaluate(()=>!__gs.bk.busy&&!__gs.bk.regionBusy&&!document.querySelector('.loadbar:not([hidden])')))return;await W(100);}};
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.getByRole('button',{name:'Unlit',exact:true}).first().click().catch(()=>{});
 const shot=async name=>{if(!SHOTS)return;await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:.7,pitch:.3});__gs.v3.dirty=true;});await W(4000);const bx=await p.locator('#pane3d').boundingBox();await p.screenshot({path:SHOTS+'/'+name+'.png',clip:bx,timeout:180000});};
 /* the real mesh maps */
 await p.click('#p3PreviewMaps');
 for(let i=0;i<900;i++){if(await p.evaluate(()=>__gs.allNodes(__gs.doc.root).some(n=>n.name==='Preview mesh material')))break;await W(200);}
 await W(1500);
 await p.evaluate(()=>__gs.p3Bake(['wnormal','position'],1024,__gs.p3.sets.map(s=>s.name)));await W(1000);await waitIdle();await W(1500);
 const keys=await p.evaluate(()=>Object.keys(__gs.doc.meshMaps||{}).sort().join());
 ok(['ao','curv','normal','thick','wnormal','position'].every(k=>keys.split(',').includes(k)),'the preview model has real mesh maps: '+keys);
 await shot('0-preview-material');
 /* reading the result and the baked maps, texel by texel */
 const stats=()=>p.evaluate(()=>{const G=__gs,M=G.doc.meshMaps,w=G.doc.w,h=G.doc.h;G.changedAll&&G.changedAll();G.composite();
   const t=G.compositeMap('base'),c=G.captureRegionNow(t,0,0,w,h).data;G.release(t);
   const rd=k=>M[k]?G.captureRegionNow(M[k],0,0,w,h).data:null,ao=rd('ao'),cv=rd('curv'),wn=rd('wnormal');
   const L=i=>c[i]*.299+c[i+1]*.587+c[i+2]*.114,acc={aoLo:[0,0],aoHi:[0,0],up:[0,0],dn:[0,0],edge:[0,0],flat:[0,0]},add=(a,v)=>{a[0]+=v;a[1]++;};
   for(let i=0;i<c.length;i+=16){if(c[i+3]<200||(wn&&wn[i+3]<200))continue;const l=L(i);
     if(ao){if(ao[i]<120)add(acc.aoLo,l);else if(ao[i]>235)add(acc.aoHi,l);}
     if(wn){if(wn[i+1]>215)add(acc.up,l);else if(wn[i+1]<40)add(acc.dn,l);}
     if(cv){if(cv[i]>170)add(acc.edge,l);else if(Math.abs(cv[i]-128)<6)add(acc.flat,l);}}
   const m=a=>a[1]?+(a[0]/a[1]).toFixed(1):null,o={};for(const k in acc)o[k]=m(acc[k]),o[k+'N']=acc[k][1];return o;});
 const gap=s=>({ao:s.aoHi-s.aoLo,up:s.up-s.dn,edge:s.edge-s.flat});
 /* one effect on its own: the change it makes in crevices vs open parts, on edges vs flat parts, facing up vs down */
 const snap=()=>p.evaluate(()=>{const G=__gs,w=G.doc.w,h=G.doc.h;G.changedAll&&G.changedAll();G.composite();const t=G.compositeMap('base'),c=G.captureRegionNow(t,0,0,w,h).data;G.release(t);window.__snap=c;});
 const delta=()=>p.evaluate(()=>{const G=__gs,M=G.doc.meshMaps,w=G.doc.w,h=G.doc.h,A=window.__snap;G.changedAll&&G.changedAll();G.composite();const t=G.compositeMap('base'),B=G.captureRegionNow(t,0,0,w,h).data;G.release(t);
   const rd=k=>G.captureRegionNow(M[k],0,0,w,h).data,ao=rd('ao'),cv=rd('curv'),wn=rd('wnormal'),L=(c,i)=>c[i]*.299+c[i+1]*.587+c[i+2]*.114;
   const acc={crev:[0,0],open:[0,0],edge:[0,0],flat:[0,0],up:[0,0],dn:[0,0]},add=(a,v)=>{a[0]+=v;a[1]++;};
   for(let i=0;i<B.length;i+=8){if(B[i+3]<200||wn[i+3]<200)continue;const d=L(B,i)-L(A,i);
     if(ao[i]<170)add(acc.crev,d);else if(ao[i]>240)add(acc.open,d);if(cv[i]>150)add(acc.edge,d);else if(Math.abs(cv[i]-128)<6)add(acc.flat,d);
     if(wn[i+1]>215)add(acc.up,d);else if(wn[i+1]<40)add(acc.dn,d);}
   const m=a=>a[1]?+(a[0]/a[1]).toFixed(1):0,o={};for(const k in acc){o[k]=m(acc[k]);o[k+'N']=acc[k][1];}return o;});
 const setL=o=>p.evaluate(o=>{const L=__gs.doc.active;Object.assign(L.fx.stack[0].v,o);L.lookVer=(L.lookVer||0)+1;},o);
 const s0=await stats();console.log('  preview material alone:',JSON.stringify(gap(s0)),JSON.stringify(s0));
 ok(s0.aoLoN>50&&s0.upN>50&&s0.dnN>50&&s0.edgeN>20,'enough texels in crevices, facing up and down, and on edges to measure');
 const done=async()=>{const bt=p.getByRole('button',{name:'Done',exact:true});if(await bt.count())await bt.first().click();await W(300);};
 const hideTop=()=>p.evaluate(()=>{const L=__gs.doc.active;L.visible=false;__gs.changedAll&&__gs.changedAll();});
 /* without the mesh maps (to see what they add) */
 const noMaps=async fn=>p.evaluate(async()=>{window.__mm=__gs.doc.meshMaps;__gs.doc.meshMaps={};__gs.msEpoch&&0;}).then(fn).finally(()=>p.evaluate(()=>{__gs.doc.meshMaps=window.__mm;}));
 const bump=()=>p.evaluate(()=>{const L=__gs.doc.active;L.lookVer=(L.lookVer||0)+1;});
 /* ---- Hand-painted, paint over the material ---- */
 await p.evaluate(()=>__gs.cmdNewHandPaintLayer());await W(800);await done();
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;Object.assign(v,{own:false,sAmt:0,lEl:80,lTurn:0});});await bump();
 const s1=await stats(),g1=gap(s1);console.log('  Hand-painted:',JSON.stringify(g1));
 await setL({aoAmt:0});await snap();await setL({aoAmt:1});let D=await delta();console.log('  Hand-painted AO alone:',JSON.stringify(D));
 ok(D.crevN>50&&D.crev<D.open-8,'Hand-painted: the baked AO darkens crevices (crevices '+D.crev+' vs open '+D.open+')');
 await setL({edgeAmt:0});await snap();await setL({edgeAmt:1,edgeSpread:.6});D=await delta();console.log('  Hand-painted edges alone:',JSON.stringify(D));
 ok(D.edgeN>50&&D.edge>D.flat+5,'Hand-painted: the baked curvature lightens edges (edges +'+D.edge+' vs flat +'+D.flat+')');
 await setL({edgeAmt:.5,edgeSpread:.4,aoAmt:.7});
 ok(g1.up>gap(s0).up+15,'Hand-painted: faces the baked world normal points up get the light ('+gap(s0).up.toFixed(0)+' → '+g1.up.toFixed(0)+')');
 const src=await p.evaluate(()=>__gs.hpSources(__gs.doc.active));ok(/baked world normal/.test(src)&&/baked position/.test(src)&&/baked AO/.test(src)&&/baked curvature/.test(src)&&/baked thickness/.test(src),'Hand-painted reads every baked map: '+src);
 await shot('1-hand-painted');
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;Object.assign(v,{sAmt:.7});});await bump();await shot('1b-hand-painted-strokes');
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;Object.assign(v,{sAmt:0});});await bump();
 let n1;await noMaps(async()=>{await bump();n1=await stats();});await bump();
 ok(Math.abs(gap(n1).ao-g1.ao)>5||Math.abs(gap(n1).edge-g1.edge)>5,'Hand-painted changes when the mesh maps are taken away, so it really reads them (AO gap '+gap(n1).ao.toFixed(0)+' vs '+g1.ao.toFixed(0)+')');
 await hideTop();
 /* ---- Stylize (Painter style) ---- */
 await p.evaluate(()=>__gs.cmdNewStylizePLayer());await W(800);await done();
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;Object.assign(v,{lighting:1,lV:80,lH:0,dI:.8,edges:1,aoO:1,eO:.8});});await bump();
 const s2=await stats(),g2=gap(s2);console.log('  Stylize (Painter style):',JSON.stringify(g2));
 ok(g2.up>gap(s0).up+15,'Painter style: baked lighting follows the baked world normal ('+gap(s0).up.toFixed(0)+' → '+g2.up.toFixed(0)+')');
 await setL({edges:0});await snap();await setL({edges:1,aoO:1,eO:0,cO:0});let E=await delta();console.log('  Painter AO alone:',JSON.stringify(E));
 ok(E.crevN>50&&E.crev<E.open-8,'Painter style: edges and cavities darken the baked AO crevices (crevices '+E.crev+' vs open '+E.open+')');
 await setL({edges:0});await snap();await setL({edges:1,aoO:0,eO:1,eW:.6,cO:0});E=await delta();console.log('  Painter edges alone:',JSON.stringify(E));
 ok(E.edgeN>50&&E.edge>E.flat+5,'Painter style: the baked curvature lightens edges (edges +'+E.edge+' vs flat +'+E.flat+')');
 await setL({edges:.6,aoO:.6,eO:.6,cO:.6,eW:.4});
 await shot('2-stylize-painter');
 await hideTop();
 /* ---- Stylize (Gouache) ---- */
 await p.evaluate(()=>__gs.cmdNewStylizeLayer());await W(800);await done();
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;Object.assign(v,{meshLight:1,meshEdge:1,mlEl:80,mlTurn:0});});await bump();
 const s3=await stats(),g3=gap(s3);console.log('  Stylize (Gouache):',JSON.stringify(g3));
 ok(g3.up>gap(s0).up+15,'Gouache: baked lighting follows the baked world normal ('+gap(s0).up.toFixed(0)+' → '+g3.up.toFixed(0)+')');
 await setL({meshEdge:0});await snap();await setL({meshEdge:1});const E3=await delta();console.log('  Gouache edges/cavities alone:',JSON.stringify(E3));
 ok(E3.crevN>50&&E3.crev<E3.open-5,'Gouache: crevices from the baked AO are darker (crevices '+E3.crev+' vs open '+E3.open+')');
 await shot('3-stylize-gouache');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
