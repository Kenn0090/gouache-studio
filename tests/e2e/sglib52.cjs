/* 0.52: Spec/Gloss materials in the Library (tag, corner icon), and materials converted as they are added to the other workflow. */
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
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:__dirname+'/../../assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{__gs.p3NewProject(256,{setup:'spec',workflow:'spec',startMaterial:'neutral'});});await W(1500);
 await p.evaluate(()=>{const b=document.querySelector('.dlg .btn.primary, #dlgOk, .dlg button.ok');if(b)b.click();});await W(800);
 ok(await p.evaluate(()=>__gs.doc.workflow)==='spec','a Spec/Gloss project');
 await p.evaluate(()=>__gs.showPanel('mats'));await W(500);
 const chip=await p.evaluate(()=>[...document.querySelectorAll('#matBody .chip')].map(c=>c.textContent).find(t=>/^Spec\/Gloss/.test(t)));
 ok(/Spec\/Gloss 10/.test(chip||''),'the Library has a Spec/Gloss tag with 10 materials: '+chip);
 await p.locator('#matBody .chip',{hasText:/^Spec\/Gloss/}).first().click();await W(400);
 const t=await p.evaluate(()=>({tiles:document.querySelectorAll('#matLib .mattile').length,badges:document.querySelectorAll('#matLib .mattile .sgbadge').length,thumbs:[...document.querySelectorAll('#matLib img')].filter(i=>i.naturalWidth>0).length}));
 ok(t.tiles===10&&t.badges===10&&t.thumbs===10,'ten tiles, each with the S/G icon and a picture '+JSON.stringify(t));
 await p.locator('#matSec').screenshot({path:OLD+'out/sglib.png'});
 // add the gold to this Spec/Gloss project
 await p.click('#gm_sg-gold');await p.click('#lFill');for(let i=0;i<60;i++){if(await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.name==='Gold'))break;await W(250);}
 const g=await p.evaluate(()=>{const m=__gs.doc.active.fill.maps;return {spec:m.spec.on&&m.spec.c.map(x=>+x.toFixed(2)),gloss:m.gloss.on&&m.gloss.v,metal:m.metal.on};});
 ok(g.spec&&g.spec[0]>.9&&g.spec[2]<.6&&g.spec[0]>g.spec[2]+.4&&Math.abs(g.gloss-.8)<.01&&!g.metal,'gold keeps its Specular colour and Glossiness in a Spec/Gloss project '+JSON.stringify(g));
 const cp=k=>p.evaluate(k=>{const t=__gs.compositeMap(k);const d=__gs.readRGBA8(t);__gs.release(t);const i=(100*__gs.doc.w+100)*4;return [d[i],d[i+1],d[i+2]];},k);
 const sp=await cp('spec');ok(sp[0]>220&&sp[2]<150,'the Specular map is gold '+JSON.stringify(sp));
 // a Metal/Rough library material (pictures) in this Spec/Gloss project is converted
 await p.locator('#matBody .chip',{hasText:/^Metal /}).first().click();await W(300);
 await p.click('#gm_aged-copper');await p.click('#lFill');for(let i=0;i<80;i++){if(await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.name==='Aged copper'))break;await W(300);}
 const c=await p.evaluate(()=>{const m=__gs.doc.active.fill.maps,I=__gs.doc.active._fillImg||{};return {base:m.base.on&&m.base.src,spec:m.spec.on&&m.spec.src,gloss:m.gloss.on&&m.gloss.src,rough:m.rough.on,metal:m.metal.on,imgs:Object.keys(I).sort().join()};});
 ok(c.spec==='image'&&c.gloss==='image'&&!c.rough&&!c.metal&&/gloss/.test(c.imgs)&&/spec/.test(c.imgs),'a Metal/Rough library material is converted to Specular and Glossiness pictures '+JSON.stringify(c));
 // and a Spec/Gloss material in a Metal/Rough project
 await p.evaluate(()=>__gs.wfSwitch('metal','convert'));await W(700);
 await p.locator('#matBody .chip',{hasText:/^Spec\/Gloss/}).first().click();await W(300);
 await p.click('#gm_sg-copper');await p.click('#lFill');for(let i=0;i<60;i++){if(await p.evaluate(()=>__gs.doc.active&&__gs.doc.active.name==='Copper'))break;await W(250);}
 const m=await p.evaluate(()=>{const f=__gs.doc.active.fill.maps;return {metal:f.metal.on&&f.metal.v,rough:f.rough.on&&+f.rough.v.toFixed(2),base:f.base.c.map(x=>+x.toFixed(2)),spec:f.spec.on};});
 ok(m.metal>.5&&Math.abs(m.rough-.25)<.02&&m.base[0]>m.base[2]&&!m.spec,'the copper becomes a metallic, coppery Metal/Rough material '+JSON.stringify(m));
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
