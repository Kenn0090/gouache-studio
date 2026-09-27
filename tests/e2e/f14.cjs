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
 const drag=async(x0,y0,x1,y1,steps)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:steps||12});await p.mouse.up();await W(200);};
 const px=(x,y)=>p.evaluate(([x,y])=>{const d=__gs.readRGBA8(__gs.compositeMap('base'));return [...d.slice((y*__gs.doc.w+x)*4,(y*__gs.doc.w+x)*4+4)];},[x,y]);
 const rowStats=y=>p.evaluate(y=>{const t=__gs.compositeMap('base');const d=__gs.readRGBA8(t);__gs.release(t);const W=__gs.doc.w;const hs=new Set();let mn=[255,255,255],mx=[0,0,0];
   for(let x=30;x<W-30;x++){const i=(y*W+x)*4;for(let c=0;c<3;c++){mn[c]=Math.min(mn[c],d[i+c]);mx[c]=Math.max(mx[c],d[i+c]);}hs.add(d[i]>>4<<8|d[i+1]>>4<<4|d[i+2]>>4);}return {mn,mx,n:hs.size};},y);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'F14',false));await W();
 await p.evaluate(()=>{__gs.act('addLayer');});await W(200);
 // ---- colour jitter ----
 await setFG('#d02020');await p.evaluate(()=>Object.assign(__gs.brush,{size:30,hardness:1,opacity:1,flow:1,spacing:.25,smoothing:0,pSize:false,tip:null,hueJitter:0,satJitter:0,valJitter:0}));
 await drag(20,60,236,60);let r=await rowStats(60);ok(r.n<=3&&r.mx[1]<40,'no jitter: one colour '+JSON.stringify(r));
 await p.evaluate(()=>{__gs.brush.hueJitter=1;});await drag(20,140,236,140);r=await rowStats(140);ok(r.n>=6&&r.mx[1]>100,'hue jitter: many colours '+JSON.stringify(r));
 await p.evaluate(()=>{Object.assign(__gs.brush,{hueJitter:0,valJitter:.8});});await drag(20,200,236,200);r=await rowStats(200);ok(r.mn[0]<150&&r.mx[1]<40,'brightness jitter: darker reds, no other hues '+JSON.stringify(r));
 const ed=await px(128,200-14);ok(ed[3]>0,'stroke edge still painted '+ed);
 await p.evaluate(()=>{Object.assign(__gs.brush,{hueJitter:1,valJitter:0,jitterPerStroke:true});});await p.evaluate(()=>__gs.act('selAll'));await p.keyboard.press('Delete');await W(200);await p.evaluate(()=>__gs.act('deselect'));await W(100);
 await drag(20,100,236,100);r=await rowStats(100);ok(r.n<=4,'once per stroke: one colour along the stroke '+JSON.stringify(r));
 await p.screenshot({path:OUT+'f14-jitter.png'});
 const saved=await p.evaluate(()=>Object.keys(__gs.brush).filter(k=>/Jitter|jitterPer/.test(k)));ok(saved.length>=4,'jitter settings are brush settings '+saved);
 await p.evaluate(()=>Object.assign(__gs.brush,{hueJitter:0,satJitter:0,valJitter:0,jitterPerStroke:false}));

 // ---- keyboard shortcuts ----
 await p.mouse.click(box.x+5,box.y+5);await p.keyboard.press('e');await W(100);ok(await p.evaluate(()=>__gs.ui.tool)==='erase','E still picks the eraser');
 await p.evaluate(()=>__gs.act('keys'));await W(300);
 await p.fill('.kbsearch','brush');await W(100);
 const kb=p.locator('.kbrow',{hasText:/^Brush/}).first();await kb.locator('.kbkey').click();await W(100);await p.keyboard.press('p');await W(200);
 ok(/^P$/.test((await kb.locator('.kbkey').textContent()).trim()),'Brush now on P');
 await p.fill('.kbsearch','');await W(100);
 // Ctrl+Shift+L onto "Levels" (default Ctrl+L)
 await p.fill('.kbsearch','levels');await p.locator('.kbrow',{hasText:'Levels'}).locator('.kbkey').click();await p.keyboard.press('Control+Shift+Y');await W(100);
 await p.click('#dlgCancel');await W(200);
 await p.keyboard.press('p');await W(100);ok(await p.evaluate(()=>__gs.ui.tool)==='brush','P picks the brush');
 await p.keyboard.press('e');await p.keyboard.press('b');await W(100);ok(await p.evaluate(()=>__gs.ui.tool)==='erase','B no longer picks the brush');
 ok((await p.textContent('#hint')).includes('P brush'),'hint line shows the new key: '+(await p.textContent('#hint')).slice(0,40));
 await p.keyboard.press('Control+Shift+y');await W(400);ok(await p.evaluate(()=>!document.querySelector('#modal').hidden&&/Levels/.test(document.querySelector('#dlgTitle').textContent)),'new key opens Levels');await p.click('#dlgCancel');await W(200);
 await p.click('#menus button:text("Adjust")');await W(150);ok(await p.locator('#menuPop .mi',{hasText:'Levels'}).locator('kbd').textContent()==='Ctrl+Shift+Y','menu shows the new key');await p.keyboard.press('Escape');
 await p.evaluate(()=>__gs.act('hints'));await W(100);ok(!(await p.isVisible('#hint')),'shortcut hints can be hidden');await p.evaluate(()=>__gs.act('hints'));await W(100);ok(await p.isVisible('#hint'),'and shown again');
 await p.evaluate(()=>__gs.act('keys'));await W(200);await p.click('.kbdlg button:text("Photoshop keys")');await W(100);const psk=await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.keys')).hueSat);ok(psk==='Ctrl+U','Photoshop keys: Hue/Saturation on Ctrl+U');await p.click('.kbdlg button:text-is("Reset all")');await p.click('#dlgCancel');await W(100);
 await p.keyboard.press('b');await W(100);ok(await p.evaluate(()=>__gs.ui.tool)==='brush','reset: B is the brush again');

 // ---- themes ----
 await p.evaluate(()=>__gs.act('prefs'));await W(300);
 await p.click('.themeseg button:has-text("Dark red")');await W(200);
 ok(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())==='#e05555','Dark red theme previews live');
 await p.screenshot({path:OUT+'f14-theme-red.png'});
 await p.click('.themeseg button:has-text("Light")');await W(200);await p.screenshot({path:OUT+'f14-theme-light.png'});
 await p.click('#dlgCancel');await W(200);ok(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())==='#e2a453','Cancel goes back to the old theme');
 await p.evaluate(()=>__gs.act('prefs'));await W(300);await p.click('.themeseg button:has-text("Custom")');await W(200);
 await p.evaluate(()=>{const i=document.querySelectorAll('.themecol input')[4];i.value='#3399ff';i.dispatchEvent(new Event('input'));});await W(100);
 await p.click('#dlgOk');await W(200);
 const th=await p.evaluate(()=>({a:getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),saved:JSON.parse(localStorage.getItem('gs.prefs')).theme}));
 ok(th.a==='#3399ff'&&th.saved==='custom','custom theme saved '+JSON.stringify(th));
 await p.screenshot({path:OUT+'f14-theme-custom.png'});
 await p.evaluate(()=>__gs.act('prefs'));await W(300);await p.click('.themeseg button:has-text("Dark")');await p.click('#dlgOk');await W(200);

 // ---- brush tip template and Make tip ----
 await p.evaluate(()=>__gs.act('new'));await W(300);await p.click('#dlgBody .chip:text("Brush tip")');await W(100);
 ok(await p.inputValue('#dW')==='512','brush template picks 512');await p.click('#dlgOk');await W(500);
 let bt=await p.evaluate(()=>({tpl:__gs.doc.brushTpl,w:__gs.doc.w,fg:[...__gs.ui.fg],ban:!document.querySelector('#tipBanner').hidden}));
 ok(bt.tpl&&bt.w===512&&bt.fg.join()==='0,0,0'&&bt.ban,'brush tip canvas: white, black brush, banner '+JSON.stringify(bt));
 await p.screenshot({path:OUT+'f14-tipdoc.png'});
 await p.evaluate(()=>Object.assign(__gs.brush,{size:60,hardness:1,flow:1,opacity:1,spacing:.1,tip:null,smoothing:0}));
 await drag(150,256,360,256);await drag(256,150,256,360);
 await p.click('#tipBanner button:text("Make brush")');await W(300);await p.fill('#dlgBody input[type=text]','Cross');await p.click('#dlgOk');await W(500);
 let tp=await p.evaluate(()=>({tip:__gs.brush.tip&&{w:__gs.brush.tip.w,h:__gs.brush.tip.h,name:__gs.brush.tip.name}}));
 ok(tp.tip&&tp.tip.name==='Cross'&&Math.abs(tp.tip.w-270)<20&&Math.abs(tp.tip.h-270)<20,'Make brush: a tip the size of the drawing '+JSON.stringify(tp));
 // only the selection
 await p.evaluate(()=>{__gs.setTool('marquee');});await drag(140,226,200,286);console.log('sel',await p.evaluate(()=>({a:__gs.sel.active,t:__gs.ui.tool,modal:!document.querySelector('#modal').hidden})));await p.evaluate(()=>__gs.setTool('brush'));
 await p.evaluate(()=>__gs.act('makeTip'));await W(300);await p.click('#dlgOk');await W(400);
 tp=await p.evaluate(()=>({w:__gs.brush.tip.w,h:__gs.brush.tip.h}));ok(tp.w<=62&&tp.h<=62,'Make tip uses only the selection '+JSON.stringify(tp));
 await p.evaluate(()=>__gs.act('deselect'));
 await p.click('#tipBanner button:text("Clear")');await W(300);const cl=await px(256,256);ok(cl[0]>250,'Clear makes the canvas white again '+cl);
 await p.click('#modeTabs [data-mode=convert]');await W(500);ok(await p.evaluate(()=>document.querySelector('#tipBanner').hidden),'banner only in Paint');await p.click('#modeTabs [data-mode=paint]');await W(300);
 ok(!errs.length,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
