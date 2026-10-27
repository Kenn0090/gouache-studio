/* 0.75.1: a material with see-through parts can add a mask from its transparency, so the material under shows in every map */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1400,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.matOpen','all');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 const tick=()=>p.waitForTimeout(150);
 const setup=await p.evaluate(async()=>{const G=__gs;G.newDoc(64,64);G.setDocMaps(['base','rough'],'maps');
  const under=G.cmdNewFillLayer({name:'Under',maps:{base:{c:[1,0,0]},rough:{v:.2}}});
  /* a picture: left half opaque green, right half see-through */
  const W=64,H=64,d=new Uint8Array(W*H*4);for(let y=0;y<H;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4;if(x<32){d[i]=0;d[i+1]=200;d[i+2]=0;d[i+3]=255;}}
  const t=G.makeTarget(W,H,8,true);G.writeRegion(t,0,0,W,H,d);
  const top=G.cmdNewFillLayer({name:'Top',maps:{base:{src:'image',tile:1},rough:{v:.9}},imgs:{base:t}});G.fillRender(top);G.composite();
  return {has:G.fillHasAlpha(top),on:G.fillAlphaOn(top),hasUnder:G.fillHasAlpha(under)};});
 ok(setup.has&&!setup.hasUnder,'the material with see-through parts is recognised (a plain one is not)');ok(!setup.on,'the cut-out starts off');
 const rough=()=>p.evaluate(()=>{const G=__gs;G.composite();const t=G.compositeMap('rough'),a=G.captureRegionNow(t,10,30,1,1).data[0],b=G.captureRegionNow(t,50,30,1,1).data[0];return {left:a,right:b};});
 const before=await rough();ok(before.right>200,'without the tick the top material covers the roughness below, even where it is see-through ('+before.right+')');
 await p.evaluate(()=>{const G=__gs;G.fillAlphaMask(G.doc.active,true);});await tick();
 const st=await p.evaluate(()=>{const L=__gs.doc.active;return {mask:!!L.mask,rows:L.mask&&L.mask.stack.map(r=>r.kind),on:__gs.fillAlphaOn(L)};});
 ok(st.mask&&st.on&&st.rows.includes('alpha'),'ticking adds a mask with a transparency row ('+st.rows+')');
 const after=await rough();ok(after.right<80&&after.right>30,'where it is see-through the material below now shows in the roughness map ('+after.right+' ≈ 51)');ok(after.left>200,'where it is opaque the top material still wins ('+after.left+')');
 const col=await p.evaluate(()=>{const G=__gs;G.composite();const t=G.compositeMap('base'),a=G.captureRegionNow(t,50,30,1,1).data;return Array.from(a);});ok(col[0]>200&&col[1]<60,'the colour below shows too (red: '+col+')');
 /* the panel shows the tick, and the row can be inverted */
 await p.evaluate(()=>{__gs.showPanel('matEd');__gs.renderMatEd(true);});await tick();
 ok(await p.locator('#fl_alpha').count()===1,'the Material panel shows the tick');
 /* undo and redo */
 await p.evaluate(()=>__gs.undo());await tick();ok(await p.evaluate(()=>!__gs.fillAlphaOn(__gs.doc.active)&&!__gs.doc.active.mask),'undo takes the cut-out away (and the mask made for it)');
 await p.evaluate(()=>__gs.redo&&__gs.redo());
 /* untick from the panel */
 await p.evaluate(()=>{const G=__gs;if(!G.fillAlphaOn(G.doc.active))G.fillAlphaMask(G.doc.active,true);G.renderMatEd(true);});await tick();
 await p.locator('#fl_alpha').uncheck();await tick();
 ok(await p.evaluate(()=>!__gs.fillAlphaOn(__gs.doc.active)&&!__gs.doc.active.mask),'unticking removes it again');
 const back=await rough();ok(back.right>200,'and the top material covers again ('+back.right+')');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
