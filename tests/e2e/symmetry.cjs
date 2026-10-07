/* Symmetry alignment, reflected views, pointer dragging and radial guides. */
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

 await p.evaluate(()=>{const g=__gs;g.setMode('paint');g.setWorkspace('painting');g.newDoc(128,128,8,null,'Symmetry',false);g.setTool('brush');Object.assign(g.ui.sym,{mode:'x',cx:.5,cy:.5,n:6,align:'screen'});g.vxSet(Math.PI/4,false);});
 const math=await p.evaluate(()=>{const g=__gs,out=[];for(const flip of [false,true]){g.vxSet(Math.PI/4,flip);const A=flip?[-Math.SQRT1_2,-Math.SQRT1_2,-Math.SQRT1_2,Math.SQRT1_2]:[Math.SQRT1_2,-Math.SQRT1_2,Math.SQRT1_2,Math.SQRT1_2];const sym=g.symFor({});const copies=g.symCopies(sym,128,128,80,70,.3,1,1,3,2);const scr=p=>[A[0]*(p[0]-64)+A[1]*(p[1]-64),A[2]*(p[0]-64)+A[3]*(p[1]-64)];const a=scr(copies[0]),b=scr(copies[1]);out.push(Math.abs(a[0]+b[0])<1e-6&&Math.abs(a[1]-b[1])<1e-6);const delta=copies[1];const tip=[Math.cos(delta[2])*delta[3],Math.sin(delta[2])*delta[3]],original=[Math.cos(.3),Math.sin(.3)];const screenTip=p=>[A[0]*p[0]+A[1]*p[1],A[2]*p[0]+A[3]*p[1]],ta=screenTip(original),tb=screenTip(tip);out.push(Math.abs(ta[0]+tb[0])<1e-6&&Math.abs(ta[1]-tb[1])<1e-6);}
 g.ui.sym.align='canvas';const copy=g.symCopies(g.symFor({}),128,128,80,70,.3,1,1,3,2)[1];return {out,local:copy[0]===48&&copy[1]===70};});ok(math.out.every(Boolean)&&math.local,'screen mirror preserves screen axes and tip orientation in rotated and flipped views; canvas mirror keeps local axes');
 const pixels=await p.evaluate(()=>{const g=__gs;g.vxSet(Math.PI/2,false);g.ui.sym.align='screen';const o=g.paintOpts(g.editTarget());Object.assign(o,{size:6,pSize:false,pOpacity:false,flow:1,opacity:1,tip:null,smoothing:0,sym:g.symFor(o)});g.beginStroke(g.doc.active,80,70,1,o);g.endStroke(true);const a=g.captureRegionNow(g.doc.active.target,80,58,1,1).data[3],wrong=g.captureRegionNow(g.doc.active.target,48,70,1,1).data[3];return {a,wrong};});ok(pixels.a>200&&pixels.wrong===0,'actual painting mirrors to the screen-aligned position after a 90 degree canvas turn');
 await p.evaluate(()=>{const g=__gs;g.ui.sym.mode='radial';g.ui.sym.n=6;g.vxSet(.4,true);g.requestRender();});
 const at=async(x,y)=>p.evaluate(([x,y])=>{const q=__gs.toScreen(x,y),r=document.getElementById('stage').getBoundingClientRect();return [q[0]+r.left,q[1]+r.top];},[x,y]);
 const before=await p.evaluate(()=>__gs.hist.undo.length);
 await p.mouse.move(...await at(64,64));await p.mouse.down();await p.mouse.move(...await at(48,40),{steps:5});await p.mouse.up();
 const drag=await p.evaluate(()=>({cx:__gs.ui.sym.cx,cy:__gs.ui.sym.cy,undo:__gs.hist.undo.length,overlay:__gs.cageOverlay()}));ok(Math.abs(drag.cx-.375)<.002&&Math.abs(drag.cy-.3125)<.002&&drag.undo===before,'dragging the centre through a rotated and reflected canvas moves symmetry without adding paint');ok(drag.overlay.includes('sym-centre')&&(drag.overlay.match(/M/g)||[]).length===6,'radial canvas guide displays the centre and six rays');
 const geometry=await p.evaluate(()=>{const g=__gs;Object.assign(g.mir3,{x:false,y:false,z:false,radial:6,axis:'z',off:[.2,.3,.4]});const pts=g.mir3GuidePoints(2);const rays=[];for(let k=0;k<6;k++){const i=6+k*6;rays.push(pts.slice(i,i+6));}return {count:pts.length,rays};});ok(geometry.count===(1+6+64)*6&&geometry.rays.every(p=>p[0]===.2&&p[1]===.3&&p[2]===.4&&p[5]===.4),'3D radial guide draws six rays and an axis-centred ring at the selected offset');

 const bar=await p.evaluate(()=>{const g=__gs;g.setMode('p3d');g.mir3.radial=7;g.mir3BarSync();const r=document.getElementById('mir3Rad');return {value:r?.value,on:r?.classList.contains('on'),label:r?.getAttribute('aria-label'),overlay:g.cageOverlay()};});ok(bar.value==='7'&&bar.on&&bar.label.includes('7 radial copies around Z'),'3D radial state highlights the active count and axis, including odd counts');
 ok(bar.overlay==='', 'canvas symmetry guides stay hidden in the full 3D viewport');
 await p.screenshot({path:path.join(__dirname,'symmetry-preview.local.png')});
 ok(errors.length===0,'no application errors');if(errors.length)console.log(errors);await b.close();await new Promise(r=>server.close(r));process.exitCode=fails?1:0;
})().catch(e=>{console.error(e);process.exit(1);});
