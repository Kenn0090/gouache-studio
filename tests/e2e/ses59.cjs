/* 0.59: a saved document remembers the panel layout, view and tool; a preference turns that off. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);
 const r=await p.evaluate(async()=>{const G=__gs,W=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('.welcome')?.remove();G.newDoc(128,128,8,[1,1,1],'Ses',false,'hand');await W(400);
  G.setTool('eraser'in G?'erase':'erase');G.view.zoom=3;G.view.x=11;G.view.y=22;
  const before=JSON.stringify(G.dk.L),blob=await G.encodeGouache(),buf=await blob.arrayBuffer();
  G.dkApply(G.dkPreset('minimal')||G.dkPreset('painting'));await W(300);G.setTool('brush');G.view.zoom=1;
  const changed=JSON.stringify(G.dk.L)!==before;
  await G.openGouache(buf,'Ses');await W(600);
  const head=G.gfHead(buf).head;
  return {has:!!head.session,tool:G.ui.tool,zoom:G.view.zoom,changed,back:JSON.stringify(G.dk.L)===before};});
 ok(r.has,'the file carries a session');
 ok(r.changed,'the test really changed the layout first');
 ok(r.back&&r.tool==='erase'&&Math.abs(r.zoom-3)<.01,'opening it brings back the layout, tool and zoom '+JSON.stringify(r));
 const off=await p.evaluate(async()=>{const G=__gs;G.prefs.saveSession=false;const blob=await G.encodeGouache(),h=G.gfHead(await blob.arrayBuffer()).head;G.prefs.saveSession=undefined;return !!h.session;});
 ok(off===false,'with the preference off, nothing is stored');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
