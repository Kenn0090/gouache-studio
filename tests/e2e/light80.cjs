/* 0.80: the Lighting bake: a light rig (sun, point, spot, sky) baked onto the model with soft shadows; sent to 3D Paint as a
   mesh map and a Multiply layer; the Hand-painted layer lights the model with it; the rig's tab and gizmo in the Bake tab */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 const bake=async ks=>{await p.evaluate(ks=>__gs.p3Bake(ks,256,__gs.p3.sets.map(s=>s.name)),ks);await W(800);
   for(let i=0;i<1500;i++){if(await p.evaluate(()=>!__gs.bk.busy))break;await W(200);}await W(1200);};
 const setRig=o=>p.evaluate(o=>{const G=__gs,R=G.lightRig();R.lights=o.map(x=>G.lightNew(x.type,x));R.expo=1;},o);
 /* a sun straight from above, with shadows */
 await setRig([{type:'sun',el:70,turn:0,int:1,soft:2,rays:8,shadow:true}]);
 await bake(['light','wnormal']);
 const has=await p.evaluate(()=>!!(__gs.doc.meshMaps&&__gs.doc.meshMaps.light&&__gs.doc.meshMaps.wnormal));
 ok(has,'the Lighting bake lands in 3D Paint as a mesh map');
 const stat=()=>p.evaluate(()=>{const G=__gs,M=G.doc.meshMaps,w=G.doc.w,h=G.doc.h,l=G.captureRegionNow(M.light,0,0,w,h).data,n=G.captureRegionNow(M.wnormal,0,0,w,h).data;
   let up=0,un=0,dn=0,dnn=0,all=0,an=0,shadowed=0,facing=0;for(let i=0;i<l.length;i+=4){if(n[i+3]<200)continue;const v=l[i];all+=v;an++;
     if(n[i+1]>215){up+=v;un++;}else if(n[i+1]<40){dn+=v;dnn++;}if(n[i+1]>190){facing++;if(v<60)shadowed++;}}
   return {up:up/Math.max(1,un),dn:dn/Math.max(1,dnn),all:all/Math.max(1,an),un,dnn,shadowed,facing};});
 const s1=await stat();console.log('  sun from above, shadows:',JSON.stringify(s1));
 ok(s1.un>20&&s1.dnn>20&&s1.up>s1.dn+80,'parts facing up are lit, parts facing down are dark ('+s1.up.toFixed(0)+' vs '+s1.dn.toFixed(0)+')');
 const layer=await p.evaluate(()=>{const L=__gs.allNodes(__gs.doc.root).find(n=>n.meshMap==='light');return L?{name:L.name,mode:__gs.MODES[L.mode],vis:L.visible}:null;});
 ok(layer&&layer.mode==='Multiply'&&layer.vis,'and as a Multiply layer you can paint on: '+JSON.stringify(layer));
 /* the same without shadows: more light (the rim of the model shades its inside) */
 await p.evaluate(()=>{__gs.lightRig().lights[0].shadow=false;});await bake(['light','wnormal']);
 const s2=await stat();console.log('  no shadows:',JSON.stringify(s2));
 ok(s2.all>s1.all+1&&s1.shadowed>s2.shadowed,'shadows: the model shades itself (mean light '+s1.all.toFixed(1)+' with, '+s2.all.toFixed(1)+' without; shadowed upward texels '+s1.shadowed+' vs '+s2.shadowed+')');
 /* a sun from below: the other way round */
 await setRig([{type:'sun',el:-70,turn:0,int:1,shadow:false}]);await bake(['light','wnormal']);const s3=await stat();
 ok(s3.dn>s3.up+80,'a sun from below lights the underside ('+s3.dn.toFixed(0)+' vs '+s3.up.toFixed(0)+')');
 /* point, spot and sky add light; a light turned off adds none */
 await setRig([{type:'sky',int:.6,rays:12}]);await bake(['light','wnormal']);const sk=await stat();ok(sk.all>40,'the sky lights everything a little ('+sk.all.toFixed(0)+')');
 await p.evaluate(()=>{__gs.lightRig().lights[0].on=false;});await bake(['light','wnormal']);const off=await stat();ok(off.all<3,'a light turned off adds nothing ('+off.all.toFixed(1)+')');
 await p.evaluate(()=>{const G=__gs,R=G.lightRig(),b={c:[0,0,0]};R.lights=[G.lightNew('point',{pos:[0,3,0],int:3,range:4,shadow:false}),G.lightNew('spot',{pos:[0,-3,0],int:3,range:4,cone:60,shadow:false})];});
 await bake(['light','wnormal']);const ps=await stat();ok(ps.up>30&&ps.dn>30,'a point light above and a spot below light both sides ('+ps.up.toFixed(0)+', '+ps.dn.toFixed(0)+')');
 /* the Hand-painted layer lights the model with the baked map */
 await setRig([{type:'sun',el:70,turn:0,int:1,shadow:true,rays:8}]);await bake(['light','wnormal']);
 await p.evaluate(()=>__gs.cmdNewHandPaintLayer());await W(600);{const bt=p.getByRole('button',{name:'Done',exact:true});if(await bt.count())await bt.first().click();}await W(300);
 const src=await p.evaluate(()=>__gs.hpSources(__gs.doc.active));ok(/baked Lighting/.test(src),'the Hand-painted layer reads the baked Lighting: '+src);
 const cmp=await p.evaluate(()=>{const G=__gs,L=G.doc.active,v=L.fx.stack[0].v,w=G.doc.w,h=G.doc.h;Object.assign(v,{sAmt:0,varAmt:0,lEl:-60,lTurn:0});
   const rd=()=>{L.lookVer=(L.lookVer||0)+1;G.changedAll&&G.changedAll();G.composite();const t=G.compositeMap('base'),d=G.captureRegionNow(t,0,0,w,h).data;G.release(t);return d;};
   const a=rd();v.lightSrc='dir';const b=rd();let s=0;for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i]);return s/(a.length/4);});
 ok(cmp>5,'it lights the model differently from its own direction setting (difference '+cmp.toFixed(1)+')');
 /* the Bake tab: the Lighting tab, Auto rig and the lights in the view */
 await p.evaluate(()=>{__gs.bakeCfg.tab='light';__gs.lightRig().lights=[];});await p.click('#modeTabs [data-mode=bake]');await W(1500);await p.evaluate(()=>{for(const g of __gs.dk.L.groups)g.min=!g.tabs.includes('bake');__gs.showPanel('bake');});await W(300);await p.evaluate(()=>__gs.act('bake'));await W(500);
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#bakeBody .bktabs button')].find(b=>b.textContent.startsWith('Lighting'));if(b)b.click();});await W(400);
 ok(await p.locator('#lAuto').count()===1,'the Bake tab has a Lighting tab with Auto rig');
 await p.click('#lAuto');await W(400);
 const rig=await p.evaluate(()=>__gs.lightRig().lights.map(l=>l.name+':'+l.type).join());ok(/Key:sun/.test(rig)&&/Fill:sun/.test(rig)&&/Rim:sun/.test(rig)&&/Sky:sky/.test(rig),'Auto rig makes key, fill, rim and sky: '+rig);
 await p.click('#lAdd_point');await W(300);ok(await p.evaluate(()=>__gs.lightRig().lights.length===5),'+ Point adds a light');
 await W(800);const gz=await p.evaluate(()=>{const c=__gs.lgz.el;return !!(c&&!c.hidden);});ok(gz,'the lights are drawn in the 3D view');
 /* drag the point light: it moves */
 const G0=await p.evaluate(()=>{const g=__gs.lgzGeom(document.getElementById('v3Hit'));const it=g&&g.items.find(o=>o.L.type==='point');const r=document.getElementById('v3Hit').getBoundingClientRect();return it?{x:r.left+it.p[0],y:r.top+it.p[1],pos:it.L.pos.slice()}:null;});
 if(G0){await p.mouse.move(G0.x,G0.y);await p.mouse.down();await p.mouse.move(G0.x+60,G0.y-30,{steps:6});await p.mouse.up();await W(300);
   const pos=await p.evaluate(()=>__gs.lightRig().lights.find(l=>l.type==='point').pos);ok(Math.hypot(pos[0]-G0.pos[0],pos[1]-G0.pos[1],pos[2]-G0.pos[2])>.05,'dragging a light in the view moves it');}
 else ok(false,'the point light is on screen');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
