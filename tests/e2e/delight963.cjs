/* 0.96.3 (Kenn): De-light filter in Paint (Filter › Adjust, gallery, filter layers) */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 /* an orange checker texture lit dark on the left, bright on the right */
 await p.evaluate(()=>{const G=__gs;G.newDoc(256,128,8,[1,1,1],'dl',false);const c=document.createElement('canvas');c.width=256;c.height=128;const x=c.getContext('2d');
   for(let yy=0;yy<128;yy+=8)for(let xx=0;xx<256;xx+=8){const k=((xx+yy)/8)%2?1:.8,l=.25+.75*xx/256;x.fillStyle='rgb('+[200,130,70].map(v=>Math.round(v*k*l)).join(',')+')';x.fillRect(xx,yy,8,8);}
   const d=x.getImageData(0,0,256,128).data,L=G.doc.active,tex=G.uploadStraight({w:256,h:128,data:d,bits:8});G.premultInto(L.target,tex,[0,0],null);G.requestRender(true);});
 const side=()=>p.evaluate(()=>{const G=__gs,t=G.doc.active.target,d=G.captureRegionNow(t,0,0,t.w,t.h).data,avg=(x0,x1)=>{let s=0,n=0;for(let y=0;y<128;y++)for(let x=x0;x<x1;x++){const i=(y*256+x)*4;s+=.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];n++;}return s/n;};return [avg(8,48),avg(208,248)];});
 const before=await side();
 ok(await p.evaluate(()=>JSON.stringify(__gs.MENUS).includes('"De-light…","delight"')),'Filter › Adjust has De-light…');
 await p.evaluate(()=>__gs.act('delight'));await p.waitForTimeout(800);
 ok(await p.isVisible('#fx_even')&&await p.isVisible('#fx_r'),'the window has Even out lighting and Lighting size');
 await p.click('#dlgOk');await p.waitForTimeout(800);
 const after=await side();
 const r0=before[0]/before[1],r1=after[0]/after[1];
 ok(r1>r0+.2,'the dark side and the bright side come closer (left/right '+r0.toFixed(2)+' → '+r1.toFixed(2)+')');
 ok(await p.evaluate(()=>{const G=__gs,g=document.body.textContent;return !!G.FX.delight&&G.fxDefaults(G.FX.delight).even===.6;}),'it is a regular filter with its defaults (also in the gallery and filter layers)');
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
