/* wiki picture: Material slots with the Skin channels (0.97.26) */
const {chromium}=require('playwright');const OLD=__dirname+'/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1500,height:950},deviceScaleFactor:2});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:256,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(4000);await p.waitForSelector('#shKind',{timeout:120000}).catch(()=>{});await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();});await p.waitForTimeout(300);
 await p.selectOption('#shKind','skin');await p.waitForTimeout(800);
 await p.evaluate(()=>{__gs.doc.mapDef=Object.assign({},__gs.doc.mapDef,{'name:u1':'Wetness'});__gs.setDocMaps(__gs.doc.maps.concat('u1'),'Wetness');__gs.renderShading();document.getElementById('shSlots').scrollIntoView();});await p.waitForTimeout(500);
 const out=require('path').resolve(__dirname,'../../docs/wiki/images');
 await p.evaluate(()=>{const c=document.getElementById('shSlots'),box=document.createElement('div');box.id='shotBox';box.className='sec';Object.assign(box.style,{position:'fixed',left:'20px',top:'20px',width:'330px',padding:'10px',zIndex:9999,background:getComputedStyle(document.body).backgroundColor});box.append(c);document.body.append(box);});await p.waitForTimeout(300);
 await (await p.$('#shotBox')).screenshot({path:out+'/material-slots.png'});
 await p.evaluate(()=>{document.getElementById('shotBox').remove();__gs.shadeEdit(d=>{d.kind='custom';d.p=d.p||{};d.p.custom={name:'Toon chrome',rows:[{id:'a',k:'toon',on:true,amt:1,p:{}},{id:'b',k:'coat',on:true,amt:.8,mask:'u1',p:{}},{id:'c',k:'rim',on:true,amt:1,p:{col:[1,.5,.3]}}]};});__gs.cxApplyTo&&0;__gs.renderShading();
   const c=document.getElementById('cxEd'),box=document.createElement('div');box.id='shotBox';box.className='sec';Object.assign(box.style,{position:'fixed',left:'20px',top:'20px',width:'330px',padding:'10px',zIndex:9999,background:getComputedStyle(document.body).backgroundColor});box.append(c);document.body.append(box);});
 await p.waitForTimeout(300);await (await p.$('#shotBox')).screenshot({path:out+'/custom-shader.png'});
 await b.close();})();
