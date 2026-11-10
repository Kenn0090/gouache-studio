/* 0.95.8 (Kenn's round): M = Material lit, lights (instant preview, gizmo, Delete), shorter menus, Convolution kernel,
   mesh maps from the normal map, 3D gradient (mask generator and layer), wireframe colour */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* ---- menus ---- */
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'r958',false));await W(300);
 const file=await p.evaluate(()=>{const l=__gs.menuList(__gs.MENUS.File,'File');return l.map(e=>e.textContent.trim()).filter(Boolean);});
 ok(file.some(t=>t.startsWith('Export'))&&file.some(t=>t.startsWith('Import'))&&!file.some(t=>/Welcome screen|Launch screen/.test(t))&&file.length<=16,'File menu is grouped ('+file.length+' lines): '+file.join(' | '));
 const help=await p.evaluate(()=>__gs.menuList(__gs.MENUS.Help,'Help').map(e=>e.textContent));ok(help.some(t=>/Launch screen/.test(t))&&help.some(t=>/Welcome screen/.test(t)),'Welcome and Launch screens are in Help');
 await p.evaluate(()=>{__gs.act('addLayer');__gs.showPanel('layers');});await W(200);
 await p.click('#layerList .lrow.sel',{button:'right'}).catch(()=>p.click('#layerList .lrow',{button:'right'}));await W(200);
 const lm=await p.evaluate(()=>[...document.querySelectorAll('#menuPop > .mi')].map(b=>b.textContent.replace('▸','').trim()));
 ok(lm.length<=15&&lm.some(t=>t.startsWith('Add white mask'))&&lm.some(t=>t.startsWith('Add black mask'))&&lm.some(t=>t.startsWith('Filters and effects'))&&lm.some(t=>t.startsWith('Duplicate')),'layer menu is short ('+lm.length+'): '+lm.join(' | '));
 await p.keyboard.press('Escape');await p.mouse.click(5,450);await W(100);
 /* ---- Transform on a material moves what was painted ---- */
 const xt=await p.evaluate(()=>{const G=__gs;G.cmdNewFillLayer({name:'Mat',maps:{base:{c:[1,0,0]}}});const L=G.doc.active;G.cmdAddMask(0);
   const m=L.mask.target,W=G.doc.w,px=new Uint8Array(W*W*4);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const on=x>=10&&x<40&&y>=10&&y<40;px.set(on?[255,255,255,255]:[0,0,0,255],(y*W+x)*4);}
   const tx=G.uploadStraight({data:px,w:W,h:W});G.blit?0:0;G.premultInto(m,tx,[0,0],null);L.editMask=false;G.renderLayers();
   const ok0=G.xfStart();if(!ok0)return {err:'no xf'};G.xf.q=G.xf.q.map(v=>v+50);G.xfRender(false);G.xfCommit();
   const d=G.captureRegionNow(m,0,0,W,W).data,at=(x,y)=>d[(y*W+x)*4];const base=G.captureRegionNow(G.mapT(L,'base'),0,0,W,W).data;
   return {old:at(20,20),moved:at(70,70),out:at(110,110),baseOld:base[(20*W+20)*4]};});
 ok(xt.old<20&&xt.moved>230&&xt.out<20,'Transform on a material moves its painted area and keeps the rest hidden '+JSON.stringify(xt));
 /* ---- convolution ---- */
 const cv=await p.evaluate(()=>{const G=__gs,s=G.makeTarget(32,32,8,false),a=G.makeTarget(32,32,8,false),c=G.makeTarget(32,32,8,false);G.clearTarget(s,[.2,.2,.2,1]);
   const px=new Uint8Array(32*32*4);for(let i=0;i<32*32;i++){const x=i%32;px.set(x<16?[50,50,50,255]:[200,200,200,255],i*4);}const t=G.uploadStraight({data:px,w:32,h:32});G.premultInto(s,t,[0,0],null);
   G.convRun(s,a,{n:3,k:G.CONV_PRESETS.identity[2],divAuto:true,lum:true,mix:1});G.convRun(s,c,{n:3,k:G.CONV_PRESETS.edges[2],divAuto:true,abs:true,lum:false,mix:1});
   const A=G.captureRegionNow(a,0,0,32,32).data,C=G.captureRegionNow(c,0,0,32,32).data,r=x=>(16*32+x)*4;return {id:[A[r(4)],A[r(28)]],edge:[C[r(4)],C[r(15)],C[r(16)],C[r(28)]],fx:!!G.FX.convolve,mask:G.MS_FILTERS.includes('convolve')};});
 ok(cv.fx&&cv.mask&&Math.abs(cv.id[0]-50)<4&&Math.abs(cv.id[1]-200)<4,'Convolution: the "Nothing" kernel keeps the picture '+JSON.stringify(cv.id));
 ok(cv.edge[0]<10&&cv.edge[3]<10&&Math.max(cv.edge[1],cv.edge[2])>100,'Convolution: the Edges kernel finds the edge only '+JSON.stringify(cv.edge));
 /* ---- 3D Paint: M key, 3D gradient ---- */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const G=__gs;G.v3s().model='sphere';G.v3.mesh=null;G.v3.dirty=true;G.requestRender(true);});await W(1500);
 await p.evaluate(()=>{__gs.v3s().channelView='rough';__gs.v3.dirty=true;});await p.mouse.move(400,450);await p.keyboard.press('m');await W(200);
 ok(await p.evaluate(()=>!__gs.v3s().channelView),'M goes back to the lit material in 3D Paint');
 await p.evaluate(()=>__gs.cmdNewG3dLayer());await W(800);
 const g=await p.evaluate(()=>{const G=__gs,L=G.doc.active,T=G.mapT(L,'base'),d=G.captureRegionNow(T,0,0,T.w,T.h).data;let r=0,bl=0;for(let i=0;i<d.length;i+=4){if(d[i]>d[i+2]+40)r++;if(d[i+2]>d[i]+40)bl++;}return {r,bl,n:d.length/4,src:L.fill.maps.base.src,pts:L.fill.g3.pts.length};});
 ok(g.src==='g3d'&&g.pts===2&&g.r>g.n*.1&&g.bl>g.n*.1,'3D gradient layer: warm and cool regions on the model '+JSON.stringify(g));
 await p.evaluate(()=>{__gs.g3.sel=0;__gs.v3.dirty=true;__gs.requestRender(true);});await W(500);
 const gg=await p.evaluate(()=>{const G=__gs.g3Geom(document.getElementById('v3Hit'));return G?{n:G.items.length,ax:G.gz?G.gz.ax.length:0,p:G.items[0].p,ax0:G.gz&&(G.gz.ax.find(a=>a.k===0)||{}).end}:null;});
 ok(gg&&gg.n===2&&gg.ax>=2,'the points show in the 3D view with move arrows '+JSON.stringify(gg&&{n:gg.n,ax:gg.ax}));
 if(gg&&gg.ax0){const hb=await p.locator('#v3Hit').boundingBox(),y0=await p.evaluate(()=>__gs.doc.active.fill.g3.pts[0].p[0]);
   const a=gg.p,e=gg.ax0,m=[a[0]+(e[0]-a[0])*.6,a[1]+(e[1]-a[1])*.6];await p.mouse.move(hb.x+m[0],hb.y+m[1]);await p.mouse.down();await p.mouse.move(hb.x+m[0]+60,hb.y+m[1],{steps:6});await p.mouse.up();await W(500);
   const y1=await p.evaluate(()=>__gs.doc.active.fill.g3.pts[0].p[0]);ok(y1>y0+.05,'dragging the red arrow moves the point along X ('+y0.toFixed(2)+' → '+y1.toFixed(2)+')');
   await p.keyboard.press('Control+z');await W(400);const y2=await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.fill?__gs.doc.active.fill.g3.pts[0].p[0]:-9);ok(Math.abs(y2-y0)<1e-3,'one undo puts it back');}
 /* as a mask generator */
 await p.evaluate(()=>{const G=__gs;G.selectOnly(G.layerByName('Paint'));G.msAdd(G.doc.active,'g3d');});await W(800);
 const mk=await p.evaluate(()=>{const G=__gs,L=G.doc.active;G.compositeMap('base');const t=L.mask.target,d=G.captureRegionNow(t,0,0,t.w,t.h).data;let hi=0,lo=0;for(let i=0;i<d.length;i+=4){if(d[i]>200)hi++;if(d[i]<55)lo++;}return {hi,lo,n:d.length/4,kind:L.mask.stack.map(r=>r.kind)};});
 ok(mk.kind.includes('g3d')&&mk.hi>mk.n*.05&&mk.lo>mk.n*.05,'3D gradient mask row: white and black regions '+JSON.stringify(mk));
 /* ---- mesh maps from the normal map ---- */
 const mn=await p.evaluate(async()=>{const G=__gs,W=G.doc.w,H=G.doc.h,t=G.makeTarget(W,H,8,false),px=new Uint8Array(W*H*4);
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){const nx=Math.sin(x/W*Math.PI*8)*.6,ny=0,nz=Math.sqrt(1-nx*nx);px.set([(nx*.5+.5)*255,128,(nz*.5+.5)*255,255],(y*W+x)*4);}
   const tx=G.uploadStraight({data:px,w:W,h:H});G.premultInto(t,tx,[0,0],null);G.doc.meshMaps=G.doc.meshMaps||{};G.doc.meshMaps.normal=t;G.doc.meshMapInfo=G.doc.meshMapInfo||{};G.doc.meshMapInfo.normal={name:'mine_normal.png',w:W,h:H};
   G.p3bk.fromN={curv:'normal',ao:'normal'};await G.p3DeriveSets(['curv','ao'],[G.doc.name]);const M=G.doc.meshMaps,c=M.curv&&G.captureRegionNow(M.curv,0,0,M.curv.w,M.curv.h).data;let mn2=255,mx=0;if(c)for(let i=0;i<c.length;i+=4){mn2=Math.min(mn2,c[i]);mx=Math.max(mx,c[i]);}
   return {curv:!!M.curv,edge:!!M.curvEdge,ao:!!M.ao,range:mx-mn2,name:G.doc.meshMapInfo.curv&&G.doc.meshMapInfo.curv.name};});
 ok(mn.curv&&mn.edge&&mn.ao&&mn.range>40,'curvature (with edges) and AO made from the imported normal map '+JSON.stringify(mn));
 /* ---- wireframe colour ---- */
 ok(await p.evaluate(()=>{const s=document.getElementById('v3Settings');if(s)s.hidden=false;const ok=!!document.getElementById('v3WireCol');if(s)s.hidden=true;return ok;}),'the 3D settings have a Wireframe colour button');
 /* ---- lights in the Bake tab ---- */
 await p.click('#modeTabs [data-mode=bake]');await W(1500);
 await p.evaluate(()=>{const G=__gs;for(const g of G.dk.L.groups)g.min=!g.tabs.includes('bake');G.showPanel('bake');G.v3s().model='sphere';G.bakeCfg.low=null;G.bakeCfg.tab='light';
   G.lightRig().lights=[G.lightNew('point',{name:'Bulb',int:1.5,rays:2}),G.lightNew('spot',{name:'Spot',rays:2})];G.lightRig().sel=G.lightRig().lights[1].id;G.buildBakePanel();G.v3.dirty=true;G.requestRender(true);});await W(300);
 const inst=await p.evaluate(()=>({on:__gs.lpInstant(),n:__gs.lightViewUniforms().uVLN.int}));
 ok(inst.on&&inst.n===2,'while the rig is being changed the model is lit live by the lights '+JSON.stringify(inst));
 await p.mouse.move(700,450);await W(100);
 const lg=await p.evaluate(()=>{const G=__gs.lgzGeom(document.getElementById('v3Hit'));return G&&G.gz?{ax:G.gz.ax.length,ring:G.gz.ring,p:G.gz.it.p}:null;});
 ok(lg&&lg.ax===3&&lg.ring>0,'the selected spot has move arrows and a turn ring '+JSON.stringify(lg));
 if(lg){const hb=await p.locator('#v3Hit').boundingBox(),a0=await p.evaluate(()=>__gs.lightAim(__gs.lightRig().lights[1]));
   await p.mouse.move(hb.x+lg.p[0]+lg.ring,hb.y+lg.p[1]);await p.mouse.down();await p.mouse.move(hb.x+lg.p[0]+lg.ring+50,hb.y+lg.p[1]+20,{steps:5});await p.mouse.up();await W(300);
   const a1=await p.evaluate(()=>__gs.lightAim(__gs.lightRig().lights[1]));ok(Math.hypot(a1[0]-a0[0],a1[1]-a0[1],a1[2]-a0[2])>.2,'dragging the ring turns the spot');}
 await p.mouse.move(700,450);await p.keyboard.press('Delete');await W(300);
 ok(await p.evaluate(()=>__gs.lightRig().lights.length===1&&__gs.lightRig().lights[0].name==='Bulb'),'Delete removes the selected light');
 for(let i=0;i<200;i++){if(await p.evaluate(()=>!__gs.lpInstant()))break;await W(250);}
 ok(await p.evaluate(()=>!__gs.lpInstant()&&__gs.lightViewUniforms().uVLN.int===0),'after a pause the shadowed bake preview takes over');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
