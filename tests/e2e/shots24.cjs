/* Guide pictures for 0.24 (docs/wiki/images/smart-materials.png, p3-bake.png, heal.png). */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require("path").resolve(__dirname,"../../docs/wiki/images")+"/";
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* healing: a textured picture with two flaws; the left one healed */
 await p.evaluate(()=>__gs.newDoc(320,200,8,[1,1,1],'heal',false));await W(300);
 await p.evaluate(()=>{const A=__gs.doc.active,n=320,m=200,g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(n*m*4);let s=7;const R=()=>(s=(s*16807)%2147483647)/2147483647;
   const noise=new Float32Array(n*m);for(let i=0;i<n*m;i++)noise[i]=R();
   for(let y=0;y<m;y++)for(let x=0;x<n;x++){const b=((x>>4)+(y>>3))%2,k=((y>>3)%2)*8,brick=((x+k)%32<2||y%16<2)?0.55:1;let v=(150+b*12+noise[y*n+x]*40)*brick+x*.15;
     const f1=Math.hypot(x-90,y-100)<11,f2=Math.hypot(x-230,y-100)<11;let c=[v*1.05,v*.72,v*.55];if(f1||f2)c=[40,140,60];px.set([...c.map(q=>Math.min(255,q)),255],(y*n+x)*4);}
   const T8=__gs.makeTarget(n,m,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,m,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,A.target);__gs.requestRender(true);});await W(400);
 await p.evaluate(()=>{__gs.setTool('heal');__gs.heal.mode='spot';Object.assign(__gs.brush,{size:30,hardness:.8,smoothing:0,lazy:0,pSize:false,tip:null,flow:1});__gs.act('fit');});await W(400);
 const box=await p.locator('#gl').boundingBox(),scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 {const a=await scr(84,100),c=await scr(96,100);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:6});await p.mouse.up();await W(600);}
 {const a=await scr(0,0),c=await scr(320,200);await p.mouse.move(c[0]+40,c[1]+40);await W(200);await p.screenshot({path:OUT+'heal.png',clip:{x:a[0],y:a[1],width:c[0]-a[0],height:c[1]-a[1]}});console.log('shot heal');}
 /* 3D Paint: a smart material on the model, the Materials tab showing */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:.6,pitch:.35});__gs.v3.dirty=true;__gs.showPanel('mats');});await W(300);
 await p.click('#smGrid .mattile:has-text("Gun metal")');await W(1500);
 await p.click('#smGrid .mattile:has-text("Dust")');await W(1500);
 await p.mouse.move(5,900);await W(800);await p.screenshot({path:OUT+'smart-materials.png'});console.log('shot smart-materials');
 /* the Bake mesh maps window */
 await p.evaluate(()=>__gs.showPanel('p3d'));await W(300);await p.click('#p3BakeBtn');await W(400);
 await p.locator('#modal .dialog').screenshot({path:OUT+'p3-bake.png'});console.log('shot p3-bake');await p.click('#dlgCancel');
 console.log(errs.length?'ERRORS '+errs.slice(0,3).join('\n'):'no errors');await b.close();})();
