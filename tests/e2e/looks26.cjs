/* 0.26: the looks — HDRI lighting, shaders per texture set, ray-traced mode and Render window, screenshot, turntable (GIF, PNG sequence), transparent background. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1100,height:760},acceptDownloads:true});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 const URL='file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug&welcome';
 const W=ms=>p.waitForTimeout(ms||200);
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await W(3000);
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 const pane=()=>p.locator('#pane3d').boundingBox();
 /* the HDRI: loaded and prepared */
 for(let i=0;i<30&&!(await p.evaluate(()=>__gs.env.key==='studio'&&__gs.env.lv.length===6));i++)await W(300);
 ok(await p.evaluate(()=>__gs.env.key==='studio'&&__gs.env.lv.length===6&&!!__gs.env.irr),'the Studio HDRI lights the model by default (prepared: 6 reflection levels + diffuse)');
 const centre=async()=>{const bx=await pane();const buf=await p.screenshot({clip:{x:bx.x+bx.width/2-2,y:bx.y+bx.height/2-2,width:4,height:4}});return buf.length;};
 await p.click('#v3Gear');await W(200);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#v3Env option')].map(o=>o.textContent).filter(t=>/Studio|Photo studio|Cloudy sky|Venice sunset|Evening sky|Simple sky|Load your own/.test(t)).length>=7),'Settings › Lighting lists the five HDRIs, a simple sky and Load your own');
 ok(await p.evaluate(()=>/Sergej Majboroda/.test(document.querySelector('#envBox').textContent)),'…with the HDRI’s author credited');
 await p.selectOption('#v3Env','sunset');for(let i=0;i<30&&!(await p.evaluate(()=>__gs.env.key==='sunset'));i++)await W(300);
 ok(await p.evaluate(()=>__gs.env.key==='sunset'),'picking another HDRI lights with it');
 await p.click('label[for=v3EnvBg]');await W(300);ok(await p.evaluate(()=>__gs.doc.v3d.envBg===true&&!!document.querySelector('#v3EnvBlur')),'Show it as the background (with its own blur)');
 /* a .hdr of our own: a tiny one made here */
 const own=await p.evaluate(()=>{const W=8,H=4,h='#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y '+H+' +X '+W+'\n',b=new Uint8Array(h.length+W*H*4);for(let i=0;i<h.length;i++)b[i]=h.charCodeAt(i);for(let i=0;i<W*H;i++)b.set([128,64,32,129],h.length+i*4);const r=__gs.parseHDR(b);return [r.w,r.h,r.rgb[0],r.rgb[1]];});
 ok(own[0]===8&&own[1]===4&&Math.abs(own[2]-1)<.01&&Math.abs(own[3]-.5)<.01,'.hdr files are read (RGBE) '+own);
 await p.click('#v3Gear');await W(200);
 /* shaders per texture set, in a drop-down */
 await p.evaluate(()=>__gs.showPanel('shading'));await W(300);
 ok(await p.evaluate(()=>document.querySelectorAll('#shKind option').length===7),'the Shader panel has a drop-down of 7 shaders');
 await p.selectOption('#shKind','toon');await W(400);
 ok(await p.evaluate(()=>__gs.doc.v3shade.kind==='toon'&&!!document.querySelector('#sh_steps')&&!!document.querySelector('#sh_outline')),'Toon has its own settings (bands, outline…)');
 await p.selectOption('#shKind','skin');await W(300);await p.evaluate(()=>{const i=document.querySelector('#sh_scatter');i.value=.9;i.dispatchEvent(new Event('input'));});await p.selectOption('#shKind','toon');await p.selectOption('#shKind','skin');await W(200);
 ok(await p.evaluate(()=>Math.abs(__gs.doc.v3shade.p.skin.scatter-.9)<.02),'each shader keeps its own settings when you switch');
 ok(await p.evaluate(()=>{const u=__gs.shadeUniforms(__gs.v3ShadeOf(__gs.doc));return u.uSh.int===1&&Math.abs(u.uShP[0]-.9)<.02;}),'…and the texture set is drawn with it');
 await p.selectOption('#shKind','std');await W(200);
 /* ray traced mode */
 await p.click('#v3Shade button:has-text("Ray traced")');
 let n=0;for(let i=0;i<40;i++){await W(500);n=await p.evaluate(()=>__gs.rt.view?__gs.rt.view.n:0);if(n>=6)break;}
 ok(n>=6,'Ray traced mode adds samples frame after frame ('+n+')');
 ok(await p.evaluate(()=>/Ray traced · \d+/.test(document.getElementById('v3Info').textContent)),'…and says how far it is');
 await p.click('#v3Shade button:has-text("Lit")');await W(300);
 /* screenshot with a transparent background */
 const dl1=p.waitForEvent('download',{timeout:30000});await p.evaluate(()=>__gs.v3Screenshot('view',true));const d1=await dl1;const f1=await d1.path();
 const png=require('fs').readFileSync(f1);ok(png.slice(1,4).toString()==='PNG','the screenshot is a PNG '+d1.suggestedFilename());
 const alpha=await p.evaluate(async b64=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const a=x.getImageData(0,0,1,1).data[3],m=x.getImageData(im.width>>1,im.height>>1,1,1).data[3];return [a,m];},png.toString('base64'));
 ok(alpha[0]===0&&alpha[1]===255,'…with a transparent background, the model solid '+alpha);
 /* the Render window */
 await p.click('#v3RenderBtn');await W(300);await p.click('#rtDlg .segb:has-text("Draft")');await p.click('#rtGo');
 for(let i=0;i<120;i++){await W(500);if(await p.evaluate(()=>/Done/.test(document.getElementById('rtMsg').textContent)))break;}
 ok(await p.evaluate(()=>/Done: 64 samples/.test(document.getElementById('rtMsg').textContent)),'Render › Draft finishes 64 samples '+await p.evaluate(()=>document.getElementById('rtMsg').textContent));
 const dl2=p.waitForEvent('download',{timeout:30000});await p.click('#rtSave');const d2=await dl2;ok(/_render\.png$/.test(d2.suggestedFilename()),'…and saves a PNG');
 await p.click('#dlgCancel');await W(200);
 /* turntable: a GIF, then PNG frames */
 await p.evaluate(()=>{__gs.v3.tto={spins:1,secs:1,fps:24,size:'view',fmt:'gif',lightTurns:false,tr:false};});
 const dl3=p.waitForEvent('download',{timeout:120000});await p.evaluate(()=>__gs.ttRecord(__gs.v3.tto));const d3=await dl3;const gif=require('fs').readFileSync(await d3.path());
 ok(gif.slice(0,6).toString()==='GIF89a','the turntable GIF is a GIF '+gif.length+' bytes');
 const frames=await p.evaluate(async b64=>{const im=new Image();im.src='data:image/gif;base64,'+b64;try{await im.decode();return im.width>0;}catch(e){return 'bad '+e;}},gif.toString('base64'));ok(frames===true,'…that a browser can open '+frames);
 ok(await p.evaluate(()=>Math.abs(__gs.doc.v3d.envRot||0)<.01),'the camera and light are put back afterwards');
 await p.evaluate(()=>{__gs.v3.tto={spins:1,secs:1,fps:24,size:'view',fmt:'png',lightTurns:true,tr:true};});
 const dl4=p.waitForEvent('download',{timeout:120000});await p.evaluate(()=>__gs.ttRecord(__gs.v3.tto));const d4=await dl4;ok(/_turntable\.zip$/.test(d4.suggestedFilename()),'a PNG sequence comes as a zip in the browser');
 /* Bake tab: the high-poly on the model, and C to step through the maps */
 await p.click('#modeTabs [data-mode=bake]');await W(1500);
 await p.evaluate(()=>{const lo='v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n',hi='v -1 -1 0\nv 1 -1 0\nv 1 1 0.2\nv -1 1 0\nf 1 2 3 4\n';
   const C=__gs.bakeCfg;C.low=__gs.parseOBJ(lo,'q_low.obj');C.high=__gs.parseOBJ(hi,'q_high.obj');C.cage=null;C.size=64;C.ss=1;C.pad=2;C.rays=16;for(const k in C.kinds)C.kinds[k]=k==='ao'||k==='normal';__gs.buildBakePanel();});await W(800);
 ok(await p.evaluate(()=>!!document.querySelector('#bkShowHigh')),'with a high-poly loaded, the Bake panel offers Show high-poly');
 await p.click('#bkShowHigh .segb:has-text("Only")');await W(800);ok(await p.evaluate(()=>!!__gs.bkHV.g&&__gs.bkHV.g.count===6),'Only: the high-poly is drawn on its own');
 await p.click('#bkShowHigh .segb:has-text("See-through")');await W(400);
 await p.click('#bkGo');for(let i=0;i<120&&(await p.evaluate(()=>__gs.bk.busy||!Object.keys(__gs.bk.res).length));i++)await W(500);
 await p.mouse.move(300,300);const s0=await p.evaluate(()=>__gs.bk.show);await p.keyboard.press('c');await W(200);const s1=await p.evaluate(()=>__gs.bk.show);await p.keyboard.press('c');await W(200);const s2=await p.evaluate(()=>__gs.bk.show);
 ok(s0!==s1&&s1!==s2,'C steps through what the model shows ('+[s0,s1,s2].join(' → ')+')');
 await p.keyboard.press('Shift+c');await W(200);ok(await p.evaluate(s1=>__gs.bk.show===s1,s1),'Shift+C steps back');
 ok(await p.evaluate(()=>__gs.ui.tool!=='crop'),'…without picking the Crop tool');
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
