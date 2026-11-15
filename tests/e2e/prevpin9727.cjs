/* 0.97.27 (Kenn: "always make sure we keep it shown"): the stroke preview stays pinned while scrolling the brush settings,
   in Paint and 3D Paint, also on a short window */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [w,h] of [[1600,1000],[1366,720]]){
  const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
  await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
  for(const mode of ['paint','p3d']){
   if(mode==='p3d'){await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(3000);}
   await p.evaluate(()=>{__gs.setTool('brush');__gs.showPanel('tool');});await p.waitForTimeout(400);
   const r=await p.evaluate(()=>{const pw=document.querySelector('.prevwrap');if(!pw||pw.hidden||!pw.offsetParent)return {shown:false};
     let sc=pw.parentElement;while(sc&&sc!==document.body&&!(sc.scrollHeight>sc.clientHeight+4&&/(auto|scroll)/.test(getComputedStyle(sc).overflowY)))sc=sc.parentElement;
     const pos=getComputedStyle(pw).position;if(!sc||sc===document.body)return {shown:true,pos,noScroll:true};
     sc.scrollTop=sc.scrollHeight;const R=pw.getBoundingClientRect(),S=sc.getBoundingClientRect(),bh=pw.parentElement.querySelector(':scope>.brhead'),B=bh&&getComputedStyle(bh).position==='sticky'?bh.getBoundingClientRect():null;return {cover:B?Math.max(0,Math.round(B.bottom-R.top)):0,shown:true,pos,top:Math.round(R.top-S.top),bottom:Math.round(R.bottom),sb:Math.round(S.bottom),h:Math.round(R.height)};});
   ok(r.shown&&r.pos==='sticky'&&(r.noScroll||(!r.cover&&r.top>=-1&&r.bottom<=r.sb&&r.top<120)),mode+' at '+w+'×'+h+': the stroke preview stays in view while the settings scroll '+JSON.stringify(r));
  }
  await p.context().close();}
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
