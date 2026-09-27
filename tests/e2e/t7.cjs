const {chromium}=require('playwright');
const S=__dirname+'/';
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('ag-psd'))return r.fulfill({path:S+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text())});
 await p.goto((process.env.APP||'file://'+require('path').resolve(__dirname,'../../dist-web/index.html'))+'');await p.waitForTimeout(2500);
 const names=async()=>(await p.locator('#layerList .lrow .lname').allTextContents()).join(' | ');
 const box=await p.locator('#gl').boundingBox();
 await p.keyboard.press('t');console.log('tool title:',await p.textContent('#brushTitle'));
 await p.mouse.click(box.x+250,box.y+300);await p.waitForTimeout(200);
 await p.keyboard.type('Cobble Road');await p.keyboard.press('Enter');await p.keyboard.type('Level 1');
 await p.waitForTimeout(200);await p.screenshot({path:S+'out/text-typing.png'});
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 console.log('after commit:',await names());
 // restyle: outline + center
 await p.evaluate(()=>{const i=document.querySelector('#tOut');i.value=6;i.dispatchEvent(new Event('input'));});
 await p.click('#brushBody .chip:text-is("Center")');await p.waitForTimeout(900);
 // add custom font
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#brushBody button:text-is("+ Add font file…")')]);await fc.setFiles(S+'fixtures/Caladea.ttf');await p.waitForTimeout(1200);
 console.log('font toast:',await p.textContent('#toast'),'| font btn:',await p.textContent('#fontBtn'));
 // font popover hover preview on built-in Mono
 await p.click('#fontBtn');await p.hover('.fontpop button:text-is("Mono")');await p.waitForTimeout(300);await p.screenshot({path:S+'out/font-hover.png'});await p.keyboard.press('Escape');
 console.log('after esc font:',await p.textContent('#fontBtn'));
 // move text by dragging
 const hit={x:box.x+300,y:box.y+300};await p.mouse.move(hit.x,hit.y);await p.mouse.down();await p.mouse.move(hit.x+80,hit.y+120,{steps:8});await p.mouse.up();await p.waitForTimeout(900);
 await p.screenshot({path:S+'out/text-moved.png'});
 // undo stack
 for(let i=0;i<3;i++){await p.keyboard.press('Control+z');await p.waitForTimeout(100);console.log('undo:',await p.textContent('#toast'));}
 for(let i=0;i<3;i++){await p.keyboard.press('Control+Shift+z');}
 // paint on it -> rasterize
 await p.keyboard.press('b');await p.mouse.move(box.x+260,box.y+320);await p.mouse.down();await p.mouse.move(box.x+400,box.y+330,{steps:5});await p.mouse.up();
 console.log('after paint:',await p.textContent('#toast'),'|',await names());
 await p.keyboard.press('Control+z');await p.keyboard.press('Control+z');console.log('undo rasterize ->',await p.textContent('#toast'));
 // save psd
 const [d]=await Promise.all([p.waitForEvent('download'),p.keyboard.press('Control+s')]);await d.saveAs(S+'out/text.psd');
 // empty text click-away removes layer
 await p.keyboard.press('t');await p.mouse.click(box.x+700,box.y+700);await p.mouse.click(box.x+50,box.y+50);console.log('after empty text:',await names());
 console.log(errs.join('\n')||'no errors');await b.close();})();
