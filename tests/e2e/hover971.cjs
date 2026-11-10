/* 0.97.1 (Kenn): hovering a Textures tile, a layer or mask thumbnail, a document tab, a brush tip or a chosen picture's name
   shows a bigger preview after a short pause; it goes when the mouse leaves. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:950}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>__gs.newDoc(128,96,8,[1,1,1],'Hover',false));await W(300);
 const pop=()=>p.evaluate(()=>{const e=document.getElementById('hpvPop');if(!e)return null;const c=e.querySelector('canvas');return {name:(e.querySelector('.mpname')||{}).textContent||'',sub:(e.querySelector('.mpline')||{}).textContent||'',w:c&&c.width,h:c&&c.height,px:c?[...c.getContext('2d').getImageData(Math.floor(c.width/2),Math.floor(c.height/2),1,1).data]:null};});
 const hover=async sel=>{await p.mouse.move(5,900);await W(150);const box=await p.evaluate(s=>{const e=typeof s==='string'?document.querySelector(s):null;if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];},sel);if(!box)return 'missing';await p.mouse.move(box[0],box[1]);await W(120);const early=await pop();await W(700);return {early,late:await pop()};};
 /* a red layer with a mask */
 await p.evaluate(()=>{const G=__gs;G.cmdAddLayer();const L=G.doc.active;L.name='Red';G.clearTarget(L.target,[1,0,0,1]);G.cmdAddMask(0);G.changedAll();G.renderLayers();});await W(400);
 await p.evaluate(()=>{const L=__gs.doc.active;L.thumb.id='tLayer';L.mask.thumb.id='tMask';});
 let r=await hover('#tLayer');
 ok(r.early===null&&r.late&&r.late.name==='Red'&&r.late.px&&r.late.px[0]>200&&r.late.px[1]<40,'a layer thumbnail shows a big preview of the layer after a pause '+JSON.stringify(r));
 ok(r.late&&/128 × 96/.test(r.late.sub),'with its size');
 r=await hover('#tMask');ok(r.late&&/mask/.test(r.late.name)&&r.late.px[0]<30,'a mask thumbnail shows the mask '+JSON.stringify(r.late));
 await p.mouse.move(700,500);await W(300);ok(await pop()===null,'moving away hides it');
 /* a document tab */
 await p.evaluate(()=>{__gs.dlgNew&&0;});
 r=await hover('.dtab');ok(r.late&&r.late.name&&r.late.w>0,'a document tab shows its canvas '+JSON.stringify(r.late&&{n:r.late.name,s:r.late.sub}));
 /* a Textures tile */
 await p.evaluate(()=>__gs.showPanel('textures'));await W(800);
 r=await hover('.txtile');ok(r.late&&r.late.w>=128,'a Textures tile shows a big preview '+JSON.stringify(r.late&&{n:r.late.name,w:r.late.w,s:r.late.sub}));

 /* top half green, bottom half red: the preview keeps it the right way up (like the layer's own thumbnail) */
 await p.evaluate(()=>{const G=__gs,L=G.doc.active;L.mask=null;G.clearTarget(L.target,[1,0,0,1]);G.scissorDo?G.scissorDo([0,0,128,48],()=>G.clearTarget(L.target,[0,1,0,1])):0;G.changedAll();G.renderLayers();});await W(400);
 const thumbTop=await p.evaluate(()=>{const c=__gs.doc.active.thumb,x=c.getContext('2d');for(let y=0;y<c.height;y++){const d=x.getImageData(Math.floor(c.width/2),y,1,1).data;if(d[3]>200)return [...d];}return null;});
 await p.evaluate(()=>{__gs.doc.active.thumb.id='tLayer2';});
 r=await hover('#tLayer2');const top=await p.evaluate(()=>{const c=document.querySelector('#hpvPop canvas');return [...c.getContext('2d').getImageData(Math.floor(c.width/2),3,1,1).data];});
 ok((thumbTop[1]>thumbTop[0])===(top[1]>top[0]),'the preview is the same way up as the thumbnail '+JSON.stringify({thumbTop,top}));
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
