/* 0.28: Filter › Embroidery patch: thread colours, stitches, merrow border, height */
const {chromium}=require('playwright');
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 const {pathToFileURL}=require('node:url');
 await p.goto(pathToFileURL(require('path').resolve(__dirname,'../../dist-web/index.html')).href+'?debug');
 await p.waitForFunction(()=>!!window.__gs?.gl);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.newDoc(256,256,8,[1,1,1],'painting',false);});
 /* a picture on a transparent layer: a red disc with a blue square in it */
 await p.evaluate(()=>{__gs.act('addLayer');const L=__gs.doc.active,c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
   x.fillStyle='#d02020';x.beginPath();x.arc(128,128,100,0,7);x.fill();x.fillStyle='#2040d0';x.fillRect(90,90,76,76);x.fillStyle='#f0e020';x.fillRect(120,40,16,30);
   x.clearRect(50,119,12,18);
   x.fillStyle='rgba(208,32,32,.33)';x.fillRect(23,128,3,3);
   const g=__gs.gl;g.bindTexture(g.TEXTURE_2D,L.maps.base.tex);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,c);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);__gs.changedAll();});
 await p.evaluate(()=>__gs.act('embroidery'));
 const pal=await p.evaluate(()=>[...document.querySelectorAll('#embPal .embsw')].map(e=>e.title));
 ok(pal.length>=3&&pal.length<=8,'thread colours come from the picture '+pal.join(' '));
 const previewMaps=await p.evaluate(()=>{const G=__gs;const L=G.allLayers().find(l=>l.name==='Embroidery');
   window.embPixels=()=>G.captureRegionNow(L.maps.base,0,0,256,256).data;
   window.embOriginal=embPixels();
   return G.doc.maps.includes('height')===false;});
 ok(previewMaps,'preview does not add a Height map to the document');
 await p.locator('#embStyle').selectOption('woven');
 await p.waitForFunction(()=>embPixels().some((v,i)=>Math.abs(v-embOriginal[i])>18));
 await p.locator('#embStyle').selectOption('satin');
 await p.locator('#embPrev').uncheck();
 ok(await p.evaluate(()=>__gs.allLayers().find(l=>l.name==='Embroidery').visible===false),'the live preview can be hidden');
 await p.click('#dlgCancel');
 ok(await p.evaluate(()=>!__gs.doc.maps.includes('height')&&!__gs.allLayers().some(l=>l.name==='Embroidery')),
   'cancel removes the preview without altering maps or layers');
 await p.evaluate(()=>__gs.act('embroidery'));
 await p.locator('#modal').screenshot({path:OUT+'emb-dlg.png'});
 await p.click('#dlgOk');await W(800);
 const r=await p.evaluate(()=>{const L=__gs.doc.active,cap=t=>__gs.captureRegionNow(t,0,0,256,256).data;const B=cap(L.maps.base),H=cap(L.maps.height);
   const at=(d,x,y)=>Array.from(d.slice((y*256+x)*4,(y*256+x)*4+4));
   const half=n=>2**(((n>>10)&31)-15)*(1+(n&1023)/1024);
   /* thread stripes: along a row inside the red ring, the brightness goes up and down */
   let ups=0,prev=null;for(let x=40;x<80;x++){const v=at(B,x,128)[0];if(prev!==null&&Math.abs(v-prev)>6)ups++;prev=v;}
   let hmin=1,hmax=0;for(let x=70;x<109;x++){const h=half(at(H,x,128)[0]);hmin=Math.min(hmin,h);hmax=Math.max(hmax,h);}
   return {name:L.name,maps:Object.keys(L.maps).join(),docMaps:__gs.doc.maps.join(),corner:at(B,2,2)[3],
     hole:at(B,54,124)[3],edge:at(B,24,129)[3],mid:at(B,128,128),ups,hmin,hmax};});
 ok(r.name==='Embroidery'&&r.maps.includes('height')&&r.docMaps.includes('height'),'a new Embroidery layer with colour and Height '+JSON.stringify(r));
 ok(r.corner===0&&r.mid[3]>250&&r.mid[2]>r.mid[0],'outside the picture stays clear; the middle is stitched in blue thread');
 ok(r.hole===0&&r.edge>=78&&r.edge<=92,'the patch keeps cutouts and soft source alpha');
 ok(r.ups>=6,'the threads show as stripes ('+r.ups+' changes)');
 ok(r.hmin>.5&&r.hmax-r.hmin>.08,'the stitch crowns and grooves have distinct height');
 await p.evaluate(()=>{__gs.showPanel&&__gs.showPanel('layers');});await p.locator('#work').screenshot({path:OUT+'emb-canvas.png'});
 await p.evaluate(()=>__gs.undo());await W(100);
 ok(await p.evaluate(()=>!__gs.doc.maps.includes('height')&&!__gs.allLayers().some(l=>l.name==='Embroidery')),
   'one undo removes the patch and the Height map it added');
 await p.evaluate(()=>__gs.act('redo'));
 await p.waitForFunction(()=>__gs.doc.active.name==='Embroidery');
 ok(await p.evaluate(()=>!!__gs.doc.active.maps.height?.tex),'redo restores the same patch and Height');
 await p.evaluate(()=>__gs.undo());
 await p.evaluate(()=>{const G=__gs;G.setDocMaps(['base','rough'],'Add Roughness');G.act('embroidery');});
 await p.locator('#embStyle').selectOption('satin');
 await p.locator('#embPrev').uncheck();
 await p.click('#dlgOk');
 const rough=await p.evaluate(()=>{
   const G=__gs,L=G.doc.active,read=k=>G.captureRegionNow(L.maps[k],0,0,256,256).data;
   const B=read('base'),R=read('rough'),v=[];
   for(let x=70;x<109;x++)v.push(R[(128*256+x)*4]);
   return {variation:Math.max(...v)-Math.min(...v),sameAlpha:R.every((n,i)=>i%4!==3||n===B[i])};
 });
 ok(rough.sameAlpha&&rough.variation>25,'Roughness follows the thread pattern and silhouette when applied with preview off');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
