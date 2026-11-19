/* 0.98.22 (Georgian's painting report at 8192×4096: 3.7 ms per dab, dabs up to 1.2 s, 1 fps): on a picture over 12.5 M pixels every brush dab was
   drawn in 512-pixel tiles over the WHOLE picture (64 draws + flushes for one small dab here, 128 at 8K), and a dab reaching across a seam drew one box
   spanning the texture. A 4096² stroke: each dab is a handful of draws, and a seam dab draws small boxes per patch. */
const {chromium}=require('playwright');const M=require('./models9820.cjs');const SIZE=4096;let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(s=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:s,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}},SIZE);
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]',{timeout:120000});await p.waitForTimeout(6000);const hb=await p.locator('#v3Hit').boundingBox({timeout:120000});
 await p.evaluate(async q=>{const g=__gs;const m=await g.parseModelBytes('t.obj',new TextEncoder().encode(q),{noUp:true});g.v3.imported=g.p3.imported=m;const s=g.v3s();s.model='imported';g.v3.mesh=null;
   g.doc.active=g.layerByName('Paint');g.v3.paintOn=true;Object.assign(g.brush,{size:9,hardness:.9,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null,spacing:.03});g.setFG([.85,.12,.1]);g.mir3.x=true;Object.assign(g.v3.cam,{yaw:0,pitch:.1,dist:4,tx:0,ty:0,tz:0});g.v3.dirty=true;g.requestRender(true);},M.tube());await p.waitForTimeout(5000);
 console.log('doc',await p.evaluate(()=>__gs.doc.w+'x'+__gs.doc.h));
 await p.evaluate(()=>{window.__swDebug=[];window.__rs0=__gs.runStat.n;});
 const at=(fx,fy)=>[hb.x+hb.width*fx,hb.y+hb.height*fy];const a=at(.4,.5),c=at(.6,.5);await p.mouse.move(a[0],a[1]);await p.mouse.down();for(let k=1;k<=20;k++){await p.mouse.move(a[0]+(c[0]-a[0])*k/20,a[1]);await p.waitForTimeout(60);}await p.mouse.up();await p.waitForTimeout(2000);
 const r=await p.evaluate(()=>({runs:__gs.runStat.n-window.__rs0,dabs:window.__swDebug.length,max:Math.max(...window.__swDebug.map(d=>(d.rects||[d.rect]).reduce((s,q)=>s+(q[2]-q[0])*(q[3]-q[1]),0)))}));console.log(JSON.stringify(r));
 ok(r.dabs>50,'the stroke made dabs on the surface ('+r.dabs+')');ok(r.runs/r.dabs<12,'each dab is a handful of draws, not the whole picture in tiles ('+(r.runs/r.dabs).toFixed(1)+' per dab)');
 ok(r.max<40000,'the biggest dab (across the seam) covers small boxes, not the whole width ('+r.max+' px)');
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
 console.log(JSON.stringify(await p.evaluate(()=>{const D=window.__swDebug,ar=D.map(d=>(d.rects||[d.rect]).reduce((s,r)=>s+(r[2]-r[0])*(r[3]-r[1]),0)).sort((a,b)=>a-b);return {dabs:D.length,median:ar[ar.length>>1],p90:ar[Math.floor(ar.length*.9)],max:ar[ar.length-1],split:D.filter(d=>d.rects).length,rTexels:+D[0].r.toFixed(1)};})));
 await b.close();})();
