/* 0.52.2: no shader may use more than 16 textures. Many Windows graphics cards stop at 16, and a shader over it fails to compile while the app starts
   (the 3D viewer shader had 17 in 0.51.31 and 0.52.0/0.52.1: the app stayed on the loading screen). Software renderers allow more, so this counts them. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.addInitScript(()=>{window.__big=[];window.__maxU=0;window.__nProg=0;const P=WebGL2RenderingContext.prototype,src=new WeakMap(),oss=P.shaderSource,ola=P.attachShader,olp=P.linkProgram,sh=new WeakMap();
  P.shaderSource=function(s,t){src.set(s,t);return oss.call(this,s,t);};
  P.attachShader=function(pr,s){(sh.get(pr)||sh.set(pr,[]).get(pr)).push(s);return ola.call(this,pr,s);};
  P.linkProgram=function(pr){olp.call(this,pr);try{window.__nProg++;const fs=(sh.get(pr)||[]).map(s=>src.get(s)||'').find(t=>/void main/.test(t)&&!/gl_Position/.test(t))||'';
    const n=(fs.match(/uniform\s+(?:highp\s+|lowp\s+|mediump\s+)?sampler\w+\s+[^;]+;/g)||[]).reduce((a,d)=>a+d.replace(/^[^;]*?sampler\w+\s+/,'').split(',').length,0);
    if(n>window.__maxU)window.__maxU=n;if(n>16)window.__big.push(n+': '+fs.slice(0,120).replace(/\s+/g,' '));}catch(e){}};});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(4000);
 const rep=()=>p.evaluate(()=>({max:__maxU,programs:__nProg,big:__big}));
 let r=await rep();ok(r.programs>20&&r.max<=16&&!r.big.length,'start-up: '+r.programs+' shaders, at most '+r.max+' textures each '+JSON.stringify(r.big));
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'x',false));
 for(const m of ['p3d','bake','convert']){await p.click('#modeTabs [data-mode='+m+']').catch(()=>{});await p.waitForTimeout(2000);}
 r=await rep();ok(r.max<=16&&!r.big.length,'after 3D Paint, Bake and Convert: at most '+r.max+' textures in any shader '+JSON.stringify(r.big));
 // Spec/Gloss on the model still shows the Specular colour
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>__gs.wfSwitch('spec','convert'));await p.waitForTimeout(1500);
 const avg=()=>p.evaluate(()=>{const px=__gs.v3Offscreen(64,64,{transparent:true});let r=0,g=0,n=0;for(let i=0;i<px.length;i+=4)if(px[i+3]>200){r+=px[i];g+=px[i+1];n++;}return [r/n,g/n];});
 const a0=await avg();
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Base material');L.fill.maps.spec.c=[1,0,0];__gs.fillRender(L);__gs.changedAll();});await p.waitForTimeout(1500);
 const a1=await avg();ok(a1[0]-a0[0]>5&&Math.abs(a1[1]-a0[1])<3,'a red Specular tints the reflections on the model '+JSON.stringify([a0,a1]));
 r=await rep();ok(r.max<=16&&!r.big.length,'still at most 16 textures with Spec/Gloss on '+r.max);
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
