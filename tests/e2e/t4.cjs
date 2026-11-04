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
 await p.goto((process.env.APP||'file://'+require('path').resolve(__dirname,'../../dist-web/index.html'))+'');await p.waitForTimeout(2500);await p.click('#wEx_cobble');await p.waitForTimeout(1500);
 const names=async()=>(await p.locator('#layerList .lrow .lname').allTextContents()).join(' | ');
 const row=n=>p.locator('#layerList .lrow',{has:p.locator(`.lname:text-is("${n}")`)}).first();
 console.log('start:',await names());
 await p.evaluate(()=>document.querySelector('.panel').scrollTop=2000);
 // collapse / expand
 await p.click('#layerList .lrow.group .caret');console.log('collapsed:',await names());
 await p.click('#layerList .lrow.group .caret');
 // new layer + paint
 await p.click('#lAdd');await p.click('#lAdd');console.log('added:',await names());
 const box=await p.locator('#gl').boundingBox();
 await p.mouse.move(box.x+300,box.y+300);await p.mouse.down();for(let i=0;i<20;i++)await p.mouse.move(box.x+300+i*10,box.y+300);await p.mouse.up();
 // multiselect layer 6 + layer 7 and group
 await row('Layer 7').click();await row('Layer 6').click({modifiers:['Shift']});
 console.log('sel count',await p.locator('#layerList .lrow.sel').count(), 'merge label',await p.textContent('#lMerge'));
 await p.keyboard.press('Control+g');console.log('grouped:',await names());
 // drag 'Your strokes' into the new group
 const src=await row('Your strokes').boundingBox();const g=await row("Group 1").boundingBox();
 await p.mouse.move(src.x+100,src.y+src.height/2);await p.mouse.down();await p.mouse.move(src.x+100,src.y+30,{steps:5});await p.mouse.move(g.x+100,g.y+g.height/2,{steps:8});
 await p.screenshot({path:S+'out/drag.png'});
 await p.mouse.up();console.log('dragged into:',await names());
 // drag Mortar to top (above first row)
 const m=await row('Mortar').boundingBox();const first=await p.locator('#layerList .lrow').first().boundingBox();
 await p.mouse.move(m.x+100,m.y+m.height/2);await p.mouse.down();await p.mouse.move(m.x+100,m.y-20,{steps:5});await p.mouse.move(first.x+100,first.y+3,{steps:10});await p.mouse.up();
 console.log('mortar top:',await names());
 await p.keyboard.press('Control+z');console.log('undo:',await names());
 // group mode isolated multiply on Cobbles
 await row('Cobbles').click();await p.click('#lModeBtn');await p.click('.modepop button:text-is("Multiply")');await p.waitForTimeout(300);
 await p.screenshot({path:S+'out/groups.png'});
 await p.click('#lModeBtn');await p.click('.modepop button:text-is("Pass through")');
 // save psd with groups
 const [d]=await Promise.all([p.waitForEvent('download'),p.keyboard.press('Control+s')]);await d.saveAs(S+'out/groups.psd');
 // merge group
 await row('Cobbles').click();await p.click('#lMerge');console.log('merge group:',await names());
 await p.keyboard.press('Control+z');
 // merge visible
 await p.click('#menus button:text-is("Layer")');await p.click('#menuPop .mi:has-text("Merge visible")');console.log('merge visible:',await names(),errs);
 await p.keyboard.press('Control+z');console.log('undo:',await names());
 // hide one and flatten
 await row('Mortar').locator('.eye').click();
 await p.click('#menus button:text-is("Layer")');await p.click('#menuPop .mi:has-text("Flatten image")');
 console.log('flatten dialog:',await p.textContent('#dlgBody'));await p.click('#dlgOk');console.log('flat:',await names());
 await p.keyboard.press('Control+z');console.log('undo flat:',await names());
 // reopen saved psd
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),(async()=>{await p.click('#menus button:text-is("File")');await p.click('#menuPop .mi:has-text("Open")');})()]);
 await fc.setFiles(S+'out/groups.psd');await p.waitForTimeout(800);if((await p.locator('#dlgTitle').textContent()).startsWith('Replace'))await p.click('#dlgOk');await p.waitForTimeout(2500);
 console.log('reopened:',await names(), await p.locator('#toast').textContent());
 // brush preview for a few presets
 for(const n of ['Grass','Blender','Chalk']){await p.click(`#libBody button[aria-label="${n}"]`);await p.waitForTimeout(250);}
 await p.evaluate(()=>document.querySelector('.panel').scrollTop=280);await p.waitForTimeout(300);
 await p.screenshot({path:S+'out/preview.png'});
 console.log(errs.join('\n')||'no errors');await b.close();})();
