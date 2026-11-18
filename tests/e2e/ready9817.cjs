/* 0.98.17 (Kenn: "letting the 3D paint section load fully before allowing me to do things"): opening the 3D Paint tab shows a progress screen
   that blocks clicks and keys until the model, shaders and textures are ready and the view draws smoothly; Preferences can turn it off. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{window.__p3Ready=true;window.__p3rFrame=5000;try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(100);
 const st=()=>p.evaluate(()=>({on:__gs.p3r.on,shown:!!document.querySelector('#p3Ready:not([hidden])'),done:__gs.p3r.done,list:[...document.querySelectorAll('#p3Ready li')].map(l=>l.textContent).join(' | '),tool:__gs.ui.tool}));
 let s=await st();console.log(JSON.stringify(s));
 ok(s.on&&s.shown,'the ready screen covers 3D Paint while it loads');
 /* a key press does nothing while it is up */
 await p.keyboard.press('e');const s2=await st();
 if(s2.on)ok(s2.tool===s.tool,'keys are held back while it loads ('+s2.tool+')');
 const t0=Date.now();while(Date.now()-t0<100000){s=await st();if(!s.on)break;await p.waitForTimeout(500);}
 console.log('ready after',Date.now()-t0,'ms',JSON.stringify(s));
 ok(!s.on&&s.done==='ready','it goes away by itself once everything is ready ('+s.done+')');
 ok(await p.evaluate(()=>!!__gs.v3.mesh&&!__gs.v3.mapsDirty),'the model and its textures are there');
 /* turned off in Preferences: no screen */
 await p.evaluate(()=>{__gs.prefs.p3Ready=false;__gs.setMode('paint');__gs.setMode('p3d');});await p.waitForTimeout(200);
 s=await st();ok(!s.on,'with the preference off it does not come up');
 await p.evaluate(()=>{__gs.prefs.p3Ready=undefined;});
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
