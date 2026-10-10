/* 0.53.1: the metal normal maps in Textures (tag Normals, 4096 px), their uses, and the quiet Maps rows. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const items=await p.evaluate(()=>__gs.txItems().filter(i=>i.category==='Normals').map(i=>i.name));
 ok(items.length>=19,'Textures has '+items.length+' normal maps under the Normals tag');
 for(const w of ['Bare metal','Dents','Brushed metal','Galvanized'])ok(items.some(n=>n.includes(w)),'has '+w);
 // they are tangent-space normals: mostly blue, flat areas near (128,128,255), and 4096 px
 const info=await p.evaluate(()=>{const t=__gs.txGenTarget('nm-dent-large',4096),d=__gs.captureRegionNow(t,0,0,64,64).data;let b=0;for(let i=0;i<d.length;i+=4)b+=d[i+2];const o={w:t.w,h:t.h,blue:b/(d.length/4)};__gs.disposeTarget(t);return o;});
 ok(info.w===4096&&info.h===4096,'a normal texture is 4096 × 4096 ('+info.w+')');ok(info.blue>180,'it is a normal map: mostly blue ('+Math.round(info.blue)+')');
 // seamless: the left and right edge columns agree about as much as neighbouring columns do
 const seam=await p.evaluate(()=>{const out=[];for(const id of ['nm-galv-large','nm-brush-cross','nm-dent-hammered','nm-bare-sanded']){const t=__gs.txGenTarget(id,512),W=512,D=__gs.captureRegionNow(t,0,0,W,W).data;
   const col=x=>{const a=[];for(let y=0;y<W;y++)a.push(D[(y*W+x)*4]);return a;},row=y=>{const a=[];for(let x=0;x<W;x++)a.push(D[(y*W+x)*4]);return a;},gap=(a,b)=>a.reduce((s,v,i)=>s+Math.abs(v-b[i]),0)/W;
   let ix=0,iy=0;for(let k=10;k<W-10;k+=20){ix=Math.max(ix,gap(col(k),col(k+1)));iy=Math.max(iy,gap(row(k),row(k+1)));}
   out.push([id,gap(col(0),col(W-1))<=ix*1.2+2&&gap(row(0),row(W-1))<=iy*1.2+2]);__gs.disposeTarget(t);}return out;});
 for(const [id,good] of seam)ok(good,id+' tiles without a seam');
 // use them on a model
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'SG',false,'pbrsg'));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.p3NewProject(512,{setup:'pbr',workflow:'metal',startMaterial:'steel'});});await p.waitForTimeout(2500);
 await p.evaluate(()=>{const s=document.getElementById('v3Model');s.value='sphere';s.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(1200);
 const px=()=>p.evaluate(()=>{const a=__gs.v3Offscreen(96,96,{transparent:true});let r=0;for(let i=0;i<a.length;i+=4)r+=a[i]*a[i]/1000;return Math.round(r);});
 const base=await px();await p.click('text=Base material');await p.waitForTimeout(500);
 await p.evaluate(async()=>{await __gs.txToChannel(__gs.txItems().find(i=>i.id==='nm-brush-fine'),'normal');});await p.waitForTimeout(2500);
 const a=await px();ok(a!==base,'as the material normal channel it changes the model ('+base+' → '+a+')');
 await p.evaluate(async()=>{await __gs.txToLayer(__gs.txItems().find(i=>i.id==='nm-dent-hammered'));});await p.waitForTimeout(2500);
 const c=await px();ok(c!==a&&await p.evaluate(()=>__gs.allLayers().some(l=>/Hammered/.test(l.name)&&l.maps&&l.maps.normal)),'as a layer it goes into the Normal map and changes the model ('+a+' → '+c+')');
 // the quiet Maps rows
 await p.evaluate(()=>{const t=__gs.makeTarget(1024,1024,8,false);__gs.clearTarget(t,[.5,.5,1,1]);__gs.p3MapSet('normal',t,'Baked normal');__gs.showPanel('maps');});await p.waitForTimeout(600);
 const rows=await p.evaluate(()=>{const f=document.querySelector('[data-mesh-slot=normal]'),e=document.querySelector('[data-mesh-slot=curv]');return {h:f.getBoundingClientRect().height,btns:[...f.querySelectorAll('button')].map(b=>b.getAttribute('aria-label')),emptyBtn:e.querySelector('button').textContent,size:f.querySelector('.meshslotsize').textContent};});
 ok(rows.h<40,'a mesh-map row is one slim line ('+Math.round(rows.h)+' px)');
 ok(rows.btns.join()==='View on the model,Edit in 2D,Replace…,Remove Normal','a filled row has view, edit, replace and remove icons');
 ok(rows.emptyBtn==='Import…'&&rows.size==='1024','an empty row is just Import…, a filled one shows its size');
 ok(errs.length===0,'no page errors '+errs.slice(0,2));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
