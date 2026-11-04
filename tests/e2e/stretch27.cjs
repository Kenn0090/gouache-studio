/* 0.27: Every panel stretchable: dock width, 3D Paint column, toolbar, timeline */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message+' '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* names from the sites */
 const drag=async(sel,dx,dy)=>{const b=await p.locator(sel).first().boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+dx,y+dy,{steps:6});await p.mouse.up();await W(300);};
 /* the main dock can go much wider than before (720 px) */
 const w0=await p.evaluate(()=>__gs.dk.L.w);await drag('.dkwidth',-500,0);const w1=await p.evaluate(()=>__gs.dk.L.w);
 ok(w1>w0+300&&w1>720,'the dock stretches past the old limit ('+w0+' → '+w1+')');
 await p.evaluate(()=>{__gs.dk.L.w=300;__gs.dkGrid&&0;});
 /* 3D Paint's middle column */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 ok(await p.locator('.stcol2').isVisible(),'3D Paint has a drag edge for its middle column');
 const c0=await p.evaluate(()=>__gs.dk.col2.w);await drag('.stcol2',-120,0);const c1=await p.evaluate(()=>__gs.dk.col2.w);
 ok(c1>c0+80,'dragging it widens the column ('+c0+' → '+c1+')');
 await p.dblclick('.stcol2');await W(300);ok(await p.evaluate(()=>__gs.dk.col2.w===250),'double-click resets it');
 await p.click('#modeTabs [data-mode=paint]');await W(800);
 ok(await p.locator('.stcol2').isHidden(),'the column edge is only there in 3D Paint');
 /* the toolbar: one or two columns */
 const t0=await p.evaluate(()=>__gs.dk.L.tb.cols||1);await drag('.sttools',t0===2?-40:40,0);const t1=await p.evaluate(()=>__gs.dk.L.tb.cols||1);
 ok(t1!==t0,'dragging the toolbar edge switches one/two columns ('+t0+' → '+t1+')');
 /* the timeline: taller frames */
 await p.click('#modeTabs [data-mode=anim]');await W(1200);
 const f0=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--fcs').trim());await drag('.sttl',0,-60);
 const f1=await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--fcs').trim());
 ok(parseInt(f1)>parseInt(f0)+30,'dragging the timeline’s top edge makes the frames bigger ('+f0+' → '+f1+')');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
