/* 0.80.2: padding on texture export: dilation grows the UV islands outward; fill the rest; transparent; none */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1400,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errors=[];p.on('pageerror',e=>errors.push(e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 /* a test map: white inside the UV islands, black outside; padded copies counted */
 const run=mode=>p.evaluate(mode=>{const G=__gs,C=G.texCfg;C.pad=mode;C.padPx=4;C.size=0;const ctx=G.texPadBegin(G.doc.w);if(!ctx)return null;
   const T=G.acquire();G.blit(ctx.mask,T,0,0,G.doc.w,G.doc.h,0,0);const P=G.texPadT(ctx,T,true);const w=G.doc.w,h=G.doc.h,a=G.captureRegionNow(T,0,0,w,h).data,d=G.captureRegionNow(P,0,0,w,h).data;
   const sc=a instanceof Float32Array?255:1;let in0=0,in1=0,trans=0,opaqueFar=0;for(let i=0;i<a.length;i+=4){if(a[i]*sc>128)in0++;if(d[i]*sc>128&&d[i+3]*sc>128)in1++;if(d[i+3]*sc<10)trans++;}
   G.release(T);if(P!==T)G.release(P);G.texPadEnd(ctx);return {in0,in1,trans,n:w*h};},mode);
 ok(await p.evaluate(()=>{__gs.texCfg.pad='none';return __gs.texPadBegin(__gs.doc.w)===null;}),'None leaves the maps as painted');
 const d=await run('dilate');console.log('  dilate 4 px:',JSON.stringify(d));
 ok(d&&d.in1>d.in0*1.02&&d.in1<d.n*.98,'Dilation grows the islands outward a few pixels ('+d.in0+' → '+d.in1+' of '+d.n+')');
 const d8=await p.evaluate(()=>0);
 const inf=await run('dilate+inf');ok(inf&&inf.in1>inf.n*.995,'Dilation + fill the rest fills the whole picture ('+inf.in1+' of '+inf.n+')');
 const tr=await run('dilate+trans');ok(tr&&tr.trans>tr.n*.05&&tr.in1>tr.in0,'Dilation + transparent: grown islands, see-through beyond ('+tr.trans+' transparent)');
 const all=await run('inf');ok(all&&all.in1>all.n*.995,'Fill everything');
 /* bigger dilation reaches further */
 const big=await p.evaluate(()=>{const G=__gs,C=G.texCfg;C.pad='dilate';C.padPx=12;const ctx=G.texPadBegin(G.doc.w);const T=G.acquire();G.blit(ctx.mask,T,0,0,G.doc.w,G.doc.h,0,0);const P=G.texPadT(ctx,T,true);
   const d=G.captureRegionNow(P,0,0,G.doc.w,G.doc.h).data,sc=d instanceof Float32Array?255:1;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]*sc>128)n++;G.release(T);G.release(P);G.texPadEnd(ctx);return n;});
 ok(big>d.in1,'a wider dilation reaches further ('+d.in1+' → '+big+')');
 /* a whole export with padding on */
 const files=await p.evaluate(async()=>{const G=__gs;G.texCfg.pad='dilate+inf';G.texCfg.padPx=16;const fs=await G.buildTextures(G.TEX_PRESETS.unreal,'Pad');return fs.map(f=>f.name+':'+f.data.length);});
 ok(files.length>=3&&files.every(f=>+f.split(':')[1]>100),'an export runs with padding: '+files.join(', '));
 /* the dialog */
 await p.evaluate(()=>__gs.dlgExportTextures());await p.waitForTimeout(400);
 ok(await p.locator('#txPad').count()===1&&await p.locator('#txPadPx').count()===1&&await p.locator('#txPadPx_def').count()===1,'the export window has Padding and a Dilation width (with its default button)');
 /* (Kenn) the viewport's Lit / Unlit / Ray traced work while a layer's settings window is open */
 await p.keyboard.press('Escape');await p.waitForTimeout(300);
 await p.evaluate(()=>__gs.cmdNewHandPaintLayer());await p.waitForTimeout(600);
 await p.getByRole('button',{name:'Unlit',exact:true}).first().click();await p.waitForTimeout(300);
 const un=await p.evaluate(()=>__gs.v3s().channelView);ok(un==='base','Unlit works with the settings open ('+un+')');
 await p.getByRole('button',{name:'Lit',exact:true}).first().click();await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!__gs.v3s().channelView&&!__gs.v3.rt),'and Lit');
 await p.getByRole('button',{name:'Ray traced',exact:true}).first().click();await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!__gs.v3.rt),'and Ray traced');
 await p.getByRole('button',{name:'Lit',exact:true}).first().click();await p.waitForTimeout(300);
 ok(await p.locator('#fxUndo').count()===1,'and the settings window stays open');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
