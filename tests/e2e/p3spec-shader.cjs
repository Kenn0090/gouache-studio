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
 /* choosing Spec/Gloss in the Shader panel on a metal texture set is refused with a message */
 await p.evaluate(()=>{__gs.showPanel('shading');const sel=document.getElementById('shKind');sel.value='specgloss';sel.dispatchEvent(new Event('change',{bubbles:true}));});await W(1200);
 const asked=await p.evaluate(()=>{const m=document.getElementById('modal');if(m&&!m.hidden){document.getElementById('dlgCancel').click();return true;}return false;});await W(800);
 s=await shader();
 const said=await p.evaluate(()=>document.body.innerText.includes('needs a new 3D Paint project'));
 s=await shader();
 ok(s.wf==='metal'&&s.kind==='std'&&said,'Shader › Spec/Gloss on a metal texture set says so and does not change it '+JSON.stringify(s)+' message:'+said);
 /* a Specular/Glossiness project replaces the set */
 await p.evaluate(()=>__gs.p3NewProject(256,{setup:'spec',workflow:'spec',startMaterial:'neutral'}));await W(1500);
 await p.evaluate(()=>{const b=document.querySelector('.dlg .btn.primary, #dlgOk, .dlg button.ok');if(b)b.click();});await W(800);
 s=await shader();
 ok(s.wf==='spec'&&s.kind==='specgloss'&&s.maps==='base,spec,gloss,height,normal','Spec/Gloss project starts with the Spec/Gloss shader '+JSON.stringify(s));
 /* the material editor's preview and sliders follow Glossiness and Specular */
 const pv=()=>p.evaluate(()=>{const c=document.querySelector('#matEdBody .matprev');if(!c)return null;const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}return [r,g,b];});
 const setGloss=v=>p.evaluate(v=>{const i=document.getElementById('fl_v_gloss');i.value=v;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));},v);
 await p.evaluate(()=>{__gs.selectOnly(__gs.allLayers().find(L=>L.name==='Base material'));__gs.renderMatEd(true);});await W(300);
 const label=await p.evaluate(()=>[...document.querySelectorAll('#matEdBody .fillhead .nm')].map(e=>e.textContent).join('|'));
 ok(/Glossiness/.test(label)&&!/Level/.test(label),'Glossiness is labelled Glossiness');
 await setGloss('0.05');await W(400);const rough=await pv();
 await setGloss('0.95');await W(400);const shiny=await pv();
 ok(rough&&shiny&&(rough[0]!==shiny[0]||rough[1]!==shiny[1]||rough[2]!==shiny[2]),'the preview changes with Glossiness '+JSON.stringify([rough,shiny]));
 ok(await p.evaluate(()=>[...document.querySelectorAll('button,[role=tab],.dktab,.dkhead,h2,h3')].some(e=>e.textContent.trim()==='Material editor')),'the panel is called Material editor');
 const panel=await p.evaluate(()=>{__gs.selectOnly(__gs.allLayers().find(L=>L.name==='Base material'));__gs.showPanel('matEd');__gs.renderMatEd(true);const t=document.getElementById('matEdBody')?.textContent||'';return {spec:/Spec Gloss parameters/.test(t),spec2:/Specular/.test(t)&&/Glossiness/.test(t)};});
 ok(panel.spec&&panel.spec2,'Properties shows Spec Gloss inputs '+JSON.stringify(panel));
 console.log(fails?'FAILED '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
