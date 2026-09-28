/* 0.22: ID bake colours from separate meshes, materials, vertex colours or ZBrush polypaint. */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const waitIdle=async()=>{for(let i=0;i<900;i++){if(await p.evaluate(()=>!__gs.bk.busy))return;await W(100);}};
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'painting',false));await p.click('#modeTabs [data-mode=bake]');await W(600);
 /* high-poly: two quads (objects A and B, materials Ma and Mb), vertex colours red/blue, polypaint green/yellow */
 await p.evaluate(()=>{const low='v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n';
   const hi='v -1 -1 0 1 0 0\nv 0 -1 0 1 0 0\nv 0 1 0 1 0 0\nv -1 1 0 1 0 0\nv 0 -1 0 0 0 1\nv 1 -1 0 0 0 1\nv 1 1 0 0 0 1\nv 0 1 0 0 0 1\n#MRGB 0000ff000000ff000000ff000000ff00\n#MRGB 00ffff0000ffff0000ffff0000ffff00\no A\nusemtl Ma\nf 1 2 3 4\no B\nusemtl Mb\nf 5 6 7 8\n';
   const C=__gs.bakeCfg;C.low=__gs.parseOBJ(low,'q_low.obj');C.high=__gs.parseOBJ(hi,'q_high.obj');C.cage=null;C.size=64;C.ss=1;C.pad=2;C.front=20;C.back=20;C.match=false;C.perMat=false;for(const k in C.kinds)C.kinds[k]=k==='id';});
 const h=await p.evaluate(()=>{const H=__gs.bakeCfg.high;return {vc:!!H.vcol,pc:!!H.pcol,parts:H.partNames,mats:H.matNames};});
 ok(h.vc&&h.pc&&h.mats.join()==='Ma,Mb','the OBJ reader keeps vertex colours and polypaint '+JSON.stringify(h));
 const bake=async src=>{await p.evaluate(s=>{__gs.bakeCfg.idSrc=s;},src);await p.evaluate(()=>__gs.act('bake'));await W(200);await p.click('#bkGo');await W(300);await waitIdle();await W(200);
   return p.evaluate(()=>{const d=__gs.readRGBA8(__gs.bk.res.id),W=__gs.doc.w,px=(x,y)=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+3));return [px(16,32),px(48,32)];});};
 let r=await bake('vertex');ok(r[0][0]>200&&r[0][2]<60&&r[1][2]>200&&r[1][0]<60,'Vertex colours: red and blue '+JSON.stringify(r));
 r=await bake('poly');ok(r[0][1]>200&&r[0][0]<60&&r[1][0]>200&&r[1][1]>200&&r[1][2]<60,'Polypaint: green and yellow '+JSON.stringify(r));
 r=await bake('part');const d1=Math.abs(r[0][0]-r[1][0])+Math.abs(r[0][1]-r[1][1])+Math.abs(r[0][2]-r[1][2]);ok(d1>60,'Separate meshes: two different colours '+JSON.stringify(r));
 r=await bake('mat');const d2=Math.abs(r[0][0]-r[1][0])+Math.abs(r[0][1]-r[1][1])+Math.abs(r[0][2]-r[1][2]);ok(d2>60,'Materials: two different colours '+JSON.stringify(r));
 ok(await p.evaluate(()=>{const b=[...document.querySelectorAll('#bakeBody .seg button')].find(b=>b.textContent.startsWith('Other'));if(b)b.click();return !!document.querySelector('#bkIdSrc');}),'the Other tab offers the ID colour sources');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
