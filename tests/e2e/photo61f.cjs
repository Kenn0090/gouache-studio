/* 0.61.1: with no photo open, the preset pictures show a sample scene */
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
 await p.evaluate(()=>__gs.showPanel&&__gs.showPanel('phpre'));
 await p.waitForFunction(()=>document.querySelectorAll('#phPreBody .phpre img[src^="data:"]').length>=60,null,{timeout:30000}).catch(()=>{});
 const r=await p.evaluate(async()=>{const imgs=[...document.querySelectorAll('#phPreBody .phpre img')];
  const avg=async im=>{await im.decode().catch(()=>{});const c=document.createElement('canvas');c.width=8;c.height=8;const g=c.getContext('2d');g.drawImage(im,0,0,8,8);const d=g.getImageData(0,0,8,8).data;let s=0,sat=0;for(let i=0;i<d.length;i+=4){s+=d[i]+d[i+1]+d[i+2];}return Math.round(s/64);};
  const vals=[];for(const im of imgs.slice(0,60))vals.push(await avg(im));
  return {n:imgs.length,withPic:imgs.filter(i=>i.naturalWidth>0).length,distinct:new Set(vals).size,note:!!document.querySelector('#phPreBody .note')};});
 ok(r.n>=60&&r.withPic===r.n,'every preset shows a picture without a photo open '+JSON.stringify(r));
 ok(r.distinct>=25,'the pictures differ from each other, so the looks can be judged ('+r.distinct+' distinct)');
 ok(r.note,'a note says the pictures are a sample scene');
 await p.screenshot({path:__dirname+'/out/photo61f.png'});
 await p.evaluate(async()=>{const c=new OffscreenCanvas(240,160),x=c.getContext('2d');x.fillStyle='#204060';x.fillRect(0,0,240,160);await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'p.png',{type:'image/png'})]);});await p.waitForTimeout(1500);
 const nt=await p.evaluate(()=>({n:__gs.ph?__gs.ph.photos.length:-1,t:[...document.querySelectorAll('#phPreBody .note')].map(x=>x.textContent)}));ok(nt.t.length===0,'with a photo open the note is gone '+JSON.stringify(nt));
 ok(errs.length===0,'no errors '+errs.join('|'));
 console.log(fails?'FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
