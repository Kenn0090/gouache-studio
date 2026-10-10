/* 0.52.3: a Spec/Gloss 3D Paint project offers Diffuse / Specular / Glossiness everywhere, and no Roughness or Metallic. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'x',false));await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{__gs.p3NewProject(256,{setup:'spec',workflow:'spec',startMaterial:'neutral'});});await W(1500);
 await p.evaluate(()=>{const o=document.querySelector('.dlg .btn.primary, #dlgOk');if(o)o.click();});await W(1500);
 const txt=sel=>p.evaluate(sel=>{const e=document.querySelector(sel);return e?e.innerText.replace(/\s+/g,' '):'';},sel);
 ok(await p.evaluate(()=>__gs.doc.workflow)==='spec','a Spec/Gloss project');
 await p.evaluate(()=>__gs.showPanel('maps'));await W(500);
 const maps=await txt('#mapList');
 ok(/Diffuse/.test(maps)&&/Specular/.test(maps)&&/Glossiness/.test(maps)&&!/Roughness|Metallic/.test(maps),'the Maps list: '+maps.slice(0,120));
 const chan=await p.evaluate(()=>[...document.getElementById('lChan').options].map(o=>o.text).join('|'));
 ok(/Specular/.test(chan)&&/Glossiness/.test(chan)&&!/Roughness|Metallic/.test(chan),'the channel list: '+chan);
 const slots=await txt('#meshMapSlots');
 ok(slots.length>50&&!/Roughness|Metallic/.test(slots),'the mesh-map slots have no Roughness or Metallic');
 await p.evaluate(()=>__gs.showPanel('tool'));await W(500);
 const tool=await txt('#toolSec,#optSec');
 ok(/Specular/.test(tool)&&/Glossiness/.test(tool)&&!/Roughness|Metallic/.test(tool),'the brush "Also paint" list: '+(tool.match(/Also paint.*/)||[''])[0].slice(0,140));
 // painting the Glossiness map works
 await p.evaluate(()=>__gs.setEditMap('gloss'));await W(300);
 ok(await p.evaluate(()=>__gs.doc.map)==='gloss','Glossiness can be chosen to paint');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
