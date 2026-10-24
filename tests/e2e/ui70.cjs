/* 0.70: texture picker in the material editor, Retro pixelate filter, Retro viewer shader, wireframe toggle,
   settings that stay open, Bevel shader in 3D Paint. */
const {chromium}=require('playwright');
const OLD=__dirname+'/',OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 /* ---- Retro pixelate filter ---- */
 await p.evaluate(()=>__gs.EXAMPLES[0].run());await W(1500);
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Stones');__gs.doc.active=L;__gs.doc.sel=new Set([L]);});
 const sig=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.doc.active.target);let h=0;for(let i=0;i<d.length;i+=97)h=(h*31+d[i])%1000003;return h;});
 const s0=await sig();
 await p.evaluate(()=>__gs.act('retroPixel'));await W(600);
 ok(await p.locator('#rt_pre_n64').count()===1&&await p.locator('#rt_pre_psx').count()===1,'Retro pixelate has console presets');
 await p.click('#dlgOk');await W(400);const s1=await sig();ok(s1!==s0,'Retro pixelate (N64) changes the layer');
 await p.evaluate(()=>__gs.undo());await W(250);
 await p.evaluate(()=>__gs.act('retroPixel'));await W(500);await p.click('#rt_pre_psx');await W(400);
 const pv=await p.evaluate(()=>document.querySelector('#rt_res')?.value);ok(pv==='64','PlayStation preset sets 64 texels ('+pv+')');
 await p.click('#dlgOk');await W(400);const s2=await sig();ok(s2!==s0&&s2!==s1,'PlayStation preset looks different from the N64 one');
 await p.evaluate(()=>__gs.undo());await W(250);
 /* ---- 3D Paint ---- */
 await p.evaluate(()=>{const G=__gs;G.closeWelcome();G.setMode('p3d',true);G.useModel(G.primMesh('cube',1));G.cmdNewFillLayer({name:'Red',maps:{base:{c:[.85,.06,.03]}}});Object.assign(G.v3s(),{unlit:false,wire:false,wireOnly:false,showUV:false,disp:0,spin:false,bg:'dark'});G.mir3.show=false;G.composite();G.v3Refresh();});await W(800);
 /* material editor: Textures… */
 await p.evaluate(()=>__gs.showPanel('matEd'));await W(400);
 const L0=await p.evaluate(()=>{const L=__gs.doc.active;return !!L.fill;});ok(L0,'a material layer is active');
 const hasSeg=await p.locator('#matEdBody .fillcard').count();ok(hasSeg>3,'material channels are listed ('+hasSeg+')');
 await p.evaluate(()=>{const L=__gs.doc.active;L.fill.maps.rough.on=true;L.fill.maps.rough.src='image';});await p.evaluate(()=>__gs.renderMatEd(true));await W(400);
 ok(await p.locator('#fl_tx_rough').count()===1,'the Image source offers a Textures… button even before any image is chosen');
 await p.locator('#fl_tx_rough').click();await W(600);
 ok(await p.locator('#txPickGrid .txtile').count()>10,'the texture picker lists the Textures library');
 await p.fill('#txPickSearch','clouds');await W(400);
 await p.locator('#txp_gen_clouds').click();await W(1200);
 const got=await p.evaluate(()=>{const L=__gs.doc.active,s=L.fill.maps.rough;return {src:s.src,name:s.name,img:!!(L._fillImg&&L._fillImg.rough)};});
 ok(got.src==='image'&&got.img&&/cloud/i.test(got.name),'picking a texture makes it the Roughness image '+JSON.stringify(got));
 ok(await p.locator('#fl_t_rough').count()===1,'its Tile control shows');
 await p.screenshot({path:OUT+'ui70-matEd.png'});
 /* wireframe: click the active mode again to turn it off */
 await p.locator('#v3More').click();await p.locator('#v3Gear').click();await W(300);
 ok(await p.evaluate(()=>localStorage.getItem('gs.v3setOpen'))==='1','settings remember that they are open');
 await p.locator('[data-wire-mode="overlay"]').click();ok(await p.evaluate(()=>__gs.v3s().wire)===true,'Wireframe overlay turns on');
 await p.locator('[data-wire-mode="overlay"]').click();ok(await p.evaluate(()=>__gs.v3s().wire)===false,'clicking Wireframe overlay again turns it off');
 await p.locator('[data-wire-mode="wire"]').click();await p.locator('[data-wire-mode="wire"]').click();ok(await p.evaluate(()=>__gs.v3s().wire)===false,'Wireframe turns off the same way');
 /* retro shader */
 const grab=()=>p.evaluate(()=>{const G=__gs,F=G.v3Targets(160,160);G.v3Render(F);const a=G.captureRegionNow({fbo:F.rf,w:F.w,h:F.h,depth:8},0,0,F.w,F.h).data;let h=0,levels=new Set();for(let i=0;i<a.length;i+=4){h=(h*31+a[i]+a[i+1]*3+a[i+2]*7)%1000003;levels.add(a[i]);}return {h,levels:levels.size,err:G.gl.getError()};});
 const std=await grab();
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'retro',p:{}};__gs.v3.dirty=true;});await W(300);
 const ret=await grab();
 ok(ret.err===0&&ret.h!==std.h,'the Retro shader draws without graphics errors and looks different');
 ok(ret.levels<std.levels&&ret.levels<=40,'Retro colour is cut to few levels ('+ret.levels+' vs '+std.levels+')');
 await p.evaluate(()=>{__gs.shadeEdit(d=>{d.p.retro={wobble:.8,fog:.5,steps:3};});});await W(300);
 const ret2=await grab();ok(ret2.err===0&&ret2.h!==ret.h,'wobble, fog and light bands change the picture');
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await W(400);
 ok(await p.locator('#shRetro_psx').count()===1,'the Shader panel has the Retro console presets');
 await p.locator('#shRetro_psx').click();await W(300);
 ok(await p.evaluate(()=>__gs.shParams(__gs.v3ShadeOf(__gs.doc)).res)===64,'PlayStation preset sets the texel grid');
 await p.screenshot({path:OUT+'ui70-retro.png'});
 /* bevel shader in 3D Paint */
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'std',p:{}};__gs.renderShading();});await W(300);
 ok(await p.locator('#shBevelOn').count()===1,'the Shader panel offers the Bevel shader in 3D Paint');
 const before=await grab();
 await p.locator('#shBevelOn').click();await W(2500);
 ok(await p.evaluate(()=>__gs.bevelPreviewOn()),'bevel preview is on in 3D Paint');
 let after;for(let i=0;i<12;i++){after=await grab();await W(800);}
 ok(after.err===0,'the bevel preview draws without graphics errors');
 ok(await p.locator('#shBevelBox #bkBevelWidth').count()===1,'width, angle and samples are listed once it is on');
 await p.screenshot({path:OUT+'ui70-bevel.png'});
 await p.evaluate(()=>__gs.dlgP3Bake());await W(500);
 ok(await p.locator('#p3bkBevelBox').count()===1,'the Bake mesh maps window offers the Bevel shader');
 await p.click('#dlgCancel');await W(200);
 /* per-material bevel width */
 await p.evaluate(()=>{const G=__gs,corner=['v -1 -1 0','v 1 -1 0','v 1 1 0','v -1 1 0','v 1 -1 -1','v 1 1 -1','vt 0 0','vt .5 0','vt .5 1','vt 0 1','vt .6 0','vt 1 0','vt 1 1','vt .6 1','vn 0 0 1','vn 1 0 0','o body','usemtl Front','f 1/1/1 2/2/1 3/3/1','f 1/1/1 3/3/1 4/4/1','usemtl Side','f 2/5/2 5/6/2 6/7/2','f 2/5/2 6/7/2 3/8/2'].join('\n');
   G.useModel(G.parseOBJ(corner,'Corner'));Object.assign(G.bvSettings(),{on:true,preview:true,width:3,angle:30,samples:32,mats:{}});G.bvSettings().on=false;G.bvChanged();G.showPanel('shading');G.renderShading();});await W(1500);
 const grab2=async()=>{for(let i=0;i<80;i++){const t=await p.evaluate(()=>__gs.bvStatusText());if(/ready|off/i.test(t))break;await W(1000);}await W(1200);return grab();};
 const off=await grab2();
 await p.evaluate(()=>{const o=__gs.bvSettings();o.on=true;__gs.bvChanged();__gs.renderShading();});const on=await grab2();
 ok(await p.locator('#shBevelBox [id^=bkBevelMat]').count()===2,'two materials get a width slider each');
 await p.evaluate(()=>{const o=__gs.bvSettings();o.mats={Front:0,Side:0};__gs.bvChanged();});const zero=await grab2();
 ok(off.h!==on.h,'the bevel changes a two-material model');ok(zero.h===off.h,'0% on every material leaves the model sharp (per-material width works)');
 await p.evaluate(()=>{const o=__gs.bvSettings();o.mats={Front:0,Side:1};__gs.bvChanged();});const half=await grab2();
 ok(half.h!==off.h,'one material beveled, the other not, gives a different picture');
 ok(errs.length===0,'no application errors '+errs.slice(0,4).join(' | '));
 await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
