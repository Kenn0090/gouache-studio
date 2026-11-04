/* 0.95: any brush can take another tip (picker in the options bar and the Brush panel), other settings stay, Original tip and Round come back. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.brush.size=37;__gs.brush.flow=.6;__gs.brush.hardness=.7;__gs.setTool('brush');});await p.waitForTimeout(400);
 ok(await p.locator('#obTip').count()===1,'the options bar has a Tip… button');
 await p.click('#obTip');await p.waitForTimeout(800);
 const n=await p.locator('#tipGrid .tipcell').count();ok(n>=10,'the picker lists tips ('+n+')');
 const names=await p.evaluate(()=>[...document.querySelectorAll('#tipGrid .tipcell')].slice(0,6).map(b=>b.title));console.log('first',JSON.stringify(names));
 const before=await p.evaluate(()=>({tip:__gs.brush.tip&&__gs.brush.tip.name}));
 await p.locator('#tipGrid .tipcell').nth(3).click();await p.waitForTimeout(300);
 const after=await p.evaluate(()=>({tip:__gs.brush.tip&&__gs.brush.tip.name,size:__gs.brush.size,flow:__gs.brush.flow,hard:__gs.brush.hardness,orig:__gs.brush._tipOrig&&__gs.brush._tipOrig.name}));
 ok(after.tip&&after.tip!==before.tip,'clicking a tip sets it: '+before.tip+' → '+after.tip);
 ok(after.size===37&&after.flow===.6&&after.hard===.7,'the other settings stay '+JSON.stringify(after));
 await p.locator('#tipGrid .tipcell').first().click();await p.waitForTimeout(200);
 ok(await p.evaluate(()=>__gs.brush.tip===null),'Round (no tip) makes it a plain round brush');
 await p.locator('#tipSearch').fill('square');await p.waitForTimeout(500);
 const sq=await p.locator('#tipGrid .tipcell').count();ok(sq>=2&&sq<n,'search narrows the list ('+sq+')');
 await p.evaluate(()=>document.getElementById('dlgOk').click());await p.waitForTimeout(200);
 /* the eraser can take a tip too */
 await p.evaluate(()=>__gs.setTool('erase'));await p.waitForTimeout(300);
 ok(await p.locator('#obTip').count()===1,'the eraser has the Tip… button');
 /* the Brush panel */
 await p.evaluate(()=>{__gs.setTool('brush');__gs.showPanel('brushes');});await p.waitForTimeout(300);
 ok(await p.locator('#tipChange').count()===1,'the Brush panel has Change tip…');
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('|'));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
