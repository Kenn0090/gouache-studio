/* Ctrl+N opens New document (as well as Ctrl+Alt+N), also in Animation mode; Ctrl+Shift+N still adds a layer. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1300,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();__gs.newDoc(128,128,8,[1,1,1],'K',false,'hand');});await p.waitForTimeout(300);
 const open=()=>p.evaluate(()=>!document.querySelector('#modal').hidden&&document.querySelector('#dlgTitle').textContent);
 for(const [keys,label] of [['Control+n','Ctrl+N'],['Control+Alt+n','Ctrl+Alt+N']]){await p.keyboard.press(keys);await p.waitForTimeout(300);ok((await open())==='New document',label+' opens New document');await p.click('#dlgCancel');await p.waitForTimeout(150);}
 const n0=await p.evaluate(()=>document.querySelectorAll('#layerList .layer, .llist .layer').length);
 await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(300);
 ok(!(await open())&&await p.evaluate(()=>__gs.doc.root.children.length)>=2,'Ctrl+Shift+N still adds a layer');
 await p.evaluate(()=>__gs.setMode('anim',true));await p.waitForTimeout(500);
 await p.keyboard.press('Control+n');await p.waitForTimeout(300);ok((await open())==='New document','Ctrl+N opens New document in Animation mode too');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
