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
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const IDS=[['glass'],['glass','Ribbed'],['glass','Overlay'],['softFocus'],['acid'],['acid','Glitch trails'],['halftone'],['halftone','Wavy lines'],['engraving'],['riso'],['bwPrint'],['watercolour'],['charcoal'],['driftBlur'],['pixelBitmap'],['pixelBitmap','1-bit'],['anaglyph'],['cineMono'],['kuwahara'],['none']];
 await p.evaluate(()=>{window.__sheet=[];__gs.act('flatten');});await W(500);
 for(const [id,mode] of IDS){
  if(id!=='none'){await p.evaluate(id=>__gs.act(id),id);await W(400);if(mode)await p.click('#dlgBody .seg button:text("'+mode+'")');await W(300);await p.click('#dlgOk');await W(300);}
  await p.evaluate(label=>{const t=__gs.compositeMap('base');const d=__gs.readRGBA8(t);__gs.release(t);const W=__gs.doc.w,H=__gs.doc.h;const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');const im=x.createImageData(W,H);
    for(let i=0;i<d.length;i+=4){const a=d[i+3]||1;im.data[i]=d[i]*255/a;im.data[i+1]=d[i+1]*255/a;im.data[i+2]=d[i+2]*255/a;im.data[i+3]=255;}x.putImageData(im,0,0);
    const s=document.createElement('canvas');s.width=s.height=300;s.getContext('2d').drawImage(c,W*.25,H*.25,W*.5,H*.5,0,0,300,300);window.__sheet.push([label,s]);},(id==='none'?'original':id)+(mode?' · '+mode:''));
  if(id!=='none'){await p.evaluate(()=>__gs.undo());await W(250);}}
 await p.evaluate(()=>{const o=document.createElement('div');o.style.cssText='position:fixed;inset:0;z-index:999;background:#15171b;display:grid;grid-template-columns:repeat(5,300px);gap:10px 12px;padding:14px;align-content:start;overflow:hidden;font:13px sans-serif;color:#ddd';
   for(const [l,c] of window.__sheet){const d=document.createElement('div');d.append(c);const t=document.createElement('div');t.textContent=l;d.append(t);o.append(d);}document.body.append(o);});
 await p.setViewportSize({width:1600,height:1340});await W(300);await p.screenshot({path:OUT+'fx17-sheet.png'});
 await b.close();})();
