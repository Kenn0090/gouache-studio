const {chromium}=require('playwright');
const S=__dirname+'/';
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:S+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:S+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:S+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue(); return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text())});
 await p.goto((process.env.APP||'file://'+require('path').resolve(__dirname,'../../dist-web/index.html'))+'');await p.waitForTimeout(2500);
 const row=n=>p.locator('#layerList .lrow',{has:p.locator(`.lname:text-is("${n}")`)}).first();
 const box=await p.locator('#gl').boundingBox();
 const stroke=async(x,y,n=20,dx=12)=>{await p.mouse.move(box.x+x,box.y+y);await p.mouse.down();for(let i=0;i<n;i++)await p.mouse.move(box.x+x+i*dx,box.y+y);await p.mouse.up();};
 await p.evaluate(()=>document.querySelector('.panel').scrollTop=700);
 // hide-all mask on Cobbles group, reveal with white
 await row('Cobbles').click();await p.click('#maskRow button:text-is("Add hide-all mask")');
 console.log('mask thumbs',await p.locator('#layerList canvas.mthumb').count(), await p.textContent('#maskRow'));
 await p.click('#libBody button[aria-label="Soft air"]');
 await p.evaluate(()=>{});await p.keyboard.press('d'); // fg black bg white
 await p.keyboard.press('x'); // fg white
 for(let k=0;k<3;k++)await stroke(200,300+k*60,40,14);
 await p.screenshot({path:S+'out/mask-group.png'});
 await p.click('#mView');await p.waitForTimeout(200);await p.screenshot({path:S+'out/mask-view.png'});await p.click('#mView');
 // undo/redo mask stroke & mask add
 await p.keyboard.press('Control+z');await p.keyboard.press('Control+z');await p.keyboard.press('Control+z');
 console.log('after undo strokes, mask thumbs',await p.locator('#layerList canvas.mthumb').count());
 await p.keyboard.press('Control+z');console.log('after undo add, mask thumbs',await p.locator('#layerList canvas.mthumb').count());
 await p.keyboard.press('Control+Shift+z');for(let k=0;k<3;k++)await p.keyboard.press('Control+Shift+z');
 console.log('redo all, mask thumbs',await p.locator('#layerList canvas.mthumb').count(), (await p.locator('#toast').textContent()));
 // layer mask on Your strokes, paint red stroke then mask black
 await row('Your strokes').click();await p.click('#libBody button[aria-label="Round"]');await p.keyboard.press('x');
 await p.evaluate(()=>{});await stroke(250,700,40,15);
 await p.click('#maskRow button:text-is("Add mask")');await p.keyboard.press('d');await stroke(300,650,1,0);
 await p.mouse.move(box.x+500,box.y+640);await p.mouse.down();await p.mouse.move(box.x+500,box.y+760,{steps:10});await p.mouse.up();
 // channels: red only, paint
 await p.click('#chanList .crow2:has-text("Red")');console.log('chan state',await p.textContent('#stChan'));
 await p.waitForTimeout(200);await p.screenshot({path:S+'out/chan-red.png'});
 await p.click('#chanList .crow2:has-text("RGB")');
 // alpha only
 await p.keyboard.press('Alt+6');console.log('alpha',await p.textContent('#stChan'));await p.screenshot({path:S+'out/chan-alpha.png'});await p.keyboard.press('Alt+2');
 // blend hover preview
 await row('Your strokes').click();await p.click('#lModeBtn');await p.hover('.modepop button:text-is("Difference")');await p.waitForTimeout(200);
 console.log('hover mode label?',await p.evaluate(()=>document.querySelector('#lModeName').textContent));
 await p.screenshot({path:S+'out/blend-hover.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(100);console.log('after esc',await p.textContent('#lModeName'));
 await p.click('#lModeBtn');await p.click('.modepop button:text-is("Multiply")');console.log('after click',await p.textContent('#lModeName'));
 // group mode hover includes pass through
 await row('Cobbles').click();await p.click('#lModeBtn');console.log('group first option',await p.locator('.modepop button').first().textContent());await p.keyboard.press('Escape');
 // save psd with masks
 const [d]=await Promise.all([p.waitForEvent('download'),p.keyboard.press('Control+s')]);await d.saveAs(S+'out/masks.psd');
 // reopen fixture layer-mask and our file
 for(const f of [S+'fixtures/layer-mask.psd',S+'out/masks.psd']){
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),(async()=>{await p.click('#menus button:text-is("File")');await p.click('#menuPop .mi:has-text("Open")');})()]);
  await fc.setFiles(f);await p.waitForTimeout(800);if(await p.locator('#modal:visible').count()&&(await p.locator('#dlgTitle').textContent()).startsWith('Replace'))await p.click('#dlgOk');await p.waitForTimeout(2500);
  console.log('opened',f.split('/').slice(-2).join('/'),'masks:',await p.locator('#layerList canvas.mthumb').count(),await p.locator('#toast').textContent());
  if(await p.locator('#modal:visible').count())await p.click('#dlgCancel');}
 await p.screenshot({path:S+'out/reopen-masks.png'});
 console.log(errs.join('\n')||'no errors');await b.close();})();
