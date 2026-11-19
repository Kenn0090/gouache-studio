/* 0.98.20 (Kenn: "inconsistent brush sizes", "the alignment not matching perfectly", "painting on edges isn't working properly"): the surface
   brush on models with real UV layouts (models9820.cjs: a box with faces packed at four densities, a tube with a seam, stretched side, caps).
   Single dabs: the paint's size measured in space is the brush's size everywhere (reach), solid inside (solid), centred under the pointer (off),
   nothing in empty texture (gutter), and the outline ring drawn on the model is the same size. Strokes over an edge, a seam and onto a cap
   leave no gaps along their path. */
const {chromium}=require('playwright');const M=require('./models9820.cjs');const ALIGN='wrap',SURF=true,VID=false;let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext(Object.assign({viewport:{width:1100,height:760}},VID?{recordVideo:{dir:__dirname+'/vid',size:{width:1100,height:760}}}:{}));const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 const hb=await p.locator('#v3Hit').boundingBox();
 const load=async(name,cam)=>{await p.evaluate(async([q,c,A,S])=>{const g=__gs;const m=await g.parseModelBytes('t.obj',new TextEncoder().encode(q),{noUp:true});g.v3.imported=g.p3.imported=m;const s=g.v3s();s.model='imported';g.v3.mesh=null;
   s.paintAlign=A;s.surfWrap=S;s.sizeSpace='object';g.doc.active=g.layerByName('Paint');g.v3.paintOn=true;
   Object.assign(g.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,pFlow:false,pOpacity:false,tip:null,spacing:.08});g.setFG([.9,.1,.1]);Object.assign(g.v3.cam,c);g.v3.dirty=true;g.requestRender(true);},[M[name](),cam,ALIGN,SURF]);await p.waitForTimeout(1800);};
 const measure=(x,y)=>p.evaluate(([x,y])=>{const g=__gs,hit=document.getElementById('v3Hit'),R=hit.getBoundingClientRect(),pk=g.v3PickFast(hit,{clientX:x,clientY:y});if(!pk)return {miss:true};
   const s=g.v3s(),cam=g.v3.cam,cp=Math.cos(cam.pitch),t=[cam.tx,cam.ty,cam.tz],eye=[t[0]+Math.sin(cam.yaw)*cp*cam.dist,t[1]+Math.sin(cam.pitch)*cam.dist,t[2]+Math.cos(cam.yaw)*cp*cam.dist];
   const nrm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
   const f=nrm(t.map((v,i)=>v-eye[i])),rt=nrm(cr(f,[0,1,0])),up=cr(rt,f),th=Math.tan(s.fov*Math.PI/360),nx=((x-R.left)/R.width*2-1)*th*R.width/R.height,ny=(1-(y-R.top)/R.height*2)*th;
   const dir=nrm(f.map((v,i)=>v+rt[i]*nx+up[i]*ny)),c=eye.map((v,i)=>v+dir[i]*pk.dist);
   const C=g.fillPosMaps(),gl=document.getElementById('gl').getContext('webgl2'),W=C.pos.w,H=C.pos.h,P=new Float32Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,C.pos.fbo);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,P);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
   const L=g.layerByName('Paint'),T=g.mapT(L,'base'),d=g.captureRegionNow(T,0,0,T.w,T.h).data;
   let rmax=0,rmin=1e9,n=0,gut=0;for(let i=0;i<W*H;i++){const on=d[i*4+3]>=128;if(P[i*4+3]<.5){if(on)gut++;continue;}const dd=Math.hypot(P[i*4]-c[0],P[i*4+1]-c[1],P[i*4+2]-c[2]);if(on){n++;if(dd>rmax)rmax=dd;}else if(dd<rmin)rmin=dd;}
   const curPx=g.brush.size/2*g.meshBrushScale(R.height),depth=pk.dist,cursorR=curPx*2*depth*th/R.height,target=g.brush.size/2*(g.v3.mesh.radius||1)/256;
   const u=Math.min(W-1,Math.floor(pk.uv[0]*W)),v=Math.min(H-1,Math.floor(pk.uv[1]*H)),k=(v*W+u)*4,cu=[P[k],P[k+1],P[k+2]];
   /* where the paint really is: its centre */let sx=0,sy=0,sz=0;for(let i=0;i<W*H;i++){if(d[i*4+3]<128||P[i*4+3]<.5)continue;sx+=P[i*4];sy+=P[i*4+1];sz+=P[i*4+2];}
   const pc=n?[sx/n,sy/n,sz/n]:c;
   return {off:+(Math.hypot(pc[0]-c[0],pc[1]-c[1],pc[2]-c[2])/target).toFixed(2),rayVsUv:+(Math.hypot(cu[0]-c[0],cu[1]-c[1],cu[2]-c[2])/target).toFixed(2),reach:+(rmax/target).toFixed(2),solid:+(Math.min(rmin,rmax)/target).toFixed(2),cursor:+(cursorR/target).toFixed(2),texels:n,gutter:gut,target:+target.toFixed(4)};},[x,y]);
 const clear=()=>p.evaluate(()=>{const g=__gs,L=g.layerByName('Paint'),T=g.mapT(L,'base');g.clearTarget(T);g.v3.mapsDirty=true;g.v3.dirty=true;g.requestRender(true);});
 const dab=async(fx,fy)=>{const x=hb.x+hb.width*fx,y=hb.y+hb.height*fy;await p.mouse.move(x,y);await p.waitForTimeout(200);const ring=await p.evaluate(()=>__gs.v3.ring?__gs.v3.ring.r:null);await p.mouse.down();await p.waitForTimeout(60);await p.mouse.up();await p.waitForTimeout(900);const r=await measure(x,y);r.ring=ring&&r.target?+(ring/r.target).toFixed(2):null;if(!VID)await clear();await p.waitForTimeout(200);return r;};
 /* a stroke from (fa) to (fb): for points along its 3D path, the distance to the nearest unpainted texel (gaps show as small values) */
 const pathPts=async(fa,fb,n)=>{const out=[];for(let k=0;k<=n;k++){const fx=fa[0]+(fb[0]-fa[0])*k/n,fy=fa[1]+(fb[1]-fa[1])*k/n;out.push([hb.x+hb.width*fx,hb.y+hb.height*fy]);}return out;};
 const strokeTest=async(fa,fb,N)=>{const pts=await pathPts(fa,fb,N||24);await p.mouse.move(pts[0][0],pts[0][1]);await p.waitForTimeout(200);await p.mouse.down();for(const q of pts.slice(1)){await p.mouse.move(q[0],q[1]);await p.waitForTimeout(40);}await p.mouse.up();await p.waitForTimeout(1200);
   const r=await p.evaluate(pts=>{const g=__gs,hit=document.getElementById('v3Hit'),R=hit.getBoundingClientRect(),s=g.v3s(),cam=g.v3.cam,cp=Math.cos(cam.pitch),t=[cam.tx,cam.ty,cam.tz],eye=[t[0]+Math.sin(cam.yaw)*cp*cam.dist,t[1]+Math.sin(cam.pitch)*cam.dist,t[2]+Math.cos(cam.yaw)*cp*cam.dist];
     const nrm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],f=nrm(t.map((v,i)=>v-eye[i])),rt=nrm(cr(f,[0,1,0])),up=cr(rt,f),th=Math.tan(s.fov*Math.PI/360);
     const C=g.fillPosMaps(),gl=document.getElementById('gl').getContext('webgl2'),W=C.pos.w,H=C.pos.h,P=new Float32Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,C.pos.fbo);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,P);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
     const L=g.layerByName('Paint'),T=g.mapT(L,'base'),d=g.captureRegionNow(T,0,0,T.w,T.h).data,target=g.brush.size/2*(g.v3.mesh.radius||1)/256;
     const un=[];for(let i=0;i<W*H;i++)if(P[i*4+3]>.5&&d[i*4+3]<128)un.push(i);let worst=1e9,gut=0;for(let i=0;i<W*H;i++)if(P[i*4+3]<.5&&d[i*4+3]>=128)gut++;
     for(const [x,y] of pts.slice(2,-2)){const pk=g.v3PickFast(hit,{clientX:x,clientY:y});if(!pk)continue;const nx=((x-R.left)/R.width*2-1)*th*R.width/R.height,ny=(1-(y-R.top)/R.height*2)*th,dir=nrm(f.map((v,i)=>v+rt[i]*nx+up[i]*ny)),c=eye.map((v,i)=>v+dir[i]*pk.dist);
       let m=1e9;for(const i of un){const dd=Math.hypot(P[i*4]-c[0],P[i*4+1]-c[1],P[i*4+2]-c[2]);if(dd<m)m=dd;}if(m<worst)worst=m;}
     const cs=[];for(const [x,y] of pts){const pk=g.v3PickFast(hit,{clientX:x,clientY:y});if(!pk)continue;const nx=((x-R.left)/R.width*2-1)*th*R.width/R.height,ny=(1-(y-R.top)/R.height*2)*th,dir=nrm(f.map((v,i)=>v+rt[i]*nx+up[i]*ny));cs.push(eye.map((v,i)=>v+dir[i]*pk.dist));}
     const segD=(p,a,b)=>{const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],ap=[p[0]-a[0],p[1]-a[1],p[2]-a[2]],t=Math.max(0,Math.min(1,(ab[0]*ap[0]+ab[1]*ap[1]+ab[2]*ap[2])/Math.max(1e-12,ab[0]*ab[0]+ab[1]*ab[1]+ab[2]*ab[2])));return Math.hypot(ap[0]-ab[0]*t,ap[1]-ab[1]*t,ap[2]-ab[2]*t);};
     let far=0;for(let i=0;i<W*H;i++){if(d[i*4+3]<128||P[i*4+3]<.5)continue;const q=[P[i*4],P[i*4+1],P[i*4+2]];let m=1e9;for(let k=1;k<cs.length;k++)m=Math.min(m,segD(q,cs[k-1],cs[k]));if(m>2.5*target)far++;}
     return {coverAlongPath:+(worst/target).toFixed(2),gutter:gut,farPaint:far};},pts);
   await clear();return r;};
 const rows=[];
 await load('box',{yaw:.6,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});
 for(const [n,fx,fy] of [['box front (dense)',.44,.6],['box right (medium)',.6,.56],['box top (sparse)',.5,.36],['box edge front|right',.53,.62],['box corner',.53,.42]])rows.push([n,await dab(fx,fy)]);
 await load('tube',{yaw:0,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});
 for(const [n,fx,fy] of [['tube side',.5,.62],['tube side, at a slant',.62,.62],['tube cap',.5,.38],['tube rim (side|cap)',.5,.47],['tube seam (back)',.5,.62,true]])rows.push([n,await dab(fx,fy)]);
 {
  await load('box',{yaw:.6,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});rows.push(['stroke box front→right',await strokeTest([.38,.62],[.7,.58])]);rows.push(['stroke box top→front',await strokeTest([.5,.3],[.46,.7])]);
  await load('tube',{yaw:0,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});rows.push(['stroke over tube seam',await strokeTest([.35,.62],[.65,.62])]);rows.push(['stroke side→cap',await strokeTest([.5,.7],[.5,.3])]);
  /* (0.98.24, Kenn's video) strong smoothing and a few big pen jumps (a hiccup): no paint away from the stroke, still no gaps */
  await p.evaluate(()=>{__gs.brush.smoothing=.7;});rows.push(['jumpy smoothed over tube seam',await strokeTest([.35,.62],[.65,.62],5)]);
  await load('box',{yaw:.6,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});await p.evaluate(()=>{__gs.brush.smoothing=.7;});rows.push(['jumpy smoothed box top→front',await strokeTest([.5,.3],[.46,.7],5)]);await p.evaluate(()=>{__gs.brush.smoothing=0;});}
 /* (0.98.24, Kenn's video: paint on the arms while painting the chest) a straight line on the texture that crosses other islands is not joined */
 {await load('box',{yaw:.6,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});const r=await p.evaluate(()=>{const g=__gs,W=g.doc.w,H=g.doc.h;g.uvmBuild();
    /* the box's faces on the texture (the file's v is flipped on loading): front .05–.45 × .55–.95, right .55–.85 × .40–.70, back .55–.75 × .75–.95, bottom .55–.85 × .05–.35 */
    const ok=(a,b)=>g.swSegOk(a[0]*W,a[1]*H,b[0]*W,b[1]*H);return {inFace:ok([.12,.64],[.38,.88]),acrossGap:ok([.4,.6],[.7,.55]),overIsland:ok([.65,.8],[.65,.2])};});
  console.log('joined?',JSON.stringify(r));ok(r.inFace,'a line inside one face is joined');ok(!r.acrossGap,'a line over empty texture is not');ok(!r.overIsland,'a line from one face across another face to a third is not');}
 /* Projection › Backface culling angle: 90° paints round a square edge, 45° keeps paint off the face round the corner */
 {await load('box',{yaw:.6,pitch:.45,dist:4.2,tx:0,ty:0,tz:0});const proj=pt=>p.evaluate(pt=>{const g=__gs,R=document.getElementById('v3Hit').getBoundingClientRect(),s=g.v3s(),cam=g.v3.cam,cp=Math.cos(cam.pitch),t=[cam.tx,cam.ty,cam.tz],eye=[t[0]+Math.sin(cam.yaw)*cp*cam.dist,t[1]+Math.sin(cam.pitch)*cam.dist,t[2]+Math.cos(cam.yaw)*cp*cam.dist];
     const nrm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l);},cr=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],f=nrm(t.map((v,i)=>v-eye[i])),rt=nrm(cr(f,[0,1,0])),up=cr(rt,f),th=Math.tan(s.fov*Math.PI/360);
     const d=pt.map((v,i)=>v-eye[i]),z=dot(d,f),nx=dot(d,rt)/z/(th*R.width/R.height),ny=dot(d,up)/z/th;return [R.left+(nx+1)/2*R.width,R.top+(1-ny)/2*R.height];},pt);
  /* the edge between the front (z = 1) and right (x = 1) faces, just on the front side */
  const E=await proj([0.985,0.1,1]);
  const sideOf=async ang=>{await p.evaluate(a=>{__gs.v3s().cullAngle=a;},ang);const x=E[0],y=E[1];await p.mouse.move(x,y);await p.waitForTimeout(200);await p.mouse.down();await p.mouse.up();await p.waitForTimeout(900);
   const n=await p.evaluate(()=>{const g=__gs,C=g.fillPosMaps(),gl=document.getElementById('gl').getContext('webgl2'),W=C.nrm.w,H=C.nrm.h,N=new Float32Array(W*H*4);gl.bindFramebuffer(gl.FRAMEBUFFER,C.nrm.fbo);gl.readPixels(0,0,W,H,gl.RGBA,gl.FLOAT,N);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
     const T=g.mapT(g.layerByName('Paint'),'base'),d=g.captureRegionNow(T,0,0,T.w,T.h).data;let f=0,r=0;for(let i=0;i<W*H;i++){if(d[i*4+3]<128)continue;if(N[i*4+2]>.9)f++;else if(N[i*4]>.9)r++;}return [f,r];});await clear();await p.waitForTimeout(200);return n;};
  const a90=await sideOf(90),a45=await sideOf(45);await p.evaluate(()=>{__gs.v3s().cullAngle=90;});console.log('edge dab: front/right texels at 90°',a90,'at 45°',a45);
  ok(a90[0]>50&&a90[1]>50,'at 90° a dab on the edge paints both faces');ok(a45[1]<a90[1]*.25&&a45[0]>50,'at 45° the face round the corner is left (almost) unpainted');}
 for(const [n,r] of rows)console.log(n.padEnd(24),JSON.stringify(r));
 for(const [n,r] of rows){if(r.miss){ok(false,n+': missed the model');continue;}
   if('reach' in r){ok(r.reach>.85&&r.reach<1.12,n+': the paint is the brush size on the model ('+r.reach+')');ok(r.solid>.8,n+': solid inside ('+r.solid+')');ok(r.gutter===0,n+': nothing in empty texture');
     ok(r.ring>.97&&r.ring<1.03,n+': the outline on the model is the same size ('+r.ring+')');if(!/top|corner/.test(n))ok(r.off<.15,n+': centred under the pointer ('+r.off+')');}
   else ok(r.coverAlongPath>.8&&r.gutter===0&&r.farPaint===0,n+': no gaps along the stroke, no paint away from it ('+r.coverAlongPath+', '+r.farPaint+' px away)');}
 ok(!errs.length,'no page errors '+[...new Set(errs)].slice(0,3).join(' | '));await ctx.close();await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
