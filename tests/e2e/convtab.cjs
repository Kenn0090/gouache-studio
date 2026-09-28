const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({acceptDownloads:true,viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const avg=k=>p.evaluate(k=>{const t=__gs.cv.res[k];if(!t)return null;const d=__gs.readRGBA8(t);let s=[0,0,0],n=0;for(let i=0;i<d.length;i+=16){s[0]+=d[i];s[1]+=d[i+1];s[2]+=d[i+2];n++;}return s.map(v=>Math.round(v/n));},k);
 const sig=k=>p.evaluate(k=>{const t=__gs.cv.res[k];const d=__gs.readRGBA8(t);let h=0;for(let i=0;i<d.length;i+=40)h=(h*31+d[i]+d[i+1]*7)%1000003;return h;},k);
 await p.evaluate(()=>__gs.newDoc(512,512,8,[1,1,1],'Conv',false));await W();
 await setFG('#b06a36');await p.evaluate(()=>{__gs.ui.bg=[.2,.27,.35];});
 await p.evaluate(()=>__gs.act('clouds'));await W(400);await p.click('#dlgOk');await W(300);
 await p.click('#modeTabs [data-mode=convert]');await W(800);
 let st=await p.evaluate(()=>({mode:__gs.ui.mode,kind:__gs.cv.kind,src:!!__gs.cv.src,res:Object.keys(__gs.cv.res),sec:getComputedStyle(document.querySelector('#convSec')).display}));
 ok(st.mode==='convert'&&st.src&&st.kind==='photo'&&st.sec!=='none','Convert tab opens on the base colour as a photo '+JSON.stringify(st));
 ok(st.res.includes('normal')&&st.res.includes('height')&&st.res.includes('ao'),'normal, height and AO made');
 const nA=await avg('normal'),hA=await avg('height');ok(nA[2]>200&&Math.abs(nA[0]-128)<30,'normal is bluish '+nA);ok(Math.abs(hA[0]-hA[1])<3&&Math.abs(hA[1]-hA[2])<3,'height is grey '+hA);
 const aA=await avg('ao');ok(Math.abs(aA[0]-aA[2])<3,'AO is grey '+aA);
 await W(300);ok(await p.evaluate(()=>!!__gs.cv.thumbs&&__gs.cv.thumbs.length===2),'bumps out / in previews');
 const s0=await sig('normal');await p.click('.cvthumb:nth-child(2)');await W(400);const s1=await sig('normal');ok(s0!==s1,'choosing "bumps in" changes the normal');
 await p.evaluate(()=>{const s=document.querySelector('#cv_normal_large');s.value=1;s.dispatchEvent(new Event('input'));});await W(400);ok(await sig('normal')!==s1,'detail slider updates the normal live');
 await p.screenshot({path:OUT+'convtab.png'});
 // roughness, metal with a picked colour
 await p.check('#cvMk_metal');await p.evaluate(()=>{const b=[...document.querySelectorAll('#convBody .seg button')].find(b=>b.textContent==='Metallic');b.click();});await W(300);
 await p.click('text=Pick a colour');await W(150);const a=await scr(100,100);await p.mouse.click(a[0],a[1]);await W(500);
 const mt=await p.evaluate(()=>({keys:__gs.cv.keys.metal.length}));const mA=await avg('metal');ok(mt.keys===1&&mA[0]>5,'picked colour becomes metal '+JSON.stringify(mt)+' '+mA);
 // base colour cleanup
 await p.check('#cvMk_base');await p.evaluate(()=>{const b=[...document.querySelectorAll('#convBody .seg button')].find(b=>b.textContent==='Base');b.click();});await W(400);ok(!!(await avg('base')),'base colour cleanup made');
 // straighten + seamless
 await p.evaluate(()=>{document.querySelector('details.more').open=true;});await p.check('#cvPersp');await W(300);
 const c0=await scr(40,40),c1=await scr(90,70);await p.mouse.move(c0[0],c0[1]);await p.mouse.down();await p.mouse.move(c1[0],c1[1],{steps:5});await p.mouse.up();await W(400);
 const q=await p.evaluate(()=>__gs.cv.persp.q[0].map(Math.round));ok(Math.abs(q[0]-90)<3&&Math.abs(q[1]-70)<3,'perspective corner dragged '+q);
 await p.screenshot({path:OUT+'convtab-persp.png'});
 await p.click('text=Done moving corners');await p.check('#cvSeam');await W(400);
 // send
 await p.click('#cvSend');await W(400);let g=await p.evaluate(()=>__gs.inPaint(()=>({g:__gs.doc.root.children.filter(n=>n.converted).map(n=>n.name),groups:__gs.doc.root.children.filter(n=>n.type==='group').length,maps:__gs.doc.maps.join()})));
 ok(g.g.includes('Converted normal')&&g.g.includes('Converted metallic')&&g.maps.includes('metal')&&g.groups===0,'sent to the painting: one plain layer per map '+JSON.stringify(g));
 await p.click('#cvSend');await W(300);ok((await p.evaluate(()=>__gs.inPaint(()=>__gs.doc.root.children.filter(n=>n.converted).length)))===g.g.length,'sending again replaces');
 // export
 const dl=p.waitForEvent('download',{timeout:15000}).catch(()=>null);await p.click('#cvExport');const d=await dl;ok(!!d&&/maps\.zip$/.test(d.suggestedFilename()),'export gives a zip '+(d&&d.suggestedFilename()));
 // normal source: detected as normal (OpenGL); DirectX version detected too
 await p.evaluate(()=>__gs.cvSourceFromDoc('normal'));await W(600);st=await p.evaluate(()=>({kind:__gs.cv.kind,dx:__gs.cv.dx,guess:__gs.cv.guess,res:Object.keys(__gs.cv.res)}));
 ok(st.kind==='normal'&&st.dx===false,'normal map source detected (OpenGL) '+JSON.stringify(st));
 await p.evaluate(()=>{__gs.cvSetKind('normal');});await W(900);ok(!!(await avg('height')),'height rebuilt from the normal map');
 await p.evaluate(()=>{__gs.cvSetKind('photo');__gs.cvSourceFromDoc('base');__gs.cv.v.normal.dx=true;__gs.cvSetKind('photo');});await W(500);await p.evaluate(()=>{__gs.cv.make={normal:true};});await p.click('#cvSend');await W(300);
 await p.evaluate(()=>__gs.cvSourceFromDoc('normal'));await W(500);st=await p.evaluate(()=>({kind:__gs.cv.kind,dx:__gs.cv.dx}));ok(st.kind==='normal'&&st.dx===true,'DirectX normal map detected '+JSON.stringify(st));
 // Maps menu opens the tab
 await p.click('#modeTabs [data-mode=paint]');await W(300);await p.evaluate(()=>__gs.act('cvAO'));await W(600);
 st=await p.evaluate(()=>({mode:__gs.ui.mode,tab:__gs.cv.tab,kind:__gs.cv.kind}));ok(st.mode==='convert'&&st.tab==='ao'&&st.kind==='height','Maps › AO from height opens the Convert tab on AO '+JSON.stringify(st));
 ok(errs.length===0,'no errors '+errs.join('\n'));console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
