/* 0.61.1: presets swap instead of piling up, the Amount slider, many presets, sepia keeps its tone */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const c=new OffscreenCanvas(240,160),x=c.getContext('2d'),g=x.createLinearGradient(0,0,240,0);g.addColorStop(0,'#406080');g.addColorStop(1,'#c0a060');x.fillStyle=g;x.fillRect(0,0,240,160);
  await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'p.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 const n=await p.evaluate(()=>__gs.PH_PRESETS.reduce((a,g)=>a+g[1].length,0));ok(n>=60,'there are many presets ('+n+' in '+(await p.evaluate(()=>__gs.PH_PRESETS.length))+' groups)');
 await p.evaluate(()=>__gs.showPanel&&__gs.showPanel('phpre'));await p.waitForFunction(()=>document.querySelectorAll('#phPreBody .phpre img[src^="data:"]').length>=60,null,{timeout:20000}).catch(()=>{});
 ok(await p.evaluate(()=>document.querySelectorAll('#phPreBody .phpre img[src^="data:"]').length)>=60,'the preset pictures fill in a few at a time');
 // layering: the same preset twice and two presets one after another leave the same result as each alone
 const find=name=>p.evaluate(n=>{for(const [g,l] of __gs.PH_PRESETS)for(const [k,v] of l)if(k===n)return v;return null;},name);
 const state=()=>p.evaluate(()=>JSON.stringify(__gs.phS()));
 await p.evaluate(()=>__gs.phApplyPreset(__gs.PH_PRESETS[0][1].find(x=>x[0]==='Punchy')[1],'Punchy'));const afterP=await state();
 await p.evaluate(()=>__gs.phApplyPreset(__gs.PH_PRESETS[0][1].find(x=>x[0]==='Punchy')[1],'Punchy'));ok(await state()===afterP,'the same preset twice does not pile up');
 await p.evaluate(()=>__gs.phApplyPreset(__gs.PH_PRESETS[0][1].find(x=>x[0]==='Faded')[1],'Faded'));const afterF=await state();
 await p.evaluate(()=>{__gs.phReset();});await p.evaluate(()=>__gs.phApplyPreset(__gs.PH_PRESETS[0][1].find(x=>x[0]==='Faded')[1],'Faded'));ok(await state()===afterF,'Punchy then Faded gives the same as Faded alone');
 // edits in between are kept as the new start
 await p.evaluate(()=>{__gs.phSet('exp',1,'Exposure');__gs.phCommit('Exposure');__gs.phApplyPreset(__gs.PH_PRESETS[0][1].find(x=>x[0]==='Punchy')[1],'Punchy');});
 ok(await p.evaluate(()=>__gs.phS().exp)===1,'an edit you made before a preset stays');
 // amount
 await p.evaluate(()=>{__gs.phReset();__gs.phApplyPreset(__gs.PH_PRESETS[0][1].find(x=>x[0]==='Punchy')[1],'Punchy');});const full=await p.evaluate(()=>__gs.phS().con);
 await p.evaluate(()=>__gs.phPresetAmount(50));const half=await p.evaluate(()=>__gs.phS().con);ok(full===30&&Math.abs(half-15)<.01,'Amount 50% gives half the effect ('+full+' → '+half+')');
 await p.evaluate(()=>__gs.phPresetAmount(100));
 // sepia keeps its tone (black and white happens before grading)
 await p.evaluate(()=>{__gs.phReset();__gs.phApplyPreset(__gs.PH_PRESETS.find(g=>g[0]==='Black & white')[1].find(x=>x[0]==='Sepia')[1],'Sepia');});await p.waitForTimeout(400);
 const px=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(80*W+120)*4;return [d[i],d[i+1],d[i+2]];});
 ok(px[0]>px[2]+12,'Sepia is warm brown, not plain grey ('+px+')');
 await p.evaluate(()=>{__gs.phReset();__gs.phApplyPreset(__gs.PH_PRESETS.find(g=>g[0]==='Black & white')[1][0][1],'B&W natural');});await p.waitForTimeout(300);
 const g=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,i=(80*W+120)*4;return [d[i],d[i+1],d[i+2]];});ok(Math.abs(g[0]-g[1])<=1&&Math.abs(g[1]-g[2])<=1,'plain B&W is still grey ('+g+')');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
