/* 0.74: copy a mask and paste it onto another layer (pixels equal, one undo step, original untouched) */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1300,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 const r=await p.evaluate(async()=>{const tick=()=>new Promise(r=>setTimeout(r,120));const G=__gs;G.newDoc(64,64);G.cmdAddLayer();const A=G.doc.active;G.cmdAddMask(1);
  /* paint a hole into A's mask: black square */
  const m=A.mask.target;G.clearTarget(m,[1,1,1,1]);G.scissorDo([10,10,20,20],()=>G.clearTarget(m,[0,0,0,1]));
  const pix=n=>Array.from(G.readRGBA8(n.mask.target));const a0=pix(A);G.cmdCopyMask(A);
  G.cmdAddLayer();const B=G.doc.active;const hadMask=!!B.mask;G.cmdPasteMask(B);const b1=pix(B);await tick();
  G.undo();await tick();const afterUndo=!!B.mask;G.redo();await tick();const b2=pix(B);
  return {hadMask,same:a0.every((v,i)=>v===b1[i]),holes:b1.filter((v,i)=>i%4===0&&v===0).length,aKept:a0.every((v,i)=>v===pix(A)[i]),afterUndo,redo:b1.every((v,i)=>v===b2[i]),separate:A.mask!==B.mask&&A.mask.target!==B.mask.target};});
 ok(!r.hadMask,'the target layer had no mask');ok(r.same,'pasted mask has the same pixels');ok(r.holes===400,'the black square came across ('+r.holes+' pixels)');
 ok(r.aKept,'the original mask is untouched');ok(!r.afterUndo,'undo removes the pasted mask');ok(r.redo,'redo brings it back');ok(r.separate,'the copy is independent of the original');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
