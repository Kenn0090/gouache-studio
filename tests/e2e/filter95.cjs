/* 0.95: UV filtering: a small picture on a material is blended (Smooth) or kept as crisp pixels (Nearest) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>{__gs.newDoc(128,128,8,[1,1,1],'Filt',false,'pbr');});await p.waitForTimeout(500);
 const run=async filter=>p.evaluate(f=>{
   const L=__gs.cmdNewFillLayer('metal');
   const t=__gs.makeTarget(2,2,8,true),d=new Uint8Array(16);[[255,0,0],[0,0,255],[0,0,255],[255,0,0]].forEach((c,i)=>{d[i*4]=c[0];d[i*4+1]=c[1];d[i*4+2]=c[2];d[i*4+3]=255;});__gs.writeRegion(t,0,0,2,2,d);
   L._fillImg={base:t};L.fill.maps.base={on:true,src:'image',tile:1,c:[1,1,1,1],v:1,name:'x'};L.fill.xf=Object.assign({},L.fill.xf||{},{filter:f});L.fill.proj='uv';
   __gs.fillRender(L);const tgt=__gs.compositeMap('base'),px=__gs.captureRegionNow(tgt,0,0,128,128).data;__gs.release(tgt);
   let mid=0;for(let i=0;i<px.length;i+=4){const r=px[i],bl=px[i+2];if(r>40&&r<215&&bl>40&&bl<215)mid++;}return mid;},filter);
 const smooth=await run('smooth'),nearest=await run('nearest');
 console.log('blended pixels  smooth',smooth,' nearest',nearest);
 ok(smooth>nearest,'Nearest keeps crisp pixels: fewer blended pixels than Smooth ('+nearest+' vs '+smooth+')');
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
