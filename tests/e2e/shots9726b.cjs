/* wiki pictures: Texture Set Settings and the Marmoset-style skin settings (0.97.26) */
const {chromium}=require('playwright');const OLD=__dirname+'/';
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1500,height:950},deviceScaleFactor:2});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:256,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(4000);
 const out=require('path').resolve(__dirname,'../../docs/wiki/images');
 const grab=async(sel,file,w)=>{await p.evaluate(([sel,w])=>{const c=document.querySelector(sel),box=document.createElement('div');box.id='shotBox';box.className='sec';Object.assign(box.style,{position:'fixed',left:'20px',top:'20px',width:w+'px',padding:'10px',zIndex:9999,background:getComputedStyle(document.body).backgroundColor});const cl=c.cloneNode(true);const a=c.querySelectorAll('select'),z=cl.querySelectorAll('select');a.forEach((s,i)=>{z[i].value=s.value;});box.append(cl);document.body.append(box);},[sel,w]);
   await p.waitForTimeout(300);await (await p.$('#shotBox')).screenshot({path:out+'/'+file});await p.evaluate(()=>document.getElementById('shotBox').remove());};
 await p.evaluate(()=>{const g=__gs;g.tssAdd('sss');g.tssAdd('trans');g.doc.mapDef=Object.assign({},g.doc.mapDef,{'name:u1':'Wetness'});g.tssAdd('u1');g.tssSetFormat('height',16);g.showPanel('tsset');g.tssRender();});
 await grab('#tssBody','texset-settings.png',360);
 await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();g.showPanel('matEd');g.renderMatEd(true);});await p.waitForTimeout(300);
 await grab('#tssMatChips','material-channels.png',360);
 await p.evaluate(()=>{const g=__gs;g.showPanel('shading');g.shadeEdit(d=>{d.kind='skin';});g.renderShading();});await p.waitForTimeout(500);
 await grab('#skMarm','skin-marmoset.png',360);
 await b.close();})();
