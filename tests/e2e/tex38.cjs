/* 0.38: Turn the canvas into a texture (Grunge, Decal, Material, Brush tip) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});

 await p.addInitScript(()=>{try{localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,null,'painting',false));await W(400);
 /* paint a stroke on a transparent layer */
 const box=await p.evaluate(()=>{const r=document.querySelector('#gl').getBoundingClientRect();return [r.left,r.top,r.width,r.height];});
 const cx=box[0]+box[2]/2,cy=box[1]+box[3]/2;
 await p.evaluate(()=>{__gs.setTool('brush');});
 await p.mouse.move(cx-30,cy);await p.mouse.down();await p.mouse.move(cx+30,cy,{steps:8});await p.mouse.up();await W(400);
 /* File menu has the command; the dialog offers the types */
 await p.evaluate(()=>__gs.dlgToTexture());await W(300);
 const labels=await p.evaluate(()=>[...document.querySelectorAll('#modal .segb, .dlg .segb')].map(b=>b.textContent));
 ok(['Grunge','Decal','Material','Brush tip','Stencil'].every(l=>labels.includes(l)),'the dialog offers the texture types '+labels.join(','));
 await p.evaluate(()=>document.querySelector('#dlgCancel').click());await W(200);
 /* Grunge goes to Textures with its transparency */
 const n0=await p.evaluate(()=>__gs.tx.mine.length);
 await p.evaluate(()=>__gs.ttMake(null,'grunge','My canvas'));await W(600);
 const g=await p.evaluate(()=>{const r=__gs.tx.mine[__gs.tx.mine.length-1];let a0=0,a1=0;for(let i=3;i<r.data.length;i+=4){if(r.data[i]===0)a0++;else a1++;}return {n:__gs.tx.mine.length,name:r.name,a0,a1};});
 ok(g.n===n0+1&&g.name==='My canvas','Grunge: the texture is saved in Textures '+JSON.stringify(g));
 ok(g.a0>0&&g.a1>0,'the transparent parts stay transparent '+JSON.stringify(g));
 /* Decal goes through the Convert tab and keeps its cut-out */
 await p.evaluate(()=>__gs.ttMake(null,'decal','My decal'));await W(1500);
 ok(await p.evaluate(()=>__gs.ui.mode==='convert'&&__gs.cv.decal===true&&!!__gs.cv.src),'Decal opens the Convert tab with the picture');
 const rec=await p.evaluate(()=>{const r=__gs.cvMaterialRec('My decal',256);let a0=0,a1=0;const d=r.imgs.base.data;for(let i=3;i<d.length;i+=4){if(d[i]<10)a0++;else a1++;}return {decal:!!r.fill.decal,proj:r.fill.proj,a0,a1};});
 ok(rec.decal&&rec.proj==='planar'&&rec.a0>0&&rec.a1>0,'the decal material keeps the cut-out '+JSON.stringify(rec));
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
