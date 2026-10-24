/* loads an FBX into 3D Paint and tries the Bevel and Retro shaders: node pistol.cjs model.fbx */
const {chromium}=require('playwright'),fs=require('fs');const OLD=__dirname+'/';
(async()=>{const file=process.argv[2],buf=fs.readFileSync(file).toString('base64');
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1100,height:760}})).newPage();const errs=[];
 p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+' '+m.text().slice(0,300));});
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.addStyleTag({content:'#pane3d .v3bar,#pane3d .v3info,#pane3d .v3set,#pane3d .v3mir,.vpstrip,#pane3d .v3xtra{display:none!important}'});
 const info=await p.evaluate(async b64=>{const G=__gs;G.closeWelcome();G.setMode('p3d',true);const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
   const m=await G.parseFBX(u.buffer,'Pistol');G.useModel(m);G.cmdNewFillLayer({name:'Steel',maps:{base:{c:[.78,.8,.84]},metal:{v:1},rough:{v:.3}}});
   Object.assign(G.v3s(),{unlit:false,wire:false,spin:false,bg:'dark'});G.mir3.show=false;G.composite();G.v3Refresh();
   return {tris:m.tris,verts:m.verts,mats:m.matNames,parts:m.partNames&&m.partNames.length,noUV:m.noUV,bbox:m.bbox||null};},buf);
 console.log('model',JSON.stringify(info));await p.waitForTimeout(2000);
 const clip=await p.evaluate(()=>{const r=document.querySelector('#v3Hit').getBoundingClientRect();const s=Math.min(r.width,r.height,560);return {x:r.x+(r.width-s)/2,y:r.y+(r.height-s)/2,width:s,height:s};});
 await p.screenshot({path:'out/pistol-std.png',clip});
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await p.waitForTimeout(500);await p.selectOption('#shKind','retro');console.log('shader after UI pick',await p.evaluate(()=>JSON.stringify(__gs.v3ShadeOf(__gs.doc))));await p.waitForTimeout(6000);await p.screenshot({path:'out/pistol-retro.png',clip});if(process.argv[3]==='retro'){console.log('errors',JSON.stringify(errs.slice(0,8)));await b.close();return;}
 await p.evaluate(()=>{__gs.doc.v3shade={kind:'std',p:{}};Object.assign(__gs.bvSettings(),{on:true,preview:true,width:1.2,angle:30,samples:32});__gs.bvChanged();});
 for(let i=0;i<200;i++){await p.waitForTimeout(2000);const t=await p.evaluate(()=>__gs.bvStatusText());if(i%5===0)console.log(i,t);if(/ready|unavailable/i.test(t))break;}
 await p.waitForTimeout(1500);await p.screenshot({path:'out/pistol-bevel.png',clip});
 console.log('errors',JSON.stringify(errs.slice(0,8)));await b.close();})();
