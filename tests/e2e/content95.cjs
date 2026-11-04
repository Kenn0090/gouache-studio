/* 0.95: the Content window (first-launch download choices): choices, sizes, a sky download, and the bundled fallback */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 let netOn=true;await p.route('**/*',r=>{const u=r.request().url();
  if(u.startsWith('https://raw.githubusercontent.com/')){if(!netOn)return r.abort();return r.fulfill({body:Buffer.from([9,8,7,6]),contentType:'application/octet-stream'});}
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* the web version only explains */
 await p.evaluate(()=>{__gs.platform.isDesktop=false;__gs.dlgContent(true);});await W(300);
 ok(await p.evaluate(()=>document.body.innerText.includes('needs the Gouache Studio desktop app')),'the web version explains that it needs the desktop app');
 await p.evaluate(()=>document.querySelector('#modal [data-act=cancel], #modal .btn:last-child')&&document.querySelector('#modal .btn:last-child').click());await W(200);
 /* desktop: a fake network */
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__calls=[];
   P.invoke=async(cmd,a)=>{window.__calls.push(cmd+':'+(a&&a.url||''));if(cmd==='net_get_text')return JSON.stringify({hdri:{'2k':{hdr:{url:'https://dl.example/'+a.url.split('/').pop()+'_2k.hdr'}}}});
     if(cmd==='net_download'){return new Uint8Array([1,2,3,4,5,6,7,8]).buffer;}return true;};});
 await p.evaluate(()=>{__gs.dlgContent(true);});await W(800);
 const t0=await p.evaluate(()=>document.getElementById('ctBody').innerText);
 ok(/Material Library pictures/.test(t0)&&/Skies/.test(t0)&&/AI add-ons/.test(t0),'the window lists the Library, the skies and the AI add-ons');
 ok(await p.evaluate(()=>__gs.ctPick().lib==='2K'&&__gs.ctPick().env==='2K'),'2K is the default for the Library and the skies');
 const e0=await p.evaluate(()=>__gs.ctEstimates());
 ok(e0.envN===5&&e0.env>0,'the sky download is counted ('+e0.envN+' skies)');
 /* download only the skies */
 await p.evaluate(()=>{__gs.ctPick().lib='1K';__gs.ctRun();});
 for(let i=0;i<40&&(await p.evaluate(()=>!!document.getElementById('ctStop')));i++)await W(250);
 await W(500);
 const have=await p.evaluate(async()=>{await __gs.ctEnvRefresh();const v=await __gs.aiDB.get('hdri/studio_small_09_2k.hdr');return v&&v.buf?v.buf.byteLength:0;});
 ok(have===8,'a 2K sky is kept on this computer');
 ok(await p.evaluate(async()=>{const u=await __gs.envBundled('studio_small_09');return u&&u.length===8;}),'the sky loader uses the downloaded 2K file first');
 ok(await p.evaluate(()=>window.__calls.filter(c=>c.startsWith('net_download')).length===5),'five skies were fetched');
 ok(await p.evaluate(()=>__gs.ctEstimates().envN===0),'nothing is left to download afterwards');
 /* the smaller installer: the starter content is fetched once and kept for offline use */
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug&lite');await W(2500);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;P.invoke=async()=>true;});
 await p.evaluate(()=>__gs.dlgContent(true));await W(1500);
 ok(await p.evaluate(()=>!!document.getElementById('ctOff')),'the smaller installer offers the starter content for offline work');
 const total=await p.evaluate(()=>__gs.ctOffList().length);
 await p.evaluate(()=>{__gs.ctPick().lib='1K';__gs.ctPick().env='1K';__gs.ctRun();});
 for(let i=0;i<120&&(await p.evaluate(()=>!!document.getElementById('ctStop')));i++)await W(500);
 await W(800);
 ok(await p.evaluate(()=>__gs.ctOffMissing().length)===0,'all '+total+' starter files are kept on this computer');
 netOn=false;
 ok(await p.evaluate(async()=>{const u=await __gs.bcGet('materials','Brass.gmat',null);return u.length===4;}).catch(()=>false)||await p.evaluate(async()=>{const f=__gs.ctOffList()[0];const u=await __gs.bcGet(f[0],f[1],null);return u.length===4;}),'a kept file is used when the internet is off');
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();process.exit(fails?1:0);
})();
