/* 0.79: Stylize, Painter style: master sliders and groups; the same strokes in every map; lighting, edges and gradient from the mesh maps */
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
 const mk=f=>{const d=new Uint8Array(W*W*4);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,c=f(x,y);d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;}return Array.from(d);};
 const grab=k=>p.evaluate(k=>{const G=__gs;G.changedAll&&G.changedAll();G.composite();const t=G.compositeMap(k),d=G.captureRegionNow(t,0,0,64,64).data;const h2f=h=>{const e=(h>>10)&31,m=h&1023,sg=h>>15?-1:1;return sg*(e===0?m/1024*Math.pow(2,-14):e===31?(m?NaN:Infinity):Math.pow(2,e-15)*(1+m/1024));};return Array.from(d,v=>d instanceof Float32Array?v*255:d instanceof Uint16Array?h2f(v)*255:v);},k);
 const lumAt=(a,x0,y0,x1,y1)=>{let s=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*64+x)*4;s+=a[i]*.299+a[i+1]*.587+a[i+2]*.114;n++;}return s/n;};
 const meanCh=(a,c)=>{let s=0;for(let i=c;i<a.length;i+=4)s+=a[i];return s/(a.length/4);};
 const diff=(a,b)=>{let s=0;for(let i=0;i<a.length;i+=4)s+=Math.abs(a[i]-b[i]);return s/(a.length/4);};
 const setV=o=>p.evaluate(o=>{const L=__gs.doc.active,v=L.fx.stack[0].v;Object.assign(v,o);L.lookVer=(L.lookVer||0)+1;},o);
 /* stripes in the colour and the same stripes in the height, so strokes show in both */
 const stripe=(x,y)=>((x+2*y)>>3)&1;
 await p.evaluate(({W,b,h,r,n})=>{const G=__gs;G.newDoc(W,W);G.setDocMaps(['base','rough','height','normal'],'maps');G.cmdAddLayer();const L=G.doc.active;
   G.writeRegion(G.ensureMapTarget(L,'base'),0,0,W,W,new Uint8Array(b));G.writeRegion(G.ensureMapTarget(L,'rough'),0,0,W,W,new Uint8Array(r));G.writeRegion(G.ensureMapTarget(L,'normal'),0,0,W,W,new Uint8Array(n));
   const H=G.ensureMapTarget(L,'height'),f=new Float32Array(W*W*4);for(let i=0;i<W*W;i++){const v=h[i*4]/255;f[i*4]=f[i*4+1]=f[i*4+2]=v;f[i*4+3]=1;}G.writeRegion(H,0,0,W,W,f);G.composite();},
   {W,b:mk((x,y)=>stripe(x,y)?[210,70,50]:[50,90,210]),h:mk((x,y)=>stripe(x,y)?[200,200,200]:[40,40,40]),r:mk((x,y)=>stripe(x,y)?[220,220,220]:[40,40,40]),n:mk(()=>[128,128,255])}).catch(e=>console.log('setup',e.message));
 await p.evaluate(({W,wn,ao})=>{const G=__gs,M={};for(const [k,d] of [['wnormal',wn],['ao',ao]]){const t=G.makeTarget(W,W,8,false);G.writeRegion(t,0,0,W,W,new Uint8Array(d));M[k]=t;}G.doc.meshMaps=M;},
   {W,wn:mk((x,y)=>y<32?[128,255,128]:[128,0,128]),ao:mk(x=>x<32?[0,0,0]:[255,255,255])});
 const B0=await grab('base'),H0=await grab('height'),Rg0=await grab('rough');
 await p.evaluate(()=>__gs.cmdNewStylizePLayer());await p.waitForTimeout(500);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!(L&&L.fx&&L.fx.map==='all'&&L.fx.stack[0].id==='stylizeP');}),'a Stylize (Painter style) layer is made, acting on all maps');
 const ui=await p.evaluate(()=>['stylization','strokes','smooth','colorize','gradient','lighting','edges','seed'].every(k=>!!document.getElementById('pa_'+k))&&document.querySelectorAll('#paTips button').length>3&&document.querySelectorAll('.hpgrp').length>=8);
 ok(ui,'the editor has the master sliders (Stylization, Brush strokes, Smoothness, Colorize, Gradient, Baked lighting, Edges and cavities, Seed), the groups and the brush tips');
 await done();
 let B=await grab('base');ok(diff(B,B0)>3,'the colour is repainted ('+diff(B,B0).toFixed(1)+')');
 await setV({stylization:0});B=await grab('base');ok(diff(B,B0)<1,'Stylization 0 leaves it as it was');
 /* only strokes: the same stamps in colour and height */
 await setV({stylization:1,smooth:0,colorize:0,gradient:0,lighting:0,edges:0,eH:0,eN:0,eE:0,eR:0,sCVar:0,sSize:150,sRand:.2});
 B=await grab('base');const Rg=await grab('rough'),H=await grab('height');
 let both=0,any=0;for(let i=0;i<B.length;i+=4){const cb=Math.abs(B[i]-B0[i])>40,ch=Math.abs(Rg[i]-Rg0[i])>40;if(cb||ch)any++;if(cb&&ch)both++;}
 ok(any>100&&both/any>.8,'the strokes are the same in the colour and the roughness ('+both+' of '+any+' changed pixels agree)');
 await setV({eH:1.5});const H2=await grab('height');ok(diff(H2,H)>0.5,'stroke effects raise the height ('+diff(H2,H).toFixed(2)+')');
 await setV({eN:1.5});const N=await grab('normal');let tilt=0,unit=true;for(let i=0;i<N.length;i+=4){const x=N[i]/255*2-1,y=N[i+1]/255*2-1,z=N[i+2]/255*2-1;if(Math.abs(x)+Math.abs(y)>.05)tilt++;if(Math.abs(Math.hypot(x,y,z)-1)>.12)unit=false;}
 ok(tilt>200&&unit,'and bend the normal, which stays unit length ('+tilt+' tilted)');
 /* mesh maps: lighting, edges, gradient */
 await setV({strokes:0,smooth:0,lighting:1,litPart:1,lH:0,lV:90,dI:1,dR:0,dCon:.5,sI:0});B=await grab('base');
 ok(lumAt(B,0,0,64,28)>lumAt(B,0,36,64,64)+20,'baked lighting from the world normal: top lit ('+lumAt(B,0,0,64,28).toFixed(0)+' vs '+lumAt(B,0,36,64,64).toFixed(0)+')');
 await setV({lighting:0,edges:1,aoO:1,eO:0,cO:0});B=await grab('base');ok(lumAt(B,34,0,64,64)>lumAt(B,0,0,30,64)+20,'edges and cavities: the baked AO darkens the crevices');
 await setV({edges:0,gradient:1,gMode:0,g1:[1,1,1],gO1:1,gB1:0,gV:90,gH:0,gOff:.5,gCon:.5});B=await grab('base');ok(lumAt(B,0,0,64,16)>lumAt(B,0,48,64,64)+30,'the gradient goes from the top of the model');
 await setV({gradient:0,colorize:1,hue:180,sat:1,val:1,con:1,post:0});B=await grab('base');
 let turned=0,reds=0;for(let i=0;i<B0.length;i+=4)if(B0[i]>150&&B0[i+2]<100){reds++;if(B[i+2]>B[i])turned++;}
 ok(reds>100&&turned>reds*.8,'colorize turns the hue (red became blue-green in '+turned+' of '+reds+' red pixels)');
 /* smoothness per map */
 await setV({colorize:0,smooth:1,smR:30,smRo:1});const R0=await grab('rough');await setV({smRo:0});const R1=await grab('rough');ok(diff(R0,R1)>3,'smoothness evens out the roughness');
 /* helpers */
 await setV({show:'normal'});B=await grab('base');ok(B[(5*64+5)*4+1]>200&&B[(60*64+5)*4+1]<60,'helper view shows the normals it reads (green up on top)');await setV({show:'result'});
 ok(await p.evaluate(()=>Object.keys(__gs.PA_PRESETS).length>=6),'presets exist');
 /* saved, reopened, and as a smart material */
 await setV({preset:'Thick strokes'});
 const re=await p.evaluate(async()=>{const G=__gs,b=await G.encodeGouache();await G.openGouache(await b.arrayBuffer(),'x.gouache');const L=G.allNodes(G.doc.root).find(n=>n.fx&&n.fx.stack[0].id==='stylizeP');return L?L.fx.stack[0].v.preset:null;});
 ok(re==='Thick strokes','saved and reopened with its settings');
 const sm=await p.evaluate(()=>{const G=__gs,L=G.allNodes(G.doc.root).find(n=>n.fx&&n.fx.stack[0].id==='stylizeP');const n=G.smApplyNow({name:'Mine',tree:JSON.parse(JSON.stringify({t:'G',name:'Mine',kids:[G.smSer(L)]}))});return n&&n.fx?n.fx.stack[0].id:null;});
 ok(sm==='stylizeP','saved as a smart material, it comes back as the same layer');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
