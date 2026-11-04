/* 0.76.1: a big project is written to disk in pieces (write_chunk), Select part's edge maps are let go, and the save trail names the model's size */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1300,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 /* the desktop side is pretended: pieces are collected */
 await p.evaluate(()=>{const P=__gs.platform;window.__w={calls:[],files:{}};P.isDesktop=true;
  P.invoke=async(cmd,args,opts)=>{const h=opts&&opts.headers||{};
   if(cmd==='write_chunk'){const path=decodeURIComponent(h['x-path']),off=+h['x-offset'],f=window.__w.files[path]||(window.__w.files[path]=[]);window.__w.calls.push(['chunk',off,args.length,h['x-last']]);if(off!==f.reduce((s,x)=>s+x.length,0))throw new Error('out of order');f.push(args.slice());return;}
   if(cmd==='write_file'){window.__w.calls.push(['whole',args.length]);window.__w.files[decodeURIComponent(h['x-path'])]=[args.slice()];return;}
   return null;};});
 /* a 40 MB blob: sent in 16 MB pieces, in order, the last one marked */
 const big=await p.evaluate(async()=>{const n=40*1048576+123,u=new Uint8Array(n);for(let i=0;i<n;i+=4099)u[i]=i%251;window.__w.calls=[];await __gs.platform.writeFile('C:/t/big.bin',new Blob([u]));
  const f=window.__w.files['C:/t/big.bin'],all=new Uint8Array(f.reduce((s,x)=>s+x.length,0));let o=0;for(const x of f){all.set(x,o);o+=x.length;}
  let same=all.length===n;for(let i=0;same&&i<n;i+=4099)if(all[i]!==u[i])same=false;return {calls:window.__w.calls,same,len:all.length,n};});
 ok(big.calls.length===3&&big.calls.map(c=>c[0]).every(x=>x==='chunk'),'a 40 MB blob goes out as 3 pieces ('+big.calls.length+')');
 ok(big.calls[0][1]===0&&big.calls[1][1]===16*1048576&&big.calls[2][1]===32*1048576&&big.calls.map(c=>c[3]).join()==='0,0,1','pieces are in order and only the last is marked last');
 ok(big.same&&big.len===big.n,'the pieces put together are the original bytes');
 ok(await p.evaluate(async()=>{window.__w.calls=[];await __gs.platform.writeFile('C:/t/small.bin',new Uint8Array([1,2,3]));return window.__w.calls[0][0]==='whole';}),'plain bytes still go the old way in one piece');
 /* saving a document writes a Blob that arrives whole, and is a real Gouache file */
 const sv=await p.evaluate(async()=>{const G=__gs;G.newDoc(48,48);G.cmdAddLayer();G.doc.filePath='C:/t/doc.gouache';window.__w.calls=[];await G.saveDoc(false);
  const f=window.__w.files['C:/t/doc.gouache'];if(!f)return null;const all=new Uint8Array(f.reduce((s,x)=>s+x.length,0));let o=0;for(const x of f){all.set(x,o);o+=x.length;}return {calls:window.__w.calls.length,kind:window.__w.calls[0][0],magic:G.isGouache(all.buffer),len:all.length};});
 ok(sv&&sv.magic&&sv.len>100,'saving a document writes a real Gouache file ('+(sv&&sv.len)+' bytes, '+(sv&&sv.kind)+')');
 /* the edge maps */
 const topo=await p.evaluate(()=>{const G=__gs,N=40,n=N*N,pos=new Float32Array(n*3),uv=new Float32Array(n*2),idx=new Uint32Array((N-1)*(N-1)*6);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x;pos[i*3]=x/N;pos[i*3+1]=y/N;uv[i*2]=x/N;uv[i*2+1]=y/N;}let k=0;for(let y=0;y<N-1;y++)for(let x=0;x<N-1;x++){const a=y*N+x;idx.set([a,a+1,a+N,a+1,a+N+1,a+N],k);k+=6;}
  const m={pos,uv,idx};G.sel3Topo(m);const had=!!m._topo;G.v3.mesh=m;G.sel3Free();return {had,gone:!m._topo};});
 ok(topo.had&&topo.gone,'Select part\'s edge maps are built, and let go by sel3Free');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
