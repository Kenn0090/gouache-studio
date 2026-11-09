/* 0.96.4 (Kenn: smart material "adds nothing" when dropped; "the Gmat file is 193mb"): a smart material made from a Library
   material names it instead of copying its pictures, still comes back whole, and a smart material that cannot be built says so. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  {const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:__dirname+'/../../assets/materials/'+m[1],contentType:'application/octet-stream'});}
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>__gs.useModel(__gs.primMesh('sphere',1)));await W(600);
 const a=await p.evaluate(async()=>{const G=__gs,rec=G.gmRecs.find(r=>r.bundled&&!r.bundled.dl);const L=await G.gmApply(rec);
   const keys=Object.keys(L._fillImg||{}),tagged=keys.filter(k=>L._fillImg[k]._lib).length;
   const tree={t:'G',name:'Mine',open:true,kids:[G.smSer(L)]};const r=G.smPut({kind:'smart',name:'Mine',tree});
   const k0=tree.kids[0],body=await G.smImgsOut({tree});const size=JSON.stringify(body).length;
   return {name:rec.name,keys:keys.length,tagged,lib:k0.lib,pics:Object.keys(k0.fillImg||{}).length,size};});
 ok(a.keys>0&&a.tagged===a.keys,'Library pictures are tagged '+JSON.stringify(a));
 ok(!!a.lib&&a.pics===0,'the smart material names the Library material and copies no pictures');
 ok(a.size<20000,'its .gmat body is small ('+a.size+' characters)');
 const c=await p.evaluate(async()=>{const G=__gs,r=G.matLib.list.find(x=>x.name==='Mine');const n0=G.doc.root.children.length;
   const n=await G.libApply('smart',r,{at:{parent:G.doc.root,index:n0}});const L=n&&n.children&&n.children[0];
   const ks=L&&L._fillImg?Object.keys(L._fillImg):[];return {added:G.doc.root.children.length-n0,ks:ks.length,tag:ks.every(k=>L._fillImg[k]._lib),src:L&&L.fill.maps.base.src};});
 ok(c.added===1&&c.ks===a.keys&&c.src==='image','dropping it adds the folder with the Library pictures back '+JSON.stringify(c));
 ok(c.tag,'and the pictures stay tagged, so saving it again stays small');
 const d=await p.evaluate(async()=>{const G=__gs,n0=G.doc.root.children.length;let res;
   try{res=G.smApply({name:'Broken',tree:{t:'G',name:'Broken',kids:[null]}});}catch(e){return 'THREW '+e.message;}
   await new Promise(r=>setTimeout(r,300));return {res:res===null,same:G.doc.root.children.length===n0,toast:document.getElementById('toast').textContent};});
 ok(d&&d.same&&/Could not add “Broken”/.test(d.toast),'a smart material that cannot be built says so '+JSON.stringify(d));
 ok(errs.length===0,'no page errors '+errs.join('\n').slice(0,600));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
