/* 0.96.1: Warp rows and generator Distort stay continuous across UV seams on a model; texture tiles drop onto a
   generator's Grunge box; the grunge has Contrast and Level */
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
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 /* a sphere whose UV seam sits in the middle of the texture (u from .25 to .75) */
 await p.evaluate(()=>{const G=__gs,s=G.primMesh('sphere',0),uv=new Float32Array(s.uv);for(let i=0;i<uv.length;i+=2)uv[i]=.25+uv[i]*.5;
   const m=Object.assign({},s,{uv,name:'seamsphere'});for(const k of Object.keys(m))if(k[0]==='_')delete m[k];G.v3.imported=m;G.v3s().model='imported';G.v3.mesh=null;G.v3.dirty=true;G.requestRender(true);});await W(1500);
 const seam=()=>p.evaluate(()=>{const G=__gs,L=G.doc.active;G.msUpdate(L);const t=L.mask.target,d=G.captureRegionNow(t,0,0,t.w,t.h).data,W=t.w,H=t.h;
   /* the texels right at the two sides of the seam are neighbours on the model: compare them with neighbours inside the island */
   const x0=Math.round(W*.25),x1=Math.round(W*.75)-1,xm=Math.round(W*.5);let diff=0,n=0,spread=0;
   for(let y=Math.round(H*.2);y<H*.8;y++){const a=d[(y*W+x0)*4],c=d[(y*W+x1)*4];diff+=Math.abs(a-c);spread+=Math.abs(d[(y*W+xm)*4]-d[(y*W+xm+1)*4]);n++;}return {diff:diff/n,spread:spread/n};});
 await p.evaluate(()=>{const G=__gs;G.selectOnly(G.layerByName('Paint'));G.msAdd(G.doc.active,'noise',{p:Object.assign(G.MS_KINDS.noise.p(),{type:'grunge',scale:5,contrast:2})});});await W(800);
 const s0=await seam();
 await p.evaluate(()=>{const G=__gs;G.msAdd(G.doc.active,'filter',{own:'warp',p:{r:8,scale:6,seed:1}});});await W(1500);
 const s1=await seam();
 ok(s0.diff<s0.spread*1.6+4,'a world noise is continuous across the seam (difference '+s0.diff.toFixed(1)+', neighbours inside '+s0.spread.toFixed(1)+')');
 ok(s1.diff<s1.spread*1.6+4,'after a Warp row it is still continuous across the seam (difference '+s1.diff.toFixed(1)+', neighbours inside '+s1.spread.toFixed(1)+')');
 await p.evaluate(()=>{window.__oldWarp=true;const L=__gs.doc.active,r=L.mask.stack.find(x=>x.own==='warp');r.p.r=8.0001;L.mask._key=null;});await W(800);const sOld=await seam();await p.evaluate(()=>{window.__oldWarp=false;const L=__gs.doc.active,r=L.mask.stack.find(x=>x.own==='warp');r.p.r=8;L.mask._key=null;});await W(800);
 ok(sOld.diff>sOld.spread*1.6,'(check) the old flat Warp did break at the seam');
 console.log('  (the old flat Warp: difference '+sOld.diff.toFixed(1)+', neighbours inside '+sOld.spread.toFixed(1)+')');
 /* (0.96.1) Slope blur row and the Slope blur filter */
 await p.evaluate(()=>{const G=__gs,L=G.doc.active;L.mask.stack.splice(0);G.msAdd(L,'noise',{p:Object.assign(G.MS_KINDS.noise.p(),{type:'grunge',scale:5,contrast:2})});G.msAdd(L,'filter',{own:'slope',p:{r:8,scale:6,seed:1}});});await W(1500);
 const s3=await seam();ok(s3.diff<s3.spread*1.6+4,'a Slope blur row is continuous across the seam (difference '+s3.diff.toFixed(1)+', inside '+s3.spread.toFixed(1)+')');
 await p.evaluate(()=>{window.__oldWarp=true;const L=__gs.doc.active,r=L.mask.stack.find(x=>x.own==='slope');r.p.r=8.0001;L.mask._key=null;});await W(800);const s3o=await seam();await p.evaluate(()=>{window.__oldWarp=false;});
 console.log('  (the old flat Slope blur: difference '+s3o.diff.toFixed(1)+', inside '+s3o.spread.toFixed(1)+')');
 for(const guide of ['self','noise']){
  const fx=await p.evaluate(guide=>{const G=__gs,L=G.doc.active;L.mask.stack.splice(0);G.msAdd(L,'noise',{p:Object.assign(G.MS_KINDS.noise.p(),{type:'grunge',scale:5,contrast:2})});G.msUpdate(L);
    const t=L.mask.target,o=G.makeTarget(t.w,t.h,8,false),res={};
    for(const old of [false,true]){window.__oldWarp=old;G.FX.slopeBlur.render(t,o,{amt:24,steps:16,mode:'blur',guide,size:40,seed:1,gtile:1,meshSeams:true});
      const d=G.captureRegionNow(o,0,0,o.w,o.h).data,W=o.w,H=o.h,x0=Math.round(W*.25),x1=Math.round(W*.75)-1,xm=Math.round(W*.5);let diff=0,n=0,spread=0;
      for(let y=Math.round(H*.2);y<H*.8;y++){diff+=Math.abs(d[(y*W+x0)*4]-d[(y*W+x1)*4]);spread+=Math.abs(d[(y*W+xm)*4]-d[(y*W+xm+1)*4]);n++;}res[old?'old':'now']={diff:diff/n,spread:spread/n};}
    window.__oldWarp=false;G.disposeTarget(o);return res;},guide);
  ok(fx.now.diff<fx.now.spread*1.6+4,'Slope blur filter ('+guide+') is continuous across the seam (difference '+fx.now.diff.toFixed(1)+', inside '+fx.now.spread.toFixed(1)+'; old flat one '+fx.old.diff.toFixed(1)+')');}
 /* generator with Distort */
 await p.evaluate(()=>{const G=__gs,L=G.doc.active;for(const r of L.mask.stack.slice())if(r.kind!=='paint'){}L.mask.stack.splice(0);G.msAdd(L,'gen',{p:Object.assign(G.msGenDefaults('dust'),{distort:1})});});await W(1500);
 const s2=await seam();ok(s2.diff<s2.spread*1.6+4,'a generator with Distort is continuous across the seam (difference '+s2.diff.toFixed(1)+')');
 /* drop a texture tile onto the Grunge box */
 await p.evaluate(()=>{const G=__gs,L=G.doc.active,r=L.mask.stack.find(x=>x.kind==='gen');G.ui.msSel={L,where:'m',id:r.id};G.ui.editMask=true;G.showPanel('matEd');G.renderMatEd(true);});await W(400);
 await p.evaluate(()=>__gs.showPanel('textures'));await W(600);
 const tile=p.locator('.txtile').first(),box=p.locator('#msGrungeDrop');await box.scrollIntoViewIfNeeded();await tile.scrollIntoViewIfNeeded();await W(200);
 const tb=await tile.boundingBox(),bb=await box.boundingBox();
 console.log('  target at box:',await p.evaluate(([x,y])=>{const T=__gs.libTarget(x,y,{kind:'tex'});return T?Object.keys(T).join(','):'none';},[bb.x+bb.width/2,bb.y+bb.height/2]),await p.evaluate(([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id+' '+e.className);},[bb.x+bb.width/2,bb.y+bb.height/2]));
 if(tb&&bb){await p.mouse.move(tb.x+tb.width/2,tb.y+tb.height/2);await p.mouse.down();await p.mouse.move(tb.x+40,tb.y+10,{steps:4});await p.mouse.move(bb.x+bb.width/2,bb.y+bb.height/2,{steps:8});await p.mouse.up();await W(600);}
 const g=await p.evaluate(()=>{const r=__gs.doc.active.mask.stack.find(x=>x.kind==='gen');return r.p.gimg;});
 ok(!!(g&&g.id),'a texture tile dropped on the Grunge box becomes the grunge '+JSON.stringify(g)+' tile:'+!!tb+' box:'+!!bb);
 await p.evaluate(()=>{const G=__gs,L=G.doc.active;G.renderMatEd(true);});await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('ms_gcon')&&!!document.getElementById('ms_glev')),'the grunge has Contrast and Level sliders');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
