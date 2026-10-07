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
 const weld=await p.evaluate(async()=>{const g=__gs;g.newDoc(128,128,8,null,'Weld pixels',false);const L=g.doc.active;await g.weldUse(g.WELD_STYLES[0]);const same=g.materialBrushTarget()===L;const et=g.editTarget(),o=g.paintOpts(et);Object.assign(o,{size:24,pSize:false,smoothing:0});g.beginStroke(et.L,25,64,1,o);g.addPoint(95,64,1);g.endStroke(true);
  const values={};for(const k of ['base','rough','metal','height'])values[k]=Array.from(g.captureRegionNow(g.mapT(L,k),60,64,1,1).data);
  g.undo();const undo=['base','rough','metal','height'].every(k=>g.captureRegionNow(g.mapT(L,k),60,64,1,1).data[3]===0);g.redo();
  const original=L.id;g.cmdAddMask();L.editMask=true;const next=g.materialBrushTarget();
  return {same,values,undo,mask:!!L.mask,plainBeforeMask:!L.fill,created:next.id!==original&&!next.mask&&!next.fill};});
 console.log('Weld',weld);ok(weld.same&&weld.plainBeforeMask&&weld.values.base[3]>0&&weld.values.metal[0]>0&&weld.values.height[0]>0&&weld.undo,'weld paints existing pixel layer channels with one undo');ok(weld.created,'weld selected on a mask creates a plain layer instead of painting a mask');
 const texture=await p.evaluate(async()=>{const g=__gs;g.newDoc(64,64,8,null,'Texture mask',false);const L=g.doc.active;g.cmdAddMask();L.editMask=true;const n=g.allLayers().length,it={kind:'gen',id:g.TX_GEN[0][0],name:g.TX_GEN[0][1]};await g.txClick(it);const maskCount=g.allLayers().length,rows=L.mask.stack?.length||L.mask.rows?.length||0,same=g.doc.active===L;
  L.editMask=false;g.ui.msSel=null;await g.txClick(it);return {n,maskCount,same,rows,layerCount:g.allLayers().length};});
 console.log('Texture',texture);ok(texture.maskCount===texture.n&&texture.same&&texture.layerCount===texture.n+1,'texture click uses selected mask, colour thumbnail still creates a layer');
 const layouts=await p.evaluate(()=>{const g=__gs;g.setMode('paint');g.setWorkspace('minimal');g.dkMove('layers',{hidden:true});g.setMode('p3d');g.setWorkspace('minimal');const separate=!g.dk.L.hidden.includes('layers');g.dkMove('hist',{hidden:true});g.setMode('paint');const paint=g.dk.L.hidden.includes('layers')&&!g.dk.L.hidden.includes('hist');
  const options=Array.from(document.querySelector('#wsSel').options).filter(x=>x.value&&!x.value.startsWith(':')).map(x=>x.value);
  g.setMode('p3d');const model=!g.dk.L.hidden.includes('layers')&&g.dk.L.hidden.includes('hist');g.setMode('paint');g.setWorkspace('paint3d');return {separate,paint,model,options,canvas:!g.v3.on};});
 console.log('Layouts',layouts);ok(layouts.separate&&layouts.paint&&layouts.model,'closing panels in the same preset stays independent between Paint and 3D Paint');ok(!layouts.options.includes('texturing')&&!layouts.options.includes('paint3d')&&layouts.canvas,'Paint layout menu stays focused on the canvas');
 const pen=await p.evaluate(()=>__gs.pressureOf({pressure:.18},{pointerType:'pen',pressure:.75}));ok(Math.abs(pen-.18)<.001,'coalesced pen samples retain their own pressure');
 await p.evaluate(()=>{const g=__gs;g.setWorkspace('painting');g.newDoc(128,128,8,null,'Lazy release',false);g.setTool('brush');g.setFG([1,0,0]);Object.assign(g.brush,{size:8,hardness:1,flow:1,opacity:1,pSize:false,pOpacity:false,lazy:30,smoothing:.2,spacing:.1,tip:null});});
 const at=async(x,y)=>p.evaluate(([x,y])=>{const r=document.getElementById('stage').getBoundingClientRect(),v=__gs.view;return [r.left+v.x+x*v.zoom,r.top+v.y+y*v.zoom];},[x,y]);
 await p.mouse.move(...await at(20,64));await p.mouse.down();await p.mouse.move(...await at(95,64),{steps:12});await p.mouse.up();
 const lazy=await p.evaluate(()=>Array.from(__gs.captureRegionNow(__gs.doc.active.target,95,64,1,1).data));ok(lazy[3]===0,'releasing lazy mouse does not draw an abrupt tail to the raw cursor');
 const seam=await p.evaluate(()=>{const g=__gs;g.setMode('p3d');g.newDoc(64,64,8,null,'Seam test',false);g.p3.size=64;g.v3s().detail=0;g.v3s().uvs=1;
  const obj=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0',
   'vt .05 .1','vt .4 .1','vt .4 .9','vt .05 .9','vt .6 .1','vt .95 .1','vt .95 .9','vt .6 .9',
   'f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 2/5 5/6 6/7','f 2/5 6/7 3/8'].join('\n');
  g.useModel(g.parseOBJ(obj));const src=g.makeTarget(64,64,8,false),dst=g.makeTarget(64,64,8,false),px=new Uint8Array(64*64*4);
  for(let y=6;y<58;y++)for(let x=3;x<61;x++){if(x>25&&x<38)continue;const i=(y*64+x)*4;px.set(x<26?[255,0,0,255]:[0,0,255,255],i);}g.writeRegion(src,0,0,64,64,px);
  const used=g.meshConnectedBlur(src,dst,3,3,false),read=x=>Array.from(g.captureRegionNow(dst,x,32,1,1).data),left=read(25),right=read(38),outside=read(3);
  const box=g.meshConnectedBlur(src,dst,6,6,true),boxLeft=read(25),boxRight=read(38);
  const inPlace=g.meshConnectedBlur(src,src,3,3,false),inValue=Array.from(g.captureRegionNow(src,25,32,1,1).data);
  g.writeRegion(src,0,0,64,64,px);g.seamBlurDispose();g.v3.mesh.setRanges=[{name:g.p3Binding(g.p3.sets[g.p3.cur]),start:0,count:2}];g.meshConnectedBlur(src,dst,3,3,false);const isolated=read(25);
  const error=g.gl.getError();g.disposeTarget(src);g.disposeTarget(dst);return {used,left,right,outside,box,boxLeft,boxRight,inPlace,inValue,isolated,error};});
 console.log('Seams',seam);ok(seam.used&&seam.left[2]>30&&seam.right[0]>30&&Math.abs(seam.left[0]-seam.right[2])<20,'Gaussian taps cross a geometric join between separated UV islands');ok(seam.left[3]>245&&seam.right[3]>245&&seam.outside[3]>245,'blur avoids dark or transparent atlas gutters');ok(seam.box&&seam.boxLeft[2]>30&&seam.boxRight[0]>30,'box blur also follows connected UV islands');ok(seam.inPlace&&Math.abs(seam.inValue[0]-seam.left[0])<3,'in-place seam blur avoids sampling its own output');ok(seam.isolated[2]<3&&seam.isolated[0]>245,'texture set boundary does not bleed into the adjacent set');ok(seam.error===0&&errors.length===0,'no WebGL or application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
