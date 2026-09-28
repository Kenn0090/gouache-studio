/* 0.24: heal brushes: spot healing and the healing brush (Alt+click source), on every map of the layer, inside the selection, with symmetry, undo; and on the model in 3D Paint. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.removeItem('gs.heal');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:8});await p.mouse.up();await W(300);};
 /* stripes (period 8) getting brighter to the right; red squares = flaws; the height map has the same stripes and white flaws */
 const setup=spots=>p.evaluate(spots=>{const A=__gs.doc.active,n=__gs.doc.w,g=document.querySelector('#gl').getContext('webgl2');
   const up=(T,f)=>{const px=new Uint8Array(n*n*4);for(let y=0;y<n;y++)for(let x=0;x<n;x++)px.set(f(x,y),(y*n+x)*4);const T8=__gs.makeTarget(n,n,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,T);T.empty=false;};
   const bad=(x,y)=>spots.some(([cx,cy])=>Math.abs(x-cx)<=5&&Math.abs(y-cy)<=5);
   up(__gs.mapT(A,'base'),(x,y)=>{if(bad(x,y))return [230,20,20,255];const v=(x%8<4?60:140)+x*.6|0;return [v,v,v,255];});
   up(__gs.ensureMapTarget(A,'height'),(x,y)=>bad(x,y)?[255,255,255,255]:(x%8<4?[90,90,90,255]:[170,170,170,255]));A.lookVer=(A.lookVer||0)+1;__gs.requestRender(true);},spots);
 const px=(k,pts)=>p.evaluate(([k,pts])=>{const A=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(A,k)),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[k,pts]);
 const red=c=>c[0]-c[1]>80;
 await p.evaluate(()=>{__gs.newDoc(128,128,8,[1,1,1],'heal',false);__gs.setDocMaps(['base','rough','metal','height','normal'],'maps');});await W(300);
 await p.evaluate(()=>{__gs.act('addLayer');__gs.doc.active.name='Tex';});await setup([[64,64]]);await W(300);
 /* the tool: button, J key, options */
 await p.click('#tools .tool[data-tool=heal]');await W(150);
 ok(await p.evaluate(()=>__gs.ui.tool==='heal'&&/Spot healing brush/.test(document.querySelector('#brushTitle').textContent)&&!!document.querySelector('#optBar .optchip.on')),'the Healing brush button picks the heal tool (Spot by default), with Spot/Healing in the options bar');
 await p.evaluate(()=>{__gs.setTool('brush');});await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.keyboard.press('j');await W(100);
 ok(await p.evaluate(()=>__gs.ui.tool==='heal'),'J picks the heal tool');
 await p.evaluate(()=>Object.assign(__gs.brush,{size:18,hardness:.9,flow:1,opacity:1,smoothing:0,lazy:0,pSize:false,tip:null,spacing:.06}));
 /* spot healing */
 const u0=await p.evaluate(()=>__gs.hist.undo.length);
 await drag(61,64,67,64);await W(400);
 let c=await px('base',[[64,64],[62,62],[66,66]]),h=await px('height',[[64,64]]);
 ok(!c.some(red),'spot healing: the red flaw is gone '+JSON.stringify(c));
 const row=await px('base',[[60,64],[61,64],[62,64],[63,64],[64,64],[65,64],[66,64],[67,64],[68,64],[69,64]]);const lums=row.map(q=>q[1]);
 ok(Math.max(...lums)-Math.min(...lums)>40,'…with the stripes carried in (texture, not a blur) '+lums);
 ok(h[0][0]<230,'…and the height map healed with it (every map of the layer) '+h[0]);
 ok(await p.evaluate(u0=>__gs.hist.undo.length===u0+1&&__gs.hist.undo[__gs.hist.undo.length-1].label==='Heal',u0),'one undo step “Heal”');
 await p.keyboard.press('Control+z');await W(300);
 c=await px('base',[[64,64]]);h=await px('height',[[64,64]]);ok(red(c[0])&&h[0][0]>250,'undo brings the flaw back in both maps');
 /* inside a selection: only the left half heals */
 await p.evaluate(()=>__gs.setTool('marquee'));await drag(40,40,64,90);await p.evaluate(()=>__gs.setTool('heal'));
 await drag(60,64,68,64);await W(400);
 c=await px('base',[[61,64],[67,64]]);ok(!red(c[0])&&red(c[1]),'with a selection only the selected part is healed '+JSON.stringify(c));
 await p.keyboard.press('Control+z');await W(200);await p.keyboard.press('Control+d');await W(200);
 /* symmetry: healing one flaw heals its mirror too */
 await setup([[40,64],[88,64]]);await W(200);
 await p.evaluate(()=>{__gs.ui.sym.mode='x';__gs.ui.sym.cx=.5;__gs.ui.sym.cy=.5;});
 await drag(37,64,43,64);await W(400);c=await px('base',[[40,64],[88,64]]);
 ok(!red(c[0])&&!red(c[1]),'with left–right symmetry both flaws are healed '+JSON.stringify(c));
 await p.evaluate(()=>{__gs.ui.sym.mode='off';});
 /* the healing brush: Alt+click a source, then paint */
 await setup([[64,64]]);await W(200);
 await p.click('#optBar .optchip:has-text("Healing")');await W(100);
 await drag(61,64,67,64);await W(300);ok(red((await px('base',[[64,64]]))[0]),'the healing brush does nothing before a source is set');
 const s=await scr(32,32);await p.keyboard.down('Alt');await p.mouse.click(s[0],s[1]);await p.keyboard.up('Alt');await W(150);
 ok(await p.evaluate(()=>__gs.heal.src&&Math.abs(__gs.heal.src[0]-32)<1.5&&!document.querySelector('#healMark').hidden),'Alt+click sets the source (a cross marks it) '+JSON.stringify(await p.evaluate(()=>__gs.heal.src)));
 await drag(61,64,67,64);await W(400);
 c=await px('base',[[64,64],[62,63]]);ok(!c.some(red)&&await p.evaluate(()=>Math.abs(__gs.heal.last.off[0]+29)<2&&Math.abs(__gs.heal.last.off[1]+32)<2),'painting copies from the source (offset from the stroke start) '+JSON.stringify(c));
 ok((await px('height',[[64,64]]))[0][0]<230,'…healing the height too');
 /* 3D Paint: heal on the model */
 await p.evaluate(()=>__gs.newDoc(128,128,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{__gs.useModel(__gs.parseOBJ('v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n','quad.obj'));});await W(800);
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;const L=__gs.allLayers().find(l=>l.name==='Paint');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});
 const n3=await p.evaluate(()=>__gs.doc.w);
 await p.evaluate(n=>{const A=__gs.doc.active,g=document.querySelector('#gl').getContext('webgl2'),T=__gs.mapT(A,'base'),px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const bad=Math.abs(x-n/2)<=n/20&&Math.abs(y-n/2)<=n/20,v=(x%8<4?60:140);px.set(bad?[230,20,20,255]:[v,v,v,255],(y*n+x)*4);}
   const T8=__gs.makeTarget(n,n,8,false);g.bindTexture(g.TEXTURE_2D,T8.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);__gs.copyScaled(T8,T);T.empty=false;A.lookVer=(A.lookVer||0)+1;__gs.v3.mapsDirty=true;__gs.requestRender(true);},n3);await W(500);
 await p.evaluate(()=>{__gs.setTool('heal');__gs.heal.mode='spot';Object.assign(__gs.brush,{size:90,hardness:.9});});await W(100);
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.mouse.move(cx-8,cy);await p.mouse.down();await p.mouse.move(cx+8,cy,{steps:6});await p.mouse.up();await W(600);
 const c3=await p.evaluate(n=>{const d=__gs.readRGBA8(__gs.mapT(__gs.doc.active,'base'));const i=((n/2)*n+n/2)*4;return Array.from(d.slice(i,i+4));},n3);
 ok(c3[0]-c3[1]<30,'3D Paint: spot healing on the model heals the flaw '+c3);
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
