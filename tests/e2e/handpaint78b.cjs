/* 0.78: Hand-painted and Stylize layers read the mesh maps, work in Spec/Gloss, and save as smart materials */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1300,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());


 const W=64;
 const done=async()=>{const b=p.getByRole('button',{name:'Done',exact:true});if(await b.count())await b.first().click();await p.waitForTimeout(200);};
 const mk=(W,f)=>{const d=new Uint8Array(W*W*4);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,c=f(x,y);d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;}return Array.from(d);};
 const grab=k=>p.evaluate(k=>{const G=__gs;G.changedAll&&G.changedAll();G.composite();const t=G.compositeMap(k),d=G.captureRegionNow(t,0,0,64,64).data;return Array.from(d,v=>d instanceof Float32Array?v*255:v);},k);
 const lumAt=(a,x0,y0,x1,y1)=>{let s=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*64+x)*4;s+=a[i]*.299+a[i+1]*.587+a[i+2]*.114;n++;}return s/n;};
 const meanCh=(a,c)=>{let s=0;for(let i=c;i<a.length;i+=4)s+=a[i];return s/(a.length/4);};
 const setV=o=>p.evaluate(o=>{const L=__gs.doc.active,v=L.fx.stack[0].v;Object.assign(v,o);L.lookVer=(L.lookVer||0)+1;},o);
 const setMesh=o=>p.evaluate(({W,o})=>{const G=__gs,M={};for(const k in o){const t=G.makeTarget(W,W,8,false);G.writeRegion(t,0,0,W,W,new Uint8Array(o[k]));M[k]=t;}G.doc.meshMaps=M;},{W,o});
 /* ---- mesh maps: the baked world normal, AO and curvature drive the Hand-painted look ---- */
 await p.evaluate(({W,base})=>{const G=__gs;G.newDoc(W,W);G.setDocMaps(['base','rough','metal','normal'],'maps');G.cmdAddLayer();G.writeRegion(G.ensureMapTarget(G.doc.active,'base'),0,0,W,W,new Uint8Array(base));G.composite();},{W,base:mk(W,()=>[150,150,150])});
 await setMesh({wnormal:mk(W,(x,y)=>y<32?[128,255,128]:[128,0,128]),ao:mk(W,(x)=>x<32?[0,0,0]:[255,255,255])});
 await p.evaluate(()=>__gs.cmdNewHandPaintLayer());await p.waitForTimeout(400);await done();
 await setV({sAmt:0,varAmt:0,lEl:90,lTurn:0,base:[.6,.6,.6],edgeAmt:0,cavAmt:0,gTopAmt:0,gBotAmt:0,aoAmt:0});
 let a=await grab('base');ok(lumAt(a,0,0,64,30)>lumAt(a,0,34,64,64)+25,'the baked world normal decides lit and shaded parts ('+lumAt(a,0,0,64,30).toFixed(0)+' vs '+lumAt(a,0,34,64,64).toFixed(0)+')');
 await setV({aoAmt:1});a=await grab('base');ok(lumAt(a,34,0,64,30)>lumAt(a,0,0,30,30)+25,'the baked AO darkens the crevices');
 const src=await p.evaluate(()=>__gs.hpSources(__gs.doc.active));ok(/baked world normal/.test(src)&&/baked AO/.test(src),'the settings say which mesh maps it reads: '+src);
 await setMesh({wnormal:mk(W,()=>[128,255,128]),curv:mk(W,(x)=>x<32?[255,255,255]:[128,128,128])});
 await setV({aoAmt:0,edgeAmt:1,edgeCol:[1,1,1],edgeSpread:.6});a=await grab('base');ok(lumAt(a,0,0,30,64)>lumAt(a,34,0,64,64)+20,'the baked curvature lights the edges');
 /* ---- Stylize: strokes follow the shape from the mesh maps, and paint in their lighting ---- */
 await p.evaluate(({W,st})=>{const G=__gs,L=G.doc.active;L.visible=false;const B=G.doc.root.children.filter(n=>!n.fx).pop();G.writeRegion(G.ensureMapTarget(B,'base'),0,0,W,W,new Uint8Array(st));},{W,st:mk(W,(x,y)=>((y>>2)&1)?[200,80,60]:[60,90,200])});
 await setMesh({wnormal:mk(W,(x,y)=>{const a=Math.atan2(y-32,x-32);return [Math.round(128+100*Math.cos(a)),Math.round(128+100*Math.sin(a)),200];}),curv:mk(W,(x,y)=>(Math.hypot(x-32,y-32)>>2)&1?[255,255,255]:[60,60,60])});
 const sty=await p.evaluate(()=>{const G=__gs;G.cmdNewStylizeLayer();const L=G.doc.active,v=L.fx.stack[0].v;return {g:G.sgGuideOf(v),id:L.fx.stack[0].id};});
 await done();ok(sty.g==='both'&&sty.id==='stylizeG','Stylize strokes follow the model\'s shape and the colour when there are mesh maps');
 const s1=await grab('base');await setV({guide:'colour'});const s2=await grab('base');
 let d=0;for(let i=0;i<s1.length;i+=4)d+=Math.abs(s1[i]-s2[i]);ok(d/4096>0.2,'and the shape changes the strokes ('+(d/4096).toFixed(2)+')');
 {let bk=0;for(let i=0;i<s1.length;i+=4){if(s1[i]+s1[i+1]+s1[i+2]<15)bk++;}ok(bk<41,'no black specks in the strokes ('+bk+' of 4096)');}
 await setMesh({wnormal:mk(W,(x,y)=>y<32?[128,255,128]:[128,0,128]),ao:mk(W,(x)=>x<32?[0,0,0]:[255,255,255])});
 await setV({guide:'colour',meshLight:1,meshEdge:0,mlEl:90,mlTurn:0,cvar:0,bristle:0,grain:0,relief:0});
 let m1=await grab('base');ok(lumAt(m1,34,0,64,28)>lumAt(m1,34,36,64,64)+20,'Stylize paints in the baked lighting from the world normal (top '+lumAt(m1,34,0,64,28).toFixed(0)+' vs bottom '+lumAt(m1,34,36,64,64).toFixed(0)+')');
 await setV({meshLight:0,meshEdge:1});m1=await grab('base');ok(lumAt(m1,34,0,64,64)>lumAt(m1,0,0,30,64)+20,'Stylize darkens the crevices from the baked AO ('+lumAt(m1,34,0,64,64).toFixed(0)+' vs '+lumAt(m1,0,0,30,64).toFixed(0)+')');
 /* ---- Spec/Gloss ---- */
 await p.evaluate(({W,base})=>{const G=__gs;G.newDoc(W,W);G.setDocMaps(['base','rough','metal','normal'],'maps');G.cmdAddLayer();G.writeRegion(G.ensureMapTarget(G.doc.active,'base'),0,0,W,W,new Uint8Array(base));G.wfSwitch('spec','convert');G.composite();},{W,base:mk(W,()=>[150,150,150])});
 ok(await p.evaluate(()=>__gs.doc.workflow==='spec'&&__gs.doc.maps.includes('gloss')&&__gs.doc.maps.includes('spec')),'a Spec/Gloss document');
 await p.evaluate(()=>__gs.cmdNewHandPaintLayer('Gold'));await p.waitForTimeout(400);await done();
 const gl=await grab('gloss'),sp=await grab('spec'),df=await grab('base');
 ok(Math.abs(meanCh(gl,0)-.65*255)<35,'gloss is made (1 − roughness: '+meanCh(gl,0).toFixed(0)+')');
 ok(meanCh(sp,0)>140&&meanCh(sp,0)>meanCh(sp,2)+40,'metal parts get a coloured (gold) specular ('+[0,1,2].map(c=>meanCh(sp,c).toFixed(0))+')');
 ok(meanCh(df,0)<45,'and a dark diffuse, as Spec/Gloss needs ('+meanCh(df,0).toFixed(0)+')');
 await setV({mOn:false});const sp2=await grab('spec'),df2=await grab('base');
 ok(Math.abs(meanCh(sp2,0)-59)<12&&meanCh(df2,0)>100,'non-metal: plain 4% specular and the colour in the diffuse ('+meanCh(sp2,0).toFixed(0)+', '+meanCh(df2,0).toFixed(0)+')');
 /* ---- saved as a smart material ---- */
 const sm=await p.evaluate(()=>{const G=__gs,L=G.doc.active,tree={t:'G',name:'My gold',open:true,kids:[G.smSer(L)]};const before=G.doc.root.children.length;
   const n=G.smApplyNow({name:'My gold',tree:JSON.parse(JSON.stringify(tree))});return {fx:!!(n&&n.fx&&n.fx.map==='all'),top:n&&n.parent===G.doc.root,pre:n&&n.fx.stack[0].v.preset,grew:G.doc.root.children.length-before};});
 ok(sm.fx&&sm.top&&sm.grew===1,'saved as a smart material, it comes back as the same layer on top (not in a folder): '+JSON.stringify(sm));
 ok(await p.evaluate(()=>__gs.smBuiltins().filter(r=>/^Hand-painted /.test(r.name)).length>=20),'the presets are listed as smart materials');
 const bi=await p.evaluate(()=>{const G=__gs,r=G.smBuiltins().find(r=>r.name==='Hand-painted Rock');const n=G.smApplyNow(r);return n&&n.fx?n.fx.stack[0].v.preset:null;});
 ok(bi==='Rock','adding the built-in “Hand-painted Rock” makes a Hand-painted layer');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
