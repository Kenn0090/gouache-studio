/* 0.96.1 (Kenn): right-clicking the mask gives a short mask-only menu (make it, change it, its own commands) */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||300);
 const mi=n=>p.getByRole('menuitem',{name:n,exact:true});
 for(const mode of ['p3d','paint']){
  await p.evaluate(m=>{const G=__gs;G.setMode(m);if(m==='paint')G.newDoc(128,128,8,[1,1,1],'mm',false);window.ML=G.cmdNewFillLayer({name:'Mask menu '+m});G.cmdAddMask(0);G.showPanel('layers');},mode);await W(800);
  const row=p.locator('.lrow').filter({has:p.locator('.lname',{hasText:'Mask menu '+mode})});
  await row.locator('.mthumb').click({button:'right'});await W(200);
  const has=async n=>await mi(n).count()>0;
  ok(await has('Generators')&&await has('Fill white')&&await has('Levels')&&await has('Delete mask'),mode+': the mask menu has mask things (Generators, Fill white, Levels, Delete mask)');
  ok(!(await p.getByRole('menuitem',{name:/^Duplicate/}).count())&&!(await has('Layer style'))&&!(await has('Group into folder')),mode+': and no layer commands');
  const n=await p.locator('#menuPop > *').count();ok(n<=24,mode+': it is short ('+n+' lines)');
  await mi('Fill black').click();await W(200);
  ok(await p.evaluate(()=>{const st=ML.mask.stack||[];const d=__gs.captureRegionNow((ML.mask.stack?__gs.msPaintRow(ML).t:ML.mask.target),0,0,8,8).data;return !st.some(r=>r.kind==='fill')&&d[0]===0;}),mode+': Fill black adds no Fill row: it fills the mask\'s own Paint row');
  await row.locator('.mthumb').click({button:'right'});await W(200);await mi('Invert').last().click();await W(200);
  ok(await p.evaluate(()=>ML.mask.stack.at(-1).fx==='invert'),mode+': Invert adds to the mask');
  await row.locator('.lname').click({button:'right'});await W(200);
  console.log('   layer menu:',(await p.locator('#menuPop').innerText()).replace(/\s+/g,' ').slice(0,200));ok(await p.getByRole('menuitem',{name:/^Duplicate/}).count()>0&&await mi('Generators').count()===0,mode+': the layer’s own menu is unchanged');await p.keyboard.press('Escape');}
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
