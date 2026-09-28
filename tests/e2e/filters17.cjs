const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const IDS=['glass','softFocus','acid','halftone','engraving','riso','bwPrint','watercolour','charcoal','driftBlur','pixelBitmap','anaglyph','cineMono','kuwahara'];
 // a colourful picture: the sample tile
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Stones');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});
 const sig=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.doc.active.target);let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])%1000003;return h;});
 const s0=await sig();
 for(const id of IDS){const r=await p.evaluate(async id=>{const L=__gs.doc.active;__gs.act(id);await new Promise(r=>setTimeout(r,500));
     const ok=!document.querySelector('#modal').hidden&&document.querySelector('#dlgOk');document.querySelector('#dlgOk').click();await new Promise(r=>setTimeout(r,300));
     return {ok:!!ok,label:__gs.hist.undo[__gs.hist.undo.length-1].label};},id);
   const s1=await sig();ok(r.ok&&s1!==s0,id+': applies and changes the layer ('+r.label+')');
   await p.screenshot({path:OUT+'fx17-'+id+'.png'});
   await p.evaluate(()=>__gs.undo());await W(250);ok(await sig()===s0,id+': undo restores');}
 // modes
 const modes=[['glass','.seg button:text("Ribbed")'],['glass','.seg button:text("Overlay")'],['acid','.seg button:text("Glitch trails")'],['halftone','.seg button:text("Wavy lines")'],['pixelBitmap','.seg button:text("1-bit")'],['riso','.seg button:text("Three inks")']];
 for(const [id,sel] of modes){await p.evaluate(id=>__gs.act(id),id);await W(400);await p.click('#dlgBody '+sel);await W(300);await p.click('#dlgOk');await W(300);const s1=await sig();ok(s1!==s0,id+' '+sel.split('"')[1]+' works');await p.screenshot({path:OUT+'fx17-'+id+'-'+sel.split('"')[1].replace(/\W/g,'')+'.png'});await p.evaluate(()=>__gs.undo());await W(200);}
 // gallery folders and gradient map presets
 await p.keyboard.press('Control+Shift+F');await W(600);
 const heads=await p.evaluate(()=>[...document.querySelectorAll('.galhead')].map(h=>h.textContent.replace(/[▾▸] /,'')).join());ok(/Photo/.test(heads)&&/Print/.test(heads),'gallery has Photo and Print folders: '+heads);
 await p.click('.galhead:has-text("Print")');await W(300);ok(await p.evaluate(()=>[...document.querySelectorAll('.galitem span')].map(s=>s.textContent).join()).then(t=>/Riso/.test(t)&&/Halftone/.test(t)),'Print folder lists the new filters');
 await p.click('#dlgCancel');await W(200);
 await p.evaluate(()=>__gs.act('gradMap'));await W(400);ok(await p.evaluate(()=>[...document.querySelectorAll('#gmSel option')].filter(o=>/Y2K/.test(o.textContent)).length)>=5,'Y2K gradient maps');await p.click('#dlgCancel');
 // as a filter layer
 await p.evaluate(()=>__gs.act('newFx'));await W(400);const kinds=await p.evaluate(()=>document.querySelector('#dlgBody').textContent);ok(/Riso print/.test(kinds)&&/Drift blur/.test(kinds),'filter layers can use them');await p.click('#dlgCancel');

 // Tile: uniform scale (one count for both directions) and separate counts
 await p.evaluate(()=>__gs.newDoc(240,120,8,[1,1,1],'T',false));await W();
 await p.evaluate(()=>{__gs.setTool('marquee');});const A=await scr(0,0),C=await scr(120,60);await p.mouse.move(A[0],A[1]);await p.mouse.down();await p.mouse.move(C[0],C[1],{steps:4});await p.mouse.up();
 await setFG('#000000');await p.evaluate(()=>{__gs.act('fill');__gs.act('deselect');});await W(200);
 await p.evaluate(()=>__gs.act('tile_fx'));await W(400);ok(await p.isChecked('#fx_tuni'),'Tile: uniform scale is on for a new tile');
 await p.evaluate(()=>{const s=document.querySelector('#fx_nx');s.value=3;s.dispatchEvent(new Event('input'));});await W(200);await p.click('#dlgOk');await W(300);
 const cnt=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.doc.active.target),W=__gs.doc.w;const row=y=>{let n=0,prev=255;for(let x=0;x<W;x++){const v=d[(y*W+x)*4];if(v<60&&prev>=60)n++;prev=v;}return n;};let col=0,prev=255;for(let y=0;y<__gs.doc.h;y++){const v=d[(y*W+5)*4];if(v<60&&prev>=60)col++;prev=v;}return [row(5),col];});
 ok(cnt[0]===3&&cnt[1]===3,'Tiles 3 with uniform scale: 3 across and 3 down '+cnt);
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
