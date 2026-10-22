/* 0.68: normal layers: Raise / Dent / Direction brushes, Smudge keeps normals unit length, converts */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message+' @'+(e.stack||'').split('\n').slice(1,4).join('<')));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:20});await p.mouse.up();await p.waitForTimeout(250);};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'nrm',false));await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 /* the layer */
 await p.evaluate(()=>{__gs.cmdNewNormalLayer();});await p.waitForTimeout(500);
 const st=await p.evaluate(()=>({maps:__gs.doc.maps.join(),nrm:__gs.isNormalLayer(__gs.doc.active),map:__gs.doc.map,view:__gs.doc.view,keys:Object.keys(__gs.doc.active.maps).join()}));
 ok(st.maps.includes('height')&&st.maps.includes('normal')&&st.nrm,'a normal layer is made and the document gets Height and Normal ('+JSON.stringify(st)+')');
 ok(st.map==='height'&&st.keys.includes('normal'),'it paints Height by default');
 await p.evaluate(()=>{__gs.doc.nrmStr=8;});
 const nrmAt=(xs,y=100)=>p.evaluate(([xs,y])=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t),W=__gs.doc.w;const r=xs.map(x=>{const i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]];});return r;},[xs,y]);
 const soft=()=>p.evaluate(()=>{Object.assign(__gs.brush,{size:80,hardness:0,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:true,edgeSat:0,glaze:0,wet:0,pickup:0,dual:null,followDir:false});__gs.np.mode='raise';__gs.np.str=.8;});
 await soft();await p.evaluate(()=>{__gs.setTool('brush');});
 await drag(60,100,240,100);
 let r=await nrmAt([75,150,225]);
 ok(r[1][0]>118&&r[1][0]<138&&r[1][2]>200,'Raise: the top of the stroke is flat-ish ('+r[1]+')');
 const ends=await p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t),W=__gs.doc.w;let l=0,u=0,dn=0;for(let x=70;x<230;x++){const i=(75*W+x)*4,j=(125*W+x)*4;u+=d[i+1];dn+=d[j+1];}return {up:u/160,down:dn/160};});
 ok(ends.up>ends.down+15,'Raise: the top edge of the stroke slopes one way and the bottom edge the other ('+ends.up.toFixed(0)+' / '+ends.down.toFixed(0)+')');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(400);
 /* dent is the opposite */
 await p.evaluate(()=>{__gs.np.mode='dent';});await drag(60,100,240,100);
 const ends2=await p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t),W=__gs.doc.w;let u=0,dn=0;for(let x=70;x<230;x++){const i=(75*W+x)*4,j=(125*W+x)*4;u+=d[i+1];dn+=d[j+1];}return {up:u/160,down:dn/160};});
 ok(ends2.up<ends2.down-15,'Dent slopes the opposite way ('+ends2.up.toFixed(0)+' / '+ends2.down.toFixed(0)+')');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(400);
 /* direction */
 await p.evaluate(()=>{__gs.np.mode='dir';__gs.np.ang=0;__gs.np.tilt=.6;Object.assign(__gs.brush,{hardness:1,buildup:false});});
 await drag(60,60,240,60);
 const dirpx=await p.evaluate(()=>{const L=__gs.doc.active,t=L.maps.normal,d=__gs.readRGBA8(t),W=__gs.doc.w,i=(60*W+150)*4,a=d[i+3];return [d[i]/a,d[i+1]/a,d[i+2]/a,a,__gs.doc.map];});
 ok(dirpx[3]>200&&dirpx[0]>.85&&Math.abs(dirpx[1]-.5)<.06&&dirpx[2]>.7&&dirpx[4]==='normal','Direction paints a tilted normal toward the right ('+dirpx.map(v=>typeof v==='number'?v.toFixed(2):v)+')');
 /* smudge keeps length */
 await p.evaluate(()=>{__gs.np.ang=180;});await drag(60,100,240,100);
 await p.evaluate(()=>{__gs.setTool('smudge');Object.assign(__gs.brush,{size:60,hardness:.8,strength:.8,charge:0,spacing:.05,paintMix:0,pSize:false,pOpacity:false});});
 await drag(150,40,150,120);
 const len=await p.evaluate(()=>{const L=__gs.doc.active,t=L.maps.normal,d=__gs.readRGBA8(t),W=__gs.doc.w;let n=0,bad=0,mn=9,mx=0;for(let y=40;y<120;y++)for(let x=130;x<170;x++){const i=(y*W+x)*4,a=d[i+3];if(a<250)continue;const v=[d[i]/a*2-1,d[i+1]/a*2-1,d[i+2]/a*2-1],l=Math.hypot(...v);n++;if(l<mn)mn=l;if(l>mx)mx=l;}return {n,mn,mx};});
 ok(len.n>300&&len.mn>.93&&len.mx<1.07,'Smudge on the normal keeps every normal unit length ('+len.n+' px, length '+len.mn.toFixed(2)+' to '+len.mx.toFixed(2)+')');

 /* gradient tool: a slope */
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'nrm2',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{__gs.cmdNewNormalLayer();__gs.doc.nrmStr=8;__gs.np.mode='raise';__gs.np.str=.8;__gs.setTool('gradient');});await p.waitForTimeout(300);
 await drag(60,100,240,100);
 const sl=await p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t),W=__gs.doc.w,at=x=>d[(100*W+x)*4];return {before:at(20),mid:at(150),after:at(270),map:__gs.doc.map};});
 ok(sl.map==='height'&&sl.mid<127&&Math.abs(sl.before-128)<6&&Math.abs(sl.after-128)<6,'the gradient tool makes a slope on a normal layer: tilted along the ramp, flat either side ('+sl.before+' / '+sl.mid+' / '+sl.after+')');
 /* selections limit it */
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'nrm3',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{__gs.cmdNewNormalLayer();__gs.doc.nrmStr=8;});await p.keyboard.press('m');await drag(0,0,150,200);
 await p.evaluate(()=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:80,hardness:0,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:true,dual:null,followDir:false,pickup:0,wet:0,glaze:0,edgeSat:0});__gs.np.mode='raise';__gs.np.str=.8;});
 await drag(30,100,270,100);
 const sx=await p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t),W=__gs.doc.w;let l=0,r=0;for(let x=60;x<140;x++)l+=Math.abs(d[(75*W+x)*4+1]-128);for(let x=160;x<240;x++)r+=Math.abs(d[(75*W+x)*4+1]-128);return {l:l/80,r:r/80};});
 ok(sx.l>5&&sx.r<2,'a selection (marquee) limits where it paints ('+sx.l.toFixed(1)+' inside, '+sx.r.toFixed(1)+' outside)');

 /* convert to AO and curvature from the normal layer */
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'nrm4',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{__gs.cmdNewNormalLayer();__gs.doc.nrmStr=8;__gs.setTool('brush');Object.assign(__gs.brush,{size:50,hardness:.3,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:true,dual:null,followDir:false,pickup:0,wet:0,glaze:0,edgeSat:0});__gs.np.mode='dent';__gs.np.str=.9;});
 await drag(60,100,240,100);
 ok(await p.evaluate(()=>__gs.mcHasSource(__gs.doc.active)),'a normal layer can be converted');
 await p.evaluate(()=>{__gs.dlgMatConvert(__gs.doc.active,['ao']);});await p.waitForTimeout(700);
 const dl=await p.evaluate(()=>({prev:!!document.querySelector('.mcprev'),ticks:[...document.querySelectorAll('#mc_ao,#mc_curv,#mc_rough')].map(e=>e.id+':'+(e.checked??e.getAttribute('aria-checked'))).join(','),title:document.querySelector('.dlg h2,.dlgtitle,[role=dialog] h2')?.textContent}));
 ok(dl.prev&&/mc_ao/.test(dl.ticks)&&!/mc_curv/.test(dl.ticks)&&!/mc_rough/.test(dl.ticks),'Convert to AO opens a window with a preview and only AO ticked ('+dl.ticks+')');
 const pvOk=await p.evaluate(()=>{const c=document.querySelector('.mcprev'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let mn=255,mx=0;for(let i=0;i<d.length;i+=4){mn=Math.min(mn,d[i]);mx=Math.max(mx,d[i]);}return mx-mn;});
 ok(pvOk>8,'the preview shows the cavity ('+pvOk+' levels of difference)');
 await p.click('#dlgOk');await p.waitForTimeout(900);
 const mk=await p.evaluate(()=>({names:__gs.allLayers().map(L=>L.name),mm:Object.keys(__gs.doc.meshMaps||{})}));
 ok(mk.names.some(n=>/AO/.test(n)),'it made a new AO layer ('+mk.names.join(' | ')+')');
 ok(mk.mm.includes('cv:ao'),'and added it to the converted mesh maps ('+mk.mm.join(',')+')');

 /* Levels on the layer's height: quick panels / adjusting the depth */
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'nrm5',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{__gs.cmdNewNormalLayer();__gs.doc.nrmStr=8;__gs.setTool('brush');Object.assign(__gs.brush,{size:70,hardness:.2,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:true,dual:null,followDir:false,pickup:0,wet:0,glaze:0,edgeSat:0});__gs.np.mode='raise';__gs.np.str=.8;});
 await drag(60,100,240,100);
 const range=()=>p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t),W=__gs.doc.w;let mx=0;for(let y=60;y<140;y++)for(let x=70;x<230;x++)mx+=Math.abs(d[(y*W+x)*4+1]-128);return Math.round(mx/100);});
 const hv=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(L.maps.height),W=__gs.doc.w;return [100,150,200].map(x=>{const i=(100*W+x)*4;return Array.from(d.slice(i,i+4)).join(',');}).join(' | ');});
 const ce=()=>p.evaluate(()=>{const t=__gs.compositeMap('height'),d=__gs.readRGBA8(t),W=__gs.doc.w;return [72,78,84,90].map(y=>d[(y*W+150)*4]).join(',');});
 const r0=await range();const hs=()=>p.evaluate(()=>{const L=__gs.doc.active,t=L.maps.height,d=__gs.readRGBA8(t);let s=0;for(let i=0;i<d.length;i+=3)s=(s*31+d[i])>>>0;return [s,t===L.target,__gs.doc.map,t.depth,t.packed];});
 await p.evaluate(()=>__gs.act('levels'));await p.waitForTimeout(500);
 await p.click('.segb:text-is("Sliders")');await p.evaluate(()=>{const s=document.querySelector('#lvG');s.value=3;s.dispatchEvent(new Event('input'));});await p.waitForTimeout(400);
 await p.click('#dlgOk');await p.waitForTimeout(600);
 const r1=await range();
 ok(r0>20&&Math.abs(r1-r0)>r0*.1,'Levels changes the depth of a normal layer ('+r0+' to '+r1+')');
 const sane=await p.evaluate(()=>{const t=__gs.normalComposite(false),d=__gs.readRGBA8(t);let bad=0;for(let i=0;i<d.length;i+=4)if(d[i+2]<110)bad++;return bad;});
 ok(sane<50,'and the normals stay sensible, no garbled pixels ('+sane+' odd pixels)');

 /* it saves with the file and survives a duplicate */
 const rt=await p.evaluate(async()=>{const b=await __gs.encodeGouache();window.__nb=await b.arrayBuffer();return window.__nb.byteLength;});
 await p.evaluate(()=>__gs.newDoc(50,50,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__nb,'t');});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>__gs.allLayers().some(L=>__gs.isNormalLayer(L))),'a normal layer is still a normal layer after saving and opening ('+rt+' bytes)');
 ok(await p.evaluate(()=>{__gs.setTool('brush');__gs.showPanel('tool');return !!document.getElementById('npStr')||!!document.getElementById('npAng');}),'the Brush panel has the Normal paint section');
 ok(await p.evaluate(()=>!!document.getElementById('lNrm')),'there is a New normal layer button');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
