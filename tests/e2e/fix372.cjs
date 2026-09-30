/* 0.37.2: Preferences tabs, reset buttons, Brushes in the shelf */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});

 await p.addInitScript(()=>{try{localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await W(400);

 await p.keyboard.press('Control+k');await W(400);
 ok(await p.evaluate(()=>document.querySelectorAll('.preftabs button').length>=4),'Preferences has tabs');
 await p.click('#pTab_paint');await W(150);
 ok(await p.evaluate(()=>!!document.querySelector('#pTipCur')&&!document.querySelector('#pLive')),'the Painting tab shows only its own settings');
 await p.click('#pTab_speed');await W(150);
 ok(await p.evaluate(()=>!!document.querySelector('#pLive')&&!!document.querySelector('#pReset')),'Speed tab has its settings and a reset button');
 await p.click('#pReset');await W(150);
 await p.keyboard.press('Escape');await W(200);
 /* shader + environment resets */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{__gs.showPanel('shading');});await W(400);
 ok(await p.evaluate(()=>!!document.querySelector('#shReset')&&!!document.querySelector('#shEnvReset')),'Shader panel has Reset this shader and Reset lighting');
 await p.evaluate(()=>{__gs.doc.v3d.expo=2.5;__gs.doc.v3d.envI=3;});
 await p.click('#shEnvReset');await W(300);
 ok(await p.evaluate(()=>__gs.doc.v3d.expo===1&&__gs.doc.v3d.envI===1),'Reset lighting restores exposure and brightness');
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'toon',p:{toon:{steps:5}}};__gs.renderShading&&__gs.renderShading();});await W(300);
 if(await p.evaluate(()=>!!document.querySelector('#shReset'))){await p.click('#shReset');await W(200);}
 ok(await p.evaluate(()=>!(__gs.doc.v3shade.p&&__gs.doc.v3shade.p.toon)),'Reset this shader clears its changes');
 /* colour buttons open a picker with H / S / L sliders */
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'toon',p:{}};__gs.renderShading();});await W(300);
 await p.evaluate(()=>document.querySelector('#sh_col').click());await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('.colpop #cp_h')&&!!document.querySelector('.colpop #cp_s')&&!!document.querySelector('.colpop #cp_l')),'the colour picker has Hue, Saturation and Lightness sliders');
 await p.evaluate(()=>{const i=document.querySelector('#cp_l');i.value=i.max;i.dispatchEvent(new Event('input',{bubbles:true}));});await W(200);
 ok(await p.evaluate(()=>document.querySelector('#sh_col').value==='#ffffff'),'moving Lightness changes the colour');
 {const sq=await p.locator('#cp_sq').boundingBox();await p.mouse.click(sq.x+sq.width*.9,sq.y+sq.height*.1);await W(200);
   ok(await p.evaluate(()=>{const v=document.querySelector('#sh_col').value,c=[1,3,5].map(i=>parseInt(v.slice(i,i+2),16));return Math.max(...c)>200&&Math.max(...c)-Math.min(...c)>150;}),'the colour square picks a bright, saturated colour');}
 await p.evaluate(()=>document.querySelector('#cp_close').click());
 await p.evaluate(()=>{__gs.brush.spacing=1;__gs.brush.grain=.8;__gs.buildBrushPanel&&__gs.buildBrushPanel();});
 if(await p.evaluate(()=>!!document.querySelector('#brushReset'))){await p.evaluate(()=>document.querySelector('#brushReset').click());await W(200);}
 ok(await p.evaluate(()=>__gs.brush.grain===0&&__gs.brush.spacing<.5),'Reset brush restores the brush settings');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
