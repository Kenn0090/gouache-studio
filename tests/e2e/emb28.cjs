/* 0.28: Filter › Embroidery patch: thread colours, stitches, merrow border, height */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
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
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'painting',false));await W(300);
 /* a picture on a transparent layer: a red disc with a blue square in it */
 await p.evaluate(()=>{__gs.act('addLayer');const L=__gs.doc.active,c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
   x.fillStyle='#d02020';x.beginPath();x.arc(128,128,100,0,7);x.fill();x.fillStyle='#2040d0';x.fillRect(90,90,76,76);x.fillStyle='#f0e020';x.fillRect(120,40,16,30);
   const g=__gs.gl;g.bindTexture(g.TEXTURE_2D,L.maps.base.tex);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);g.texSubImage2D(g.TEXTURE_2D,0,0,0,g.RGBA,g.UNSIGNED_BYTE,c);g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);__gs.changedAll();});await W(400);
 await p.evaluate(()=>__gs.act('embroidery'));await W(1500);
 const pal=await p.evaluate(()=>[...document.querySelectorAll('#embPal .embsw')].map(e=>e.title));
 ok(pal.length>=3&&pal.length<=6,'thread colours come from the picture '+pal.join(' '));
 await p.locator('#modal').screenshot({path:OUT+'emb-dlg.png'});
 await p.click('#dlgOk');await W(800);
 const r=await p.evaluate(()=>{const L=__gs.doc.active,cap=t=>__gs.captureRegionNow(t,0,0,256,256).data;const B=cap(L.maps.base),H=cap(L.maps.height);
   const at=(d,x,y)=>Array.from(d.slice((y*256+x)*4,(y*256+x)*4+4));
   /* thread stripes: along a row inside the red ring, the brightness goes up and down */
   let ups=0,prev=null;for(let x=40;x<80;x++){const v=at(B,x,128)[0];if(prev!==null&&Math.abs(v-prev)>6)ups++;prev=v;}
   let hmin=255,hmax=0;for(let x=30;x<226;x+=2){const h=at(H,x,128)[0];hmin=Math.min(hmin,h);hmax=Math.max(hmax,h);}
   return {name:L.name,maps:Object.keys(L.maps).join(),docMaps:__gs.doc.maps.join(),corner:at(B,2,2)[3],mid:at(B,128,128),ups,hmin,hmax};});
 ok(r.name==='Embroidery'&&r.maps.includes('height')&&r.docMaps.includes('height'),'a new Embroidery layer with colour and Height '+JSON.stringify(r));
 ok(r.corner===0&&r.mid[3]>250&&r.mid[2]>r.mid[0],'outside the picture stays clear; the middle is stitched in blue thread');
 ok(r.ups>=6,'the threads show as stripes ('+r.ups+' changes)');
 ok(r.hmax-r.hmin>r.hmax*.1,'the stitches have height ('+r.hmin+'…'+r.hmax+')');
 await p.evaluate(()=>{__gs.showPanel&&__gs.showPanel('layers');});await p.locator('#work').screenshot({path:OUT+'emb-canvas.png'});
 await p.evaluate(()=>__gs.act('undo'));await W(300);ok(await p.evaluate(()=>__gs.doc.active.name!=='Embroidery'&&!__gs.allLayers().some(l=>l.name==='Embroidery')),'undo removes it');
 console.log(errs.length?errs.join('\n'):'no page errors');ok(!errs.length,'no page errors');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
