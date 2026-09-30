/* 0.21 3D Paint tab: its own canvas, layouts, painting and navigating, Alt-hover colour pick, shade arrows. */
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
 const W=ms=>p.waitForTimeout(ms||200);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{__gs.perf.on=true;const L=__gs.layerByName('Base material');__gs.doc.active=L;});await W(200);
 await p.evaluate(()=>{__gs.act('addMaskHide');});await W(500);
 await p.evaluate(()=>__gs.showPanel('color'));await setFG('#ffffff');await p.evaluate(()=>{document.activeElement.blur();Object.assign(__gs.brush,{size:40,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null});});
 await p.evaluate(()=>{const {gl,v3,brush,makeTarget}=__gs,N=32,t=makeTarget(N,N,8,false),d=new Uint8Array(N*N*4);for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(y*N+x)*4;const on=y<N/2;d[i]=d[i+1]=d[i+2]=on?255:0;d[i+3]=255;}
  gl.bindTexture(gl.TEXTURE_2D,t.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,N,N,gl.RGBA,gl.UNSIGNED_BYTE,d);
  Object.assign(brush,{size:120,hardness:1,opacity:1,flow:1,smoothing:0,tip:{tex:t.tex,w:N,h:N,name:'half'},spacing:1,angle:0,followDir:false});});
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.mouse.move(cx,cy);await p.mouse.down();await W(300);
 const half=await p.evaluate(()=>{const {gl,v3}=__gs;const M=v3.mp;if(!M)return null;const b=M.buf,w=b.w,h=b.h;const px=new Uint8Array(w*h*4);gl.bindFramebuffer(gl.FRAMEBUFFER,b.fbo||b.fb);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,px);gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  let up=0,dn=0;const cyb=h/2;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const a=px[(y*w+x)*4+3];if(a>128){if(y>cyb)up++;else dn++;}}return {up,dn,w,h};});
 await p.mouse.up();await W(300);
 console.log(JSON.stringify(half));
 ok(half&&half.up>half.dn*3,'the tip lands the right way up on screen (top part '+(half&&half.up)+' vs bottom '+(half&&half.dn)+')');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,200));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})();
