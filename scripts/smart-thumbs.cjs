/* Renders every built-in smart material and smart mask on the Material preview model (with its mesh maps), the way they
   look in 3D Paint, and saves them as assets/smart-thumbs/*.webp + previews.json (embedded by scripts/build.mjs).
   Run after `npm run build`:  node scripts/smart-thumbs.cjs   (ONLY=<name> renders just that one) */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
const repo=path.resolve(__dirname,'..'),OUT=path.join(repo,'assets/smart-thumbs'),SIZE=256;
const slug=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
(async()=>{fs.mkdirSync(OUT,{recursive:true});
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1200,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:path.join(repo,'assets/materials',m[1]),contentType:'application/octet-stream'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.join(repo,'dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(async()=>{const G=__gs;await G.studioPreviewLoad();G.v3s().model='matpreview';});await p.waitForTimeout(800);
 await p.evaluate(async()=>{const G=__gs;await G.studioPreviewMaps();const L=G.layerByName('Preview mesh material');if(L){G.selectOnly(L);G.cmdDelete();}
   const P=G.layerByName('Paint');if(P){G.selectOnly(P);G.cmdDelete();}});
 /* a mid grey base under every smart material, so overlay ones (Dirt, Dust, Imperfections) show against it */
 await p.evaluate(()=>{const G=__gs,B=G.layerByName('Base material');if(B&&B.fill){Object.assign(B.fill.maps.base,{on:true,src:'value',c:[.42,.43,.45]});if(B.fill.maps.rough)Object.assign(B.fill.maps.rough,{on:true,src:'value',v:.6});G.fillRender(B);G.changedAll();}});
 await p.evaluate(()=>{const G=__gs;G.__msCount=()=>{const L=G.doc.active;return L&&L.mask&&L.mask.target?(()=>{const T=L.mask.target,d=G.captureRegionNow(T,0,0,T.w,T.h).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>40)n++;return n/(d.length/4);})():-1;};});
 /* wait for the sky (HDRI) that lights the model */
 for(let i=0;i<80;i++){if(await p.evaluate(()=>{const e=__gs.env||null;__gs.envEnsure&&__gs.envEnsure();return !!(e&&e.key);}))break;await p.waitForTimeout(250);}
 console.log('sky:',await p.evaluate(()=>__gs.env&&__gs.env.key));
 await p.waitForTimeout(500);
 const shot=async()=>p.evaluate(async S=>{const G=__gs,v3=G.v3;Object.assign(v3.cam,{yaw:.7,pitch:.9});G.v3Frame();v3.cam.dist*=.95;v3.mapsDirty=true;v3.dirty=true;
   for(let i=0;i<6;i++){G.requestRender(true);await new Promise(r=>requestAnimationFrame(()=>setTimeout(r,60)));}
   const W=S*2,d=G.v3Offscreen(W,W,{transparent:true}),c=document.createElement('canvas');c.width=W;c.height=W;const x=c.getContext('2d'),id=x.createImageData(W,W);
   for(let y=0;y<W;y++)id.data.set(d.subarray((W-1-y)*W*4,(W-y)*W*4),y*W*4);x.putImageData(id,0,0);
   const o=document.createElement('canvas');o.width=o.height=S;const ox=o.getContext('2d');ox.imageSmoothingQuality='high';ox.drawImage(c,0,0,S,S);return o.toDataURL('image/webp',.86);},SIZE);
 const save=(kind,name,url)=>{const f=kind+'-'+slug(name)+'.webp';fs.writeFileSync(path.join(OUT,f),Buffer.from(url.split(',')[1],'base64'));return f;};
 const items={},only=process.env.ONLY;
 const smarts=await p.evaluate(()=>__gs.smBuiltins().map(r=>r.name));
 for(const name of smarts){if(only&&name!==only)continue;
   const ok=await p.evaluate(async name=>{const G=__gs,rec=G.smBuiltins().find(r=>r.name===name),base=G.layerByName('Base material');if(base)G.selectOnly(base);const n=await G.smApply(rec);G.__smN=n||null;return !!n;},name);
   if(!ok){console.log('skipped',name);continue;}await p.waitForTimeout(400);
   await p.waitForTimeout(600);items['smart:'+name]=save('sm',name,await shot());await p.evaluate(()=>{const G=__gs,n=G.__smN;if(n){G.selectOnly(n);G.cmdDelete();}G.__smN=null;const extra=G.doc.root.children.filter(c=>c.name!=='Base material');if(extra.length)console.warn('left over',extra.map(c=>c.name));});await p.waitForTimeout(200);console.log('smart material',name);}
 /* smart masks: a light material masked over a dark one */
 await p.evaluate(()=>{const G=__gs,base=G.layerByName('Base material');if(base){G.selectOnly(base);}
   G.cmdNewFillLayer({name:'Under',maps:{base:{on:true,c:[.16,.17,.19]},rough:{on:true,v:.55},metal:{on:true,v:0}}});
   G.cmdNewFillLayer({name:'Masked',maps:{base:{on:true,c:[.86,.62,.30]},rough:{on:true,v:.35},metal:{on:true,v:0}}});});
 await p.waitForTimeout(400);
 const masks=await p.evaluate(()=>__gs.smaskBuiltins().map(r=>r.name));
 for(const name of masks){if(only&&name!==only||process.env.SKIP_MASKS)continue;
   await p.evaluate(async name=>{const G=__gs,L=G.layerByName('Masked');G.selectOnly(L);await G.smMaskApply(G.smaskBuiltins().find(r=>r.name===name));G.doc.active.editMask=true;G.ui.viewMask=true;G.changedAll();},name);await p.waitForTimeout(800);
   items['smask:'+name]=save('mask',name,await shot());await p.evaluate(()=>{__gs.ui.viewMask=false;__gs.undo();});await p.waitForTimeout(200);console.log('smart mask',name);}
 const jf=path.join(OUT,'previews.json'),old=fs.existsSync(jf)?JSON.parse(fs.readFileSync(jf,'utf8')).items||{}:{};
 fs.writeFileSync(jf,JSON.stringify({size:SIZE,items:Object.assign(old,items)},null,0));
 if(errs.length)console.log('page errors:',errs.slice(0,5));console.log('Saved',Object.keys(items).length,'thumbnails');await b.close();})().catch(e=>{console.error(e);process.exit(1);});
