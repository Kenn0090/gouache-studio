const {chromium}=require('playwright'),path=require('path'),fs=require('fs'),http=require('http');
let failures=0;const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)failures++;};
(async()=>{
 let server=null,url='file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug';
 if(process.env.GS_VIEWPORT_BUILD==='desktop'){const root=path.resolve(__dirname,'../../dist');server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));url='http://127.0.0.1:'+server.address().port+'/index.html?debug';}
 const b=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL||'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1280,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));
 await p.addInitScript(()=>localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'})));
 await p.route('**/*',r=>r.request().url().startsWith('file:')||r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.fulfill({body:''}));
 await p.goto(url);await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 for(const [w,h,depth] of [[256,256,8],[256,128,16],[1,128,8],[257,129,8],[2048,2048,8]]){
  const r=await p.evaluate(([w,h,depth])=>{const G=__gs,g=G.gl;G.newDoc(w,h,depth,[.1,.2,.3],'Mip test',false);
   const src=G.makeTarget(w,h,depth,false),raw=new Uint8Array(w*h*4);for(let i=0;i<raw.length;i+=4){raw[i]=(i*17+(i>>9))&255;raw[i+1]=(i>>4)&255;raw[i+2]=(i>>7)&255;raw[i+3]=255;}
   const u=G.uploadStraight({w,h,data:raw,bits:8});G.premultInto(src,u,[0,0],null);g.deleteTexture(u);G.v3MapTex('probe',src);G.v3MapTex('reference',src);
   const before={...G.v3Work};let max=0;
   for(const rect of [[0,0,Math.min(9,w),11],[Math.max(0,w-11),h-13,Math.min(11,w),13],[Math.min(31,w-1),41,Math.min(17,w-Math.min(31,w-1)),19]]){
    g.enable(g.SCISSOR_TEST);g.scissor(...rect);G.clearTarget(src,[.73,.19,.47,1]);g.disable(g.SCISSOR_TEST);G.v3MapTex('probe',src,rect);G.v3MapTex('reference',src);
    let W=w,H=h,level=0;do{const read=k=>{const t=G.v3.tex[k];g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t.tex,level);
      const a=G.captureRegionNow({...t,w:W,h:H},0,0,W,H).data;g.bindFramebuffer(g.FRAMEBUFFER,t.fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,t.tex,0);return a;};
     const a=read('probe'),c=read('reference');for(let i=0;i<a.length;i++)max=Math.max(max,depth===16?Math.abs(a[i]-c[i]):Math.abs(a[i]-c[i]));if(W===1&&H===1)break;W=Math.max(1,W>>1);H=Math.max(1,H>>1);level++;}while(true);
   }
   const partial=G.v3Work.partialCopies-before.partialCopies,error=g.getError();G.disposeTarget(src);return {max,partial,error};},[w,h,depth]);
  console.log('mips',w,h,depth,r);ok(r.max<=1,`${w}x${h} ${depth}-bit regional updates match full mip generation at every level`);ok(r.error===0,'mip updates have no graphics errors');ok(w===257?r.partial===0:r.partial===3,'odd dimensions fall back; supported dimensions update only patches');
 }
 for(const kind of ['plain','wrapped','mask','multi-map','height','filter','dependent-mask','clipped']){
  const r=await p.evaluate(kind=>{const G=__gs;G.newDoc(256,256,8,[.3,.4,.5],kind,kind==='wrapped');G.setDocMaps(['base','rough','metal','height','normal']);G.v3.on=true;G.v3s().unlit=false;
   if(kind==='height'){G.setEditMap('height');G.setView('height');G.v3s().disp=.1;}
   const L=G.newLayerObj('Paint');G.insertNode(L,G.doc.root);G.selectOnly(L);let target=L;
   if(kind==='mask'){G.cmdAddMask(1);target=G.editTarget().L;}
   if(kind==='filter')G.insertNode(G.newFxLayerObj('Blur',[G.fxItem('blur')],'base'),G.doc.root);
   if(kind==='clipped'){const C=G.newLayerObj('Clipped roughness');C.clip=true;G.clearTarget(G.ensureMapTarget(C,'rough'),[.1,.1,.1,1]);G.insertNode(C,G.doc.root);}
   if(kind==='dependent-mask'){L.mask=G.makeMask(1);L.mask.stack=[{id:'ref',kind:'ref',on:true,mode:'normal',op:1,p:{name:'Paint'}}];}
   G.composite();G.v3.mapsDirty=true;G.v3Refresh();const o={...G.brush,tool:'brush',size:11,color:[.9,.05,.1],flow:.8,opacity:.8,spacing:.2,pSize:false,smoothing:0,grain:0,tip:null,sym:null};
   if(kind==='multi-map')o.extras=[{key:'rough',mode:1,color:[.6,.6,.6]}];
   G.beginStroke(target,30,40,1,o);G.composite();G.v3Refresh();const before={...G.v3Work};G.addPoint(36,45,1);G.composite();const dirty=G.v3.mapsDirty;
   G.v3.lastFull=0;G.v3Refresh();const copy=G.v3Work.copyPixels-before.copyPixels,partial=G.v3Work.partialCopies-before.partialCopies,mip=G.v3Work.mipPixels-before.mipPixels;
   let same=true;for(const map of new Set([G.doc.map,'rough'])){const a=G.captureRegionNow(G.v3.tex[map],0,0,256,256).data,src=G.compositeMap(map),z=G.captureRegionNow(src,0,0,256,256).data;G.release(src);same=same&&a.every((v,i)=>Math.abs(v-z[i])<=1);}
   G.endStroke(true);G.composite();G.v3Refresh();return {dirty,copy,partial,mip,same,error:G.gl.getError()};},kind);
  console.log(kind,r);ok(r.same&&r.error===0,kind+' viewport texture agrees with full compositing');
  if(kind==='plain')ok(!r.dirty&&r.partial===1&&r.copy<65536*.05&&r.mip<21845*.05,'plain painting avoids unchanged maps and updates less than 5% of texture/mip pixels');
  else if(kind==='wrapped')ok(!r.dirty&&r.partial===0&&r.copy===65536,'wrapped strokes retain full texture coverage while reusing other maps');
  else ok(r.dirty&&r.partial===0,'complex strokes retain full material updates');
 }
 const post=await p.evaluate(()=>{const G=__gs,g=G.gl;G.newDoc(256,256,8,[.35,.45,.55],'Post',false);G.v3.on=true;G.v3s().unlit=false;G.useModel(G.primMesh('cube',1));G.composite();G.v3Refresh();
  G.v3s().post={bloom:{on:true,thr:.1},ao:{on:true},dof:{on:true},sharp:{on:true},grade:{on:true,exp:.3},vig:{on:true},ca:{on:true},grain:{on:true,animated:true},look:{on:true,mode:6}};
  const F=G.v3Targets(192,128),read=()=>G.captureRegionNow({fbo:F.rf,w:F.w,h:F.h,depth:8},0,0,F.w,F.h).data;G.v3.postSeed=17;G.v3Render(F);const initial=read(),before={...G.v3Work};
  G.v3.postSeed=25;const reused=G.v3Post(F,true),a=read(),passes=G.v3Work.postPasses-before.postPasses,scenes=G.v3Work.scenes-before.scenes;
  G.v3Render(F);const z=read(),same=a.every((v,i)=>v===z[i]),changed=a.some((v,i)=>v!==initial[i]);G.v3.dirty=false;G.v3.postDirty=false;G.postGrainTick();const sameSeed=!G.v3.postDirty;
  G.v3.postSeed=32;G.postGrainTick();const scheduled=G.v3.postDirty&&!G.v3.dirty;G.v3s().post.bloom.thr=.6;const settingsRejected=!G.v3Post(F,true);G.v3Render(F);G.v3PostFree(F);const freed=!F.px&&!G.v3Post(F,true);
  G.v3.postSeed=0;delete G.v3s().post;return {reused,same,changed,passes,scenes,sameSeed,scheduled,settingsRejected,freed,error:g.getError()};});
 console.log('post',post);ok(post.reused&&post.same&&post.changed,'cached animated grain matches a full scene redraw pixel for pixel');ok(post.passes===1&&post.scenes===0,'grain uses one final pass instead of redrawing the mesh and nine post passes');ok(post.sameSeed&&post.scheduled,'grain requests view-only work only when its animation seed changes');ok(post.settingsRejected&&post.freed&&post.error===0,'changed settings and freed caches cannot reuse stale scenes');
 await p.evaluate(()=>__gs.setMode('p3d',true));await p.waitForTimeout(400);
 const mesh=await p.evaluate(()=>{const G=__gs;G.v3s().detail=4;G.v3s().model='plane';G.useModel(G.primMesh('plane',4));G.v3s().disp=0;G.v3s().uvs=1;G.composite();G.v3Refresh();
  const sp=G.meshSpace(512,512),full=sp.bbox({bb:[230,230,245,245]}),b=sp.viewportBounds({bb:[230,230,245,245]});let safe=b&&b[0]<=full[0]&&b[1]<=full[1]&&b[2]>=full[2]&&b[3]>=full[3];
  return {safe,b,full,error:G.gl.getError()};});
 console.log('mesh bounds',mesh);ok(mesh.safe&&mesh.error===0,'cached mesh bounds conservatively cover the previous triangle-based bounds');
 const projected=await p.evaluate(()=>{const G=__gs,L=G.doc.active;G.setEditMap('base');G.setView('base');G.composite();G.v3.mapsDirty=true;G.v3Refresh();
  const sp=G.meshSpace(512,512),o={...G.brush,tool:'brush',space:sp,size:12,color:[.9,.05,.1],flow:1,opacity:1,spacing:.2,pSize:false,smoothing:0,grain:0,tip:null,sym:null};
  G.beginStroke(L,235,240,1,o);sp.sync();G.composite();G.v3Refresh();const before={...G.v3Work};let max=0;
  for(let i=1;i<6;i++){G.addPoint(235+i*3,240+i*2,1);sp.sync();G.composite();G.v3Refresh();const a=G.captureRegionNow(G.v3.tex.base,0,0,256,256).data,src=G.compositeMap('base'),z=G.captureRegionNow(src,0,0,256,256).data;G.release(src);for(let j=0;j<a.length;j++)max=Math.max(max,Math.abs(a[j]-z[j]));}
  const copy=G.v3Work.copyPixels-before.copyPixels,partial=G.v3Work.partialCopies-before.partialCopies;G.endStroke(true);G.composite();G.v3Refresh();return {max,copy,partial,error:G.gl.getError()};});
 console.log('projected stroke',projected);ok(projected.max<=1&&projected.error===0,'painting directly on the mesh matches full material compositing throughout a stroke');ok(projected.partial===5&&projected.copy<5*65536*.1,'projected brush strokes update less than 10% of texture pixels on a subdivided mesh');
 const camera=await p.evaluate(()=>{const G=__gs;G.composite();G.v3Refresh();const n=G.v3Work.copies;G.v3SnapView('front');G.v3SetOrtho(true);G.postEdit('vig','on',true);return n;});await p.waitForTimeout(250);ok(await p.evaluate(n=>__gs.v3Work.copies===n,camera),'camera and post controls do not rebuild material textures');
 await p.evaluate(()=>{const G=__gs;G.v3s().post={bloom:{on:true,thr:.1},ao:{on:true},grain:{on:true,animated:true}};G.v3.postSeed=17;G.pop3D(true,true);});
 await p.waitForFunction(()=>__gs.v3.pop&&!__gs.v3.pop.busy&&!__gs.v3.dirty&&__gs.v3.fbo?.px?.valid);
 const pop=await p.evaluate(()=>{const G=__gs;const before={...G.v3Work};G.v3.postSeed=25;G.postGrainTick();G.drawPop();return before;});await p.waitForTimeout(350);
 const detached=await p.evaluate(before=>{const G=__gs,r={scenes:G.v3Work.scenes-before.scenes,reuses:G.v3Work.postReuses-before.postReuses,error:G.gl.getError()};G.pop3D(false,true);G.v3.postSeed=0;delete G.v3s().post;return r;},pop);
 console.log('detached grain',detached);ok(detached.scenes===0&&detached.reuses===1&&detached.error===0,'detached viewport updates grain without redrawing the mesh');
 ok(errors.length===0,'no application errors '+errors.join(' | '));await b.close();if(server)await new Promise(r=>server.close(r));process.exit(failures?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
