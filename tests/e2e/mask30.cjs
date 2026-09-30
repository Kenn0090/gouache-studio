/* 0.23: mask stacks (rows under a layer: paint, fill, noise, generators, filters) and content effects. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const N=+process.env.SIZE||256;
 await p.evaluate(()=>{__gs.perf.on=true;});await p.evaluate(n=>__gs.newDoc(n,n,8,[1,1,1],'mask30',false),N);await W(500);
 const raw=require('fs').readFileSync(require('path').resolve(__dirname,'../../assets/materials/aged-copper.gmat'));
 await p.evaluate(async b64=>{const j=await __gs.gmatParse(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)));const rec={fill:j.fill,imgs:await __gs.gmatImgs(j)},f=j.fill;
   __gs.cmdNewFillLayer({name:'Copper',maps:f.maps,proj:f.proj,triSharp:f.triSharp,hStr:f.hStr,xf:f.xf,rep:f.rep,front:f.front,imgs:__gs.matRecTargets(rec)});},raw.toString('base64'));await W(1500);
 await p.evaluate(()=>{__gs.act('addMaskHide');});await W(400);
 await p.evaluate(()=>__gs.act('addLayer'));await W(300);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.fill);__gs.doc.active=L;__gs.requestRender&&__gs.requestRender(true);});await W(300);
 console.log(JSON.stringify(await p.evaluate(()=>({layers:__gs.allLayers().map(l=>l.name+(l.mask?' [mask]':'')+(l.fill?' [fill]':'')),active:__gs.doc.active.name,edit:__gs.doc.active.editMask}))));
 /* painting on a mask redraws only the painted area: what it shows mid-stroke matches the full redraw after the stroke */
 const a=await scr(N*.15,N*.2),c=await scr(N*.85,N*.8);
 await p.evaluate(()=>{__gs.showPanel('color');});await p.fill('#hex','ffffff');await p.press('#hex','Enter');await p.evaluate(()=>{document.activeElement.blur();});
 await p.evaluate(()=>{__gs.perf.frames=[];});
 await p.mouse.move(a[0],a[1]);await p.mouse.down();
 for(let i=0;i<30;i++){await p.mouse.move(a[0]+(c[0]-a[0])*i/29,a[1]+(c[1]-a[1])*(0.5+0.5*Math.sin(i/4)));await p.waitForTimeout(20);}
 await p.mouse.move(c[0],c[1]);await W(700);
 const clip={x:box.x,y:box.y,width:box.width,height:box.height};
 const A=await p.screenshot({clip});
 const parts=await p.evaluate(()=>__gs.perf.frames.length);
 await p.mouse.up();await W(700);
 const B=await p.screenshot({clip});
 const {diff,tot}=await p.evaluate(async([a,b])=>{const load=s=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src='data:image/png;base64,'+s;});
   const [ia,ib]=await Promise.all([load(a),load(b)]);const g=i=>{const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const x=c.getContext('2d');x.drawImage(i,0,0);return x.getImageData(0,0,c.width,c.height).data;};
   const da=g(ia),db=g(ib);let diff=0;for(let i=0;i<da.length;i+=4)if(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2])>12)diff++;return {diff,tot:da.length/4};},[A.toString('base64'),B.toString('base64')]);
 ok(diff/tot<.002,'mid-stroke picture equals the picture after the stroke ('+diff+' of '+tot+' pixels differ)');
 const painted=await p.evaluate(()=>{const M=__gs.doc.active.mask;return !!M;});ok(painted,'the layer has its mask');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
