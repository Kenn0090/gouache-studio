/* 0.26.2 document tabs: new tabs, switching, windows of their own, closing */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const scrIn=async(pg,x,y)=>{const box=await pg.locator('#gl').boundingBox();const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const stroke=async(pg,y)=>{await p.evaluate(()=>{__gs.setTool('brush');__gs.brush.size=20;});const a=await scrIn(pg,20,y),c=await scrIn(pg,200,y);await pg.mouse.move(a[0],a[1]);await pg.mouse.down();await pg.mouse.move(c[0],c[1],{steps:6});await pg.mouse.up();await W(400);};
 const px=(x,y)=>p.evaluate(([x,y])=>{const t=__gs.compositeMap('base'),d=__gs.readRGBA8(t),Wd=__gs.doc.w;__gs.release(t);return Array.from(d.slice((y*Wd+x)*4,(y*Wd+x)*4+3));},[x,y]);
 const tabs=()=>p.evaluate(()=>__gs.dtab().tabs.map(t=>t.id));
 const newDoc=async()=>{await p.evaluate(()=>__gs.act('new'));await W(300);await p.fill('#dW','256');await p.fill('#dH','256');await p.dispatchEvent('#dW','input');await p.click('#dlgOk');await W(500);};
 ok((await tabs()).length===1&&await p.isVisible('#docTabs .dtab'),'one tab at start');
 await newDoc();ok((await tabs()).length===1,'New on the untouched start-up document reuses its tab');
 await p.evaluate(()=>__gs.setFG([1,0,0]));await stroke(p,100);ok((await px(100,100))[1]<80,'painted red in the first document');
 ok(/•/.test(await p.textContent('#docTabs .dtab.on')),'an unsaved document shows • on its tab');
 await newDoc();let T=await tabs();ok(T.length===2&&await p.evaluate(()=>__gs.dtab().live)===T[1],'New adds a second tab and switches to it');
 ok((await px(100,100))[0]>250&&(await px(100,100))[1]>250,'…with a blank canvas');
 await p.evaluate(()=>__gs.setFG([0,0,1]));await stroke(p,150);
 await p.locator('#docTabs .dtab').nth(0).click();await W(400);ok((await px(100,100))[1]<80&&(await px(100,150))[2]>250,'clicking the first tab brings back its picture (red, no blue)');
 await p.keyboard.press('Control+z');await W(300);ok((await px(100,100))[1]>250,'…each document has its own undo');await p.keyboard.press('Control+Shift+z');await W(300);
 await p.keyboard.press('Control+Tab');await W(400);ok(await p.evaluate(()=>__gs.dtab().live)===T[1]&&(await px(100,150))[2]>200,'Ctrl+Tab goes to the next document');
 /* a window of its own */
 const tb=await p.locator('#docTabs .dtab').nth(1).boundingBox();const popP=ctx.waitForEvent('page');
 await p.mouse.move(tb.x+30,tb.y+10);await p.mouse.down();await p.mouse.move(tb.x+30,tb.y+160,{steps:8});await p.mouse.up();
 const pop=await popP;await W(1200);
 ok(await pop.evaluate(()=>!!document.getElementById('gl'))&&await p.isVisible('#workAway'),'dragging a tab down out of the bar opens it in its own window, with the canvas');
 await stroke(pop,200);ok(await p.evaluate(()=>__gs.dtab().live)===T[1]&&(await px(100,200))[2]>200,'painting in that window paints its document');
 await p.click('#workAway');await W(600);ok(await p.evaluate(()=>!!document.getElementById('gl'))&&(await px(100,100))[1]<80,'clicking the main window brings the first document back there');
 ok(await pop.isVisible('.dwshot'),'…and the window shows a still picture of its document');
 await pop.click('.dwholder');await W(600);ok(await p.evaluate(()=>__gs.dtab().live)===T[1]&&await pop.evaluate(()=>!!document.getElementById('gl')),'clicking into the window makes its document the one you work on');
 await pop.click('.dwbar button',{noWaitAfter:true}).catch(()=>{});await W(600);ok(await p.evaluate(()=>!!document.getElementById('gl')&&!__gs.dtab().tabs.some(t=>t.win))&&pop.isClosed(),'⤓ puts it back as a tab in the main window');
 /* closing */
 await p.click('#docTabs .dtab.on .dtx');await W(300);ok(await p.isVisible('#modal')&&/Save/.test(await p.textContent('#dlgTitle')),'closing an unsaved document asks to save');
 await p.click('#modal button:has-text("Don’t save")');await W(500);ok((await tabs()).length===1&&(await px(100,100))[1]<80,'Don’t save closes it and shows the other document');
 await p.click('#docTabs .dtab.on .dtx');await W(300);await p.click('#modal button:has-text("Don’t save")');await W(800);
 ok((await tabs()).length===1&&await p.evaluate(()=>__gs.doc.name==='Untitled')&&await p.isVisible('#welcome'),'closing the last one leaves a blank Untitled and the welcome screen');
 console.log(errs.join('\n'));console.log(fails?'FAILS '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);})();
