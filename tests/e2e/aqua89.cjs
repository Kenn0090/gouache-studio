/* 0.89: the Watercolour studio set (36 brushes in 7 groups), bloom/backrun, salt, lift-off, stamps with pooled edges, and the two palettes. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 const fresh=async()=>{await p.evaluate(()=>__gs.newDoc(400,400,8,[1,1,1],'Aqua',false,'hand'));await p.waitForTimeout(350);await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
   return p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});};
 let box=await fresh();const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const counts=await p.evaluate(()=>{const s=__gs.library.filter(x=>/^aqua/.test(x.id));return {sets:s.length,n:s.reduce((a,x)=>a+x.presets.length,0),names:s.map(x=>x.name+' '+x.presets.length)};});
 console.log(counts.names.join(' | '));
 ok(counts.sets===7&&counts.n===36,'the Watercolour studio has 7 groups and 36 brushes ('+counts.sets+', '+counts.n+')');
 const use=(n,extra)=>p.evaluate(([n,e])=>{__gs.setTool('brush');const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name===n);__gs.applyPreset(q);Object.assign(__gs.brush,e||{});__gs.ui.fg=[.15,.25,.55];},[n,extra]);
 const drag=async(x0,y0,x1,y1)=>{const a=at(x0,y0),z=at(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:22});await p.mouse.up();await p.waitForTimeout(250);};
 const alphaAt=(x,y)=>p.evaluate(([x,y])=>__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3],[x,y]);
 const inkOf=(x0,x1,y0,y1,step=3)=>p.evaluate(([x0,x1,y0,y1,st])=>{const o=[];for(let x=x0;x<=x1;x+=st)for(let y=y0;y<=y1;y+=st)o.push(__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3]);const m=o.reduce((a,b)=>a+b)/o.length;return {m,sd:Math.sqrt(o.reduce((a,b)=>a+(b-m)*(b-m),0)/o.length)};},[x0,x1,y0,y1,step]);
 // every brush paints (or erases) something without errors
 const all=await p.evaluate(()=>__gs.library.filter(x=>/^aqua/.test(x.id)).flatMap(x=>x.presets.map(q=>q.name)));
 const failed=[];
 for(const n of all){box=await fresh();const erase=await p.evaluate(n=>{const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name===n);return q.tool==='erase';},n);
   if(erase){await use('Paint marker',{size:90,drip:0,dripAuto:0});await drag(40,200,360,200);}
   await use(n,{drip:0,dripAuto:0});const before=erase?await inkOf(40,360,150,250,6):{m:0};await drag(60,200,340,200);const after=await inkOf(40,360,150,250,6);
   const changed=erase?after.m<before.m-1:after.m>1;if(!changed)failed.push(n+' ('+before.m.toFixed(1)+'→'+after.m.toFixed(1)+')');}
 console.log('brushes that did nothing:',failed.join(', ')||'none');
 ok(failed.length===0,'every one of the 36 brushes changes the picture ('+failed.length+' did not)');
 // bloom: a backrun makes the wash patchy with lighter areas
 box=await fresh();await use('Bloom (backrun)',{size:130,drip:0});await p.evaluate(()=>{__gs.brush.mixTooth=0;});await drag(40,200,360,200);const wb=await inkOf(80,320,150,250);
 box=await fresh();await use('Bloom (backrun)',{size:130,mixWCBloom:0,drip:0});await p.evaluate(()=>{__gs.brush.mixTooth=0;});await drag(40,200,360,200);const wn=await inkOf(80,320,150,250);
 console.log('bloom spread',wb.sd.toFixed(1),'no bloom',wn.sd.toFixed(1));ok(wb.sd>wn.sd+3,'the bloom makes a lighter, uneven patch with a darker edge');
 // salt lightens a wash in small spots
 box=await fresh();await use('Paint marker',{size:140,drip:0,dripAuto:0});await drag(40,200,360,200);const full=await inkOf(80,320,160,240);
 await use('Salt');await drag(50,200,350,200);const salted=await inkOf(80,320,160,240);
 ok(salted.m<full.m-8&&salted.sd>full.sd+10,'salt leaves light spots in the paint ('+full.m.toFixed(0)+' to '+salted.m.toFixed(0)+')');
 // a stamp has pigment pooled along its edge
 box=await fresh();await use('Stamp · Blob',{size:180});{const a=at(200,200);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.up();await p.waitForTimeout(300);}
 const rim=await p.evaluate(()=>{const L=__gs.doc.active;let mx=0,cnt=0;const bins=[];for(let r=0;r<=100;r+=4){let s=0,n=0;for(let a=0;a<360;a+=15){const x=200+Math.cos(a*Math.PI/180)*r,y=200+Math.sin(a*Math.PI/180)*r;s+=__gs.captureRegionNow(L.target,Math.round(x),Math.round(y),1,1).data[3];n++;}bins.push(s/n);}return bins;});
 const mid=rim.slice(0,8).reduce((a,b)=>a+b)/8,edge=Math.max(...rim.slice(8));console.log('stamp radial alpha',rim.map(v=>Math.round(v)).join(','));
 ok(edge>mid+25,'a stamp is darker along its edge than inside ('+Math.round(mid)+' inside, '+Math.round(edge)+' at the edge)');
 // palettes
 const pal=await p.evaluate(()=>{__gs.cmUsePalette('watercolour-pans');const a=__gs.cmSw.length;__gs.cmUsePalette('ink-set');return {a,b:__gs.cmSw.length,has:!!__gs.CM_GAME_PALETTES['watercolour-pans']&&!!__gs.CM_GAME_PALETTES['ink-set']};});
 ok(pal.has&&pal.a===24&&pal.b===12,'the Watercolour pans (24) and Ink set (12) palettes are in the swatches');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
