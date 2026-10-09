/* 0.51.31: a 3D Paint texture set switches between Metal/Rough and Specular/Gloss (convert, undo/redo, restore). */
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
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 const st=()=>p.evaluate(()=>({wf:__gs.doc.workflow,maps:__gs.doc.maps.join(),shade:__gs.doc.v3shade&&__gs.doc.v3shade.kind,layers:__gs.allLayers().map(L=>L.name).join('|')}));
 let s=await st();
 ok(s.wf==='metal'&&s.maps==='base,rough,metal,height,normal','starts as a Metal/Rough set '+JSON.stringify(s));
 /* the Shader panel's Spec/Gloss converts the set */
 await p.evaluate(()=>{__gs.showPanel('shading');const sel=document.getElementById('shKind');sel.value='specgloss';sel.dispatchEvent(new Event('change',{bubbles:true}));});await W(900);
 const dlg=await p.evaluate(()=>!document.getElementById('modal').hidden);
 if(dlg)await p.evaluate(()=>document.getElementById('dlgCancel').click());await W(900);
 s=await st();
 ok(s.wf==='spec'&&s.maps==='base,spec,gloss,height,normal'&&s.shade==='specgloss','converted to Specular/Gloss with the Spec/Gloss shader '+JSON.stringify(s));
 const groups=await p.evaluate(()=>__gs.doc.root.children.map(n=>n.name));
 ok(['Diffuse (converted)','Specular (converted)','Glossiness (converted)'].every(g=>groups.includes(g)),'one converted group per map '+groups.join('|'));
 /* undo brings the Metal/Rough maps back, redo converts again */
 await p.evaluate(()=>__gs.undo());await W(600);s=await st();
 ok(s.wf==='metal'&&s.maps==='base,rough,metal,height,normal'&&s.shade==='std','undo returns to Metal/Rough and the Standard shader '+JSON.stringify(s));
 await p.evaluate(()=>__gs.redo());await W(600);s=await st();
 ok(s.wf==='spec'&&s.shade==='specgloss','redo converts to Specular/Gloss again');
 /* switching back restores the material that was set aside */
 await p.evaluate(()=>__gs.wfSwitch('metal','restore'));await W(600);s=await st();
 ok(s.wf==='metal'&&/Base material/.test(s.layers),'switching back restores the Base material '+JSON.stringify(s));
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 console.log(fails?'FAILED '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
