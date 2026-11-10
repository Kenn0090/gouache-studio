/* 0.96.9 (Kenn: "like Substance Painter"): saving a smart material makes its picture on the Material preview model, from the
   built-in previews' angle, instead of a screenshot of the 3D view; the project is left exactly as it was. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>__gs.useModel(__gs.primMesh('sphere',1)));await W(600);
 /* a red material with an edge-wear style generator mask, in a folder */
 const before=await p.evaluate(()=>{const G=__gs;G.cmdNewFillLayer({name:'Red paint',maps:{base:{on:true,c:[.8,.1,.1]},rough:{on:true,v:.4},metal:{on:true,v:0}}});
   const L=G.doc.active;G.changedAll();
   const sig=()=>({n:G.doc.root.children.length,names:G.doc.root.children.map(c=>c.name).join(),w:G.doc.w,mesh:G.v3.mesh,meshName:G.v3.mesh.name,tris:G.v3.mesh.idx.length,cam:JSON.stringify(G.v3.cam),cur:G.p3.cur,sets:G.p3.sets.length,act:G.doc.active&&G.doc.active.name,undo:G.hist.undo.length,mm:Object.keys(G.doc.meshMaps||{}).join()});
   window.__sig=sig;const s=sig();return Object.assign({},s,{mesh:null});});
 await W(1500);
 const shot=async name=>{const r=await p.evaluate(()=>{const d=__gs.v3Offscreen(128,128,{});let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]*3+d[i+2]*7;
   const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),id=x.createImageData(128,128);id.data.set(d);x.putImageData(id,0,0);return {s,u:c.toDataURL()};});
   if(process.env.SHOTS)require('fs').writeFileSync(process.env.SHOTS+'/'+name+'.png',Buffer.from(r.u.split(',')[1],'base64'));return r.s;};
 const shotA=await shot('a');const _unused=await p.evaluate(()=>{const d=__gs.v3Offscreen(64,64,{});let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]*3+d[i+2]*7;return s;});
 await p.evaluate(()=>{const G=__gs,L=G.doc.active;G.smSave(L);});await W(300);
 await p.evaluate(()=>{const i=document.querySelector('#modal input[type=text]');if(i){i.value='Red test';i.dispatchEvent(new Event('input'));}});
 await p.click('#dlgOk');
 let rec=null;for(let i=0;i<120;i++){await W(500);rec=await p.evaluate(()=>{const r=__gs.matLib.list.find(x=>x.kind==='smart'&&x.name==='Red test');return r?{thumb:r.thumb||'',busy:__gs.smTh.busy}:null;});if(rec&&!rec.busy&&/^data:image\/webp/.test(rec.thumb))break;}
 ok(!!rec,'the smart material is saved');
 const pic=await p.evaluate(async u=>{const im=new Image();im.src=u;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);
   const d=x.getImageData(0,0,c.width,c.height).data;let red=0,grey=0,clear=0;for(let i=0;i<d.length;i+=4){if(d[i+3]<10){clear++;continue;}if(d[i]>d[i+1]*1.6&&d[i]>60)red++;else if(Math.abs(d[i]-d[i+1])<20)grey++;}
   const n=d.length/4;return {w:im.width,h:im.height,red:red/n,grey:grey/n,clear:clear/n,corner:d[3]};},rec.thumb);
 ok(pic.w===256&&pic.h===256,'the picture is 256 px '+JSON.stringify(pic));
 ok(pic.red>.1,'it shows the red material');
 ok(pic.clear>.1&&pic.corner<10,'on a see-through background, like the built-in previews (the model, not the 3D view)');
 const after=await p.evaluate(()=>{const s=window.__sig();return Object.assign({},s,{same:s.mesh===__gs.v3.mesh,mesh:null});});
await W(1500);const shotB=await shot('b');const _u2=await p.evaluate(()=>{const d=__gs.v3Offscreen(64,64,{});let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]*3+d[i+2]*7;return s;});
 const strip=o=>JSON.stringify(Object.assign({},o,{mesh:null,same:null}));
 ok(strip(before)===strip(after),'the project is left as it was '+strip(after));
 ok(Math.abs(shotA-shotB)/shotA<.01,'and the 3D view still shows your model the same ('+shotA+' / '+shotB+')');
 /* ↻ redoes it */
 const n1=await p.evaluate(()=>{const r=__gs.matLib.list.find(x=>x.name==='Red test');r.thumb='x';__gs.smThumbRedo(r);return 1;});
 let t2='';for(let i=0;i<60;i++){await W(500);t2=await p.evaluate(()=>__gs.matLib.list.find(x=>x.name==='Red test').thumb);if(t2.length>2000)break;}
 if(process.env.SHOTS)require('fs').writeFileSync(process.env.SHOTS+'/thumb.webp',Buffer.from(rec.thumb.split(',')[1],'base64'));
 ok(/^data:image/.test(t2),'Redo preview makes it again');
 ok(errs.length===0,'no page errors '+errs.join('\n').slice(0,800));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
