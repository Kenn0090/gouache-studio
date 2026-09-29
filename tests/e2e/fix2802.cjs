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
 const tabs=()=>p.evaluate(()=>__gs.dtab().tabs.map(t=>t.id));
 const newDoc=async()=>{await p.evaluate(()=>__gs.act('new'));await W(300);await p.fill('#dW','256');await p.fill('#dH','256');await p.dispatchEvent('#dW','input');await p.click('#dlgOk');await W(500);};
 /* 0.28.2: black and white by default; tabs move both ways in one drag */
 ok(await p.evaluate(()=>__gs.ui.fg.join()==='0,0,0'&&__gs.ui.bg.join()==='1,1,1'),'the colours start black and white');
 await stroke(p,100);await newDoc();await stroke(p,100);await newDoc();await stroke(p,100);
 const ids=await tabs();ok(ids.length===3,'three tabs');
 let bx=await p.locator('#docTabs .dtab').nth(0).boundingBox();const last=await p.locator('#docTabs .dtab').nth(2).boundingBox();
 await p.mouse.move(bx.x+20,bx.y+10);await p.mouse.down();await p.mouse.move(last.x+last.width-6,bx.y+10,{steps:14});await W(100);
 ok(JSON.stringify(await tabs())===JSON.stringify([ids[1],ids[2],ids[0]]),'one drag carries a tab past two others to the right');
 const now=await p.locator('#docTabs .dtab').nth(2).boundingBox();await p.mouse.move(bx.x+10,bx.y+10,{steps:14});await W(100);await p.mouse.up();await W(200);
 ok(JSON.stringify(await tabs())===JSON.stringify(ids),'…and the same drag carries it back to the left');
 console.log(errs.join('\n'));console.log(fails?'FAILS '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);})();
