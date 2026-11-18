/* Curvature bakes (from the shape, from the baked normal with Flip green), the Bake panel's tabs,
   and sending bakes as layers (base colour too, so they blend) or as maps only. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* a flat plate with a raised square plateau: convex rim at |x|,|y| = 0.4, concave foot at 0.55 */
function mesa(N){const v=[],f=[];for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=i/N*2-1,y=1-j/N*2,m=Math.max(Math.abs(x),Math.abs(y)),t=Math.min(1,Math.max(0,(.55-m)/.15));v.push('v '+x+' '+y+' '+(.12*t));}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i+1,b=a+1,c=a+N+1,d=c+1;f.push('f '+a+' '+c+' '+b,'f '+b+' '+c+' '+d);}return v.join('\n')+'\n'+f.join('\n');}
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:')||u.startsWith('blob:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[.5,.5,.5],'curv',false));
 await p.evaluate(txt=>{const C=__gs.bakeCfg;C.high=__gs.parseOBJ(txt,'high');C.ss=1;C.pad=4;C.front=12;C.back=12;C.rays=16;C.replace=true;},mesa(160));
 const bake=(opts,kinds)=>p.evaluate(async([opts,kinds])=>{const C=__gs.bakeCfg;Object.assign(C,opts);for(const k in C.kinds)C.kinds[k]=kinds.includes(k);
   await __gs.runBake(__gs.bakeViewModel(),kinds);return Object.keys(__gs.bk.res);},[opts,kinds]);
 const sum=()=>p.evaluate(()=>{const L=__gs.layerByName('Baked curvature'),d=__gs.readRGBA8(__gs.mapT(L,'curv'));let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s;});
 const base={curvSrc:'mesh',curvRadius:3,curvStr:1,curvEdges:1,curvCreases:1,curvParts:true,sendAs:'layers'};
 const k0=await bake(Object.assign({curvBands:null,curvMulti:true},base),['curv']);const s0=await sum();
 const k1=await bake(Object.assign({curvBands:{sharp:0,fine:0},curvMulti:false},base),['curv']);const s1=await sum();
 const k2=await bake(Object.assign({curvBands:{sharp:0,fine:0},curvMulti:true},base),['curv']);const s2=await sum();
 console.log(JSON.stringify({k0,k1,k2,s0,s1,s2}));
 ok(!k2.some(k=>/^gcurv/.test(k)),'no scale pictures are left behind in the results');
 ok(s1!==s0&&s2!==s0,'taking the sharp and fine sizes out changes the map, blurred or measured');
 ok(s2!==s1,'measuring each size from the model gives a different map than blurring one ('+s1+' vs '+s2+')');
 const nrm=await bake(Object.assign({curvBands:{sharp:0,fine:0},curvMulti:true},base,{curvSrc:'normal'}),['curv']);
 ok(nrm&&!nrm.some(k=>/^gcurv/.test(k)),'from the baked normal it works too');
 ok(!errs.length,'no errors '+errs.join('|').slice(0,300));
 await b.close();process.exit(fails?1:0);})();
