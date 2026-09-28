/* 0.22: material layers (editor, images, triplanar, height bumps), the Materials tab (save, apply), kept in files. */
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
 const png=async(kind)=>p.evaluate(async k=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
   if(k==='check'){for(let j=0;j<8;j++)for(let i=0;i<8;i++){x.fillStyle=(i+j)%2?'#e03020':'#2040e0';x.fillRect(i*8,j*8,8,8);}}else{const g=x.createLinearGradient(0,0,64,0);g.addColorStop(0,'#000');g.addColorStop(.5,'#fff');g.addColorStop(1,'#000');x.fillStyle=g;x.fillRect(0,0,64,64);}
   const b=await new Promise(r=>c.toBlob(r,'image/png'));return Array.from(new Uint8Array(await b.arrayBuffer()));},kind);
 const choose=async(btn,kind)=>{const fc=p.waitForEvent('filechooser');await p.click(btn);const ch=await fc;await ch.setFiles({name:kind+'.png',mimeType:'image/png',buffer:Buffer.from(await png(kind))});await W(600);};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 ok(await p.evaluate(()=>{const s=document.querySelector('#matSec');return !!s&&!!s.closest('#dock2');}),'Materials is a tab beside Brushes');
 await p.evaluate(()=>__gs.showPanel('mats'));await W(200);
 ok(await p.evaluate(()=>document.querySelectorAll('#matBody .mattile').length>=10),'built-in materials shown with previews');
 /* a new material with images */
 await p.click('#matNew');await W(400);ok(await p.evaluate(()=>/New material/.test(document.querySelector('#dlgTitle').textContent)),'New material opens the material editor');
 await p.evaluate(()=>{const b=[...document.querySelectorAll('.filldlg .fillrow')].find(r=>r.textContent.includes('Base colour'));[...b.querySelectorAll('.segb')].find(x=>x.textContent==='Image');});
 await p.evaluate(()=>{const r=[...document.querySelectorAll('.filldlg .fillrow')].find(r=>r.textContent.includes('Base colour'));[...r.querySelectorAll('button')].find(x=>x.textContent==='Image').setAttribute('id','baseImgSeg');});
 await choose('#baseImgSeg','check');
 let s=await p.evaluate(()=>{const L=__gs.doc.active;return {img:!!(L._fillImg&&L._fillImg.base),src:L.fill.maps.base.src};});ok(s.img&&s.src==='image','base colour from an image '+JSON.stringify(s));
 const count=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base'));let r=0,b=0;for(let i=0;i<d.length;i+=4){if(d[i]>150&&d[i+2]<90)r++;else if(d[i+2]>150&&d[i]<90)b++;}return {r,b};});
 let c1=await count();ok(c1.r>1000&&c1.b>1000,'the checker fills the base colour '+JSON.stringify(c1));
 /* triplanar */
 await p.click('.filldlg .segb:text-is("Triplanar")');await W(500);
 ok(await p.evaluate(()=>!!__gs.fillPosMaps()),'triplanar uses the model (positions and normals per texel)');
 const c2=await count();ok(c2.r>500&&c2.b>500&&(c2.r!==c1.r||c2.b!==c1.b),'triplanar lays the image out differently '+JSON.stringify(c2));
 /* height from an image makes bumps: the final normal is no longer flat */
 await p.evaluate(()=>{const r=[...document.querySelectorAll('.filldlg .fillrow')].find(r=>r.textContent.includes('Height'));const c=r.querySelector('input[type=checkbox]');c.click();});await W(300);
 await p.evaluate(()=>{const r=[...document.querySelectorAll('.filldlg .fillrow')].find(r=>r.textContent.includes('Height'));[...r.querySelectorAll('button')].find(x=>x.textContent==='Image').setAttribute('id','hImgSeg');});
 await choose('#hImgSeg','grad');
 ok(await p.evaluate(()=>!!document.querySelector('#fl_hs')),'height image offers Bump strength');
 const nrm=await p.evaluate(()=>{const t=__gs.normalComp(),d=__gs.readRGBA8(t);let dev=0;for(let i=0;i<d.length;i+=4)dev+=Math.abs(d[i]-128);__gs.release(t);return dev/(d.length/4);});
 ok(nrm>3,'the height makes normal detail (average tilt '+nrm.toFixed(1)+')');
 await p.fill('#fl_name','Blue checker');await p.click('#fl_save');await W(400);
 ok(await p.evaluate(()=>__gs.matLib.list.some(r=>r.name==='Blue checker'&&r.imgs.base&&r.imgs.height)),'Save to Materials keeps it with its images');
 await p.click('#dlgOk');await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#matMine .mattile')),'it shows under Yours in Materials');
 /* apply the saved one */
 await p.click('#matMine .mattile');await W(600);
 s=await p.evaluate(()=>{const L=__gs.doc.active;return {name:L.name,tri:L.fill&&L.fill.proj,imgs:Object.keys(L._fillImg||{})};});
 ok(s.name==='Blue checker'&&s.tri==='tri'&&s.imgs.includes('base')&&s.imgs.includes('height'),'clicking it adds a live material layer '+JSON.stringify(s));
 /* still editable after saving and opening the project */
 await p.evaluate(async()=>{const b=await __gs.encodeP3Project();window.__pb=await b.arrayBuffer();});
 await p.evaluate(()=>{window.__o=__gs.openP3Project(window.__pb,'x').then(()=>'ok',e=>String(e));});await W(400);
 if(await p.evaluate(()=>!document.querySelector('#modal').hidden))await p.click('#dlgOk');ok((await p.evaluate(()=>window.__o))==='ok','project reopened');await W(600);
 ok(await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Blue checker');return !!(L&&L._fillImg&&L._fillImg.base&&L._fillImg.height);}),'material layers keep their images in files');
 /* ---- History panel ---- */
 await p.evaluate(()=>__gs.showPanel('mats'));await W(200);await p.click('#matMine .mattile');await W(500);await p.evaluate(()=>__gs.act('addLayer'));await W(200);
 await p.evaluate(()=>__gs.showPanel('hist'));await W(300);
 let hr=await p.evaluate(()=>[...document.querySelectorAll('#histBody .hrow')].map(r=>r.textContent));ok(hr.length>=2&&/Add material/.test(hr.join('|')),'History lists the steps '+JSON.stringify(hr.slice(-3)));
 const nL=await p.evaluate(()=>__gs.allLayers().length);await p.click('#histBody .hrow.first');await W(800);
 ok(await p.evaluate(n=>__gs.allLayers().length<n&&__gs.hist.undo.length===0,nL),'clicking the first step goes back to the start');
 await p.click('#histBody .hrow:last-child');await W(800);ok(await p.evaluate(n=>__gs.allLayers().length===n&&__gs.hist.redo.length===0,nL),'clicking the last one brings everything back');
 /* ---- lazy mouse ---- */
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);Object.assign(__gs.brush,{lazy:80,size:20,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null});});
 await p.fill('#hex','#10e040');await p.press('#hex','Enter');await p.evaluate(()=>document.activeElement.blur());
 const green=()=>p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Paint'),d=__gs.readRGBA8(__gs.mapT(L,'base'));let n=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>180&&d[i]<90&&d[i+3]>200)n++;return n;});
 const g0=await green();await p.mouse.move(cx-20,cy);await p.mouse.down();await p.mouse.move(cx+40,cy,{steps:8});await p.mouse.up();await W(400);const g1=await green();
 await p.mouse.move(cx-100,cy+40);await p.mouse.down();await p.mouse.move(cx+120,cy+40,{steps:16});await p.mouse.up();await W(400);const g2=await green();
 ok(g1-g0<400&&g2>g1+300,'lazy mouse: a short move stays on the string, a long one paints ('+g0+', '+g1+', '+g2+')');
 await p.evaluate(()=>{__gs.brush.lazy=0;});
 /* ---- export every texture set ---- */
 await p.evaluate(()=>{const o='v -2 -1 0\nv -0.1 -1 0\nv -0.1 1 0\nv -2 1 0\nv 0.1 -1 0\nv 2 -1 0\nv 2 1 0\nv 0.1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Left\nf 1/1 2/2 3/3 4/4\nusemtl Right\nf 5/1 6/2 7/3 8/4\n';__gs.useModel(__gs.parseOBJ(o,'two.obj'));});await W(800);
 await p.evaluate(()=>__gs.act('expTex'));await W(300);ok(await p.evaluate(()=>!!document.querySelector('#txAll')&&document.querySelector('#txAll').checked),'Export textures offers every texture set');
 const dl=p.waitForEvent('download',{timeout:30000}).catch(()=>null);await p.click('#dlgOk');const d=await dl;let names='';
 if(d){const fs=require('fs'),pth=await d.path();names=fs.readFileSync(pth).toString('latin1');}
 ok(!!d&&/Left/.test(names)&&/Right/.test(names)&&/_BC\.png/.test(names),'one set of files per texture set ('+(d&&d.suggestedFilename())+')');
 await p.screenshot({path:OUT+'mats.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
