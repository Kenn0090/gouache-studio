/* 0.98.3: Flatten effects bakes a layer's live effects into its pixels */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1300,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.newDoc(128,128,8,[1,1,1],'ff',false);});await p.waitForTimeout(500);
 await p.evaluate(()=>{const g=__gs;g.act('addLayer');g.setFG([.1,.1,.1]);g.setTool('marquee');});
 const px=x=>p.evaluate(x=>{const L=__gs.doc.active,d=__gs.captureRegionNow(L.target,x,64,1,1).data;return d[3];},x);
 /* a hard dark block, then a live blur row */
 await p.evaluate(()=>{const g=__gs,L=g.doc.active,T=L.target;const d=new Uint8Array(128*128*4);for(let y=40;y<90;y++)for(let x=40;x<90;x++){const i=(y*128+x)*4;d[i]=d[i+1]=d[i+2]=20;d[i+3]=255;}g.writeRegion(T,0,0,128,128,d);g.cfxAdd(L,'blur');const r=L.cfx[0];r.v=Object.assign({},r.v,{r:8});g.changedAll();});
 await p.waitForTimeout(600);
 ok(await p.evaluate(()=>__gs.fxFlattenable(__gs.doc.active)),'a layer with an effect row can be flattened');
 const hard=await px(38);ok(hard===0,'before: the pixels are still the hard block (outside = '+hard+')');
 ok(await p.evaluate(()=>__gs.cmdFlattenEffects()),'Flatten effects ran');await p.waitForTimeout(500);
 const soft=await px(38);ok(soft>10,'after: the blur is in the pixels (outside = '+soft+')');
 ok(await p.evaluate(()=>!(__gs.doc.active.cfx&&__gs.doc.active.cfx.length)&&!__gs.fxFlattenable(__gs.doc.active)),'the live effect row is gone');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(500);
 ok(await px(38)===0&&await p.evaluate(()=>__gs.doc.active.cfx&&__gs.doc.active.cfx.length===1),'undo brings the hard pixels and the effect row back');
 ok(errs.length===0&&await p.evaluate(()=>__gs.gl.getError())===0,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
