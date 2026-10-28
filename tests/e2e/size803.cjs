/* 0.80.3: smaller 3D projects: live material channels are not stored twice, identical pictures are stored once, baked
   grey maps are compressed, and a half-size copy can be saved. Everything must reopen as it was. */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();{const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:OLD+'../../assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.click('#p3PreviewMaps');for(let i=0;i<900;i++){if(await p.evaluate(()=>__gs.allNodes(__gs.doc.root).some(n=>n.name==='Preview mesh material')))break;await W(200);}await W(1500);
 await p.evaluate(async()=>{const G=__gs,rec=G.gmRecs.find(r=>r.bundled&&r.bundled.file==='old-red-bricks.gmat');await G.gmApply(rec);await G.gmApply(rec);});await W(1500);
 const snap=()=>p.evaluate(()=>{const G=__gs,out={};G.changedAll&&G.changedAll();G.composite();for(const k of ['base','rough','normal']){if(!G.doc.maps.includes(k))continue;const t=G.compositeMap(k),d=G.captureRegionNow(t,0,0,G.doc.w,G.doc.h).data;G.release(t);
   let s=0;const a=[];for(let i=0;i<d.length;i+=4*37){a.push(d[i],d[i+1],d[i+2]);}out[k]=a;}return {out,w:G.doc.w,layers:G.allNodes(G.doc.root).map(n=>n.name).join()};});
 const before=await snap();
 /* save: what is in the file */
 const info=await p.evaluate(async()=>{const G=__gs,blob=await G.encodeP3Project(),buf=await blob.arrayBuffer();window.__p3buf=buf;
   const dv=new DataView(buf),hl=dv.getUint32(12,true),head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,hl))),S=head.sets[0],sub=buf.slice(16+hl+S.o,16+hl+S.o+S.n);
   const dv2=new DataView(sub),hl2=dv2.getUint32(12,true),h2=JSON.parse(new TextDecoder().decode(new Uint8Array(sub,16,hl2)));
   const L=[];const walk=a=>{for(const n of a){if(n.kids)walk(n.kids);else L.push(n);}};walk(h2.kids);
   const bricks=L.filter(n=>/brick/i.test(n.name));const live=L.flatMap(n=>Object.values(n.maps||{})).filter(r=>r.live);
   const dup=bricks.length===2&&bricks[0].fillImg&&bricks[1].fillImg&&Object.keys(bricks[0].fillImg).every(k=>bricks[1].fillImg[k]&&bricks[1].fillImg[k].o===bricks[0].fillImg[k].o);
   return {size:blob.size,live:live.length,liveStored:live.filter(r=>r.o!==undefined).length,dup,mm:Object.fromEntries(Object.entries(h2.meshMaps||{}).map(([k,r])=>[k,r.f||'']))};});
 console.log('  file:',JSON.stringify(info));
 ok(info.live>0&&info.liveStored===0,'live material channels are saved as markers only ('+info.live+' channels, none stored as pictures)');
 ok(info.dup,'the same material picture used by two layers is stored once');
 ok(['ao','curv','thick'].some(k=>info.mm[k]==='w')&&info.mm.normal!=='w','baked grey maps are compressed (WebP), the baked normal stays exact: '+JSON.stringify(info.mm));
 /* reopen: it looks the same */
 await p.evaluate(async()=>{__gs.p3.savedAt=__gs.p3Sig();await __gs.openP3Project(window.__p3buf.slice(0),'x.gouache3d');});await W(2500);
 const after=await snap();
 let d=0,n=0;for(const k in before.out){const a=before.out[k],b2=after.out[k];if(!b2){d+=999;continue;}for(let i=0;i<a.length;i++){d+=Math.abs(a[i]-b2[i]);n++;}}
 ok(after.layers===before.layers,'the layers come back');ok(n>0&&d/n<1.5,'and look the same after reopening (average difference '+(d/Math.max(1,n)).toFixed(2)+' of 255)');
 /* a smaller copy */
 const small=await p.evaluate(async()=>{const G=__gs,blob=await G.encodeP3Project({scale:.5}),buf=await blob.arrayBuffer();window.__p3small=buf;return blob.size;});
 ok(small<info.size*.6,'a half-size copy is much smaller ('+(info.size/1048576).toFixed(2)+' MB → '+(small/1048576).toFixed(2)+' MB)');
 await p.evaluate(async()=>{__gs.p3.savedAt=__gs.p3Sig();await __gs.openP3Project(window.__p3small.slice(0),'small.gouache3d');});await W(2500);
 const sm=await snap();ok(sm.w===128&&sm.layers===before.layers,'and opens at half size with every layer ('+sm.w+' px)');
 ok(await p.evaluate(()=>{__gs.dlgSaveSmall();return !!document.getElementById('ssSize');}),'File › Save a smaller copy… opens');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
