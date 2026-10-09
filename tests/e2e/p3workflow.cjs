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
 ok(/^Base material\|Paint$/.test(s.layers),'the layers stay as they were, nothing stacked on top '+s.layers);
 /* the material stays live: its Specular colour is editable and shows in the Specular map and on the model */
 const cp=k=>p.evaluate(k=>{const t=__gs.compositeMap(k);const d=__gs.readRGBA8(t);__gs.release(t);const i=(100*__gs.doc.w+150)*4;return [d[i],d[i+1],d[i+2]];},k);
 const fillOn=await p.evaluate(()=>{const m=__gs.allLayers().find(L=>L.name==='Base material').fill.maps;return {spec:m.spec.on,gloss:m.gloss.on,rough:m.rough.on,metal:m.metal.on};});
 ok(fillOn.spec&&fillOn.gloss&&!fillOn.rough&&!fillOn.metal,'the material now has Specular and Glossiness, not Metal/Rough '+JSON.stringify(fillOn));
 const shot=async()=>{const bx=await p.locator('#v3Hit').boundingBox();return (await p.screenshot({clip:{x:bx.x+bx.width/2-60,y:bx.y+bx.height/2-60,width:120,height:120}})).toString('base64');};
 const before=await shot();const s0=await cp('spec');
 await p.evaluate(()=>{const L=__gs.allLayers().find(L=>L.name==='Base material');__gs.selectOnly(L);__gs.showPanel('matEd');__gs.renderMatEd(true);});await W(400);
 await p.evaluate(()=>{const b=document.getElementById('fl_c_spec');b&&b.click();});await W(300);
 await p.evaluate(()=>{const h=document.getElementById('cp_hex');if(h){h.value='#ff2000';h.dispatchEvent(new Event('input',{bubbles:true}));h.dispatchEvent(new Event('change',{bubbles:true}));h.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));}});await W(900);
 const s1=await cp('spec');
 ok(s1[0]>200&&s1[1]<80&&s1[0]>s0[0]+100,'changing the Specular colour changes the Specular map '+JSON.stringify([s0,s1]));
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();document.body.click();});await W(900);
 const after=await shot();
 ok(before!==after,'and the model in the 3D view changes');
 /* switching back converts again */
 await p.evaluate(()=>__gs.wfSwitch('metal','convert'));await W(600);s=await st();
 ok(s.wf==='metal'&&s.shade==='std'&&/^Base material\|Paint$/.test(s.layers),'switching back converts the material again '+JSON.stringify(s));
 const m=await p.evaluate(()=>{const f=__gs.allLayers().find(L=>L.name==='Base material').fill.maps;return {metal:f.metal.on&&f.metal.v,rough:f.rough.on,base:f.base.c};});
 ok(m.metal>.5&&m.rough,'the red Specular became a coloured metal '+JSON.stringify(m));
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 console.log(fails?'FAILED '+fails:'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
