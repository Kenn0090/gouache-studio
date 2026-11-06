/* 0.94.6 (Kenn): Hand-painted as a full material; new layers in 3D Paint are a plain 50% grey material */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* Add layer: a grey material with a white mask, one undo step */
 const n0=await p.evaluate(()=>__gs.allLayers().length),u0=await p.evaluate(()=>__gs.hist.undo.length);
 await p.evaluate(()=>document.getElementById('lAdd').click());await W(500);
 const a=await p.evaluate(()=>{const L=__gs.doc.active;return {fill:!!L.fill,mask:!!L.mask};});
 ok(!a.fill&&!a.mask,'(0.94.9) Add layer in 3D Paint makes a regular paint layer '+JSON.stringify(a));
 ok(await p.evaluate(u=>__gs.hist.undo.length===u+1,u0),'…as one undo step');
 await p.evaluate(()=>__gs.undo());await W(300);ok(await p.evaluate(n=>__gs.allLayers().length===n,n0),'…and undo takes it away');
 /* the Material button: grey only */
 await p.evaluate(()=>__gs.cmdNewFillLayer());await W(300);
 ok(await p.evaluate(()=>{const m=__gs.doc.active.fill.maps;return Object.keys(m).filter(k=>m[k].on).join()==='base'&&m.base.c[0]===.5;}),'a new material is only the grey colour');
 await p.evaluate(()=>__gs.undo());await W(200);
 /* the Hand-painted material */
 await p.evaluate(()=>{__gs.showPanel('mats');});await W(300);
 await p.evaluate(()=>{const s=document.querySelector('[id^=matView_hand],[data-v=hand]');});
 ok(await p.evaluate(()=>!!document.getElementById('hpGrid')&&document.querySelectorAll('#hpGrid .mattile').length>10),'the Materials panel lists the Hand-painted materials');
 const plain=await p.evaluate(()=>{const c=__gs.compositeMap('base'),d=Array.from(__gs.captureRegionNow(c,0,0,c.w,c.h).data);__gs.release(c);return d;});
 const u1=await p.evaluate(()=>__gs.hist.undo.length);
 const hp=await p.evaluate(()=>{const L=__gs.cmdNewHandPaintMaterial('Steel');const r=__gs.hpMatRow(L),m=L.fill.maps;return {name:L.name,row:!!r,own:r&&r.v.own,metal:m.metal.on&&m.metal.v,rough:m.rough.on&&m.rough.v};});
 ok(hp.row&&hp.own&&hp.metal>.5&&hp.rough>0&&/Steel/.test(hp.name),'a Hand-painted material is a material layer with the look, roughness and metal from the preset '+JSON.stringify(hp));
 ok(await p.evaluate(u=>__gs.hist.undo.length===u+1,u1),'…added as one undo step');
 await W(800);
 const look=await p.evaluate(()=>{const c=__gs.compositeMap('base'),d=Array.from(__gs.captureRegionNow(c,0,0,c.w,c.h).data);__gs.release(c);const vals=new Set();for(let i=0;i<d.length;i+=4*7)vals.add(d[i]>>3);return {n:vals.size,d};});
 let df=0;for(let i=0;i<plain.length;i+=4)df+=Math.abs(plain[i]-look.d[i]);
 ok(df/(plain.length/4)>3&&look.n>4,'the hand-painted look paints the colour ('+(df/(plain.length/4)).toFixed(1)+' change, '+look.n+' shades)');
 ok(await p.evaluate(()=>!!document.getElementById('hpOverBelow')&&!!document.getElementById('hpMatChannels')),'its settings show in Properties, with the switch to paint over the layers below');
 /* paint over the layers below, and back */
 await p.evaluate(()=>__gs.hpMatToOverlay(__gs.doc.active));await W(400);
 const ov=await p.evaluate(()=>{const L=__gs.doc.active;return {fx:!!(L.fx&&L.fx.stack[0].id==='handPaint'),own:L.fx&&L.fx.stack[0].v.own};});
 ok(ov.fx&&ov.own===false,'“Paint over the layers below” makes it the classic Hand-painted layer '+JSON.stringify(ov));
 await p.evaluate(()=>__gs.hpOverlayToMat(__gs.doc.active));await W(400);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!(L.fill&&__gs.hpMatRow(L)&&__gs.hpMatRow(L).v.own);}),'…and “Make it a hand-painted material” turns it back');
 const n2=await p.evaluate(()=>__gs.allLayers().length);await p.evaluate(()=>__gs.undo());await W(300);
 ok(await p.evaluate(()=>{const L=__gs.doc.active;return !!(L&&L.fx);}),'undo goes back to the layer before');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
