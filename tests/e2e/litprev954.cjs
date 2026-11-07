/* 0.95.4 (Kenn: "when you add lights to a scene you can't even see them affecting anything"): on the Bake tab's Lighting page the
   model shows a quick bake of the rig by itself, with shadows, updated when a light changes; the real bakes are left alone;
   the switch turns it off; leaving the page shows the normal view again */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=bake]');await W(1500);
 await p.evaluate(()=>{for(const g of __gs.dk.L.groups)g.min=!g.tabs.includes('bake');__gs.showPanel('bake');__gs.v3s().model='sphere';__gs.bakeCfg.low=null;__gs.v3.dirty=true;});await W(800);
 await p.evaluate(()=>{const G=__gs;G.bakeCfg.tab='light';G.lightRig().lights=[G.lightNew('sun',{el:80,turn:0,int:1.2,soft:2,rays:4})];G.buildBakePanel();G.v3.dirty=true;G.requestRender(true);});
 await p.evaluate(()=>__gs.act('bake'));await W(300);
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#bakeBody .bktabs button')].find(b=>b.textContent.startsWith('Lighting'));if(b)b.click();});await W(400);
 const wait=async()=>{for(let i=0;i<400;i++){const s=await p.evaluate(()=>!__gs.lp.run&&!__gs.lp.t||__gs.lp.pass>=1);if(s)break;await W(250);}
   for(let i=0;i<400;i++){if(await p.evaluate(()=>__gs.lp.pass>=1&&!__gs.lp.run))break;await W(250);}await W(300);};
 await wait();
 ok(await p.locator('#l_prev').count()===1&&await p.evaluate(()=>document.getElementById('l_prev').checked),'the Lighting page has "Live preview on the model", on by default');
 const top=()=>p.evaluate(()=>{const G=__gs,t=G.lp.view;if(!t)return null;const d=G.captureRegionNow(t,0,0,t.w,t.h).data,m=G.v3.mesh||G.bkLow?.();
   /* brightness of the sphere's texture: upper half of the sphere = rows near v=1 of the UV sphere; compare the top and bottom bands */
   let a=0,na=0,c=0,nc=0;for(let y=0;y<t.h;y++)for(let x=0;x<t.w;x++){const i=(y*t.w+x)*4,v=d[i];if(y<t.h*.25){a+=v;na++;}else if(y>t.h*.75){c+=v;nc++;}}return {low:a/na,high:c/nc,shown:!!G.bk.lpShown,res:Object.keys(G.bk.res).length};});
 const s1=await top();console.log('  sun from above:',JSON.stringify(s1));
 ok(s1&&s1.shown,'the model shows the preview by itself (no Bake button pressed)');
 ok(s1&&Math.abs(s1.high-s1.low)>40,'the lit side and the dark side differ ('+(s1&&s1.high.toFixed(0))+' vs '+(s1&&s1.low.toFixed(0))+')');
 ok(s1&&s1.res===0,'the real bakes are untouched');
 /* turn the sun to come from below: the preview follows */
 await p.evaluate(()=>{const G=__gs;G.lightRig().lights[0].el=-80;G.v3.dirty=true;G.requestRender(true);});await W(100);await wait();
 const s2=await top();console.log('  sun from below:',JSON.stringify(s2));
 ok(s2&&Math.sign(s2.high-s2.low)!==Math.sign(s1.high-s1.low),'moving the light updates the preview');
 /* a coloured light shows its colour */
 await p.evaluate(()=>{const G=__gs;G.lightRig().lights[0].col=[1,0,0];G.v3.dirty=true;G.requestRender(true);});await W(100);await wait();
 const red=await p.evaluate(()=>{const G=__gs,t=G.lp.view,d=G.captureRegionNow(t,0,0,t.w,t.h).data;let r=0,g=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];}return [r,g];});
 ok(red[0]>red[1]*3,'a red light shows red ('+red.join(' / ')+')');
 /* the switch turns it off; another settings page shows the normal view */
 await p.evaluate(()=>document.getElementById('l_prev').click());await W(600);ok(await p.evaluate(()=>!__gs.bk.lpShown&&!__gs.lp.view),'turning the switch off removes the preview');
 await p.evaluate(()=>document.getElementById('l_prev').click());await W(300);await wait();ok(await p.evaluate(()=>__gs.bk.lpShown),'and on again shows it');
 await p.evaluate(()=>{__gs.bakeCfg.tab='ao';__gs.buildBakePanel();__gs.v3.dirty=true;__gs.requestRender(true);});for(let i=0;i<40&&await p.evaluate(()=>__gs.bk.lpShown);i++){await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);});await W(250);}
 ok(await p.evaluate(()=>!__gs.bk.lpShown),'on another settings page the normal view is back');
 ok(!errors.length,'no errors '+errors.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
