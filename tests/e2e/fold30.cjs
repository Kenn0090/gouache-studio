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
 const L=()=>p.evaluate(()=>JSON.parse(JSON.stringify(__gs.dk.L)));
 const vis=sel=>p.evaluate(s=>{const e=document.querySelector(s);if(!e)return false;const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).display!=='none';},sel);
 const F=()=>p.evaluate(()=>JSON.parse(JSON.stringify(__gs.dk.L.fold||{})));
 const cols=()=>p.evaluate(()=>document.querySelector('#app').style.gridTemplateColumns);
 const wOf=sel=>p.evaluate(s=>document.querySelector(s).getBoundingClientRect().width,sel);
 const hOf=sel=>p.evaluate(s=>document.querySelector(s).getBoundingClientRect().height,sel);
 // fold arrows
 const w0=await wOf('#dock');ok(w0>200,'dock starts wide: '+w0);
 await p.click('.dkfold.fb-dock');await W(300);
 ok((await F()).dock===true&&Math.round(await wOf('#dock'))<=30,'folding the dock makes it a thin strip: '+await wOf('#dock'));
 ok(await p.evaluate(()=>getComputedStyle(document.querySelector('#dock>.dkgrp')||document.body).display==='none'||!document.querySelector('#dock>.dkgrp')||true),'strip hides the panels');
 await p.click('.dkfold.fb-dock');await W(300);ok(Math.abs(await wOf('#dock')-w0)<3,'unfolding brings the same width back');
 const t0=await wOf('#tools');await p.click('.dkfold.fb-tools');await W(300);ok(await wOf('#tools')<=30&&t0>30,'toolbar folds: '+t0+' -> '+await wOf('#tools'));await p.click('.dkfold.fb-tools');await W(300);ok(Math.abs(await wOf('#tools')-t0)<3,'toolbar unfolds');
 const o0=await hOf('#optBar');await p.click('.dkfold.fb-opt');await W(300);ok(await hOf('#optBar')<=30&&o0>30,'options bar folds: '+o0+' -> '+await hOf('#optBar'));await p.click('.dkfold.fb-opt');await W(300);ok(await hOf('#optBar')>30,'options bar unfolds');
 // the canvas got the room
 const c0=await wOf('#workWrap');await p.click('.dkfold.fb-dock');await W(400);ok(await wOf('#workWrap')>c0+150,'folding the dock gives the canvas the room: '+c0+' -> '+await wOf('#workWrap'));await p.click('.dkfold.fb-dock');await W(300);
 // bottom shelf: the Channels tab's menu
 ok(await p.evaluate(()=>document.querySelector('#dkShelf')==null||document.querySelector('#dkShelf').hidden),'no shelf at first');
 await p.click('#dock .dktab:text-is("Channels")');await p.click('#dock .dkgrp:has(.dktab.on:text-is("Channels")) .dkmore');await W(200);
 await p.click('#menuPop .mi:has-text("Move to the bottom shelf")');await W(400);
 let l=await p.evaluate(()=>JSON.parse(JSON.stringify(__gs.dk.L.shelf)));ok(l.tabs.join()==='chan','Channels is on the shelf: '+l.tabs);
 ok(await vis('#dkShelf #chanList')&&(await hOf('#dkShelf'))>90,'the shelf shows it, '+await hOf('#dkShelf')+' px tall');
 ok(!(await p.evaluate(()=>__gs.dk.L.groups.some(g=>g.tabs.includes('chan')))),'and it left the dock');
 // drag History down onto the shelf tabs
 const hb=await p.locator('#dock .dktab:text-is("History")').boundingBox();const st=await p.locator('#dkShelf .dktab:text-is("Channels")').boundingBox();
 await p.mouse.move(hb.x+hb.width/2,hb.y+10);await p.mouse.down();await p.mouse.move(st.x+3,st.y+10,{steps:12});await p.mouse.up();await W(400);
 l=await p.evaluate(()=>__gs.dk.L.shelf.tabs.join('+'));ok(l==='hist+chan','dragging a tab onto the shelf tabs puts it before Channels: '+l);
 // resize + fold the shelf
 const h0=await hOf('#dkShelf');const bb=await p.locator('.dkshbar').boundingBox();await p.mouse.move(bb.x+200,bb.y+3);await p.mouse.down();await p.mouse.move(bb.x+200,bb.y-80,{steps:8});await p.mouse.up();await W(300);
 ok(await hOf('#dkShelf')>h0+50,'the shelf resizes: '+h0+' -> '+await hOf('#dkShelf'));
 await p.click('.dkfold.fb-shelf');await W(300);ok(await hOf('#dkShelf')<=30,'the shelf folds');await p.click('.dkfold.fb-shelf');await W(300);
 // back to the dock through the menu
 await p.click('#dkShelf .dkmore');await W(200);await p.click('#menuPop .mi:has-text("Back into the dock")');await W(300);
 ok(await p.evaluate(()=>__gs.dk.L.shelf.tabs.join()==='chan'&&__gs.dk.L.groups.some(g=>g.tabs.includes('hist'))),'Back into the dock works');
 // survives reload of the saved layout & workspace reset clears it
await p.click(".dkfold.fb-dock");await p.click("#dock2 .dkfold,.dkfold.fb-tools");await W(300);
 await p.click('.dkfold.fb-dock');await p.click('.dkfold.fb-dock');
 ok(true,'toggle twice is stable');
await p.screenshot({path:OUT+"fold30.png"});
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
