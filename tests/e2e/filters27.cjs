/* 0.27: Warp, Slope blur and Distort filters, generator Distort */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 await p.evaluate(()=>{const w=document.getElementById('welcome');if(w)w.remove();__gs.newDoc(128,128,8,[1,1,1],'f',false);});await W(400);
 /* stripes to push around */
 const run=(id,v)=>p.evaluate(([id,v])=>{const g=__gs,W=128,s=g.makeTarget(W,W,8,false),d=new Uint8Array(W*W*4);
   for(let y=0;y<W;y++)for(let x=0;x<W;x++){const i=(y*W+x)*4,on=(Math.floor(x/16)%2)===0;d[i]=d[i+1]=d[i+2]=on?255:0;d[i+3]=255;}
   const gl=document.querySelector('#gl').getContext('webgl2');gl.bindTexture(gl.TEXTURE_2D,s.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,W,gl.RGBA,gl.UNSIGNED_BYTE,d);
   const o=g.makeTarget(W,W,8,false),F=g.FX[id];F.render(s,o,Object.assign(g.fxDefaults(F),v||{}));const r=g.captureRegionNow(o,0,0,W,W).data;
   let diff=0,sum=0,mid=0;for(let i=0;i<r.length;i+=4){diff+=Math.abs(r[i]-d[i])>40?1:0;sum+=r[i];if(r[i]>40&&r[i]<215)mid++;}return {diff,avg:sum/(W*W),mid,a:r[3]};},[id,v]);
 const base=128*128;
 for(const id of ['warp','slopeBlur','distort'])ok(await p.evaluate(id=>!!__gs.FX[id],id),id+' is a filter');
 let r=await run('warp');ok(r.diff>base*.05&&r.a===255,'Warp moves the stripes '+JSON.stringify(r));
 r=await run('warp',{mode:'turb'});ok(r.diff>base*.05,'Turbulent warp too '+JSON.stringify(r));
 r=await run('slopeBlur',{guide:'noise',amt:20});ok(r.mid>base*.1,'Slope blur smears along a noise slope (in-between greys) '+JSON.stringify(r));
 const mn=await run('slopeBlur',{guide:'noise',mode:'min',amt:20}),mx=await run('slopeBlur',{guide:'noise',mode:'max',amt:20});
 ok(mn.avg<127.5-5&&mx.avg>127.5+5,'Min eats into the bright parts, Max grows them ('+mn.avg.toFixed(1)+' / '+mx.avg.toFixed(1)+')');
 for(const k of ['waves','ripple','twirl','pinch']){r=await run('distort',{kind:k,amt:k==='pinch'?60:k==='twirl'?60:12,size:30});ok(r.diff>base*.03,'Distort › '+k+' '+JSON.stringify(r));}
 /* in the menus */
 await p.evaluate(()=>__gs.act('warp'));await W(300);ok(await p.locator('#dlgOk').isVisible(),'Filter › Warp… opens its window');await p.click('#dlgCancel');await W(200);
 await p.evaluate(()=>__gs.act('gallery'));await W(600);ok(await p.evaluate(()=>[...document.querySelectorAll('.galhead')].some(e=>/Distort$/.test(e.textContent.trim()))),'the Filter Gallery has a Distort folder');
 await p.keyboard.press('Escape');await W(300);
 /* generators: Distort changes the result */
 const gen=await p.evaluate(()=>{const g=__gs,L=g.doc.active;{/* a curvature map with sharp stripes for the edges to read */const W=g.doc.w,t=g.makeTarget(W,g.doc.h,8,true),d=new Uint8Array(W*g.doc.h*4);for(let i=0;i<W*g.doc.h;i++){const x=i%W,v=(Math.floor(x/8)%2)?230:128;d[i*4]=d[i*4+1]=d[i*4+2]=v;d[i*4+3]=255;}const gl=document.querySelector('#gl').getContext('webgl2');gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,g.doc.h,gl.RGBA,gl.UNSIGNED_BYTE,d);g.doc.meshMaps={curv:t};}g.msAdd(L,'gen',{p:{g:'edge',amount:.5,width:.5,breakup:.5,contrast:1.5,scale:6,seed:1,inv:false,anchor:''}});const r=L.mask.stack[L.mask.stack.length-1];
   const read=()=>{g.msUpdate(L);const d=g.readRGBA8(L.mask.target);let s=0;for(let i=0;i<d.length;i+=4*7)s+=d[i]*(i%97);return s;};const a=read();r.p.distort=1;L.mask._key=null;const b=read();return {a,b};});
 ok(gen.a!==gen.b,'a generator’s Distort setting changes the mask '+JSON.stringify(gen));
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
