const {chromium}=require('playwright');
const fs=require('fs');const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:')||u.startsWith('blob:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{__gs.newDoc(200,150,8,[1,1,1],'Anim',false);});
 const scr=async(x,y)=>{const box=await p.locator('#gl').boundingBox();const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,st=10)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:st});await p.mouse.up();await p.waitForTimeout(80);};
 const fpx=async(i,pts)=>p.evaluate(([i,pts])=>{const F=__gs.anim.frames[i],d=__gs.readRGBA8(F.target),W=__gs.doc.w;return pts.map(([x,y])=>d[(y*W+x)*4+3]);},[i,pts]);
 const st=()=>p.evaluate(()=>({mode:__gs.mode,n:__gs.anim?__gs.anim.frames.length:0,cur:__gs.anim?__gs.anim.cur:-1,fps:__gs.anim?__gs.anim.fps:0,tags:__gs.anim?__gs.anim.tags.length:0,w:__gs.doc.w,h:__gs.doc.h}));
 // 1. switch to Animation mode
 await p.click('#modeTabs [data-mode=anim]');await p.waitForTimeout(200);let s=await st();
 ok(s.mode==='anim'&&s.n===1&&await p.isVisible('#timeline')&&!(await p.isVisible('#layerList')),'animation mode shows timeline, hides layers '+JSON.stringify(s));
 // 2. paint frame 1, add frame 2 and paint elsewhere
 await p.keyboard.press('b');await p.keyboard.press('d');await drag(20,30,80,30);
 await p.click('button:text-is("+ Frame")');s=await st();ok(s.n===2&&s.cur===1,'new frame '+JSON.stringify(s));
 await drag(20,100,80,100);let v=await fpx(0,[[50,30],[50,100]]),w=await fpx(1,[[50,30],[50,100]]);ok(v.join()==='255,0'&&w.join()==='0,255','each frame keeps its own painting '+v+' / '+w);
 ok(await p.evaluate(()=>!!__gs.onionT),'onion skin shows the previous frame');
 await p.screenshot({path:OUT+'anim-onion.png'});
 // 3. duplicate, delete, undo
 await p.click('button:text-is("Duplicate")');s=await st();ok(s.n===3&&s.cur===2,'duplicate');
 await p.click('#timeline button:text-is("Delete")');s=await st();ok(s.n===2,'delete');
 await p.keyboard.press('Control+z');s=await st();ok(s.n===3,'undo delete');
 await p.keyboard.press(',');s=await st();ok(s.cur===1,', goes back');await p.keyboard.press('.');await p.keyboard.press('.');s=await st();ok(s.cur===0,'. wraps round');
 // 4. fps and hold
 await p.click('.tlchip:text-is("24")');s=await st();ok(s.fps===24,'24 fps');await p.fill('.tlctrl input[aria-label="Frames per second"]','15');await p.press('.tlctrl input[aria-label="Frames per second"]','Tab');s=await st();ok(s.fps===15,'custom fps');
 await p.fill('.tlctrl input[aria-label="Hold (frames)"]','2');await p.press('.tlctrl input[aria-label="Hold (frames)"]','Tab');ok(await p.evaluate(()=>__gs.anim.frames[0].hold)===2,'hold ×2');
 // 5. tag frames 1-2
 await p.locator('.fcell').nth(1).click({modifiers:['Shift']});await p.click('button:text-is("+ Tag frames")');s=await st();ok(s.tags===1&&await p.isVisible('.tltag'),'tag created');
 // 6. play
 await p.keyboard.press('Enter');await p.waitForTimeout(700);ok(await p.evaluate(()=>!!__gs.playing),'playing');await p.keyboard.press('Enter');ok(!(await p.evaluate(()=>!!__gs.playing)),'stopped');
 // 7. preview window
 await p.click('button:text-is("Preview")');await p.waitForTimeout(400);ok(await p.isVisible('#animPrev canvas'),'preview window');
 // 8. export window
 await p.click('#timeline button:text-is("Export…")');await p.waitForTimeout(300);let info=await p.textContent('.sheetinfo');ok(/3 frames · grid 2 × 2/.test(info),'export grid fits 3 frames: '+info);
 await p.screenshot({path:OUT+'anim-export.png'});
 await p.fill('#exCols','1');await p.press('#exCols','Tab');await p.fill('#exRows','1');await p.press('#exRows','Tab');
 ok((await p.textContent('.note.warn')).includes('left out')&&await p.isDisabled('button:text-is("Export sheet")'),'too-small grid warns and blocks export');
 await p.click('.segb:text-is("4×4")');info=await p.textContent('.sheetinfo');ok(/grid 4 × 4 · cells 200 × 150 px · sheet 800 × 600/.test(info),'4×4 preset '+info);
 await p.selectOption('#exScale','0.5');await p.fill('#exPad','2');await p.press('#exPad','Tab');info=await p.textContent('.sheetinfo');ok(/cells 100 × 75 px · sheet 410 × 310/.test(info),'scale + padding '+info);
 const dls=[];p.on('download',d=>dls.push(d));const waitDl=async n=>{for(let i=0;i<100&&dls.length<n;i++)await p.waitForTimeout(100);};
 await p.click('button:text-is("Export sheet")');await waitDl(2);ok(dls.length>=2,'sheet + data file downloaded ('+dls.map(d=>d.suggestedFilename()).join(', ')+')');
 fs.copyFileSync(await dls[0].path(),OUT+'sheet_out.png');fs.copyFileSync(await dls[1].path(),OUT+'sheet_out.json.zip');
 await p.click('button:text-is("GIF")');await waitDl(3);fs.copyFileSync(await dls[2].path(),OUT+'anim_out.gif');
 await p.click('#dlgCancel');
 // 9. import a sprite sheet (4 x 2 cells of 32 px)
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.selectOption('.tlsel','sheet')]);await fc.setFiles(__dirname+'/fixtures/sheet.png');await p.waitForTimeout(800);console.log('toast:',await p.textContent('#toast'),'modal hidden:',await p.evaluate(()=>document.querySelector('#modal').hidden),'title',await p.textContent('#dlgTitle'),errs.join('|'));
 await p.fill('#slcols','4');await p.fill('#slrows','2');await p.uncheck('#slRep');await p.click('#dlgOk');await p.waitForTimeout(300);s=await st();
 ok(s.n===11&&s.w===32&&s.h===32,'imported 8 frames and canvas resized to 32×32 '+JSON.stringify(s));
 // 10. PSD round trip keeps the animation
 const rt=await p.evaluate(async()=>{const blob=await __gs.encodePSD();await __gs.openPSD(await blob.arrayBuffer(),'rt');return {mode:__gs.mode,n:__gs.anim&&__gs.anim.frames.length,fps:__gs.anim&&__gs.anim.fps,tags:__gs.anim&&__gs.anim.tags.length,hold:__gs.anim&&__gs.anim.frames[0].hold,layers:__gs.doc.root.children.length};});
 ok(rt.mode==='anim'&&rt.n===11&&rt.fps===15&&rt.tags===1&&rt.hold===2,'PSD round trip keeps frames, fps, tags, holds '+JSON.stringify(rt));
 // 11. back to Paint mode: paint layers untouched; undo from paint mode switches back
 await p.click('#modeTabs [data-mode=paint]');await p.waitForTimeout(150);s=await st();const pl=await p.evaluate(()=>__gs.doc.root.children.map(n=>n.name).join('|'));
 ok(s.mode==='paint'&&pl==='Background'&&await p.isVisible('#layerList'),'paint mode shows layers again: '+pl);
 await p.click('#modeTabs [data-mode=anim]');await p.click('button:text-is("+ Frame")');await p.click('#modeTabs [data-mode=paint]');await p.keyboard.press('Control+z');s=await st();
 ok(s.mode==='anim'&&s.n===11,'undoing an animation step from Paint mode switches back '+JSON.stringify(s));
 // 12. layer commands are blocked in animation mode
 await p.keyboard.press('Control+Shift+N');ok((await p.textContent('#toast')).includes('Layers are not used'),'new layer blocked in animation mode');
 console.log(errs.length?errs.join('\n'):'no errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
