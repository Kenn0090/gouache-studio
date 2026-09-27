const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require('path').resolve(__dirname,'../../docs/wiki/images')+'/';
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
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(120);};
 const mpx=(name,k,pts)=>p.evaluate(([name,k,pts])=>{const L=__gs.layerByName(name),t=__gs.mapT(L,k);if(!t||t.empty)return null;const d=__gs.readRGBA8(t),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,k,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};

 const W=async ms=>p.waitForTimeout(ms||300);
 const shot=async n=>{await W(400);await p.screenshot({path:OUT+n+'.png'});console.log('shot',n);};
 const elShot=async(n,sel)=>{await W(400);await p.locator(sel).first().screenshot({path:OUT+n+'.png'});console.log('shot',n);};
 const dlg=async n=>elShot(n,'#modal .dialog');
 const clip=async(n,x,y,w,h)=>{await W(400);await p.screenshot({path:OUT+n+'.png',clip:{x,y,width:w,height:h}});console.log('shot',n);};
 // 1 overview with sample tile
 const hideToast=()=>p.evaluate(()=>{const t=document.querySelector('#toast');if(t)t.hidden=true;});
 // colour jitter strokes
 await p.evaluate(()=>__gs.newDoc(512,256,8,[1,1,1],'Jitter',false));await W();await p.evaluate(()=>__gs.act('addLayer'));
 await setFG('#c8452c');await p.evaluate(()=>Object.assign(__gs.brush,{size:46,hardness:.8,opacity:1,flow:1,spacing:.3,smoothing:0,pSize:false,tip:null,hueJitter:.25,satJitter:.3,valJitter:.35}));
 await drag(40,70,470,70,{steps:14});await p.evaluate(()=>Object.assign(__gs.brush,{hueJitter:1,satJitter:0,valJitter:0}));await drag(40,180,470,180,{steps:14});
 await p.evaluate(()=>{document.querySelector('details.more').open=true;});await hideToast();
 await elShot('colour-jitter','#stage');
 await p.evaluate(()=>Object.assign(__gs.brush,{hueJitter:0,satJitter:0,valJitter:0}));
 // brush tip template
 await p.evaluate(()=>__gs.act('new'));await W();await p.click('#dlgBody .chip:text("Brush tip")');await p.click('#dlgOk');await W(500);
 await p.evaluate(()=>Object.assign(__gs.brush,{size:70,hardness:.6,flow:.8,spacing:.1,tip:null,smoothing:0,pSize:false}));
 for(let i=0;i<7;i++){const a=i/7*Math.PI*2;await drag(256,256,256+Math.cos(a)*170,256+Math.sin(a)*170,{steps:10});}
 await hideToast();await shot('brush-tip-template');
 // keyboard shortcuts dialog
 await p.evaluate(()=>__gs.act('keys'));await W();await p.fill('.kbsearch','layer');await W();await dlg('keyboard-shortcuts');await p.click('#dlgCancel');
 // preferences with themes
 await p.keyboard.press('Control+k');await W();await p.click('.themeseg button:has-text("Dark red")');await W();await dlg('preferences');await p.click('#dlgCancel');await W();
 // Brush tab
 await p.click('#modeTabs [data-mode=brush]');await W(600);await p.evaluate(()=>Object.assign(__gs.brush,{size:40,hardness:.7,flow:1,opacity:1,spacing:.1,tip:null,smoothing:0,pSize:false}));
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2-Math.PI/2;await drag(256,256,256+Math.cos(a)*190,256+Math.sin(a)*190,{steps:10});}
 await p.evaluate(()=>{const s=document.querySelector('#btSJ');s.value=.3;s.dispatchEvent(new Event('input'));const a=document.querySelector('#btAJ');a.value=1;a.dispatchEvent(new Event('input'));});
 await p.fill('#btName','Star');await W(900);await hideToast();await shot('brush-tab');
 await p.click('#modeTabs [data-mode=paint]');await W(300);
 // Specular/Gloss in Document maps
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Spec',false,'pbrsg'));await W();await p.evaluate(()=>__gs.act('maps'));await W();await dlg('maps-workflow');await p.click('#dlgCancel');
 // new layout and Filter Gallery (on the sample tile)
 await p.reload();await W(2500);await hideToast();await shot('workspace-painting');
 console.log(await p.evaluate(()=>__gs.allLayers().map(l=>l.name).join()));await p.evaluate(()=>{const L=__gs.allLayers().find(l=>/stone|cobble/i.test(l.name))||__gs.allLayers()[1];__gs.doc.active=L;__gs.doc.sel=new Set([L]);});await p.keyboard.press('Control+Shift+F');await W(2500);await p.evaluate(()=>{document.activeElement.blur();});await dlg('filter-gallery');await p.click('#dlgCancel');
 console.log(errs.join('\n'));await b.close();})();
