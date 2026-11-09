/* 0.96.1 (Kenn): a highlighted material is added once by the fill layer button; the next press adds a plain base material */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 const r=await p.evaluate(async()=>{const G=__gs,hp=G.hpMatList()[1];G.matPick('hp',hp,null);const n0=G.allLayers().length;
   const first=G.matAddSelected();await new Promise(r=>setTimeout(r,500));const a=G.doc.active,hpRow=!!(a.cfx&&a.cfx.some(x=>x.fx==='handPaint'));
   const second=G.matAddSelected();return {first,hpRow,second,sel:G.matSel.rec,added:G.allLayers().length-n0};});
 ok(r.first&&r.hpRow,'the highlighted material is added the first time');
 ok(!r.second&&!r.sel,'then the highlight is cleared, so the button adds a plain base material next');
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
