/* 0.40.1: tone mapping list (ACES, AgX, PBR Neutral), new ambient occlusion and film grain */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLW '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'p40',false,'pbr'));await W(300);
 /* Tab */
 const wrap=()=>p.evaluate(()=>({w:document.getElementById('workWrap').getBoundingClientRect().width,dock:getComputedStyle(document.querySelector('#app>.panel')).display,full:document.body.classList.contains('tabfull')}));
 const w0=await wrap();await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'p401',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 const obj='v -1 0 -1\nv 1 0 -1\nv 1 0 1\nv -1 0 1\nv -1 1 -1\nv 1 1 -1\nv -1 1 1\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nvn 0 1 0\nvn 0 0 1\nvn 1 0 0\nf 1/1/1 4/4/1 3/3/1 2/2/1\nf 1/1/2 2/2/2 6/3/2 5/4/2\nf 1/1/3 5/4/3 7/3/3 4/2/3\n';
 {const fc=p.waitForEvent('filechooser');await p.selectOption('#p3Model','__import');const ch=await fc;await ch.setFiles({name:'corner.obj',mimeType:'text/plain',buffer:Buffer.from(obj)});await W(1500);}
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:.6,pitch:.55});__gs.v3.dirty=true;});await W(400);
 const shot=(w,h)=>p.evaluate(([w,h])=>Array.from(__gs.v3Offscreen(w,h)),[w||240,h||180]);
 const mean=a=>{let s=0;for(let i=0;i<a.length;i+=4)s+=a[i]+a[i+1]+a[i+2];return s/(a.length/4*3);};
 const diff=(a,c)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-c[i])+Math.abs(a[i+1]-c[i+1])+Math.abs(a[i+2]-c[i+2])>24)n++;return n;};
 const tones={};await p.evaluate(()=>{__gs.v3s().expo=3;__gs.v3.dirty=true;});
 for(const t of ['filmic','aces','agx','khr','neutral','none']){await p.evaluate(t=>{__gs.doc.v3d=__gs.doc.v3d||{};__gs.v3s().tone=t;__gs.v3.dirty=true;},t);await W(300);tones[t]=await shot();}
 for(const t in tones)ok(mean(tones[t])>15&&mean(tones[t])<245,'tone '+t+' draws a picture (mean '+mean(tones[t]).toFixed(0)+')');
 ok(diff(tones.aces,tones.filmic)>200,'ACES differs from Filmic');ok(diff(tones.agx,tones.aces)>200,'AgX differs from ACES');ok(diff(tones.khr,tones.neutral)>200,'PBR Neutral differs from Soft');
 await p.evaluate(()=>{__gs.v3s().tone='filmic';__gs.v3s().expo=1;__gs.v3.dirty=true;});await W(300);
 await p.evaluate(()=>__gs.showPanel('shading'));await W(400);
 ok(await p.evaluate(()=>!!document.getElementById('v3Tone')||!!document.getElementById('shTone')||document.querySelector('select[aria-label="Tone mapping"]')),'the tone list is in the panel');
 const base=await shot(320,240);
 await p.evaluate(()=>{document.getElementById('post_ao').click();const i=document.getElementById('post_ao_rad');i.value='.45';i.dispatchEvent(new Event('input',{bubbles:true}));});await W(500);const ao=await shot(320,240);
 const savePng=async(a,w,h,f)=>{const d=await p.evaluate(([a,w,h])=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);for(let y=0;y<h;y++)im.data.set(a.slice((h-1-y)*w*4,(h-y)*w*4),y*w*4);x.putImageData(im,0,0);return c.toDataURL('image/png');},[a,w,h]);require('fs').writeFileSync(f,Buffer.from(d.split(',')[1],'base64'));};
 if(process.env.PNG){await savePng(base,320,240,process.env.PNG+'-base.png');await savePng(ao,320,240,process.env.PNG+'-ao.png');for(const t in tones)await savePng(tones[t],240,180,process.env.PNG+'-tone-'+t+'.png');}
 ok(diff(base,ao)>150&&mean(ao)<mean(base)-0.3,'occlusion darkens creases ('+mean(base).toFixed(1)+' → '+mean(ao).toFixed(1)+')');
 await p.evaluate(()=>{document.getElementById('post_ao').click();document.getElementById('post_grain').click();});await W(500);const g1=await shot(320,240);
 ok(diff(base,g1)>1000,'film grain adds noise');
 await p.evaluate(()=>{__gs.v3.postSeed=3.3;__gs.v3.dirty=true;});await W(300);const g2=await shot(320,240);
 ok(diff(g1,g2)>1000,'a different seed gives different grain');
 await p.evaluate(()=>{const i=document.getElementById('post_grain_col');i.value='0';i.dispatchEvent(new Event('input',{bubbles:true}));});await W(300);const g3=await shot(320,240);
 let colourful=0;for(let i=0;i<g3.length;i+=4){const d=Math.max(Math.abs(g3[i]-base[i]-(g3[i+1]-base[i+1])),0);if(d>6)colourful++;}
 ok(colourful<300,'grain with Colour noise 0 is grey');
 await p.evaluate(()=>{document.getElementById('post_grain').click();});await W(300);
 require('fs').writeFileSync(process.env.OUT||'/tmp/claude-0/post.json',JSON.stringify({filmic:tones.filmic.slice(0,0)}));
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
