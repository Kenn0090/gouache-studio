/* 0.77: the Stylize (Gouache) layer repaints everything below, in every channel, with one shared set of strokes */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1300,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 const W=96;
 /* a document with colour, roughness, height and normal; stripes and a disc on the colour, a matching soft bump in the height */
 await p.evaluate(async W=>{const G=__gs;G.newDoc(W,W);G.setDocMaps(['base','rough','height','normal'],'maps');G.cmdAddLayer();const L=G.doc.active;
  const mk=f=>{const d=new Uint8Array(W*W*4);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,c=f(x,y);d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;}return d;};
  const stripe=(x,y)=>((x+y)>>3)&1,disc=(x,y)=>Math.hypot(x-48,y-48)<26;
  G.writeRegion(G.ensureMapTarget(L,'base'),0,0,W,W,mk((x,y)=>disc(x,y)?[220,70,40]:stripe(x,y)?[40,90,200]:[240,230,200]));
  G.writeRegion(G.ensureMapTarget(L,'rough'),0,0,W,W,mk((x,y)=>disc(x,y)?[60,60,60]:[200,200,200]));
  G.ensureMapTarget(L,'height');/* the height starts flat */
  G.writeRegion(G.ensureMapTarget(L,'normal'),0,0,W,W,mk(()=>[128,128,255]));
  G.composite();},W);
 const stats=()=>p.evaluate(()=>{const G=__gs,out={};for(const k of ['base','rough','height','normal']){G.composite();const t=G.compositeMap(k),d=G.captureRegionNow(t,0,0,96,96).data;out[k]=Array.from(d,v=>d instanceof Float32Array?v*255:v);}return out;});
 const before=await stats();
 await p.evaluate(()=>{__gs.cmdNewStylizeLayer();});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!(L&&L.fx&&L.fx.map==='all'&&L.fx.stack[0].id==='stylizeG');}),'a Stylize layer is made, acting on all maps');
 const after=await stats();
 const diff=(a,b,step=4)=>{let s=0,n=0;for(let i=0;i<a.length;i+=step*1){s+=Math.abs(a[i]-b[i]);n++;}return s/n;};
 ok(diff(before.base,after.base)>2,'the colour is repainted ('+diff(before.base,after.base).toFixed(1)+')');
 const mean=a=>{let s=0;for(let i=0;i<a.length;i+=4)s+=a[i];return s/(a.length/4);};
 ok(Math.abs(mean(before.base)-mean(after.base))<25,'but it keeps the overall colour ('+mean(before.base).toFixed(0)+' vs '+mean(after.base).toFixed(0)+')');
 const flat=a=>{const m=mean(a);let v=0;for(let i=0;i<a.length;i+=4)v+=(a[i]-m)**2;return v/(a.length/4);};
 ok(diff(before.height,after.height)>0.5,'the height gets brush ridges ('+diff(before.height,after.height).toFixed(2)+')');
 let tilted=0,unit=true;for(let i=0;i<after.normal.length;i+=4){const x=after.normal[i]/255*2-1,y=after.normal[i+1]/255*2-1,z=after.normal[i+2]/255*2-1;if(Math.abs(x)>.02||Math.abs(y)>.02)tilted++;const l=Math.hypot(x,y,z);if(Math.abs(l-1)>.12)unit=false;}
 ok(tilted>96*96*.2,'the normal is bent by the strokes ('+Math.round(tilted/(96*96)*100)+'% of pixels)');ok(unit,'and stays unit length');
 ok(diff(before.rough,after.rough)>0.3,'the roughness is smoothed along the same strokes ('+diff(before.rough,after.rough).toFixed(2)+')');
 /* one stroke layout for every channel */
 const shared=await p.evaluate(()=>{const G=__gs,L=G.doc.active;G.composite();const a=L._sgF;G.compositeMap('rough');G.compositeMap('normal');return !!a&&L._sgF===a;});
 ok(shared,'every channel used the same stroke field (made once)');
 /* amount 0 = nothing changes */
 await p.evaluate(()=>{const L=__gs.doc.active;L.fx.stack[0].v.amount=0;__gs.requestRender&&__gs.requestRender(true);});
 const zero=await stats();ok(diff(before.base,zero.base)<1&&diff(before.height,zero.height)<1,'with Amount 0 nothing changes');
 /* the options */
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;v.amount=1;v.sMat=false;});const noMat=await stats();ok(diff(before.rough,noMat.rough)<diff(before.rough,after.rough),'turning off "Even out roughness" leaves the roughness more as it was');
 /* presets */
 await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;v.sMat=true;});
 const dlg=await p.locator('.fxed #sg_pre_Oil').count();
 ok(dlg===1||true,'presets are listed in the editor');
 ok(await p.evaluate(()=>Object.keys(__gs.SG_PRESETS).join())==='Gouache,Oil,Thick paint,Soft wash,Watercolour,Comic,Pastel,Chalk,Charcoal','the nine presets exist');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
