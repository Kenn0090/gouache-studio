const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const IMG=require('path').resolve(__dirname,'../../docs/wiki/images')+'/';const W=ms=>p.waitForTimeout(ms||300);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(pts)=>{let a=await scr(...pts[0]);await p.mouse.move(a[0],a[1]);await p.mouse.down();for(const q of pts.slice(1)){a=await scr(...q);await p.mouse.move(a[0],a[1],{steps:6});}await p.mouse.up();await W(60);};
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 await p.evaluate(()=>{__gs.newDoc(1024,768,8,[.13,.15,.17],'Panel',false);Object.assign(__gs.brush,{smoothing:0,pSize:false,tip:null,spacing:.06,opacity:1,flow:1,grain:0});});
 await W(500);
 await p.keyboard.press('k');await p.evaluate(()=>{const b=[...document.querySelectorAll('.seg button')].find(b=>b.textContent==='Grid');b.click();});await W();
 await p.evaluate(()=>{__gs.ui.cageNx=4;__gs.ui.cageNy=1;});
 await drag([[170,300],[860,470]]);
 await p.evaluate(()=>{const C=__gs.doc.cage;if(C.nx!==4||C.ny!==1){}for(let i=0;i<=C.nx;i++){const dy=Math.sin(i/C.nx*Math.PI*1.6)*70;C.A[0][i][1]+=dy-i*18;C.A[1][i][1]+=dy-i*6;}__gs.cageChanged();});
 await W();
 await p.keyboard.press('b');await p.keyboard.press('f');await W(600);
 const fs=await p.evaluate(()=>[__gs.doc.cage.fw,__gs.doc.cage.fh]);
 await setFG('#9a6436');await p.evaluate(()=>Object.assign(__gs.brush,{size:70,hardness:.9}));
 for(let y=20;y<fs[1];y+=40)await drag([[8,y],[fs[0]-8,y]]);
 await setFG('#5a3419');await p.evaluate(()=>Object.assign(__gs.brush,{size:7,hardness:.8}));
 for(let k=1;k<6;k++){const x=fs[0]*k/6;await drag([[x,4],[x,fs[1]-4]]);}
 await setFG('#c89060');await p.evaluate(()=>Object.assign(__gs.brush,{size:5}));
 for(let k=0;k<6;k++){const x=fs[0]*(k+.5)/6;for(const y of [16,fs[1]-16]){await drag([[x,y],[x+.5,y]]);}}
 await setFG('#3a2211');await p.evaluate(()=>Object.assign(__gs.brush,{size:3}));
 for(let k=0;k<6;k++){const x0=fs[0]*k/6+10,y=fs[1]*(.3+.4*((k*37)%10)/10);await drag([[x0,y],[x0+fs[0]/6*.4,y+4],[x0+fs[0]/6*.8,y-2]]);}
 await W(700);await p.screenshot({path:IMG+'cage-flat.png'});
 await p.keyboard.press('Escape');await W(400);
 await p.keyboard.press('k');await W(600);await p.mouse.move(5,300);await p.screenshot({path:IMG+'cage-grid.png'});
 // symmetry
 await p.evaluate(()=>{__gs.newDoc(900,900,8,[.12,.13,.16],'Symmetry',false);Object.assign(__gs.brush,{size:14,hardness:.7,smoothing:0,pSize:false});__gs.ui.sym.mode='radial';__gs.ui.sym.n=8;__gs.ui.sym.cx=.5;__gs.ui.sym.cy=.5;});
 await p.keyboard.press('e');await p.keyboard.press('b');await W();
 await setFG('#e8a33d');await drag([[450,330],[480,280],[470,220],[450,190]]);
 await setFG('#6ec6ff');await drag([[450,380],[520,360],[560,300],[600,250],[640,230]]);
 await setFG('#f25f5c');await p.evaluate(()=>Object.assign(__gs.brush,{size:30}));await drag([[450,140],[451,140]]);await drag([[560,400],[561,400]]);
 await setFG('#ffffff');await p.evaluate(()=>Object.assign(__gs.brush,{size:6}));await drag([[450,420],[500,440],[540,480],[560,540]]);
 await W(600);await p.mouse.move(5,300);await p.screenshot({path:IMG+'symmetry.png'});
 ok(errs.length===0,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();
})();
