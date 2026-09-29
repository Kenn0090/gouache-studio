/* 0.28: Height depth (tessellation) on imported models: no tearing at hard edges, texture sets survive Detail */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 /* a hard-edged cube: every side has its own corners, normals and UVs; two materials */
 await p.evaluate(()=>{const F=[[[1,0,0],[0,0,-1],[0,1,0]],[[-1,0,0],[0,0,1],[0,1,0]],[[0,1,0],[1,0,0],[0,0,-1]],[[0,-1,0],[1,0,0],[0,0,1]],[[0,0,1],[1,0,0],[0,1,0]],[[0,0,-1],[-1,0,0],[0,1,0]]];
   let o='',vi=1;const nl=[],fl=[];F.forEach(([n,U,V],k)=>{for(const [a,b] of [[-1,-1],[1,-1],[1,1],[-1,1]])o+='v '+[0,1,2].map(c=>n[c]+U[c]*a+V[c]*b).join(' ')+'\n';
     o+='vn '+n.join(' ')+'\n';fl.push((k<3?'usemtl A\n':k===3?'usemtl B\n':'')+'f '+[0,1,2,3].map(i=>(vi+i)+'/'+(i+1)+'/'+(k+1)).join(' ')+'\n');vi+=4;});
   o+='vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\n'+fl.join('');window.__hc=o;__gs.useModel(__gs.parseOBJ(o.replace('usemtl B\n',''),'hardcube.obj'));});await W(1000);
  /* the first set gets a height material that pushes everything out */
 await p.evaluate(()=>{__gs.cmdNewFillLayer();const L=__gs.doc.active;const F=L.fill.maps;for(const k in F)F[k].on=false;F.height=Object.assign(F.height||{},{on:true,src:'value',v:1});__gs.fillRender(L);Object.assign(__gs.v3.cam,{yaw:.6,pitch:.5});__gs.v3.dirty=true;});await W(800);
 const bgIn=async(name)=>{const buf=await p.locator('#work').screenshot({path:OUT+name});return p.evaluate(async b64=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;
   /* background-coloured pixels inside the middle of the picture (the model covers it) */
   const b=[23,26,29];let n=0;for(let y=c.height*.35|0;y<c.height*.65;y++)for(let X=c.width*.35|0;X<c.width*.65;X++){const i=(y*c.width+X)*4;if(Math.abs(d[i]-b[0])+Math.abs(d[i+1]-b[1])+Math.abs(d[i+2]-b[2])<6)n++;}return n;},buf.toString('base64'));};
 const holes0=await bgIn('tess-0.png');
 await p.click('#v3Gear');await W(300);await p.evaluate(()=>{const s=document.querySelector('#v3Disp');s.value=1;s.dispatchEvent(new Event('input'));});await p.click('#v3Gear');await W(1500);
 const holes1=await bgIn('tess-1.png');
 ok(holes0===0&&holes1===0,'pushed out, the hard edges stay closed (background showing through: '+holes0+' → '+holes1+')');
 /* a model with two materials: the texture sets keep their parts when it is subdivided */
 await p.evaluate(()=>__gs.useModel(__gs.parseOBJ(window.__hc,'hardcube2.obj')));await W(1200);
 const sets=await p.evaluate(()=>__gs.p3.sets.map(S=>S.name).join());ok(sets.split(',').length===2,'two texture sets ('+sets+')');
 const st=await p.evaluate(()=>{const m=__gs.v3.mesh;return {det:__gs.doc.v3d.detail,tris:m.idx.length/3,src:m.src?m.src.idx.length/3:0,ranges:JSON.stringify(m.setRanges)};});
 ok(st.det>0&&st.tris>st.src&&st.src===12&&st.tris%12===0,'Height depth raises Detail: the model is subdivided '+JSON.stringify(st));
 const R=JSON.parse(st.ranges||'null');ok(R&&R.length===2&&R[0].count+R[1].count===st.tris,'the texture sets keep their parts after subdividing');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
