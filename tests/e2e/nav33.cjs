/* 0.33: Shift while turning snaps to a side view; clicking layers doesn't scroll the list; scale lock */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 const url='file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug';
 await p.goto(url);await p.waitForTimeout(2500);await p.goto(url);await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 // scale lock maths
 const r=await p.evaluate(()=>{localStorage.setItem('gs.pxfLock','1');const x={s:[1,2,4]};__gs.pxfSetScale(x,0,2,3);const a=x.s.slice();localStorage.setItem('gs.pxfLock','0');__gs.pxfSetScale(x,1,9,3);return [a,x.s];});
 ok(JSON.stringify(r[0])===JSON.stringify([2,4,8]),'locked: all scale numbers move together '+r[0]);
 ok(r[1][1]===9&&r[1][0]===2,'unlocked: only one moves '+r[1]);
 // clicking mask rows keeps the layer list where it was (the dock is rebuilt when Properties comes forward)
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'nav',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{for(let i=0;i<6;i++){const L=__gs.cmdAddLayer();__gs.cmdAddMask(1);__gs.msAdd(L,'fill',{p:{v:1}});__gs.msAdd(L,'noise',{p:{type:'clouds',scale:4,contrast:3,level:0,seed:3,tri:false,inv:false}});__gs.cfxAdd(L,'invert');}});await W(500);
 const bodyOf=()=>document.querySelector('#layerList').closest('.dkbody');
 await p.evaluate(()=>{document.querySelector('#layerList').closest('.dkbody').scrollTop=300;});
 for(let k=0;k<4;k++){const info=await p.evaluate(k=>{const bd=document.querySelector('#layerList').closest('.dkbody').getBoundingClientRect();const rs=[...document.querySelectorAll('#layerList .lrow,#layerList .msrow')].filter(r=>{const b=r.getBoundingClientRect();return b.top>bd.top+5&&b.bottom<bd.bottom-5;});const b=rs[(k*3)%rs.length].getBoundingClientRect();return {x:b.left+90,y:b.top+b.height/2};},k);
  await p.mouse.click(info.x,info.y);await W(500);
  const st=await p.evaluate(()=>document.querySelector('#layerList').closest('.dkbody').scrollTop);ok(Math.abs(st-300)<3,'click '+(k+1)+' on the layer stack: list stays put ('+st+')');}
 // Shift snaps while turning
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.keyboard.down('Alt');await p.keyboard.down('Shift');await p.mouse.move(cx,cy);await p.mouse.down();
 for(let i=1;i<=10;i++){await p.mouse.move(cx-i*9,cy+i*1);await W(30);}
 const c=await p.evaluate(()=>({y:__gs.v3.cam.yaw,p:__gs.v3.cam.pitch}));
 await p.mouse.up();await p.keyboard.up('Shift');await p.keyboard.up('Alt');
 const Q=Math.PI/2;ok(Math.abs(c.y/Q-Math.round(c.y/Q))<.01&&Math.abs(c.p)<.01,'Shift snapped the turn to a side view (yaw '+c.y.toFixed(3)+', pitch '+c.p.toFixed(3)+')');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
