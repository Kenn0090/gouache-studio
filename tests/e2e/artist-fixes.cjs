/* Regressions for ordinary weld layers, mode-owned layouts, texture masks, lazy release, and UV-connected blur. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];
 p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.stack));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.prefs.level='full';document.body.classList.remove('lv-beginner');});
 const startupImport=await p.evaluate(async()=>{const g=__gs;g.setMode('paint');g.p3.started=false;g.p3.imported=null;g.v3.imported=null;g.v3.mesh=null;const mesh=g.parseOBJ(['v -1 -1 0','v 1 -1 0','v 1 1 0','v -1 1 0','vt 0 0','vt 1 0','vt 1 1','vt 0 1','f 1/1 2/2 3/3','f 1/1 3/3 4/4'].join('\n'),'Startup imported mesh');await g.p3NewProject(128,{modelKey:'imported',imported:mesh});return {model:g.v3s().model,imported:g.v3.imported?.name,viewport:g.v3.mesh?.name,replaceButton:!!document.getElementById('v3ReplaceModel')};});console.log('First project import',startupImport);ok(startupImport.model==='imported'&&startupImport.imported==='Startup imported mesh'&&startupImport.viewport==='Startup imported mesh'&&startupImport.replaceButton,'first 3D Paint project loads the selected mesh instead of the default plane');
 const weld=await p.evaluate(async()=>{const g=__gs;g.newDoc(128,128,8,null,'Weld mask',false);const original=g.doc.active;await g.weldUse(g.WELD_STYLES[0]);const L=g.materialBrushTarget(),same=g.materialBrushTarget()===L,et=g.editTarget(),o=g.paintOpts(et);Object.assign(o,{size:24,pSize:false,smoothing:0});g.beginStroke(et.L,25,64,1,o);const lazy=g.strokeNow().lazy;g.addPoint(95,64,1);g.endStroke(true);
  const coverage=g.captureRegionNow(L.mask.target,60,64,1,1).data[0],values={};for(const k of ['base','rough','metal','height']){const t=g.compositeMap(k);values[k]=Array.from(g.captureRegionNow(t,60,64,1,1).data);g.release(t);}
  await g.undo();const undo=g.captureRegionNow(L.mask.target,60,64,1,1).data[0]===0;await g.redo();const redo=g.captureRegionNow(L.mask.target,60,64,1,1).data[0]===coverage;
  g.selectOnly(original);g.cmdAddMask();original.editMask=true;const next=g.materialBrushTarget();return {same,values,coverage,undo,redo,lazy,mask:!!L.mask&&!!L.fill,mono:L.mask.target.mono,extras:o.extras.length,original:!original.fill,created:next!==original&&!!next.mask&&!!next.fill};});
 console.log('Weld',weld);ok(weld.same&&weld.mask&&weld.mono&&weld.coverage>0&&weld.values.metal[0]>0&&weld.values.height[0]>0&&weld.undo&&weld.redo&&weld.lazy&&weld.extras===0,'weld uses one shared mask, partial stroke capture and one undo across its material channels');ok(weld.original&&weld.created,'weld creates its own masked material without overwriting an existing pixel layer or mask');
 const deepMask=await p.evaluate(async()=>{const g=__gs;g.newDoc(128,128,16,null,'16-bit weld',false);await g.weldUse(g.WELD_STYLES[0]);const L=g.materialBrushTarget(),et=g.editTarget(),o=g.paintOpts(et);Object.assign(o,{size:18,pSize:false,smoothing:0});g.beginStroke(et.L,20,40,1,o);g.addPoint(90,40,1);g.endStroke(true);const value=g.captureRegionNow(L.mask.target,60,40,1,1).data[0];await g.undo();const undo=g.captureRegionNow(L.mask.target,60,40,1,1).data[0]===0;await g.redo();return {value,undo,redo:g.captureRegionNow(L.mask.target,60,40,1,1).data[0]===value,error:g.gl.getError(),maskDepth:L.mask.target.depth,maskMono:L.mask.target.mono};});console.log('Deep mask',deepMask);ok(deepMask.value>0&&deepMask.undo&&deepMask.redo&&deepMask.error===0,'16-bit weld mask retains coverage through undo and redo');
 const texture=await p.evaluate(async()=>{const g=__gs;g.newDoc(64,64,8,null,'Texture mask',false);const L=g.doc.active;g.cmdAddMask();L.editMask=true;const n=g.allLayers().length,it={kind:'gen',id:g.TX_GEN[0][0],name:g.TX_GEN[0][1]};await g.txClick(it);const maskCount=g.allLayers().length,rows=L.mask.stack?.length||L.mask.rows?.length||0,same=g.doc.active===L;
  L.editMask=false;g.ui.msSel=null;await g.txClick(it);return {n,maskCount,same,rows,layerCount:g.allLayers().length,selected:g.tx.selected,id:it.id};});
 console.log('Texture',texture);ok(texture.maskCount===texture.n&&texture.same&&texture.rows>1&&texture.layerCount===texture.n&&texture.selected==='gen:'+texture.id,'texture click adds to the selected mask, and a paint-mode click only selects the texture for drag-and-drop');
 const layouts=await p.evaluate(()=>{const g=__gs;g.setMode('paint');g.setWorkspace('minimal');g.dkMove('layers',{hidden:true});g.setMode('p3d');g.setWorkspace('minimal');const separate=!g.dk.L.hidden.includes('layers');g.dkMove('hist',{hidden:true});g.setMode('paint');const paint=g.dk.L.hidden.includes('layers')&&!g.dk.L.hidden.includes('hist');
  const options=Array.from(document.querySelector('#wsSel').options).filter(x=>x.value&&!x.value.startsWith(':')).map(x=>x.value);
  g.setMode('p3d');const model=!g.dk.L.hidden.includes('layers')&&g.dk.L.hidden.includes('hist');g.setMode('paint');g.setWorkspace('paint3d');return {separate,paint,model,options,canvas:!g.v3.on};});
 console.log('Layouts',layouts);ok(layouts.separate&&layouts.paint&&layouts.model,'closing panels in the same preset stays independent between Paint and 3D Paint');ok(!layouts.options.includes('texturing')&&!layouts.options.includes('paint3d')&&layouts.canvas,'Paint layout menu stays focused on the canvas');
 const pen=await p.evaluate(()=>__gs.pressureOf({pressure:.18},{pointerType:'pen',pressure:.75}));ok(Math.abs(pen-.18)<.001,'coalesced pen samples retain their own pressure');
 await p.evaluate(()=>{const g=__gs;g.setWorkspace('painting');g.newDoc(128,128,8,null,'Lazy release',false);g.setTool('brush');g.setFG([1,0,0]);Object.assign(g.brush,{size:8,hardness:1,flow:1,opacity:1,pSize:false,pOpacity:false,lazy:30,smoothing:.2,spacing:.1,tip:null});});
 const at=async(x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('stage').getBoundingClientRect(),v=__gs.view;return [r.left+v.x+x*v.zoom,r.top+v.y+y*v.zoom];},[x,y]);
 await p.mouse.move(...await at(20,64));await p.mouse.down();await p.mouse.move(...await at(95,64),{steps:12});await p.mouse.up();
 const lazy=await p.evaluate(()=>Array.from(__gs.captureRegionNow(__gs.doc.active.target,95,64,1,1).data));ok(lazy[3]===0,'releasing lazy mouse does not draw an abrupt tail to the raw cursor');
 await p.evaluate(()=>{
  const g=__gs;
  g.newDoc(128,128,8,null,'Color weld brush',false);
  g.setFG([.12,.75,.32]);g.setTool('erase');g.showPanel('brushes');
  window.colorWeldLayer=g.doc.active;
 });
 const weldNames=['Standard weld','Narrow weld','Sharp weld'];
 const libraryWelds=await p.locator('#libBody .libset').filter({has:p.getByRole('button',{name:'Fold or unfold Welds',exact:true})})
   .locator('.tiles button').evaluateAll(buttons=>buttons.map(b=>b.getAttribute('aria-label')));
 ok(libraryWelds.join('|')===weldNames.map(name=>'Weld · '+name).join('|'),'the Brushes library only offers the three new weld presets');
 await p.locator('#libBody').getByRole('button',{name:'Weld · Standard weld',exact:true}).click();
 await p.mouse.move(...await at(24,64));await p.mouse.down();await p.mouse.move(...await at(100,64),{steps:12});await p.mouse.up();
 const colorWeld=await p.evaluate(async()=>{
  const g=__gs,L=window.colorWeldLayer;
  const read=()=>g.captureRegionNow(L.target,60,64,1,1).data;
  const px=Array.from(read());
  const regular=g.ui.tool==='brush'&&g.brush.followDir&&g.brush.tip.name==='Weld tip · Standard weld'
    &&g.doc.active===L&&!L.fill&&!L.mask&&g.doc.maps.length===1;
  await g.undo();
  return {regular,px,undo:read()[3]===0};
 });
 console.log('Color weld',colorWeld);
 ok(colorWeld.regular&&colorWeld.px[3]>0&&colorWeld.px[1]>2*colorWeld.px[0]&&colorWeld.undo,
   'a weld preset switches to Brush and paints the foreground color directly on a 2D layer with undo');
 const seam=await p.evaluate(()=>{const g=__gs;g.setMode('p3d');g.v3s().detail=0;g.v3s().uvs=1;
  const obj=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0',
   'vt .05 .1','vt .4 .1','vt .4 .9','vt .05 .9','vt .6 .1','vt .95 .1','vt .95 .9','vt .6 .9',
   'f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 2/5 5/6 6/7','f 2/5 6/7 3/8'].join('\n');
  g.useModel(g.parseOBJ(obj));const S=g.doc.w,src=g.makeTarget(S,S,8,false),dst=g.makeTarget(S,S,8,false),px=new Uint8Array(S*S*4);
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){const u=(x+.5)/S,v=(y+.5)/S;if(v<.1||v>.9||!(u>=.05&&u<=.4||u>=.6&&u<=.95))continue;const i=(y*S+x)*4;px.set(u<.5?[255,0,0,255]:[0,0,255,255],i);}g.writeRegion(src,0,0,S,S,px);
  const lx=Math.floor(S*.4-.5),rx=Math.ceil(S*.6-.5),mid=Math.floor(S*.5),radius=S*.047;
  const used=g.meshConnectedBlur(src,dst,radius,radius,false),read=x=>Array.from(g.captureRegionNow(dst,x,mid,1,1).data),left=read(lx),right=read(rx),outside=read(Math.ceil(S*.05-.5));
  const box=g.meshConnectedBlur(src,dst,radius*2,radius*2,true),boxLeft=read(lx),boxRight=read(rx);
  const inPlace=g.meshConnectedBlur(src,src,radius,radius,false),inValue=Array.from(g.captureRegionNow(src,lx,mid,1,1).data);
  const height=g.makeTarget(S,S,16,false,true);g.run(g.P.shift,height,{uSrc:src.tex,uOff:[0,0],uWrap:false,uOutside:[0,0,0,0]});g.meshConnectedBlur(height,height,radius,radius,false);
  const heightValue=Array.from(g.readMapF(height,4).slice((mid*S+lx)*4,(mid*S+lx)*4+4));g.disposeTarget(height);
  g.writeRegion(src,0,0,S,S,px);g.seamBlurDispose();
  const ranges=g.v3.mesh.setRanges;
  g.v3.mesh.setRanges=[{name:g.p3Binding(g.p3.sets[g.p3.cur]),start:0,count:2}];
  g.meshConnectedBlur(src,dst,radius,radius,false);
  const isolated=read(lx);g.v3.mesh.setRanges=ranges;g.seamBlurDispose();
  const error=g.gl.getError();g.disposeTarget(src);g.disposeTarget(dst);return {used,left,right,outside,box,boxLeft,boxRight,inPlace,inValue,isolated,heightValue,error,size:S,mode:g.mode};});
 console.log('Seams',seam);ok(seam.used&&seam.left[2]>30&&seam.right[0]>30&&Math.abs(seam.left[0]-seam.right[2])<20,'Gaussian taps cross a geometric join between separated UV islands');ok(seam.left[3]>245&&seam.right[3]>245&&seam.outside[3]>245,'blur avoids dark or transparent atlas gutters');ok(seam.box&&seam.boxLeft[2]>30&&seam.boxRight[0]>30,'box blur also follows connected UV islands');ok(seam.inPlace&&Math.abs(seam.inValue[0]-seam.left[0])<3,'in-place seam blur avoids sampling its own output');ok(seam.isolated[2]<3&&seam.isolated[0]>245,'texture set boundary does not bleed into the adjacent set');ok(seam.heightValue[0]>.05&&seam.heightValue[0]<.95&&seam.heightValue[3]>.95,'packed height maps remain supported by in-place seam blur');ok(seam.error===0&&errors.length===0,'no WebGL or application errors');if(errors.length)console.log(errors);
 const tipCopy=await p.evaluate(()=>{const g=__gs,tip=g.weldTipGet(),t=g.pathTipCopy(tip),px=g.captureRegionNow(t,0,0,t.w,t.h).data;let delta=0;for(let i=0;i<tip.alpha.length;i++)delta=Math.max(delta,Math.abs(px[i*4+3]-tip.alpha[i]));g.disposeTarget(t);return delta;});ok(tipCopy<=1,'path tip alpha matches the original brush tip at every pixel');
 const weldPath=await p.evaluate(async()=>{
  const g=__gs,tig=g.WELD_STYLES.find(s=>s.id==='tig');
  await g.weldUse(g.WELD_STYLES.find(s=>s.id==='standard'));g.setTool('path');
  const L=g.pathNew('3d'),m=g.v3.mesh;
  // Recreate the saved recipe of a retired TIG path, including its original profile settings.
  Object.assign(g.weldOptions,{style:tig.id,width:tig.size,height:tig.height,spacing:tig.spacing,
    irregularity:tig.irregularity,heat:tig.heat,ripple:tig.ripple,roughness:tig.rough,
    sharpness:.72,edgeBlend:.42,fusion:.32});
  g.weldPathUpdate(L);
  g.pathChange(P=>{P.points=[[-.75,0,0],[.75,0,0]].map(p=>{const q=g.pathNearest(m,p);return {p:q.p,n:q.n,pressure:1,in:[0,0,0],out:[0,0,0]};});},'Weld route');
  const covered=()=>g.readRGBA8(g.mapT(L,'base')).reduce((n,v,i)=>n+(i%4===3&&v>0?1:0),0),before=covered();
  const S=g.doc.w,half=S/2,read=(k,x,y)=>g.readMapF(L.maps[k],4).slice((y*S+x)*4,(y*S+x)*4+4);
  const left=read('base',Math.floor(.4*S-.5),half),right=read('base',Math.ceil(.6*S-.5),half);
  const heights=g.readMapF(L.maps.height,4),ripple=[];
  for(let x=Math.ceil(.18*S);x<Math.floor(.33*S);x++)ripple.push(heights[(half*S+x)*4]);
  const sharpnessPixels=value=>{
    g.weldOptions.sharpness=value;g.weldPathUpdate(L);
    return g.readMapF(L.maps.height,4);
  };
  const soft=sharpnessPixels(0),crisp=sharpnessPixels(1);
  let detail=0;
  for(let x=Math.ceil(.18*S);x<Math.floor(.33*S);x++){
    const i=(half*S+x)*4;
    detail=Math.max(detail,Math.abs(crisp[i]-soft[i]));
  }
  g.weldOptions.sharpness=.72;g.weldPathUpdate(L);
  const countRipples=spacing=>{
    g.weldOptions.spacing=spacing;g.weldPathUpdate(L);
    const h=g.readMapF(L.maps.height,4);
    let count=0;
    for(let x=Math.ceil(.16*S);x<Math.floor(.37*S);x++){
      const i=(half*S+x)*4;
      if(h[i]>h[i-4]+.004&&h[i]>h[i+4]+.004)count++;
    }
    return count;
  };
  const normalSpacing=tig.spacing;
  const standardRipples=countRipples(normalSpacing),wideRipples=countRipples(.57);
  g.weldOptions.spacing=normalSpacing;g.weldPathUpdate(L);
  const rippleRange=()=>{
    const h=g.readMapF(L.maps.height,4),line=ripple.map((_,i)=>h[(half*S+Math.ceil(.18*S)+i)*4]);
    return Math.max(...line)-Math.min(...line);
  };
  const roughRange=rippleRange();
  g.weldOptions.smoothness=1;g.weldPathUpdate(L);
  const smoothRange=rippleRange();
  g.weldOptions.surface='paint';g.weldPathUpdate(L);
  const painted=['base','rough','metal'].every(k=>g.readMapF(L.maps[k],4).every((v,i)=>i%4!==3||v===0))
    &&read('height',Math.floor(.30*S),half)[0]>.55;
  const baseAt=()=>g.readMapF(L.maps.base,4);
  Object.assign(g.weldOptions,{surface:'metal',smoothness:0,heat:0,burn:0});g.weldPathUpdate(L);
  const noHalo=baseAt(),bareHeight=g.readMapF(L.maps.height,4);
  Object.assign(g.weldOptions,{heat:1,burn:.35,haloSpread:1});g.weldPathUpdate(L);
  const hasHalo=baseAt().some((v,i)=>i%4===3&&noHalo[i]===0&&v>.05);
  const haloHeight=g.readMapF(L.maps.height,4);
  const halo=hasHalo&&bareHeight.every((v,i)=>v===haloHeight[i]);
  const cleanTig=L.path.weld.pitting===0&&L.path.weld.spatter===0;
  const normalWidth=g.weldOptions.width;
  const defectHeight=(pitting,spatter)=>{
    Object.assign(g.weldOptions,{width:42,spacing:.45,pitting,spatter});
    g.weldPathUpdate(L);
    return g.readMapF(L.maps.height,4);
  };
  const clean=defectHeight(0,0),pitted=defectHeight(1,0),spattered=defectHeight(0,1);
  const pitting=clean.every((v,i)=>i%4!==3||v===pitted[i])
    &&pitted.some((v,i)=>i%4===0&&clean[i+3]>.99&&v<clean[i]-.003);
  const spatter=spattered.some((v,i)=>i%4===3&&v>.05&&clean[i]===0);
  Object.assign(g.weldOptions,{width:normalWidth,spacing:normalSpacing,pitting:0,spatter:0});
  Object.assign(g.weldOptions,{heat:tig.heat,burn:.12,haloSpread:.44});g.weldPathUpdate(L);
  const recipe=JSON.parse(JSON.stringify(L.path));g.weldOptions.width=36;g.weldPathUpdate(L);const wider=covered();g.pathRecord(L,recipe,'Weld width');await g.undo();const restored=covered();await g.redo();
  const saved=g.readMapF(L.maps.height,4);
  const blob=await g.encodeP3Project();g.p3.savedAt=g.p3Sig();await g.openP3Project(await blob.arrayBuffer(),'Weld path reopen');const R=g.allLayers().find(n=>n.path?.weld);
  return {plain:!L.fill&&!L.mask,before,wider,restored,seam:[left[3],right[3]],detail,roughRange,smoothRange,painted,halo,standardRipples,wideRipples,cleanTig,pitting,spatter,
    ripple:Math.max(...ripple)-Math.min(...ripple),
    reopened:!!R&&!R.fill&&!R.mask&&R.path.points.length===2&&R.path.weld.profile===1&&R.path.weld.style==='tig'
      &&R.path.weld.sharpness===.72&&g.readMapF(R.maps.height,4).every((v,i)=>v===saved[i])};});
 console.log('Weld path',weldPath);ok(weldPath.plain&&weldPath.before>0&&weldPath.wider>weldPath.before&&weldPath.restored===weldPath.before&&weldPath.reopened,'editable weld path has ordinary channels, live width, undo and saved recipe without a mask');
 ok(weldPath.seam.every(a=>a>.8)&&weldPath.ripple>.025,'the raised ripples cross the geometric join between separated UV islands');
 ok(weldPath.detail>.001,'Detail sharpness changes the height of the overlapping puddles');
 ok(weldPath.wideRipples>1&&weldPath.standardRipples>weldPath.wideRipples,
   'increasing spacing produces fewer raised ripples along the same path');
 ok(weldPath.smoothRange<weldPath.roughRange*.35&&weldPath.painted,
   'Smoothness removes the ripples and the painted finish leaves the underlying material channels alone');
 ok(weldPath.halo,'the independent burn halo colours the metal beside the weld without raising it');
 ok(weldPath.cleanTig&&weldPath.pitting&&weldPath.spatter,'TIG starts clean, with independent controls for recessed pits and raised spatter');
 ok(errors.length===0,'saving and reopening the weld project raises no application errors');if(errors.length)console.log(errors);
 const shopWelds=await p.evaluate(async()=>{
  const g=__gs,L=g.allLayers().find(n=>n.path?.weld);
  const names=['Standard weld','Narrow weld','Sharp weld'];
  g.selectOnly(L);g.setTool('path');
  const profiles=[],tips=[];
  for(const name of names){
    const style=g.WELD_STYLES.find(s=>s.name===name);
    await g.weldUse(style);
    tips.push(g.weldTipGet().alpha);
    Object.assign(g.weldOptions,{width:42,height:.7,spacing:.36,taper:0});
    g.weldPathUpdate(L);
    profiles.push(g.readMapF(L.maps.height,4));
  }
  const distinct=maps=>maps.every((a,i)=>maps.slice(0,i).every(b=>a.some((v,j)=>v!==b[j])));
  const S=g.doc.w,x=Math.floor(S*.28),mid=S/2;
  await g.weldUse(g.WELD_STYLES.find(s=>s.id==='standard'));
  const strength={edgeBlend:g.weldOptions.edgeBlend,fusion:g.weldOptions.fusion};
  Object.assign(g.weldOptions,{width:42,heat:0,burn:0});g.weldPathUpdate(L);
  const blended=g.readMapF(L.maps.base,4),raised=g.readMapF(L.maps.height,4);
  const tip=g.weldTipGet().alpha;
  Object.assign(g.weldOptions,{edgeBlend:0,fusion:0});g.weldPathUpdate(L);
  const hard=g.readMapF(L.maps.base,4),hardTip=g.weldTipGet().alpha;
  const edge=hard.some((a,i)=>i%4===3&&a>.3&&a<.85&&blended[i]<a-.05);
  const crest=raised[(mid*S+x)*4]>.57;
  const continuousTip=tip.some((v,i)=>v>hardTip[i]+12);
  return {paths:distinct(profiles),tips:distinct(tips),strength,edge,crest,continuousTip};
 });
 console.log('Shop welds',shopWelds);
 ok(shopWelds.paths&&shopWelds.tips,'Standard, Narrow and Sharp have distinct tips and path profiles');
 ok(shopWelds.strength.edgeBlend>=.7&&shopWelds.strength.fusion>=.7&&shopWelds.edge&&shopWelds.crest&&shopWelds.continuousTip,
   'Standard softens material coverage at the edges and bridges the freehand tip while keeping raised relief');
 await p.evaluate(async()=>{
  const g=__gs;
  g.setTool('brush');await g.weldUse(g.WELD_STYLES.find(s=>s.id==='standard'));
  g.v3SetOrtho(true);g.v3SnapView('front');
  Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:2.8,tx:0,ty:0,tz:0});
  g.requestRender(true);
 });
 const weldShelf=p.locator('#dkShelf');
 await p.evaluate(()=>__gs.showPanel('weldtools'));
 const shelfWelds=await weldShelf.locator('#weldToolsBody .weld-card').evaluateAll(cards=>cards.map(c=>c.title));
 const styleOptions=await weldShelf.getByRole('combobox',{name:'Weld bead style'}).locator('option:not(:disabled)').allTextContents();
 ok(shelfWelds.join('|')===weldNames.join('|')&&styleOptions.join('|')===weldNames.join('|'),
   'the Welds shelf and style selector only offer Standard, Narrow and Sharp');
 ok(await weldShelf.getByRole('slider',{name:'Edge blend',exact:true}).isVisible(),
   'Welds opens from the 3D Paint bottom shelf with its edge controls');
 await p.getByRole('button',{name:'Draw weld path',exact:true}).click();
 const weldHit=await p.locator('#v3Hit').boundingBox();
 await p.mouse.click(weldHit.x+weldHit.width*.43,weldHit.y+weldHit.height*.47);
 await p.mouse.click(weldHit.x+weldHit.width*.57,weldHit.y+weldHit.height*.50);
 await p.keyboard.press('Enter');
 ok(await p.evaluate(()=>__gs.doc.active.path?.weld?.profile===1&&__gs.doc.active.path.points.length===2),
   'the Tools shelf button and two model clicks create one editable weld path');
 const weldLayerCount=await p.evaluate(()=>{window.brushBeforeWeld={...__gs.brush};return __gs.allLayers().length;});
 await p.getByRole('button',{name:'Use as Brush',exact:true}).click();
 ok(await p.evaluate(count=>__gs.ui.tool==='brush'&&__gs.allLayers().length===count&&__gs.brush.size===21
   &&__gs.brush.tip.name==='Weld tip · Standard weld',weldLayerCount),
   'Use as Brush loads the current weld tip in 3D Paint with its pixel size and creates no layers');
 await p.evaluate(()=>{
  const g=__gs;g.setEditMap('base');g.setFG([.16,.25,.8]);
  window.modelWeldLayer=g.cmdAddLayer('Weld color');
  g.requestRender(true);
 });
 await p.mouse.move(weldHit.x+weldHit.width*.45,weldHit.y+weldHit.height*.54);
 await p.mouse.down();
 await p.mouse.move(weldHit.x+weldHit.width*.55,weldHit.y+weldHit.height*.54,{steps:9});
 await p.mouse.up();
 const modelWeld=await p.evaluate(()=>{
  const g=__gs,L=window.modelWeldLayer;
  const px=g.captureRegionNow(L.target,0,0,g.doc.w,g.doc.h).data;
  return !L.fill&&!L.mask&&px.some((a,i)=>i%4===3&&a>24&&px[i-1]>2*px[i-3]);
 });
 ok(modelWeld,'the regular weld brush paints the foreground color directly on a 3D model layer');
 await p.evaluate(()=>Object.assign(__gs.brush,window.brushBeforeWeld));

 const heatHalo=await p.evaluate(async()=>{
  const g=__gs;
  const standard=g.WELD_STYLES.find(s=>s.id==='standard');
  g.setEditMap('base');g.setTool('brush');g.cmdAddLayer('Pressure halo test');
  await g.weldUse(standard);
  const weld=g.materialBrushTarget(),et=g.editTarget(),o=g.paintOpts(et);
  Object.assign(o,{size:20,pSize:false,sizeJitter:0,angleJitter:0,scatter:0,smoothing:0});
  const halo=()=>g.allLayers().find(n=>n.name==='Heat halo · Standard weld');
  const read=(L,x,y)=>Array.from(g.captureRegionNow(L.target,x,y,1,1).data);
  g.beginStroke(et.L,20,36,.16,o);g.addPoint(96,36,.16);
  const viewportPixel=()=>{g.composite();g.v3Refresh();return Array.from(g.captureRegionNow(g.v3.tex.base,53,45,1,1).data);};
  const livePixel=viewportPixel();
  g.endStroke(true);
  const finalPixel=viewportPixel();
  const liveMatches=finalPixel.every((v,i)=>Math.abs(v-livePixel[i])<=1);
  const layer=halo(),low=read(layer,53,45);
  g.beginStroke(et.L,20,87,1,o);g.addPoint(96,87,1);g.endStroke(true);
  const high=read(layer,53,96),lowOuter=read(layer,53,50),highOuter=read(layer,53,101);
  const outsideBead=g.captureRegionNow(weld.mask.target,53,101,1,1).data[0]===0;
  const undoCheck=()=>read(layer,53,101)[3]===0&&g.captureRegionNow(weld.mask.target,53,87,1,1).data[0]===0;
  await g.undo();const undo=undoCheck();
  await g.undo();const removed=!halo();
  await g.redo();await g.redo();
  const redo=read(layer,53,101).every((v,i)=>v===highOuter[i]);
  const blob=await g.encodeP3Project();g.p3.savedAt=g.p3Sig();
  await g.openP3Project(await blob.arrayBuffer(),'Heat halo reopen');
  const reopened=!!halo()&&read(halo(),53,101).every((v,i)=>v===highOuter[i]);
  return {low,high,lowOuter,highOuter,outsideBead,undo,removed,redo,reopened,liveMatches,livePixel,finalPixel,
    colorOnly:Object.keys(layer.maps).join(',')==='base',error:g.gl.getError()};
 });
 console.log('Pressure halo',heatHalo);
 ok(heatHalo.low[0]>heatHalo.low[2]&&heatHalo.high[2]>heatHalo.high[0]&&
   heatHalo.highOuter[3]>heatHalo.lowOuter[3]+5&&heatHalo.outsideBead&&heatHalo.colorOnly,
   'pen pressure shifts the halo from gold to blue and widens it independently of bead height');
 ok(heatHalo.liveMatches&&heatHalo.undo&&heatHalo.removed&&heatHalo.redo&&heatHalo.reopened&&heatHalo.error===0,
   'the halo and bead undo together and the halo survives project reopen');
 const projectedHalo=await p.evaluate(async()=>{
  const g=__gs;
  g.setTool('brush');g.cmdAddLayer('Projected halo test');
  await g.weldUse(g.WELD_STYLES.find(s=>s.id==='standard'));
  const weld=g.materialBrushTarget(),et=g.editTarget(),o=g.paintOpts(et);
  g.v3SetOrtho(true);g.v3SnapView('front');
  Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:3,tx:0,ty:0,tz:0});
  g.v3s().paintAlign='wrap';
  Object.assign(o,{space:g.meshSpace(256,256),cageRs:1,size:24,pSize:false,smoothing:0});
  g.beginStroke(et.L,94,128,.25,o);g.addPoint(161,128,.95);g.endStroke(true);
  const layer=weld.parent.children[weld.parent.children.indexOf(weld)-1];
  const pixels=g.captureRegionNow(layer.target,0,0,g.doc.w,g.doc.h).data;
  const mask=g.captureRegionNow(weld.mask.target,0,0,g.doc.w,g.doc.h).data;
  return {haloOnly:pixels.some((v,i)=>i%4===3&&v>8&&mask[i-3]===0),error:g.gl.getError()};
 });
 ok(projectedHalo.haloOnly&&projectedHalo.error===0,'surface projection carries halo color onto the model beyond the bead');

 const weldPerf=await p.evaluate(async()=>{const g=__gs;g.prefs.paintSpeed='best';g.doc.wrap=false;g.setEditMap('base');g.doc.view='base';g.setTool('brush');await g.weldUse(g.WELD_STYLES[0]);g.cmdAddLayer();g.materialBrushTarget();const L=g.editTarget().L;
  g.composite();g.v3Refresh();const o=g.paintOpts(g.editTarget());Object.assign(o,{size:10,pSize:false,smoothing:0});
  const initialMetal=g.captureRegionNow(g.v3.tex.metal,0,0,g.doc.w,g.doc.h).data;
  g.beginStroke(L,24,40,1,o);g.composite();g.v3Refresh();
  const before=g.v3Work.copyPixels,work=g.runStat.px;
  for(let i=0;i<3;i++){g.addPoint(28+i*4,40,1);g.composite();g.v3Refresh();}
  const copied=g.v3Work.copyPixels-before,pixels=g.runStat.px-work,keys=['base','rough','metal','nfinal'],saved={};
  for(const k of keys)saved[k]=g.captureRegionNow(g.v3.tex[k],0,0,g.doc.w,g.doc.h).data;
  g.v3.mapsDirty=true;g.v3.lastFull=0;g.v3Refresh();let maxDelta=0;const deltas={};
  for(const k of keys){const b=g.captureRegionNow(g.v3.tex[k],0,0,g.doc.w,g.doc.h).data;let delta=0,at=0;for(let i=0;i<b.length;i++){const d=Math.abs(b[i]-saved[k][i]);if(d>delta){delta=d;at=i;}maxDelta=Math.max(maxDelta,d);}deltas[k]={delta,x:Math.floor(at/4)%g.doc.w,y:Math.floor(at/4/g.doc.w),channel:at%4,full:b[at],patch:saved[k][at]};}
  const endBefore=g.v3Work.copyPixels;g.endStroke(true);g.composite();g.v3Refresh();const endCopies=g.v3Work.copyPixels-endBefore,released=!g.v3.mapsDirty,endSaved={};for(const k of keys)endSaved[k]=g.captureRegionNow(g.v3.tex[k],0,0,g.doc.w,g.doc.h).data;
  g.v3.mapsDirty=true;g.v3Refresh();let endDelta=0;for(const k of keys){const a=g.captureRegionNow(g.v3.tex[k],0,0,g.doc.w,g.doc.h).data;for(let i=0;i<a.length;i++)endDelta=Math.max(endDelta,Math.abs(a[i]-endSaved[k][i]));}
  g.doc.wrap=true;g.beginStroke(L,30,45,1,o);g.composite();const fallback=g.v3.mapsDirty&&!g.v3.mapRegion;g.endStroke(false);g.doc.wrap=false;g.composite();g.v3Refresh();const fullBefore=g.v3Work.copyPixels;Object.assign(o,{size:96});g.beginStroke(L,64,64,1,o);g.addPoint(68,64,1);g.composite();g.v3Refresh();const large=g.v3Work.copyPixels-fullBefore>=g.doc.w*g.doc.h*4&&!g.v3.mapsDirty;g.endStroke(false);
  return {endCopies,endDelta,changedMetal:saved.metal.some((v,i)=>v!==initialMetal[i]),large,deltas,copied,pixels,fullCopies:g.doc.w*g.doc.h*4*3,maxDelta,released,fallback,error:g.gl.getError()};});
 console.log('Weld preview work',weldPerf);ok(weldPerf.endDelta<=1&&weldPerf.endCopies<weldPerf.fullCopies/3*.25&&weldPerf.changedMetal&&weldPerf.copied<weldPerf.fullCopies*.25&&weldPerf.maxDelta<=1&&weldPerf.released&&weldPerf.fallback&&weldPerf.large&&weldPerf.error===0,'weld patches update live colour, roughness, metal and normals with identical full-refresh pixels and safe fallback');
 const meshMask=await p.evaluate(async()=>{const g=__gs;await g.weldUse(g.WELD_STYLES[0]);g.cmdAddLayer();const L=g.materialBrushTarget(),et=g.editTarget(),o=g.paintOpts(et),sp=g.meshSpace(256,256);Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:3,tx:0,ty:0,tz:0});Object.assign(o,{space:sp,cageRs:g.meshBrushScale(256),size:32,pSize:false,smoothing:0});g.composite();g.v3Refresh();g.beginStroke(et.L,128,128,1,o);const lazy=g.strokeNow().lazy;g.composite();g.v3Refresh();g.addPoint(140,128,1);g.composite();g.v3Refresh();g.endStroke(true);g.composite();g.v3Refresh();const px=g.captureRegionNow(L.mask.target,0,0,g.doc.w,g.doc.h).data,covered=px.reduce((n,v,i)=>n+(i%4===0&&v>0?1:0),0);await g.undo();const blank=g.captureRegionNow(L.mask.target,0,0,g.doc.w,g.doc.h).data.every((v,i)=>i%4!==0||v===0);await g.redo();const restored=g.captureRegionNow(L.mask.target,0,0,g.doc.w,g.doc.h).data.every((v,i)=>v===px[i]);const blob=await g.encodeP3Project();g.p3.savedAt=g.p3Sig();await g.openP3Project(await blob.arrayBuffer(),'Masked weld reopen');const R=g.allLayers().find(n=>n.materialPaint?.startsWith('weld:'));return {lazy,covered,blank,restored,reopened:!!R?.fill&&!!R.mask,error:g.gl.getError()};});console.log('Mesh mask',meshMask);ok(meshMask.lazy&&meshMask.covered>0&&meshMask.blank&&meshMask.restored&&meshMask.reopened&&meshMask.error===0,'3D weld mask uses partial capture, paints the surface, supports undo and redo, and survives project reopen');
 const zoom=await p.evaluate(async()=>{const g=__gs;g.doc.wrap=false;g.setEditMap('base');g.setTool('brush');g.v3s().disp=0;g.v3s().uvs=1;Object.assign(g.v3.cam,{yaw:0,pitch:0,tx:0,ty:0,tz:0});
  const counts=[];for(const ortho of [false,true]){g.v3s().ortho=ortho;for(const dist of [3,1.5]){g.v3.cam.dist=dist;g.cmdAddLayer();const L=g.doc.active,o=g.paintOpts(g.editTarget()),sp=g.meshSpace(256,256);Object.assign(o,{space:sp,cageRs:g.meshBrushScale(256),size:48,pSize:false,tip:null,hardness:1,flow:1,opacity:1,smoothing:0,extras:[]});
    Object.assign(o,{sizeJitter:0,angleJitter:0,scatter:0});
    g.beginStroke(L,128,128,1,o);g.endStroke(false);counts.push(g.readRGBA8(L.target).reduce((n,v,i)=>n+(i%4===3&&v>128?1:0),0));}}
  return {counts,scaleRatio:(g.v3.cam.dist=3,g.meshBrushScale(256))/(g.v3.cam.dist=1.5,g.meshBrushScale(256)),error:g.gl.getError()};});
 console.log('Model brush zoom',zoom);ok(zoom.counts.every(n=>n>0)&&Math.abs(zoom.counts[0]-zoom.counts[1])<=4&&Math.abs(zoom.counts[2]-zoom.counts[3])<=4&&Math.abs(zoom.scaleRatio-.5)<.001&&zoom.error===0,'zoom preserves the model brush footprint in perspective and orthographic views');
 await p.evaluate(()=>{const g=__gs;g.setEditMap('base');g.showPanel('stitches');});
 const stitchShelf=p.locator('#stitchToolsBody');
 const addedStyles=['Chain stitch','Blanket stitch','Herringbone stitch','Ladder stitch',
  'Baseball stitch','Flat-felled seam','Overlock seam','Whipstitch seam',
  'Piping','Bar tack','Buttonhole','Keyhole buttonhole','Darning repair','Centered puckered piping'];
 const cards=await stitchShelf.locator('button.weld-card').evaluateAll(nodes=>nodes.map(node=>({
  name:node.getAttribute('aria-label'),image:node.querySelector('canvas').toDataURL()
 })));
 ok(cards.length===19&&addedStyles.every(name=>cards.some(card=>card.name===name))&&
  new Set(cards.map(card=>card.image)).size===19,'the Stitches shelf shows nineteen distinct stitch presets');
 const stitches=p.locator('#dkShelf').getByRole('button',{name:'Cross stitch',exact:true});
 await stitches.click();
 const stitchResult=await p.evaluate(async()=>{
  const g=__gs;
  g.setFG([.88,.62,.28]);
  const L=g.materialBrushTarget(),et=g.editTarget(),o=g.paintOpts(et);
  Object.assign(o,{size:37,smoothing:0});
  g.beginStroke(L,13,50,1,o);g.addPoint(109,50,1);g.endStroke(true);
  const height=g.readMapF(L.maps.height,4),base=g.readMapF(L.maps.base,4),rough=g.readMapF(L.maps.rough,4);
  const raised=height.some((h,i)=>i%4===0&&height[i+3]>.4&&h>.61);
  const pierced=height.some((h,i)=>i%4===0&&height[i+3]>.1&&h<.47);
  const strandRoughness=rough.filter((v,i)=>i%4===0&&rough[i+3]>.83);
  const detail=Math.max(...strandRoughness)-Math.min(...strandRoughness)>.045;
  const clear=height[3]===0&&base[3]===0;
  await g.undo();
  const blank=['base','height','rough'].every(k=>g.readMapF(L.maps[k],4).every((v,i)=>i%4!==3||v===0));
  await g.redo();
  const restored=g.readMapF(L.maps.height,4).every((v,i)=>v===height[i]);
  return {raised,pierced,detail,clear,blank,restored,error:g.gl.getError()};
 });
 console.log('Stitch brush',stitchResult);
 ok(Object.entries(stitchResult).every(([k,v])=>k==='error'?v===0:v),
   'a cross stitch paints raised threads, recessed needle holes and varying roughness in one undoable stroke');
 const setStitch=(key,value)=>p.locator('#stitch-'+key).evaluate((input,v)=>{
  input.value=String(v);input.dispatchEvent(new Event('input',{bubbles:true}));
 },value);
 await p.evaluate(()=>__gs.undo());
 await setStitch('pucker',1);
 const pucker=await p.evaluate(async()=>{
  const g=__gs,L=g.materialBrushTarget(),o=g.paintOpts(g.editTarget());
  Object.assign(o,{size:37,smoothing:0});
  g.beginStroke(L,13,50,1,o);g.addPoint(109,50,1);g.endStroke(true);
  const color=g.readMapF(L.maps.base,4),height=g.readMapF(L.maps.height,4);
  const outside=(v,i)=>i%4===0&&color[i+3]===0&&height[i+3]>.07;
  const ridge=height.some((v,i)=>outside(v,i)&&v>.57);
  const crease=height.some((v,i)=>outside(v,i)&&v<.43);
  await g.undo();
  const cleared=g.readMapF(L.maps.height,4).every((v,i)=>i%4!==3||v===0);
  return {ridge,crease,cleared,error:g.gl.getError()};
 });
 console.log('Stitch puckering',pucker);
 ok(pucker.ridge&&pucker.crease&&pucker.cleared&&pucker.error===0,
   'puckering adds raised folds and recessed creases outside the thread without painting color');
 const modelHit=await p.locator('#v3Hit').boundingBox();
 await p.mouse.move(modelHit.x+modelHit.width*.39,modelHit.y+modelHit.height*.42);
 await p.mouse.down();
 await p.mouse.move(modelHit.x+modelHit.width*.62,modelHit.y+modelHit.height*.42,{steps:12});
 await p.mouse.up();
 const projectedStitch=await p.evaluate(()=>{
  const g=__gs,L=g.doc.active,base=g.readMapF(L.maps.base,4),height=g.readMapF(L.maps.height,4);
  return {thread:base.some((v,i)=>i%4===3&&v>.5),
   folds:height.some((v,i)=>i%4===0&&v>.56&&height[i+3]>.08&&base[i+3]===0),error:g.gl.getError()};
 });
 ok(projectedStitch.thread&&projectedStitch.folds&&projectedStitch.error===0,
   'a freehand model stroke projects thread and fabric puckering onto the surface');
 await p.locator('#dkShelf').getByRole('button',{name:'Draw stitch path',exact:true}).click();
 const stitchHit=await p.locator('#v3Hit').boundingBox();
 await p.mouse.click(stitchHit.x+stitchHit.width*.43,stitchHit.y+stitchHit.height*.47);
 await p.mouse.click(stitchHit.x+stitchHit.width*.57,stitchHit.y+stitchHit.height*.53);
 await p.keyboard.press('Enter');
 const pathResult=await p.evaluate(async()=>{
  const g=__gs,L=g.doc.active;
  if(L.path?.points.length!==2)return {points:L.path?.points.length,stitch:L.path?.stitch};
  const read=()=>g.readMapF(L.maps.height,4);
  const original=read();
  const folds=original.some((v,i)=>i%4===3&&v>0);
  g.pathChange(P=>P.stitch.pucker=0,'Turn off puckering');
  const flat=read(),different=flat.some((v,i)=>v!==original[i]);
  await g.undo();
  const restored=read().every((v,i)=>v===original[i]);
  const blob=await g.encodeP3Project();
  g.p3.savedAt=g.p3Sig();
  await g.openP3Project(await blob.arrayBuffer(),'Stitch path reopen');
  const saved=g.allLayers().find(n=>n.path?.stitch);
  const reopened=saved?.path.stitch.pucker===1&&saved.path.points.length===2&&
   g.readMapF(saved.maps.height,4).some((v,i)=>i%4===3&&v>0);
  return {folds,different,restored,reopened,error:g.gl.getError()};
 });
 console.log('Stitch path',pathResult);
 ok(pathResult.folds&&pathResult.different&&pathResult.restored&&pathResult.reopened&&pathResult.error===0,
   'surface stitch paths are editable, regenerate puckering, support undo and reopen with their settings');
 await p.evaluate(()=>{
  const g=__gs,L=g.allLayers().find(n=>n.path?.stitch);
  g.selectOnly(L);g.setTool('path');
  for(const key of ['damage','fray','variation','seed'])delete L.path.stitch[key];
  g.pathRender(L);g.showPanel('stitches');
 });
 ok(await p.locator('#stitch-damage').inputValue()==='0'&&await p.locator('#stitch-seed').inputValue()==='1',
   'paths saved before the wear controls open with clean defaults');
 await stitchShelf.getByRole('button',{name:'Chain stitch',exact:true}).click();
 await setStitch('size',16);
 await setStitch('pucker',0);
 const getStitchPixels=()=>p.evaluate(()=>{
  const g=__gs,L=g.doc.active;
  return ['base','height','rough'].map(k=>Array.from(g.readMapF(L.maps[k],4)));
 });
 const hasDifference=(a,b)=>a.some((v,i)=>v!==b[i]);
 const clean=await getStitchPixels();
 await setStitch('damage',1);
 const damaged=await getStitchPixels();
 const opensGaps=clean[0].some((v,i)=>i%4===3&&v>.6&&damaged[0][i]<.2);
 ok(opensGaps&&hasDifference(clean[1],damaged[1])&&hasDifference(clean[2],damaged[2]),
   'stitch damage removes thread and relief together');
 await setStitch('damage',0);
 await setStitch('fray',1);
 const frayed=await getStitchPixels();
 ok(frayed[0].some((v,i)=>i%4===3&&v>.01&&clean[0][i]===0)&&hasDifference(clean[1],frayed[1]),
   'fray adds loose fibers outside the clean thread with corresponding relief');
 await setStitch('variation',1);
 await setStitch('seed',321);
 const varied=await getStitchPixels();
 ok(hasDifference(frayed[0],varied[0]),'stitch variation moves and reshapes individual stitches');
 await stitchShelf.getByRole('button',{name:'Shuffle variation',exact:true}).click();
 const shuffled=await getStitchPixels();
 ok(hasDifference(varied[0],shuffled[0])&&await p.locator('#stitch-seed').inputValue()!=='321',
   'shuffling changes the seed and immediately redraws the editable path');
 await setStitch('seed',321);
 ok(!(await getStitchPixels()).some((map,i)=>hasDifference(map,varied[i])),
   'returning to the same seed recreates identical material channels');
 const savedWear=await p.evaluate(async()=>{
  const g=__gs,b=await g.encodeP3Project();
  g.p3.savedAt=g.p3Sig();
  await g.openP3Project(await b.arrayBuffer(),'Worn stitches reopen');
  const L=g.allLayers().find(n=>n.path?.stitch);
  g.selectOnly(L);g.setTool('path');g.pathRender(L);g.showPanel('stitches');
  const {style,fray,variation,seed}=L.path.stitch;
  return {style,fray,variation,seed,error:g.gl.getError()};
 });
 ok(savedWear.style===5&&savedWear.fray===1&&savedWear.variation===1&&savedWear.seed===321&&savedWear.error===0&&
   !(await getStitchPixels()).some((map,i)=>hasDifference(map,varied[i])),
   'worn stitch paths reopen and rerender with their original seed and settings');
 await stitchShelf.getByRole('button',{name:'Paint freehand',exact:true}).click();
 const freehand=await p.evaluate(async()=>{
  const g=__gs,L=g.materialBrushTarget(),o=g.paintOpts(g.editTarget());
  Object.assign(o,{size:55,spacing:.67,smoothing:0});
  const paint=async()=>{
   g.beginStroke(L,14,65,1,o);g.addPoint(115,65,1);g.endStroke(true);
   const data=g.readMapF(L.maps.base,4);await g.undo();return data;
  };
  const worn=await paint();
  Object.assign(o.material.stitch,{fray:0,variation:0});
  const clean=await paint();
  return worn.some((v,i)=>i%4===3&&v!==clean[i])&&g.gl.getError()===0;
 });
 ok(freehand,'freehand uses the same wear and variation settings as the editable path');
 await stitchShelf.getByRole('button',{name:'Baseball stitch',exact:true}).click();
 await setStitch('damage',0);
 await setStitch('fray',0);
 await setStitch('variation',0);
 await setStitch('holes',0);
 const baseball=await p.evaluate(async()=>{
  const g=__gs,L=g.materialBrushTarget(),o=g.paintOpts(g.editTarget());
  Object.assign(o,{size:40,smoothing:0});
  const paint=async()=>{
   g.beginStroke(L,17,65,1,o);g.addPoint(112,65,1);g.endStroke(true);
   const base=g.readMapF(L.maps.base,4),height=g.readMapF(L.maps.height,4);
   await g.undo();return {base,height};
  };
  const seam=await paint();
  o.material.stitch.seam=0;
  const flat=await paint();
  const red=seam.base.some((v,i)=>i%4===0&&v>.25&&v>3*seam.base[i+1]&&seam.base[i+3]>.65);
  const inJoin=(v,i)=>i%4===0&&seam.base[i+3]===0&&seam.height[i+3]>.08&&flat.height[i+3]===0;
  return {red,groove:seam.height.some((v,i)=>inJoin(v,i)&&v<.40),
   raisedEdge:seam.height.some((v,i)=>inJoin(v,i)&&v>.57),
   colorSame:flat.base.every((v,i)=>v===seam.base[i]),error:g.gl.getError()};
 });
 console.log('Baseball seam',baseball);
 ok(baseball.red&&baseball.groove&&baseball.raisedEdge&&baseball.colorSame&&baseball.error===0,
   'Baseball defaults to red thread and independently sculpts the material underneath');
 await stitchShelf.getByRole('button',{name:'Buttonhole',exact:true}).click();
 const buttonhole=await p.evaluate(async()=>{
  const g=__gs,L=g.materialBrushTarget(),o=g.paintOpts(g.editTarget());
  Object.assign(o,{size:47});
  g.beginStroke(L,31,89,1,o);g.addPoint(114,89,1);g.endStroke(true);
  const base=g.readMapF(L.maps.base,4),height=g.readMapF(L.maps.height,4);
  await g.undo();
  return {stamp:base.some((v,i)=>i%4===3&&v>.5),
   single:base.every((v,i)=>i%4!==3||v===0||Math.floor(i/4)%g.doc.w<55),
   slit:height.some((v,i)=>i%4===0&&v<.4&&height[i+3]>.17&&base[i+3]===0)};
 });
 ok(buttonhole.stamp&&buttonhole.single&&buttonhole.slit,'buttonhole places one stitched stamp with a recessed slit');
 await stitchShelf.getByRole('button',{name:'Piping',exact:true}).click();
 await p.getByRole('checkbox',{name:'Piping topstitch'}).uncheck();
 await stitchShelf.getByRole('button',{name:'Draw stitch path',exact:true}).click();
 const pipe=await p.evaluate(()=>{
  const g=__gs,L=g.doc.active,mesh=g.v3.mesh;
  g.pathChange(P=>{
   P.points=[[-.45,-.3,0],[.45,-.3,0]].map(pos=>{
    const {p,n}=g.pathNearest(mesh,pos);
    return {p,n,pressure:1,in:[0,0,0],out:[0,0,0]};
   });
  },'Piping points');
  const height=g.readMapF(L.maps.height,4),base=g.readMapF(L.maps.base,4);
  const cord=height.some((v,i)=>i%4===0&&v>.65&&height[i+3]>.25);
  const blank=base.every((v,i)=>i%4!==3||v===0);
  g.pathChange(P=>P.stitch.pipeStitch=true,'Piping stitches');
  return {cord,blank,stitched:g.readMapF(L.maps.base,4).some((v,i)=>i%4===3&&v>.2)};
 });
 ok(pipe.cord&&pipe.blank&&pipe.stitched,'editable piping renders a raised cord and switches its topstitch on independently');
 await stitchShelf.getByRole('button',{name:'Centered puckered piping',exact:true}).click();
 const centered=await p.evaluate(()=>{
  const g=__gs,L=g.doc.active,P=L.path,read=k=>g.readMapF(L.maps[k],4);
  const defaultPucker=P.stitch.pucker,withFolds=read('height'),thread=read('base');
  g.pathChange(P=>P.stitch.pucker=0,'Remove piping puckering');
  const plain=read('height'),sameThread=read('base').every((v,i)=>v===thread[i]);
  const rows=[];
  for(let i=3;i<thread.length;i+=4)if(thread[i]>.5)rows.push(Math.floor((i/4)/g.doc.w));
  const center=rows.reduce((a,b)=>a+b,0)/rows.length;
  const changed=(v,i)=>i%4===0&&Math.abs(v*withFolds[i+3]-plain[i]*plain[i+3])>.009;
  const above=withFolds.some((v,i)=>changed(v,i)&&Math.floor((i/4)/g.doc.w)>center+1);
  const below=withFolds.some((v,i)=>changed(v,i)&&Math.floor((i/4)/g.doc.w)<center-1);
  return {defaultPucker,above,below,sameThread,hasThread:rows.length>0};
 });
 ok(centered.defaultPucker===.68&&centered.hasThread&&centered.above&&centered.below&&centered.sameThread,
   'centered piping puckers both sides while keeping the thread placement unchanged');
 await p.evaluate(()=>__gs.showPanel('surfacedetails'));
 const detailShelf=p.locator('#surfaceDetailsBody');
 const detailCards=await detailShelf.locator('canvas').evaluateAll(nodes=>nodes.map(node=>node.toDataURL()));
 ok(detailCards.length===7&&new Set(detailCards).size===7,'the Surface Details shelf offers seven distinct brushes');
 await detailShelf.getByRole('button',{name:'Hammer dent',exact:true}).click();
 const dentHit=await p.locator('#v3Hit').boundingBox();
 await p.mouse.click(dentHit.x+dentHit.width*.49,dentHit.y+dentHit.height*.41);
 const dent=await p.evaluate(async()=>{
  const g=__gs,L=g.doc.active,read=k=>g.readMapF(L.maps[k],4);
  const height=read('height'),base=read('base'),rough=read('rough');
  const recessed=height.some((v,i)=>i%4===0&&v<.40&&height[i+3]>.15);
  const rim=height.some((v,i)=>i%4===0&&v>.58&&height[i+3]>.05);
  await g.undo();
  const undone=read('height').every((v,i)=>i%4!==3||v===0)&&read('rough').every((v,i)=>i%4!==3||v===0);
  await g.redo();
  return {recessed,rim,undone,redo:read('height').every((v,i)=>v===height[i]),
   clean:base.every((v,i)=>i%4!==3||v===0),rough:rough.some((v,i)=>i%4===3&&v>.1),error:g.gl.getError()};
 });
 console.log('Hammer dent',dent);
 ok(dent.recessed&&dent.rim&&dent.clean&&dent.rough&&dent.undone&&dent.redo&&dent.error===0,
   'a projected hammer dent changes relief and roughness without coloring the surface');
 await detailShelf.getByRole('button',{name:'Paint chips',exact:true}).click();
 const chip=await p.evaluate(()=>{
  const g=__gs,L=g.materialBrushTarget(),o=g.paintOpts(g.editTarget());
  Object.assign(o,{size:46,angleJitter:0});
  g.beginStroke(L,40,92,1,o);g.endStroke(true);
  const alpha=k=>g.readMapF(L.maps[k],4).some((v,i)=>i%4===3&&v>.3);
  return ['base','height','rough'].every(alpha)&&g.gl.getError()===0;
 });
 ok(chip,'a paint chip changes color, relief and roughness together');
 ok(errors.length===0,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
