/* 0.98.3: a grey channel of a material can read any channel of its picture (mix maps) */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1300,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.matOpen','all');localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.setMode('p3d');});await p.waitForTimeout(2500);
 await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active,S=256,t=g.makeTarget(S,S,8,true),d=new Uint8Array(S*S*4);for(let i=0;i<S*S;i++){d[i*4]=51;d[i*4+1]=204;d[i*4+2]=128;d[i*4+3]=255;}g.writeRegion(t,0,0,S,S,d);
  L._fillImg={rough:t};const s=L.fill.maps.rough;s.on=true;s.src='image';s.name='mix.png';s.tile=1;g.fillRender(L);g.selectOnly(L);g.showPanel('matEd');g.renderMatEd(true);});
 await p.waitForTimeout(800);
 const rough=()=>p.evaluate(()=>{const L=__gs.doc.active,T=__gs.mapT(L,'rough'),d=__gs.captureRegionNow(T,100,100,1,1).data;return d[0];});
 ok(await p.evaluate(()=>!!document.getElementById('fl_ch_rough')),'the roughness card offers a Channel choice for a picture with different channels');
 const auto=await rough();console.log('auto',auto);
 for(const [v,expect] of [['g',204],['b',128],['r',51]]){
  await p.evaluate(v=>{const L=__gs.doc.active;L.fill.maps.rough.ch=v;__gs.fillRender(L);},v);await p.waitForTimeout(400);
  const got=await rough();ok(Math.abs(got-expect)<=2,'channel '+v+' gives '+expect+' (got '+got+')');}
 await p.locator('#fl_ch_rough button',{hasText:'Green'}).click().catch(()=>{});await p.waitForTimeout(600);
 ok(await p.evaluate(()=>__gs.doc.active.fill.maps.rough.ch==='g'),'clicking Green in the card sets it');
 ok(errs.length===0&&await p.evaluate(()=>__gs.gl.getError())===0,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
