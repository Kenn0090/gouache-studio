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
 let l=await L();ok(l.groups.map(g=>g.tabs.join('+')).join(' | ').includes('layers+chan'),'Painting workspace: tabbed groups '+l.groups.map(g=>g.tabs.join('+')).join(' | '));
 ok(await vis('#layerList')&&!(await vis('#chanList')),'Layers tab shown, Channels behind it');
 await p.click('.dktab:text-is("Channels")');await W(200);ok(await vis('#chanList')&&!(await vis('#layerList')),'clicking the Channels tab shows it');
 await p.click('.dktab:text-is("Layers")');await W(200);
 // options bar drives the brush
 await p.evaluate(()=>{const s=document.querySelector('#ob_opacity');s.value=.4;s.dispatchEvent(new Event('input'));});ok(Math.abs(await p.evaluate(()=>__gs.brush.opacity)-.4)<.01,'options bar opacity sets the brush');
 await p.keyboard.press(']');await W(100);ok(await p.evaluate(()=>+document.querySelector('#ob_size').nextSibling.textContent.replace('px',''))===await p.evaluate(()=>__gs.brush.size),'options bar follows the [ ] keys');
 await p.evaluate(()=>{__gs.brush.opacity=1;});
 // non-painting tools bring Tool settings forward
 await p.keyboard.press('m');await W(200);ok(await vis('#brushBody')&&/marquee/i.test(await p.textContent('#optBar')),'marquee: Tool settings to the front, options bar names the tool');
 await p.keyboard.press('b');await W(200);
 // drag the Channels tab off the dock: it floats
 const tab=p.locator('.dktab:text-is("Channels")');let bb=await tab.boundingBox();
 await p.mouse.move(bb.x+20,bb.y+10);await p.mouse.down();await p.mouse.move(600,400,{steps:10});await p.mouse.up();await W(300);
 l=await L();ok(l.floats.length===1&&l.floats[0].tabs[0]==='chan'&&await vis('.dkfloat #chanList'),'dragging a tab off the dock floats it');
 // drag it back onto the Layers group's tabs
 const ft=p.locator('.dkfloat .dktab:text-is("Channels")');bb=await ft.boundingBox();const lt=await p.locator('#dock .dktab:text-is("Layers")').boundingBox();
 await p.mouse.move(bb.x+20,bb.y+10);await p.mouse.down();await p.mouse.move(lt.x+60,lt.y+10,{steps:12});await p.mouse.up();await W(300);
 l=await L();ok(!l.floats.length&&l.groups.some(g=>g.tabs.includes('layers')&&g.tabs.includes('chan')),'and back into a group');
 // reorder within a group: drag the last tab to the front
 {const tabs=async()=>(await L()).groups.find(g=>g.tabs.includes('layers')).tabs.join('+');const before=await tabs();const ts=p.locator('#dock .dktab');
  const grp=(await L()).groups.find(g=>g.tabs.includes('layers')).tabs;const first=await p.locator('#dock .dktabs').filter({has:p.locator('.dktab:text-is("Layers")')}).locator('.dktab').first().boundingBox();
  const lastTab=p.locator('#dock .dktabs').filter({has:p.locator('.dktab:text-is("Layers")')}).locator('.dktab').last();const lb=await lastTab.boundingBox();
  await p.mouse.move(lb.x+lb.width/2,lb.y+10);await p.mouse.down();await p.mouse.move(first.x+3,first.y+10,{steps:12});await p.mouse.up();await W(300);
  const after=await tabs();ok(after!==before&&after.split('+')[0]===grp[grp.length-1],'dragging the last tab to the front reorders: '+before+' -> '+after);}
 // drag Color into a new group at the bottom
 const ct=await p.locator('.dktab:text-is("Color")').boundingBox(),dr=await p.locator('#dock').boundingBox();
 await p.mouse.move(ct.x+15,ct.y+10);await p.mouse.down();await p.mouse.move(dr.x+150,dr.y+dr.height-20,{steps:12});await p.mouse.up();await W(300);
 l=await L();ok(l.groups[l.groups.length-1].tabs.join()==='color','dropping at the bottom makes a new group '+l.groups.map(g=>g.tabs.join('+')).join(' | '));
 // resize bar
 const sp=await p.locator('.dksplit').nth(1).boundingBox();const f0=(await L()).groups.map(g=>g.f);
 await p.mouse.move(sp.x+100,sp.y+3);await p.mouse.down();await p.mouse.move(sp.x+100,sp.y+63,{steps:5});await p.mouse.up();await W(200);
 ok(JSON.stringify((await L()).groups.map(g=>g.f))!==JSON.stringify(f0),'the bar between groups resizes them');
 // Window menu hides and shows a panel
 await p.evaluate(()=>__gs.act('pn_maps'));await W(200);ok(!(await p.evaluate(()=>!!document.querySelector('#dock #mapsSec'))),'Window › Maps hides it');
 await p.evaluate(()=>__gs.act('pn_maps'));await W(200);ok(await p.evaluate(()=>!!document.querySelector('#dock #mapsSec')),'and shows it again');
 // the arrangement is remembered after a restart
 const before=(await L()).groups.map(g=>g.tabs.join('+')).join('|');await p.reload();await W(2500);
 ok((await L()).groups.map(g=>g.tabs.join('+')).join('|')===before,'the layout comes back after restarting');
 // workspaces
 await p.evaluate(()=>__gs.setWorkspace('minimal'));await W(400);
 ok(await p.evaluate(()=>document.querySelectorAll('#dkIcons .dkicon').length)>=5&&!(await vis('#layerList')),'Minimal: panels become icons');
 await p.click('#dkIcons .dkicon[title="Layers"]');await W(300);ok(await vis('.flyout #layerList'),'an icon opens its panel beside the column');
 await p.mouse.click(400,400);await W(200);ok(!(await vis('.flyout')),'clicking elsewhere closes it');
 await p.evaluate(()=>__gs.setWorkspace('texturing'));await W(800);ok(await p.evaluate(()=>__gs.v3.on),'Texturing opens the 3D view');
 await p.evaluate(()=>__gs.setWorkspace('paint3d'));await W(800);ok(await p.evaluate(()=>__gs.v3.on&&__gs.v3.paintOn),'3D Paint: 3D view with painting on the model');
 await p.evaluate(()=>__gs.setWorkspace('painting'));await W(400);await p.evaluate(()=>__gs.act('wsReset'));await W(300);
 ok((await L()).groups.map(g=>g.tabs.join('+')).join(' | ').startsWith('p3d+brushtab+conv+bake+anim | color+matEd+shading | brushes+stencils+mats+textures+decals+tool'),'Reset puts Painting back');
 // toolbar
 await p.evaluate(()=>__gs.act('tbCols'));await W(300);let tw=await p.evaluate(()=>document.querySelector('#tools').getBoundingClientRect().width);ok(tw>70,'toolbar: two columns ('+tw+'px)');
 await p.evaluate(()=>__gs.act('tbSide'));await W(300);let tx=await p.evaluate(()=>document.querySelector('#tools').getBoundingClientRect().left);ok(tx>600,'toolbar on the right ('+tx+')');
 await p.evaluate(()=>{__gs.act('tbCols');__gs.act('tbSide');});await W(300);
 // workspaces follow the mode tabs
 await p.click('#modeTabs [data-mode=convert]');await W(700);ok(await vis('#convSec')&&!(await vis('#layerList')),'Convert: its panel in front, others away');
 await p.click('#modeTabs [data-mode=paint]');await W(400);ok(await vis('#layerList'),'back in Paint');
 // save a workspace of your own
 await p.evaluate(()=>__gs.act('optBarToggle'));await p.evaluate(()=>__gs.act('wsSave'));await W(200);await p.fill('#dlgBody input','Laptop');await p.click('#dlgOk');await W(200);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#wsSel option')].some(o=>o.textContent==='Laptop')&&__gs.dk.ws.startsWith('c_')),'Save workspace adds it to the list');
 await p.evaluate(()=>__gs.setWorkspace('painting'));await W(300);await p.evaluate(()=>__gs.act('wsReset'));await W(300);ok(await vis('#optBar'),'Painting (reset) has the options bar');
 await p.evaluate(()=>__gs.setWorkspace(__gs.dk.ws.startsWith('c_')?__gs.dk.ws:Object.keys(__gs.dk.custom)[0]));await W(300);ok(!(await vis('#optBar')),'your workspace keeps it hidden');
 await p.evaluate(()=>__gs.setWorkspace('painting'));

 // a floating panel in a window of its own (second monitor)
 const tb2=await p.locator('.dktab:text-is("Channels")').boundingBox();await p.mouse.move(tb2.x+20,tb2.y+10);await p.mouse.down();await p.mouse.move(600,400,{steps:10});await p.mouse.up();await W(300);
 const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('.dkfloat button[aria-label="Move to its own window"]')]);await W(600);
 ok(await pop.evaluate(()=>!!document.querySelector('#chanList .crow2'))&&!(await p.evaluate(()=>!!document.querySelector('#chanList'))),'⧉ moves the panel into its own window');
 ok(await pop.evaluate(()=>getComputedStyle(document.querySelector('.dktabs')).display==='flex'),'the window has the app’s look');
 await pop.click('#chanList .crow2:has-text("Red")');await W(300);ok(/: R\b/.test(await p.textContent('#stChan')),'clicking in that window works in the app ('+await p.textContent('#stChan')+')');
 await pop.click('#chanList .crow2:has-text("RGB")');await W(200);
 await pop.keyboard.press('e');await W(200);ok(await p.evaluate(()=>__gs.ui.tool)==='erase','keys pressed there work too');await p.keyboard.press('b');
 ok(await p.evaluate(()=>__gs.dk.L.floats.some(f=>f.pop)),'remembered as a window');
 await pop.close();await W(600);ok(await p.evaluate(()=>!!document.querySelector('.dkfloat #chanList')),'closing the window brings the panel back as a floating panel');
 await p.click('.dkfloat button[aria-label="Back into the dock"]');await W(300);
 await p.screenshot({path:OUT+'dock.png'});
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
