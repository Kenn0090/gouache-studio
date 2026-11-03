/* 0.94 parity pass: the same model, material, camera and lighting in the old 3D view and (via the saved scene body) in the new viewer.
   Writes out/parity/<name>_old.png and <name>.bin; compare.sh renders the .bin in the new viewer and compares. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
const fs=require('fs'),path=require('path');
const OUT=__dirname+'/out/parity/';fs.mkdirSync(OUT,{recursive:true});
const TILT=process.env.TILT?process.env.TILT.split(',').map(Number):null,MODEL=process.env.MODEL||'',W=1100,H=760,FLAT=process.env.FLAT==='1';
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:512,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();const O='/home/user/gouache-studio/tests/e2e/';
  if(u.includes('pako'))return r.fulfill({path:O+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:O+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:O+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:'/home/user/gouache-studio/assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 p.on('pageerror',e=>console.log('PAGEERR',e.message));
 const url='file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug';
 await p.goto(url);await p.waitForTimeout(2500);await p.goto(url);await p.waitForTimeout(2500);
 const Wt=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(512,512,8,[1,1,1],'par',false,'pbr'));await Wt(300);
 await p.click('#modeTabs [data-mode=p3d]');await Wt(1500);
 await p.evaluate(()=>__gs.showPanel('mats'));await Wt(400);
 await p.locator('#matBody .chip',{hasText:/^All$/}).last().click();await Wt(500);
 for(const [gid,name,file] of [['gm_brown-leather','Brown leather','leather'],['gm_brass','Brass','brass']]){
  await p.click('#'+gid);await p.click('#lFill');for(let i=0;i<60;i++){if(await p.evaluate(n=>__gs.doc.active&&__gs.doc.active.name===n,name))break;await Wt(250);}
  if(FLAT){await p.evaluate(()=>{const L=__gs.doc.active;if(L&&L.fill&&L.fill.maps.normal){L.fill.maps.normal.on=false;if(L.fill.maps.height)L.fill.maps.height.on=false;__gs.fillRender(L);__gs.changedAll();}});await Wt(1200);}
  await Wt(1500);
  // same camera for both: yaw/pitch/dist from the page
  if(TILT&&name==='Brown leather'){await p.evaluate(t=>{const L=__gs.doc.active;__gs.setMapSolid(L,'normal',__gs.fillSolidColor('normal',[t[0],t[1],t[2],1]));__gs.changedAll();},TILT);await Wt(800);}
  if(process.env.LIGHT==='1'){await p.evaluate(()=>{const s=__gs.v3s();s.rigLive=true;__gs.bakeCfg.rig={lights:[{id:1,type:'point',pos:[1.2,0.8,1.5],col:[1,.1,.1],int:6,range:3,on:true,name:'L'}],expo:1,show:true,sel:null};__gs.changedAll();});await Wt(800);}
  if(MODEL){await p.evaluate(m=>__gs.useModel(__gs.primMeshX(m)),MODEL);await Wt(1500);}
  console.log('disp',await p.evaluate(()=>[__gs.v3s().disp,__gs.v3s().dispAmt,__gs.v3s().depth,__gs.v3s().sub]));
  if(process.env.NODISP==='1')await p.evaluate(()=>{__gs.v3s().disp=false;});
  await p.evaluate(()=>{const c=__gs.v3.cam;c.yaw=0.7;c.pitch=0.35;});await Wt(500);
  const old=await p.evaluate(async([w,h])=>{const d=__gs.v3Offscreen(w,h,{});const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),im=x.createImageData(w,h);
    for(let j=0;j<h;j++){const a=(h-1-j)*w*4,b=j*w*4;for(let i=0;i<w*4;i+=4){im.data[b+i]=d[a+i];im.data[b+i+1]=d[a+i+1];im.data[b+i+2]=d[a+i+2];im.data[b+i+3]=255;}}x.putImageData(im,0,0);return c.toDataURL('image/png');},[W,H]);
  fs.writeFileSync(OUT+file+(FLAT?'F':'')+(process.env.LIGHT==='1'?'_L':'')+(TILT?'_t'+TILT.join('_'):'')+(MODEL?'_'+MODEL:'')+'_old.png',Buffer.from(old.split(',')[1],'base64'));
  const body=await p.evaluate(async()=>{const sc=await __gs.nvScene();const e=__gs.v3Eye(),c=__gs.v3.cam;sc.settings=Object.assign({},__gs.nvSettings(),{cam:[e[0],e[1],e[2],c.tx,c.ty,c.tz]});const bytes=__gs.nvBody(sc);let s='';for(let i=0;i<bytes.length;i+=32768)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+32768));return btoa(s);});
  fs.writeFileSync(OUT+file+(FLAT?'F':'')+(process.env.LIGHT==='1'?'_L':'')+(TILT?'_t'+TILT.join('_'):'')+(MODEL?'_'+MODEL:'')+'.bin',Buffer.from(body,'base64'));
  console.log(file,'old',old.length,'body',body.length);
 }
 await b.close();})();
