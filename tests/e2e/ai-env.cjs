/* A small web server for the AI tests: serves dist-web (as /) and the model files (AI_DIR, default /tmp/aimodels) as /aimodels/.
   The models are the real ones (see assets in src/js/ai/ai-core.js for where they come from); tests skip when they are not on this machine. */
const http=require('http'),fs=require('fs'),path=require('path');
const dir=process.env.AI_DIR||'/tmp/aimodels',root=path.resolve(__dirname,'../../dist-web');
exports.have=()=>['ort.webgpu.min.mjs','vision_encoder.onnx','mask_decoder.onnx'].every(f=>fs.existsSync(path.join(dir,f)));
exports.haveAll=()=>exports.have()&&['depth.onnx','lama.onnx'].every(f=>fs.existsSync(path.join(dir,f)));
exports.start=()=>new Promise(res=>{const srv=http.createServer((q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);let f=u.startsWith('/aimodels/')?path.join(dir,path.basename(u)):path.join(root,u==='/'?'index.html':u);
  fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();return;}const ext=path.extname(f);r.writeHead(200,{'content-type':ext==='.html'?'text/html':ext==='.mjs'||ext==='.js'?'text/javascript':ext==='.wasm'?'application/wasm':'application/octet-stream','access-control-allow-origin':'*'});r.end(b);});}).listen(0,()=>res({srv,url:'http://localhost:'+srv.address().port}));});
