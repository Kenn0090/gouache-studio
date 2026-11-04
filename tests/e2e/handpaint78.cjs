/* 0.78: the Hand-painted layer lights a form from its normals, makes roughness/metallic, stamps brush strokes and has presets */
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
 /* a document with a dome in the normal map (a disc that bulges out), so "which way it faces" is known everywhere */
 await p.evaluate(async W=>{const G=__gs;G.newDoc(W,W);G.setDocMaps(['base','rough','metal','normal'],'maps');G.cmdAddLayer();const L=G.doc.active;
  const mk=f=>{const d=new Uint8Array(W*W*4);for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,c=f(x,y);d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2];d[i+3]=255;}return d;};
  G.writeRegion(G.ensureMapTarget(L,'base'),0,0,W,W,mk((x,y)=>((x>>3)&1)?[200,120,80]:[180,110,90]));
  G.writeRegion(G.ensureMapTarget(L,'rough'),0,0,W,W,mk(()=>[30,30,30]));
  G.writeRegion(G.ensureMapTarget(L,'metal'),0,0,W,W,mk(()=>[10,10,10]));
  G.writeRegion(G.ensureMapTarget(L,'normal'),0,0,W,W,mk((x,y)=>{const dx=(x-48)/34,dy=(48-y)/34,r2=dx*dx+dy*dy;if(r2>=1)return [128,128,255];const z=Math.sqrt(1-r2);return [Math.round((dx*.5+.5)*255),Math.round((dy*.5+.5)*255),Math.round((z*.5+.5)*255)];}));
  G.composite();},W);
 const grab=k=>p.evaluate(k=>{const G=__gs;G.composite();const t=G.compositeMap(k),d=G.captureRegionNow(t,0,0,96,96).data;return Array.from(d,v=>d instanceof Float32Array?v*255:v);},k);
 const lumAt=(a,x0,y0,x1,y1)=>{let s=0,n=0;for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*96+x)*4;s+=a[i]*.299+a[i+1]*.587+a[i+2]*.114;n++;}return s/n;};
 const meanCh=(a,c)=>{let s=0;for(let i=c;i<a.length;i+=4)s+=a[i];return s/(a.length/4);};
 const before=await grab('base');
 await p.evaluate(()=>{__gs.cmdNewHandPaintLayer();});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!(L&&L.fx&&L.fx.map==='all'&&L.fx.stack[0].id==='handPaint');}),'a Hand-painted layer is made, acting on all maps');
 ok(await p.locator('#hp_pre_Gold').count()===1&&await p.locator('#hpTips button').count()>3,'the editor shows presets and brush tips to stamp with');
 /* plain lighting first: no strokes, no variation, light from the top */
 const setV=o=>p.evaluate(o=>{const v=__gs.doc.active.fx.stack[0].v;Object.assign(v,o);__gs.doc.active.lookVer=(__gs.doc.active.lookVer||0)+1;},o);
 await setV({sAmt:0,varAmt:0,lEl:90,lTurn:0,base:[.6,.6,.6],aoAmt:0,edgeAmt:0,cavAmt:0,gTopAmt:0,gBotAmt:0});
 let a=await grab('base');const top=lumAt(a,40,20,56,34),bot=lumAt(a,40,62,56,76);
 ok(top>bot+20,'light from the top: the upper side of the dome is lighter ('+top.toFixed(0)+' vs '+bot.toFixed(0)+')');
 await setV({lEl:-90});a=await grab('base');const top2=lumAt(a,40,20,56,34),bot2=lumAt(a,40,62,56,76);
 ok(bot2>top2+20,'light from the bottom flips it ('+top2.toFixed(0)+' vs '+bot2.toFixed(0)+')');
 await setV({lEl:15,lTurn:-90});a=await grab('base');ok(lumAt(a,20,40,34,56)>lumAt(a,62,40,76,56)+20,'light from the left lights the left side');
 /* show directions = the normals in colour */
 await setV({showN:true});a=await grab('base');ok(a[(30*96+48)*4+1]>170&&a[(66*96+48)*4+1]<90,'"Show the directions" shows the normals (green up)');
 await setV({showN:false,lEl:65,lTurn:25});
 /* roughness and metallic */
 let r=await grab('rough');ok(Math.abs(meanCh(r,0)-.7*255)<40,'roughness is made (about 70%: '+meanCh(r,0).toFixed(0)+')');
 let m=await grab('metal');ok(Math.abs(meanCh(m,0)-10)<3,'metallic is left as it was when "Make metallic" is off');
 await setV({mOn:true,mBase:1,mFrom:0});m=await grab('metal');ok(meanCh(m,0)>240,'"Make metallic" at 100% makes it metal');
 /* brush strokes stamped with a library tip */
 await setV({mOn:false});const noStroke=await grab('base');
 const key=await p.evaluate(()=>{const G=__gs,lib=G.library||[];for(const s of lib)for(let i=0;i<s.presets.length;i++)if(s.presets[i].tip)return G.dualLibraryKey(s,s.presets[i],i);return 'b:sponge';});
 await setV({sAmt:1,sSize:14,tipKey:key,varAmt:.4});const withStroke=await grab('base');
 let d=0;for(let i=0;i<withStroke.length;i+=4)d+=Math.abs(withStroke[i]-noStroke[i]);d/=96*96;
 ok(d>1,'brush strokes change the paint ('+d.toFixed(1)+')');
 /* paint over the layers below: keeps their colour, adds the light */
 await setV({own:false,sAmt:0,varAmt:0,shAmt:.3,ltAmt:.2,over:0,sat:1});a=await grab('base');
 ok(Math.abs(meanCh(a,0)-meanCh(before,0))<40&&meanCh(a,0)>meanCh(a,2),'"Paint over the layers below" keeps their colour (red '+meanCh(a,0).toFixed(0)+' vs '+meanCh(before,0).toFixed(0)+')');
 /* a preset from the editor */
 await p.click('#hp_pre_Gold');await p.waitForTimeout(300);
 const g=await p.evaluate(()=>{const v=__gs.doc.active.fx.stack[0].v;return {pre:v.preset,m:v.mOn,own:v.own};});
 ok(g.pre==='Gold'&&g.m===true&&g.own===true,'the Gold preset sets a metallic own-colour material');
 m=await grab('metal');ok(meanCh(m,0)>230,'and the metallic follows');
 ok(await p.evaluate(()=>{const P=__gs.HP_PRESETS;return Object.keys(P['Game materials']).length>=12&&Object.keys(P['Skin and character']).length>=6&&!!P['Skin and character']['Painted skin'];}),'game material and skin presets exist, including Painted skin');
 /* saved and reopened */
 const re=await p.evaluate(async()=>{const G=__gs,b=await G.encodeGouache();await G.openGouache(await b.arrayBuffer(),'x.gouache');const L=G.allNodes(G.doc.root).find(n=>n.fx&&n.fx.map==='all');return L?L.fx.stack[0].v.preset:null;}).catch(e=>'err '+e.message);
 ok(re==='Gold','saved and reopened with its settings ('+re+')');

 /* in 3D Paint it reads the model itself: parts facing up get the light, parts facing down the shadow */
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1800);
 const has3d=await p.evaluate(()=>!!(__gs.v3&&__gs.v3.mesh));
 if(has3d){await p.evaluate(()=>{__gs.cmdNewHandPaintLayer();});await p.waitForTimeout(500);
  const S=await p.evaluate(()=>{const G=__gs,L=G.doc.active,v=L.fx.stack[0].v,W=G.doc.w,H=G.doc.h;Object.assign(v,{sAmt:0,varAmt:0,lEl:90,lTurn:0,base:[.6,.6,.6],aoAmt:0,edgeAmt:0,cavAmt:0,gTopAmt:0,gBotAmt:0,showN:true});
    const rd=()=>{L.lookVer=(L.lookVer||0)+1;G.composite();const t=G.compositeMap('base'),d=G.captureRegionNow(t,0,0,W,H).data;G.release(t);return d;};
    const n=rd();v.showN=false;const c=rd();let up=0,un=0,dn=0,dnn=0;
    for(let i=0;i<n.length;i+=4){if(n[i+3]<200)continue;const l=c[i]*.299+c[i+1]*.587+c[i+2]*.114;if(n[i+1]>210){up+=l;un++;}else if(n[i+1]<45){dn+=l;dnn++;}}
    return {up:un?up/un:0,dn:dnn?dn/dnn:0,un,dnn};});
  ok(S.un>10&&S.dnn>10&&S.up>S.dn+25,'in 3D Paint the model\'s upward faces are lit and downward ones shaded ('+S.up.toFixed(0)+' vs '+S.dn.toFixed(0)+', '+S.un+'/'+S.dnn+' texels)');}
 else ok(false,'3D Paint has a model to test with');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
