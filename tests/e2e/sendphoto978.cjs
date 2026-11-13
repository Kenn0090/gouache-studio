/* 0.97.9 (Kenn): Send to Photo from the 2D canvas and from 3D screenshots/renders, Send to Paint from Photo; nothing goes to 3D Paint */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();
 await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:64,layout:'3d'}));});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 const menu=async(mode)=>{await p.evaluate(m=>__gs.setMode(m,true),mode);await W(800);await p.click('#menus button:text-is("File")');await W(300);
   await p.hover('#menuPop .mi:has-text("Export")').catch(()=>{});await W(400);const t=await p.evaluate(()=>[...document.querySelectorAll('.mi')].filter(b=>b.offsetParent).map(b=>b.textContent.trim()).join('|'));await p.keyboard.press('Escape');await W(200);return t;};
 const mp=await menu('paint');ok(/Send to Photo/.test(mp)&&!/Send to Paint/.test(mp),'Paint’s File menu has Send to Photo (and not Send to Paint)');
 const m3=await menu('p3d');ok(!/Send to Photo/.test(m3)&&!/Send to Paint/.test(m3),'3D Paint’s File menu has neither: a photo cannot be sent to 3D Paint');
 /* 2D → Photo */
 await p.evaluate(()=>{__gs.setMode('paint',true);__gs.newDoc(64,48,8,[1,0,0],'Red test',false);});await W(600);
 await p.evaluate(()=>__gs.sendPaintToPhoto());await W(2500);
 const a=await p.evaluate(()=>({mode:__gs.ui.mode,n:__gs.ph?__gs.ph.photos.length:-1,name:__gs.ph&&__gs.ph.photos[0]&&__gs.ph.photos[0].name,w:__gs.ph&&__gs.ph.photos[0]&&__gs.ph.photos[0].w,h:__gs.ph&&__gs.ph.photos[0]&&__gs.ph.photos[0].h,cur:__gs.ph&&__gs.ph.cur}));
 ok(a.mode==='photo'&&a.n===1&&a.w===64&&a.h===48&&a.cur===0,'the painting arrives in Photo as a new photo, selected '+JSON.stringify(a));
 const mh=await menu('photo');ok(/Send to Paint/.test(mh)&&!/Send to Photo/.test(mh),'Photo’s File menu has Send to Paint');
 /* Photo → Paint */
 await p.evaluate(()=>{__gs.setMode('photo',true);});await W(500);
 await p.evaluate(()=>__gs.sendPhotoToPaint());await W(2500);
 const c=await p.evaluate(()=>{const g=__gs,L=g.allLayers().find(l=>/Red test/.test(l.name)&&l!==g.allLayers()[0])||g.allLayers()[g.allLayers().length-1];const t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data;g.release(t);const i=(24*t.w+32)*4;return {mode:g.ui.mode,layers:g.allLayers().map(l=>l.name).join(),px:[d[i],d[i+1],d[i+2]]};});
 ok(c.mode==='paint'&&c.px[0]>200&&c.px[1]<40&&/Red test/.test(c.layers),'the developed photo comes back as a layer in Paint '+JSON.stringify(c));
 /* 3D screenshot → Photo */
 await p.evaluate(async()=>{const G=__gs;G.setMode('p3d',true);G.p3.savedAt=G.p3Sig();await G.p3NewProject(64,{modelKey:'plane'});G.useModel(G.primMesh('plane',1));});await W(1500);
 await p.evaluate(()=>__gs.dlgScreenshot());await W(500);
 ok(await p.evaluate(()=>!!document.getElementById('shotPhoto')),'the screenshot window has Send to Photo');
 const before=await p.evaluate(()=>__gs.ph.photos.length);await p.click('#shotPhoto');await W(4000);
 const d=await p.evaluate(()=>({mode:__gs.ui.mode,n:__gs.ph.photos.length,name:__gs.ph.photos[__gs.ph.photos.length-1].name}));
 ok(d.mode==='photo'&&d.n===before+1&&/_3d\.png$/.test(d.name),'the 3D picture opens in Photo ('+d.name+')');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
