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
 /* Re-makes the little library pictures of assets/materials/*.gmat at 256 px, from the real images.
    Run: node gmthumbs.cjs   (writes the .gmat files in place; then npm run build) */
 const fs=require('fs'),zlib=require('zlib'),dir=require('path').resolve(__dirname,'../../assets/materials')+'/'+'/';
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const files=fs.readdirSync(dir).filter(f=>f.endsWith('.gmat')&&(!process.argv[2]||f.includes(process.argv[2])));let n=0;
 for(const f of files){const raw=fs.readFileSync(dir+f),j=JSON.parse(zlib.gunzipSync(raw).toString('utf8'));
  const url=await p.evaluate(async b64=>{const bin=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const j=await __gs.gmatParse(bin);const rec={fill:j.fill,imgs:await __gs.gmatImgs(j)};
    const c=__gs.matPreviewEl(()=>rec.fill,()=>__gs.matRecTargets(rec),256,1).el;return c.toDataURL('image/webp',0.9);},raw.toString('base64'));
  j.thumb=url;fs.writeFileSync(dir+f,zlib.gzipSync(Buffer.from(JSON.stringify(j)),{level:9}));n++;console.log(f,Math.round(url.length/1024)+' KB');}
 console.log('done',n);await b.close();
})();
