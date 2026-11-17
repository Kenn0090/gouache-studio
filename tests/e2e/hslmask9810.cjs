const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,.5,.2],'ap',false,'pbr'));await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('lAdj').click());await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!__gs.doc.active.fx),'a Hue / Saturation layer is selected');
 const r=await p.evaluate(()=>{const g=__gs,L=g.doc.active;const row=g.msAdd(L,'noise');window.__h=!!row;g.msUpdate(L);const d=g.readRGBA8(L.mask.target);let lo=255,hi=0;for(let i=0;i<d.length;i+=4){lo=Math.min(lo,d[i]);hi=Math.max(hi,d[i]);}return {row:!!row,lo,hi,hasMask:!!L.mask,stack:!!(L.mask&&L.mask.stack)};});
 ok(r.row&&r.hasMask&&r.stack&&r.hi-r.lo>40,'rows can be added to a Hue / Saturation layer’s mask '+JSON.stringify(r));
 /* the same through the + button and the menu */
 await p.evaluate(()=>document.getElementById('lFxAdd').click());await p.waitForTimeout(300);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#menuPop .mi')].some(b=>/Generators|Noise|Direction|Gradient/.test(b.textContent))),'the + menu opens on a Hue / Saturation layer');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
