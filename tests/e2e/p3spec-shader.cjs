/* New 3D Paint project: Specular/Glossiness starts with the Spec/Gloss shader, PBR with Standard. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 const shader=()=>p.evaluate(()=>({kind:__gs.doc.v3shade&&__gs.doc.v3shade.kind,wf:__gs.doc.workflow,maps:__gs.doc.maps.join()}));
 let s=await shader();
 ok(s.wf==='metal'&&s.kind==='std','PBR project starts with the Standard shader '+JSON.stringify(s));
 /* a Specular/Glossiness project replaces the set */
 await p.evaluate(()=>__gs.p3NewProject(256,{setup:'spec',workflow:'spec',startMaterial:'neutral'}));await W(1500);
 await p.evaluate(()=>{const b=document.querySelector('.dlg .btn.primary, #dlgOk, .dlg button.ok');if(b)b.click();});await W(800);
 s=await shader();
 ok(s.wf==='spec'&&s.kind==='specgloss'&&s.maps==='base,spec,gloss,height,normal','Spec/Gloss project starts with the Spec/Gloss shader '+JSON.stringify(s));
 const panel=await p.evaluate(()=>{__gs.selectOnly(__gs.allLayers().find(L=>L.name==='Base material'));__gs.showPanel('matEd');__gs.renderMatEd(true);const t=document.getElementById('matEdBody')?.textContent||'';return {spec:/Spec Gloss parameters/.test(t),spec2:/Specular/.test(t)&&/Glossiness/.test(t)};});
 ok(panel.spec&&panel.spec2,'Properties shows Spec Gloss inputs '+JSON.stringify(panel));
 console.log(fails?'FAILED '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
