/* 0.92: customise the top bar (presets, tick list, timelapse place), Canvas tab, B for the brush, bucket default, full text on hover */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1500,height:1000}}),p=await ctx.newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(400,400,8,[1,1,1],'Bar',false,'hand'));await p.waitForTimeout(400);
 const vis=sel=>p.evaluate(s=>{const e=document.querySelector(s);return !!e&&e.getClientRects().length>0;},sel);
 // defaults
 ok(!(await vis('#tlBar')),'the timelapse recorder starts switched off');
 ok(await vis('#tileBtn'),'Tile mode shows by default');
 // keys
 await p.evaluate(()=>__gs.setTool('erase'));await p.keyboard.press('b');ok(await p.evaluate(()=>__gs.ui.tool==='brush'),'B selects the brush in Paint');
 ok(await p.evaluate(()=>__gs.ui.fillKind==='bucket'),'the paint bucket is the default fill tool');
 // more row on, presets
 await p.evaluate(()=>{localStorage.setItem('gs.optMore','1');__gs.buildOptBar();});
 const has=id=>vis('#ob_'+id);
 ok(await has('size')&&await has('flow')&&await has('opacity')&&await has('spacing'),'All shows size, opacity, flow and spacing');
 await p.evaluate(()=>__gs.barPreset('minimal'));
 ok(await has('size')&&await has('flow')&&!(await has('smoothing'))&&!(await has('spacing'))&&!(await vis('#tileBtn')),'Minimal keeps size and flow and hides the rest');
 await p.evaluate(()=>__gs.barPreset('balanced'));
 ok(await has('opacity')&&await has('smoothing')&&!(await has('spacing'))&&!(await vis('#tlBar')),'Balanced keeps opacity and smoothing, hides spacing and the timelapse');
 await p.evaluate(()=>__gs.barPreset('all'));
 ok(await vis('#tlBar')&&await has('spacing'),'All brings everything back, with the timelapse at the top');
 // tick list and place
 await p.click('#barCust');ok(await vis('.barpop'),'the gear opens the customise window');
 await p.uncheck('#bc_flow');ok(!(await has('flow')),'unticking Flow hides it');await p.check('#bc_flow');ok(await has('flow'),'ticking brings it back');
 await p.selectOption('#bc_tl','bottom');
 ok(await p.evaluate(()=>{const t=document.querySelector('#tlBar');return t&&t.parentNode.id==='workWrap'&&t.classList.contains('tlbottom');}),'the timelapse bar can sit at the bottom of the canvas');
 await p.selectOption('#bc_tl','off');ok(!(await vis('#tlBar')),'and be switched off again');
 await p.evaluate(()=>document.querySelector('.barpop')?.remove());
 await p.mouse.click(700,14,{button:'right'});ok(await vis('.barpop'),'right-clicking the top bar opens the same window');
 // reload keeps it
 await p.evaluate(()=>document.querySelector('.barpop')?.remove());
 ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.bar')).tl==='off'),'the choice is remembered');
 // canvas tab
 await p.evaluate(()=>__gs.showPanel&&__gs.showPanel('canvas'));await p.waitForTimeout(800);
 ok(await p.evaluate(()=>document.querySelectorAll('.cvstile').length===__gs.PAPER_NAMES.length&&document.querySelectorAll('.cvstile').length>=12),'the Canvas tab lists every paper');
 await p.click('.cvstile[data-paper="4"]');await p.waitForTimeout(300);
 ok(await p.evaluate(()=>__gs.doc.root.children.some(n=>n.paper&&n.paper.t===4)),'clicking a paper puts it on the canvas as a layer');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#dkIcons *, .dktab, .dktabs *')].some(e=>/^Canvas$/.test((e.textContent||e.title||'').trim()))||!!document.querySelector('#cvsSec')),'Canvas is a panel tab');
 // hover shows full text
 await p.evaluate(()=>{const d=document.createElement('div');d.id='ell';d.textContent='A very long label that cannot fit';d.style.cssText='position:fixed;left:10px;top:200px;width:60px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;background:#222;color:#fff';document.body.append(d);});
 await p.hover('#ell');await p.waitForTimeout(100);
 ok(await p.evaluate(()=>document.querySelector('#ell').title==='A very long label that cannot fit'),'a label cut short by … shows its full text on hover');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
