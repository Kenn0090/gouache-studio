/* 0.60: RAW photos in the Photo tab. Needs sample RAW files (downloaded from raw.pixls.us); skips when they are not on this machine.
   RAW_DIR=/tmp/rawsamples node photo60raw.cjs */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const dir=process.env.RAW_DIR||'/tmp/rawsamples',files=['eosm.cr2','gm1.rw2'].filter(f=>fs.existsSync(path.join(dir,f)));
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 if(!files.length){console.log('SKIP no sample RAW files in '+dir);return;}
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')||r.request().url().startsWith('blob:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));if(process.env.DBG)p.on('console',m=>console.log('C',m.text().slice(0,300)));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 for(const f of files){
  const b64=fs.readFileSync(path.join(dir,f)).toString('base64');
  const n0=await p.evaluate(()=>__gs.ph.photos.length);
  await p.evaluate(async([b64,name])=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);await __gs.phAddFiles([new File([u],name)]);},[b64,f]);
  await p.waitForFunction(([n])=>__gs.ph.photos.length>n&&__gs.ph.cur===__gs.ph.photos.length-1&&!!__gs.phP().psrc,[n0],{timeout:120000});
  const info=await p.evaluate(()=>{const q=__gs.phP();return {w:q.w,h:q.h,pw:q.pw,thumb:q.thumb&&q.thumb.length};});
  ok(info.w>500&&info.h>500&&info.thumb>500,f+' opens '+JSON.stringify(info));
  await p.waitForTimeout(500);
  const mean=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out);let s=0,c=0,mx=0;for(let i=0;i<d.length;i+=4*61){s+=d[i]+d[i+1]+d[i+2];c+=3;mx=Math.max(mx,d[i],d[i+1],d[i+2]);}return {mean:s/c,mx};});
  ok(mean.mean>20&&mean.mean<235&&mean.mx>150,f+' looks like a photo '+JSON.stringify(mean));
  await p.evaluate(()=>{__gs.phSet('exp',1,'Exposure');__gs.phCommit('Exposure');});await p.waitForTimeout(300);
  const m2=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out);let s=0,c=0;for(let i=0;i<d.length;i+=4*61){s+=d[i]+d[i+1]+d[i+2];c+=3;}return s/c;});
  ok(m2>mean.mean+8,f+' exposure edits work on RAW ('+mean.mean.toFixed(0)+' → '+m2.toFixed(0)+')');
  await p.screenshot({path:'/tmp/raw_'+f+'.png'});
 }
 const ex=await p.evaluate(async()=>{const c=await __gs.phRenderFull(__gs.phP(),{mode:'long',long:800});return [c.width,c.height];});
 ok(ex[0]>0&&Math.max(...ex)<=800,'a RAW exports at a chosen size '+ex);
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
