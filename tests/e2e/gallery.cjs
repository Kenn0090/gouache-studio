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
 const px=(x,y)=>p.evaluate(([x,y])=>{const L=__gs.doc.active;const d=__gs.readRGBA8(L.target);const i=(y*__gs.doc.w+x)*4;return [d[i],d[i+1],d[i+2],d[i+3]];},[x,y]);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Gal',false));await W();
 await setFG('#204080');await p.evaluate(()=>__gs.setTool('marquee'));
 const a=await scr(0,0),c=await scr(128,256);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:4});await p.mouse.up();await W(200);
 await p.evaluate(()=>{__gs.act('fill');__gs.act('deselect');__gs.setTool('brush');});await W(200);
 const edge0=await px(130,128);
 await p.keyboard.press('Control+Shift+F');await W(800);
 ok(await p.evaluate(()=>/Filter Gallery/.test(document.querySelector('#dlgTitle').textContent)),'Ctrl+Shift+F opens the Filter Gallery');
 const n=await p.evaluate(()=>document.querySelectorAll('.galitem').length);ok(n>=4,'Artistic thumbnails listed ('+n+')');
 await W(1500);ok(await p.evaluate(()=>{const c=document.querySelector('.galitem canvas');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let s=0;for(let i=3;i<d.length;i+=4)s+=d[i];return s>0;}),'thumbnails drawn');
 await p.fill('.galsearch','gauss');await W(200);ok(await p.evaluate(()=>[...document.querySelectorAll('.galitem span')].map(s=>s.textContent).join()).then(t=>/Gaussian/.test(t)),'search finds Gaussian blur');
 await p.click('.galitem:has-text("Gaussian")');await W(300);
 ok(await p.evaluate(()=>/Gaussian/.test(document.querySelector('.galtitle').textContent)),'clicking a thumbnail picks it');
 const pv=await p.evaluate(()=>{const c=document.querySelector('.galprev');return c.width+'x'+c.height;});ok(pv==='256x256','preview canvas '+pv);
 // a second filter on top, then switch it off and on
 await p.fill('.galsearch','');await W(200);await p.click('.galstack button:text("+ Add")');await W(200);await p.fill('.galsearch','invert');await W(200);await p.click('.galitem:has-text("Invert")');await W(300);
 ok(await p.evaluate(()=>document.querySelectorAll('.galrow').length)===2,'two filters in the stack');
 await p.click('#dlgOk');await W(500);
 const e1=await px(130,128),f=await px(40,128),w=await px(220,128);ok(f[0]>200&&f[2]<150&&w[0]<20,'Apply: inverted (blue became orange, white became black) '+f+' '+w);
 ok(Math.abs(e1[0]-edge0[0])>5,'and blurred across the edge '+edge0+' → '+e1);
 ok(await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label)==='Filter Gallery','one undo step called Filter Gallery');
 await p.evaluate(()=>__gs.undo());await W(300);
 // As a filter layer
 await p.keyboard.press('Control+Shift+F');await W(800);await p.fill('.galsearch','posterize');await W(200);await p.click('.galitem:has-text("Posterize")');await W(300);await p.click('#galAsLayer');await W(400);
 const fl=await p.evaluate(()=>{const n=__gs.doc.active;return {fx:!!n.fx,clip:n.clip,stack:n.fx&&n.fx.stack.map(i=>i.id).join()};});ok(fl.fx&&fl.clip&&fl.stack==='posterize','As a filter layer: an editable clipped filter layer '+JSON.stringify(fl));
 ok(!(await p.isVisible('#galAsLayer')),'the extra button goes away with the window');
 // cancel leaves the layer as it was
 await p.evaluate(()=>{__gs.undo();});await W(200);const before=await px(60,60);await p.keyboard.press('Control+Shift+F');await W(800);await p.click('#dlgCancel');await W(300);ok((await px(60,60)).join()===before.join(),'Cancel changes nothing');
 await p.keyboard.press('Control+Shift+F');await W(1200);await p.screenshot({path:OUT+'gallery.png'});await p.click('#dlgCancel');
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
