/* 0.94.10: dense models - the brush outline cursor reads the tip once (not on every move), big models draw lighter while turning */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1300,height:800}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:256,layout:"3d"}));}catch(e){}
  const g=CanvasRenderingContext2D.prototype.getImageData;window.__gid=0;CanvasRenderingContext2D.prototype.getImageData=function(){window.__gid++;(window.__gst=window.__gst||{})[(new Error().stack||'').split('\n').slice(2,5).join('<').replace(/file:[^)]*index.html:/g,'')]=1;return g.apply(this,arguments);};});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
 /* the outline at many sizes reads the tip once */
 const r=await p.evaluate(()=>{const t=__gs.brush.tip;__gs.tipOutline(t,40);const g0=window.__gid;const outs=[];for(let d=20;d<400;d+=3)outs.push(__gs.tipOutline(t,d));const n=new Set(outs).size;return {reads:window.__gid-g0,sizes:n,w:outs[outs.length-1].width,empty:outs.some(c=>c._empty)};});
 ok(r.reads===0,'127 cursor sizes need no new read from the canvas '+JSON.stringify(r));
 ok(r.sizes<60&&r.w>300&&!r.empty,'sizes are grouped (fewer outlines to make) and still drawn');
 /* hovering and painting the model */
 const box=await p.evaluate(()=>{const r=document.getElementById('v3Hit').getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
 await p.evaluate(()=>{__gs.v3.paintOn=true;});const g1=await p.evaluate(()=>window.__gid);
 for(let i=0;i<15;i++){await p.mouse.move(box[0]+box[2]*(.35+i/60),box[1]+box[3]*(.4+i/90));await p.waitForTimeout(40);}
 await p.mouse.down();for(let i=0;i<10;i++){await p.mouse.move(box[0]+box[2]*(.5+i/80),box[1]+box[3]*.5);await p.waitForTimeout(40);}await p.mouse.up();await p.waitForTimeout(800);
 const g2=await p.evaluate(()=>window.__gid);ok(g2-g1<=2,'hovering and painting the model read canvases '+(g2-g1)+' times (was once per move)');if(g2-g1>2)console.log(await p.evaluate(()=>Object.keys(window.__gst).join('\n')));
 /* a big model draws lighter while turning */
 const N=390;await p.evaluate(async N=>{const L=[];for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const u=i/N,v=j/N,th=u*Math.PI*2,ph=v*Math.PI;L.push('v '+(Math.sin(ph)*Math.cos(th)).toFixed(4)+' '+Math.cos(ph).toFixed(4)+' '+(Math.sin(ph)*Math.sin(th)).toFixed(4)+'\nvt '+u.toFixed(4)+' '+v.toFixed(4));}
  for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i+1,b=a+1,c=a+N+1,d=c+1;L.push('f '+a+'/'+a+' '+c+'/'+c+' '+b+'/'+b+'\nf '+b+'/'+b+' '+c+'/'+c+' '+d+'/'+d);}
  const m=await __gs.parseModelBytes('dense.obj',new TextEncoder().encode(L.join('\n')));const v3=__gs.v3;v3.imported=__gs.p3.imported=m;__gs.v3s().model='imported';v3.mesh=null;v3.dirty=true;__gs.requestRender();},N);
 await p.waitForTimeout(6000);
 const full=await p.evaluate(()=>__gs.v3.fbo.w);
 const sc=await p.evaluate(()=>{const s=__gs.v3Work.scenes;__gs.v3.cam.yaw+=.3;__gs.v3.dirty=true;__gs.requestRender();return s;});await p.waitForFunction(s=>__gs.v3Work.scenes>s,sc,{timeout:60000});
 const mov=await p.evaluate(()=>({w:__gs.v3.fbo.w,tris:__gs.v3.mesh.idx.length/3}));
 ok(mov.tris>=3e5&&mov.w<full*.7,'turning a '+mov.tris+'-triangle model draws at '+mov.w+' px instead of '+full);
 await p.waitForTimeout(6000);ok(await p.evaluate(f=>__gs.v3.fbo.w===f,full),'…and sharp again once it stops');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
