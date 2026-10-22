/* 0.68: normal layers on the 3D model (3D Paint) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(1,3).join('<')));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.selectOption('#p3Model','plane');await W(900);
 await p.evaluate(()=>{__gs.cmdNewNormalLayer();});await W(800);
 const st=await p.evaluate(()=>({mode:__gs.mode,nrm:__gs.isNormalLayer(__gs.doc.active),map:__gs.doc.map,maps:__gs.doc.maps.join()}));
 ok(st.mode==='p3d'&&st.nrm&&st.map==='height','a normal layer in 3D Paint paints Height ('+JSON.stringify(st)+')');
 const hb=await p.locator('#v3Hit').boundingBox();const cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.evaluate(()=>{Object.assign(__gs.brush,{size:60,hardness:0,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:true,edgeSat:0,glaze:0,wet:0,pickup:0,dual:null,followDir:false});__gs.np.mode='raise';__gs.np.str=.8;__gs.doc.nrmStr=8;__gs.setTool('brush');});
 const stroke=async(x0,y0,x1,y1)=>{await p.mouse.move(x0,y0);await p.mouse.down();await p.mouse.move(x1,y1,{steps:14});await p.mouse.up();await W(600);};
 await stroke(cx-80,cy,cx+80,cy);
 const painted=()=>p.evaluate(()=>{const L=__gs.doc.active,t=L.maps.height,d=__gs.readRGBA8(t);let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>20)n++;return n;});
 const n1=await painted();ok(n1>300,'a Raise stroke on the model paints the layer\'s Height ('+n1+' px)');
 const slope=await p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t);let mn=255,mx=0;for(let i=1;i<d.length;i+=4){mn=Math.min(mn,d[i]);mx=Math.max(mx,d[i]);}return mx-mn;});
 ok(slope>20,'the final normal now has bumps ('+slope+' levels)');
 await p.evaluate(()=>__gs.undo());await W(500);
 ok((await painted())<n1/4,'one undo takes the stroke back');
 await p.evaluate(()=>{__gs.np.mode='dir';__gs.np.ang=45;__gs.np.tilt=.7;Object.assign(__gs.brush,{hardness:1,buildup:false});});
 await stroke(cx-80,cy,cx+80,cy);
 const dir=await p.evaluate(()=>{const L=__gs.doc.active,t=L.maps.normal,d=__gs.readRGBA8(t);let n=0,r=0,g=0;for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a>200){n++;r+=d[i]/a;g+=d[i+1]/a;}}return {n,r:r/n,g:g/n,map:__gs.doc.map};});
 ok(dir.n>300&&dir.r>.7&&dir.g>.7&&dir.map==='normal','a Direction stroke paints a tilted normal on the model ('+dir.n+' px, avg '+dir.r.toFixed(2)+','+dir.g.toFixed(2)+')');

 /* smudge on the model's normal keeps the length */
 await p.evaluate(()=>{__gs.np.ang=200;});await stroke(cx-80,cy+40,cx+80,cy+40);
 const lenOf=()=>p.evaluate(()=>{const L=__gs.doc.active,t=L.maps.normal,d=__gs.readRGBA8(t);let n=0,sh=0;for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<250)continue;const v=[d[i]/a*2-1,d[i+1]/a*2-1,d[i+2]/a*2-1],l=Math.hypot(...v);n++;if(l<.9)sh++;}return {n,sh:sh/Math.max(1,n)};});
 const lb=await lenOf();
 await p.evaluate(()=>{__gs.setTool('smudge');Object.assign(__gs.brush,{size:70,hardness:.8,strength:.9,charge:0,spacing:.05,paintMix:0,pSize:false,pOpacity:false});});
 await stroke(cx,cy-30,cx,cy+80);
 const la=await lenOf();
 ok(la.n>300&&la.sh<=lb.sh+.01,'Smudge on the model\'s normal does not shorten normals ('+(lb.sh*100).toFixed(1)+'% short before, '+(la.sh*100).toFixed(1)+'% after)');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
