/* 0.97.27: real skin blur (screen-space subsurface scattering, like Marmoset) */
const {chromium}=require('playwright');const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[],gle=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(/GL_INVALID|Feedback loop/.test(m.text()))gle.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await W(3000);
 await p.evaluate(()=>{const s=__gs.v3s();s.model='sphere';__gs.v3LoadModel&&__gs.v3LoadModel(true);__gs.shadeEdit(d=>{d.kind='skin';});
   const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;Object.assign(L.fill.maps.base,{on:true,src:'value',c:[.85,.6,.5]});g.fillRender(L);g.changedAll();});await W(800);
 /* a sharp stripe so a blur shows: paint a dark band into the base colour */
 await p.evaluate(()=>{const g=__gs,L=g.layerByName('Paint')||g.doc.active;g.selectOnly(L);const t=g.ensureMapTarget(L,'base');g.scissorDo([0,0,64,128],()=>g.clearTarget(t,[.1,.05,.05,1]));L.blankBase=false;g.changedAll();});await W(800);
 const shot=()=>p.evaluate(()=>{__gs.v3.dirty=true;return Array.from(__gs.v3Offscreen(240,180));});
 const set=o=>p.evaluate(o=>__gs.shadeEdit(d=>{d.p.skin=Object.assign({},__gs.shParams(d,'skin'),o);}),o);
 const diff=(a,b)=>{let d=0,n=0;for(let i=0;i<a.length;i+=4){d+=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);n++;}return d/n;};
 await set({blur:0,scatDepth:3,realH:25});await W(300);const flat0=await shot();
 await set({blur:1});await W(300);const flat1=await shot();
 ok(diff(flat0,flat1)<0.6,'painted colour detail stays sharp (only the light is blurred) '+diff(flat0,flat1).toFixed(2));
 /* bumps: height stripes make the light change from texel to texel, which the blur softens */
 await p.evaluate(()=>{const g=__gs;g.cmdAddLayer();const L=g.doc.active;const t=g.ensureMapTarget(L,'height');for(let i=0;i<16;i++)g.scissorDo([i*8,0,4,128],()=>g.clearTarget(t,[1,1,1,1]));g.doc.nrmStr=24;L.blankBase=true;g.changedAll();});await W(900);
 await p.evaluate(()=>{const s=__gs.v3s();s.sunAz=90;s.sunEl=8;s.sunI=2;s.envSun=2;});await set({blur:0,realH:6,scatDepth:4});await W(300);const off=await shot();await set({blur:1});await W(300);const on=await shot();
 ok(diff(off,on)>0.3,'Skin blur softens the light on bumps '+diff(off,on).toFixed(2));
 const corner=(a)=>[a[0],a[1],a[2]];ok(corner(off).join()===corner(on).join(),'the background is left alone '+corner(off)+' / '+corner(on));
 await set({realH:180});await W(300);const big=await shot();
 ok(diff(on,big)>0.1,'Model height changes how far the blur reaches (a bigger model blurs less on screen) '+diff(on,big).toFixed(2));
 const r=await p.evaluate(()=>__gs.skbRadius(__gs.shParams(__gs.v3ShadeOf(__gs.doc)),{h:180}));
 ok(r[0]>r[2],'red spreads further than blue '+r.map(x=>x.toFixed(2)).join(','));
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await W(300);
 ok(await p.evaluate(()=>!!document.getElementById('sh_blur')),'Skin blur and Model height are in the skin settings');
 ok(!gle.length,'no graphics errors '+gle.slice(0,2).join('|'));
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
