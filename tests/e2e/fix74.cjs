/* 0.74: 3D painting only clears and projects the part of the texture a stroke can reach, also with mirror painting; pixels must equal the full update. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const hardware=process.env.GS_DUAL_GPU==='1',b=await chromium.launch({headless:true,args:hardware?['--use-gl=angle','--use-angle=d3d11']:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1440,height:950}}),errors=[];

 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 await p.evaluate(async()=>{const G=__gs;G.setMode('p3d',true);G.p3.savedAt=G.p3Sig();await G.p3NewProject(256,{modelKey:'plane'});G.useModel(G.primMesh('plane',1));Object.assign(G.v3.cam,{yaw:0,pitch:0,dist:3.2,tx:0,ty:0,tz:0});Object.assign(G.v3s(),{disp:0,uvs:1,paintAlign:'camera'});G.v3.paintOn=true;G.setView('base');G.setTool('brush');G.setFG([.8,.2,.1]);Object.assign(G.brush,{size:50,opacity:.8,flow:1,spacing:.05,hardness:1,pSize:false,pOpacity:false,pFlow:false,tip:null,grain:0,smoothing:0,lazy:0,dual:null});G.composite();G.v3.mapsDirty=true;G.v3Refresh();});
 const stroke=async(mirror,off)=>{await p.evaluate(([m,o])=>{const G=__gs;G.p3Bounds.off=o;G.mir3.x=m;G.undo&&0;},[mirror,off]);
  await p.evaluate(()=>{const g=__gs.gl;if(!g._sp){g._sp={max:0,last:0,sc:g.scissor.bind(g),de:g.drawElements.bind(g)};g.scissor=(x,y,w,h)=>{g._sp.last=w*h;return g._sp.sc(x,y,w,h);};g.drawElements=(...a)=>{if(g.isEnabled(g.SCISSOR_TEST))g._sp.max=Math.max(g._sp.max,g._sp.last);return g._sp.de(...a);};}g._sp.max=0;});
  const r=await p.locator('#v3Hit').boundingBox(),y=r.y+r.height/2;await p.mouse.move(r.x+r.width*.58,y);await p.mouse.down();await p.mouse.move(r.x+r.width*.72,y+20,{steps:10});await p.mouse.up();
  return p.evaluate(()=>{const G=__gs,t=G.mapT(G.doc.active,'base');return {pixels:Array.from(G.captureRegionNow(t,0,0,t.w,t.h).data),error:G.gl.getError(),small:G.gl._sp.max};});};
 await stroke(false,true);await p.evaluate(()=>__gs.undo());/* the very first stroke of a session differs a little (warm-up) */
 for(const mirror of [false,true]){
  const full=await stroke(mirror,true);await p.evaluate(()=>__gs.undo());const fast=await stroke(mirror,false);await p.evaluate(()=>__gs.undo());
  ok(full.pixels.some((n,i)=>i%4===3&&n>0),(mirror?'mirrored ':'plain ')+'3D stroke paints something');
  ok(full.pixels.every((n,i)=>n===fast.pixels[i]),(mirror?'mirrored ':'plain ')+'stroke: boxed update gives exactly the same pixels as the full update');
  ok(fast.small>0&&fast.small<(mirror?65000:65536*.5),(mirror?'mirrored ':'plain ')+'boxed update draws the model only into part of the texture (largest box '+fast.small+' of 65536)');
  ok(fast.error===0&&full.error===0,(mirror?'mirrored ':'plain ')+'no graphics errors');
  if(mirror){const L=full.pixels;let left=0,right=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){if(L[(y*256+x)*4+3]>0){if(x<128)left++;else right++;}}ok(left>0&&right>0,'mirror painted both halves ('+left+' / '+right+')');}
 }
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
