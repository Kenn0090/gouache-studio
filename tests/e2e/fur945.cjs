/* 0.94.5: uneven fur, a Fur mask (painted or a picture) and a fur pattern picture (Kenn) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('CON',m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 const shot=()=>p.evaluate(()=>{__gs.v3.dirty=true;return Array.from(__gs.v3Offscreen(200,160));});
 const diff=(a,b)=>{let d=0;for(let i=0;i<a.length;i+=4)d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);return d/(a.length/4);};
 const set=o=>p.evaluate(o=>{__gs.shadeEdit(d=>{d.kind='fur';d.p.fur=Object.assign({},__gs.shParams(d,'fur'),o);});},o);
 await set({length:1,density:60,scatter:0,lenVar:0,dirVar:0,patch:0,wind:0});await W(300);const even=await shot();
 await set({scatter:1,lenVar:1,dirVar:1});await W(300);const uneven=await shot();
 ok(diff(even,uneven)>1,'random placement, length and direction change the fur '+diff(even,uneven).toFixed(2));
 await set({patch:1,patchSize:.3});await W(300);const patchy=await shot();
 ok(diff(uneven,patchy)>1,'patches change the fur '+diff(uneven,patchy).toFixed(2));
 /* the Shader panel has the new controls */
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await W(300);
 ok(await p.evaluate(()=>['sh_scatter','sh_lenVar','sh_dirVar','sh_patch','sh_patchSize','furPaint','furPic','fxdGuide'].every(id=>!!document.getElementById(id))),'the Fur look has Uneven fur, Fur mask and Fur pattern controls');
 /* Paint the fur mask: adds the map and picks it for painting; a black mask removes the fur */
 await p.evaluate(()=>document.getElementById('furPaint').click());await W(400);
 ok(await p.evaluate(()=>__gs.doc.maps.includes('fur')&&__gs.doc.map==='fur'),'Paint the fur mask adds the Fur mask map and paints it');
 await p.evaluate(()=>__gs.setView('material'));await W(300);
 const withMask=await shot();
 await set({length:0});await W(300);const nofur=await shot();await set({length:1});
 ok(diff(withMask,nofur)>3,'a white (untouched) mask keeps the fur '+diff(withMask,nofur).toFixed(2));
 await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;for(const k in L.fill.maps)L.fill.maps[k].on=false;Object.assign(L.fill.maps.fur,{on:true,src:'value',v:0});g.fillRender(L);g.changedAll();g.setView('material');});await W(900);
 const bare=await shot();
 ok(diff(bare,nofur)<diff(withMask,nofur)*0.5,'a black mask takes the fur away (close to no fur: '+diff(bare,nofur).toFixed(2)+' vs '+diff(withMask,nofur).toFixed(2)+')');
 await p.evaluate(()=>{__gs.undo();__gs.setView('material');});await W(300);
 /* a real black brush stroke on the Fur mask of the Paint layer */
 const stroke=await p.evaluate(async()=>{const G=__gs,hit=document.querySelector('#v3Hit'),r=hit.getBoundingClientRect();G.selectOnly(G.layerByName('Paint'));G.setEditMap('fur');G.setTool('brush');G.setFG([0,0,0]);Object.assign(G.brush,{size:60,opacity:1,flow:1,tip:null,pSize:false,pOpacity:false,smoothing:0});
   const e=(x,y)=>({pointerId:87,clientX:r.left+r.width*x,clientY:r.top+r.height*y,button:0,shiftKey:false,altKey:false,pointerType:'mouse',getCoalescedEvents:()=>[]});
   G.meshDown(hit,e(.5,.5));for(let i=1;i<=6;i++)G.meshMove(hit,e(.5+i*.01,.5));G.meshUp(e(.56,.5));await new Promise(r=>setTimeout(r,600));
   const c=G.compositeMap('fur'),d=G.captureRegionNow(c,0,0,c.w,c.h).data;G.release(c);let dark=0;for(let i=0;i<d.length;i+=4)if(d[i]<100)dark++;G.setView('material');return dark;});
 ok(stroke>10,'a black brush stroke on the Fur mask marks it ('+stroke+' bare pixels)');
 /* a pattern picture */
 const pat=await p.evaluate(async()=>{await __gs.txLoad();const it=__gs.fxdAllTex()[0];return it?{kind:it.kind,id:it.id,name:it.name}:null;});
 ok(!!pat,'a texture to use as the pattern '+JSON.stringify(pat));
 if(pat){
   const before=await shot();await set({gimg:pat,patStr:2,patTile:2});
   for(let i=0;i<20&&!(await p.evaluate(()=>!!__gs.fxdGuideTex(__gs.shParams(__gs.doc.v3shade,'fur'))));i++)await W(300);
   await W(300);const after=await shot();ok(diff(before,after)>1,'the fur pattern picture shapes the fur '+diff(before,after).toFixed(2));}
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
