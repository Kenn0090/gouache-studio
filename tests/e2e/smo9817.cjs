/* 0.98.17: (1) Preferences › "while painting, the model shows only the painted channels": during a stroke the other channels are not rebuilt,
   they catch up at the end (Georgian's stutters at 8192 × 4096). (2) Ctrl + left-drag smooths again; Ctrl + Shift + left-drag sets flow and
   opacity, and the preference swaps them (Kenn: "I can't smooth and blur anymore"). */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null});__gs.doc.active=__gs.layerByName('Paint');});
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 const stroke=async(mode,mods,n)=>{n=n||20;await p.evaluate(m=>{__gs.prefs.strokeMaps=m;window.__v3rc={};window.__dur=null;if(m==='auto')return;
     /* something that needs every channel rebuilt (like a filter layer) keeps asking for it during the stroke */
     window.__dirt=setInterval(()=>{if(__gs.curStroke){__gs.v3.mapsDirty=true;window.__dur=window.__dur||Object.assign({},window.__v3rc);window.__mid=Object.assign({},window.__v3rc);}},30);},mode);
   for(const k of mods||[])await p.keyboard.down(k);
   await p.mouse.move(cx-60,cy);await p.mouse.down();for(let i=0;i<=n;i++){await p.mouse.move(cx-60+120*i/n,cy+(i%2));await p.waitForTimeout(40);}
   const mid=await p.evaluate(()=>Object.assign({},window.__v3rc));await p.mouse.up();
   for(const k of (mods||[]).slice().reverse())await p.keyboard.up(k);
   await p.waitForTimeout(1200);return await p.evaluate(m=>{if(window.__dirt)clearInterval(window.__dirt);window.__dirt=null;return {mid:m,end:Object.assign({},window.__v3rc),maps:__gs.doc.maps.join()};},mid);};
 const on=await stroke('on');console.log('on',JSON.stringify(on));
 ok((on.mid.base||0)>0,'the painted channel refreshes during the stroke');
 ok(!on.mid.rough&&!on.mid.metal,'the other channels wait during the stroke');
 ok((on.end.rough||0)>0,'they catch up when the stroke ends');
 const off=await stroke('off');console.log('off',JSON.stringify(off));
 ok((off.mid.rough||0)>0,'"Every channel": the other channels refresh during the stroke');
 /* Ctrl + drag */
 const fl=()=>p.evaluate(()=>[__gs.brush.flow,__gs.brush.opacity]);
 await p.evaluate(()=>{__gs.prefs.ctrlDrag=undefined;Object.assign(__gs.brush,{flow:.5,opacity:1});});
 const f0=await fl();const sm=await stroke('auto',['Control'],6);const f1=await fl();
 ok(f0.join()===f1.join(),'Ctrl + drag leaves flow and opacity alone '+f1);
 await stroke('auto',['Control','Shift'],6);const f2=await fl();
 ok(f2.join()!==f0.join(),'Ctrl + Shift + drag sets flow and opacity '+f2);
 await p.evaluate(()=>{__gs.prefs.ctrlDrag='flowop';Object.assign(__gs.brush,{flow:.5,opacity:1});});
 await stroke('auto',['Control'],6);const f3=await fl();
 ok(f3.join()!==f0.join(),'with the preference swapped Ctrl + drag sets flow and opacity '+f3);
 await p.evaluate(()=>{__gs.prefs.ctrlDrag=undefined;});
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
