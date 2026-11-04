/* 0.46: a huge layered PSD opens without hitting the 2 GB decode limit */
const {chromium}=require('playwright'),fs=require('fs');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const FILE=process.env.PSD||'/mnt/project-files/Sketches.psd';if(!fs.existsSync(FILE)){console.log('SKIP no PSD');process.exit(0);}
const srv=require('http').createServer((q,res)=>{res.writeHead(200,{'Access-Control-Allow-Origin':'*','Content-Length':fs.statSync(FILE).size});fs.createReadStream(FILE).pipe(res);}).listen(47811);
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.endsWith('/big.psd'))return r.continue();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('crash',()=>console.log('CRASH'));p.on('console',m=>console.log('C:',m.text().slice(0,200)));p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+OLD+'../../dist-web/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome&&__gs.closeWelcome());
  const r=await p.evaluate(async()=>{const ab=await (await fetch('http://127.0.0.1:47811/big.psd')).arrayBuffer();
  console.log('fetched '+ab.byteLength);try{await __gs.openPSD(ab,'Sketches.psd');return {n:__gs.allLayers().length,w:__gs.doc.w,h:__gs.doc.h};}catch(e){return {err:e.message};}});
 console.log(JSON.stringify(r),errs.slice(0,3));
 ok(!r.err&&r.n>3,'big PSD opens');
 await b.close();srv.close();process.exit(fails?1:0);
})();
