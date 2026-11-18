/* 0.98.16: the 3D view keeps one-channel copies of grey maps from 4096×4096 up; the model must look the same.
   __v3MonoPx lowers the limit so a small test canvas uses them. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
async function shot(mono){const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1200,height:800}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 if(mono)await p.addInitScript(()=>{window.__v3MonoPx=1;});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(async()=>{const g=__gs;g.setMode('paint');g.p3.started=false;await g.p3NewProject(256,{modelKey:'sphere'});const L=g.paintLayers().find(x=>x.fill);
   L.fill.maps.base.c=[.8,.3,.2];if(L.fill.maps.rough){L.fill.maps.rough.on=true;L.fill.maps.rough.v=.25;}if(L.fill.maps.metal){L.fill.maps.metal.on=true;L.fill.maps.metal.v=.6;}g.fillRender(L);
   Object.assign(g.v3.cam,{yaw:.4,pitch:.2,dist:3,tx:0,ty:0,tz:0});g.v3.mapsDirty=true;g.v3.dirty=true;g.requestRender(true);});
 await p.waitForTimeout(3000);
 const r=await p.evaluate(()=>{const g=__gs,t=g.v3.tex;return {mono:Object.keys(t).filter(k=>t[k]&&t[k].mono)};});
 const box=await p.evaluate(()=>{const R=document.getElementById('v3Hit').getBoundingClientRect();return [R.x,R.y,R.width,R.height];});
 const png=await p.screenshot({clip:{x:box[0]+box[2]*.3,y:box[1]+box[3]*.3,width:box[2]*.4,height:box[3]*.4}});
 await b.close();return {r,png,errs};}
(async()=>{const a=await shot(false),c=await shot(true);
 console.log(JSON.stringify(a.r),JSON.stringify(c.r));
 ok(!a.r.mono.length&&c.r.mono.includes('rough')&&c.r.mono.includes('metal'),'grey maps are one channel only past the limit');
 /* compare the two pictures: decode the PNGs in a page */
 const b=await chromium.launch();const p=await b.newPage();
 const d=await p.evaluate(async([x,y])=>{const dec=async s=>{const bm=await createImageBitmap(await (await fetch('data:image/png;base64,'+s)).blob());const cv=new OffscreenCanvas(bm.width,bm.height),g=cv.getContext('2d');g.drawImage(bm,0,0);return g.getImageData(0,0,bm.width,bm.height).data;};
   const A=await dec(x),B=await dec(y);let s=0,m=0;for(let i=0;i<A.length;i+=4)for(let j=0;j<3;j++){const v=Math.abs(A[i+j]-B[i+j]);s+=v;if(v>m)m=v;}return {mean:s/(A.length*.75),max:m};},[a.png.toString('base64'),c.png.toString('base64')]);
 await b.close();console.log(JSON.stringify(d));
 ok(d.mean<1.5,'the model looks the same (mean difference '+d.mean.toFixed(2)+')');
 ok(!a.errs.length&&!c.errs.length,'no page errors '+a.errs.concat(c.errs).join(' | '));
 console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
