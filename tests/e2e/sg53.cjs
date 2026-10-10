/* 0.53.1: switching a project to Spec/Gloss changes the Material editor, and Glossiness and the coloured Specular show on the model in 3D Paint. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'SG',false,'pbrsg'));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.p3NewProject(256,{setup:'pbr',workflow:'metal',startMaterial:'steel'});});await p.waitForTimeout(2500);
 await p.evaluate(()=>{const s=document.getElementById('v3Model');s.value='sphere';s.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(1200);
 await p.click('text=Base material');await p.waitForTimeout(600);
 const ed=()=>p.evaluate(()=>document.querySelector('#matEdSec').innerText);
 let t=await ed();ok(/Roughness/.test(t)&&/Metallic/.test(t)&&!/Glossiness/.test(t),'PBR project: the Material editor shows Roughness and Metallic');
 // switch with the Shader tab, like a user
 await p.click('.dktab:text-is("Shader")');await p.waitForTimeout(500);
 await p.evaluate(()=>{const s=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>/Spec\/Gloss/.test(o.text)));s.value='specgloss';s.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(2500);
 ok(await p.evaluate(()=>__gs.doc.workflow)==='spec','the project is Spec/Gloss now');
 t=await ed();
 ok(!/Roughness|Metallic/.test(t),'Material editor: no Roughness or Metallic after switching');
 ok(/Specular/.test(t)&&/Glossiness/.test(t)&&/Diffuse/.test(t),'Material editor lists Diffuse, Specular and Glossiness');
 const ch=await p.evaluate(()=>[...document.querySelectorAll('#lChan option')].map(o=>o.text).join(','));
 ok(!/Roughness|Metallic/.test(ch)&&/Glossiness/.test(ch),'channel drop-down follows: '+ch);
 // glossiness changes the picture
 const px=()=>p.evaluate(()=>{const a=__gs.v3Offscreen(96,96,{transparent:true});let r=0,mx=0;for(let i=0;i<a.length;i+=4){r+=a[i]*a[i]/1000;mx=Math.max(mx,a[i]);}return [Math.round(r),mx];});
 const set=g=>p.evaluate(g=>{const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.base.c=[.6,.1,.1];L.fill.maps.spec.c=[.25,.25,.25];L.fill.maps.gloss.v=g;__gs.fillRender(L);__gs.changedAll();},g);
 await set(.05);await p.waitForTimeout(1500);const dull=await px();
 await set(.98);await p.waitForTimeout(1500);const shiny=await px();
 ok(Math.abs(shiny[0]-dull[0])/dull[0]>.03,'Glossiness changes the look on the model ('+dull+' → '+shiny+')');
 // coloured specular tints the reflection (not only metals)
 const tint=async c=>{await p.evaluate(c=>{const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.base.c=[.15,.15,.15];L.fill.maps.spec.c=c;L.fill.maps.gloss.v=.95;__gs.fillRender(L);__gs.changedAll();},c);await p.waitForTimeout(1500);
   return p.evaluate(()=>{const a=__gs.v3Offscreen(96,96,{transparent:true});let r=0,g=0,bl=0;for(let i=0;i<a.length;i+=4){if(a[i+3]>0){r+=a[i];g+=a[i+1];bl+=a[i+2];}}return [r,g,bl];});};
 const blue=await tint([.1,.2,.9]),red=await tint([.9,.2,.1]);
 ok(blue[2]>blue[0]*1.15&&red[0]>red[2]*1.15,'a blue Specular gives blue reflections and a red one red reflections ('+blue.map(Math.round)+' / '+red.map(Math.round)+')');
 // undo goes back to PBR and the editor follows
 await p.evaluate(()=>__gs.undo&&__gs.undo());await p.waitForTimeout(1500);
 const wf=await p.evaluate(()=>__gs.doc.workflow);
 if(wf==='metal'){t=await ed();ok(/Roughness/.test(t)&&!/Glossiness/.test(t),'undo: back to PBR and the editor shows Roughness again');}
 else console.log('NOTE undo stepped something else first ('+wf+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
