/* 0.97.15 (Kenn): Save As like Photoshop in the desktop app: one file window with a "Save as type" list, then the format's options, then the file is written.
   The operating system's window is stood in for here; what it is given and what gets written are checked. */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1500,height:950}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
await p.evaluate(()=>{const G=__gs;G.closeWelcome&&G.closeWelcome();G.newDoc(64,48,8,[.8,.3,.2],'Sunset',false);window.__asked=null;window.__written=[];
  Object.defineProperty(G.platform,'isDesktop',{value:true,configurable:true});
  G.platform.saveAsPath=async(name,filters)=>{window.__asked={name,filters};return window.__next;};
  G.platform.writeFile=async(pth,bytes)=>{window.__written.push({path:pth,size:(bytes.size||bytes.byteLength||bytes.length)});};
  G.platform.recentAdd=()=>{};});
const run=async(next)=>{await p.evaluate(n=>{window.__next=n;window.__written=[];__gs.dlgSaveAs();},next);await p.waitForTimeout(600);};
await run('/tmp/Sunset.png');
const asked=await p.evaluate(()=>window.__asked);
ok(asked&&asked.filters.length>=9&&asked.name==='sunset.gouache'||asked.name==='Sunset.gouache'||/\.gouache$/.test(asked.name),'one standard window with a type list ('+asked.filters.length+' types), starting at the document type: '+asked.name);
ok(asked.filters.some(f=>f.extensions.includes('png'))&&asked.filters.some(f=>f.extensions.includes('jpeg'))&&asked.filters.some(f=>f.extensions.includes('psd')),'the list has PNG, JPEG and Photoshop');
ok(await p.evaluate(()=>!!document.querySelector('#modal .fmt-opts')&&!document.getElementById('modal').hidden),'choosing a .png then shows the PNG options');
await p.click('#dlgOk');await p.waitForTimeout(1200);
let w=await p.evaluate(()=>window.__written);ok(w.length===1&&w[0].path==='/tmp/Sunset.png'&&w[0].size>50,'OK writes the PNG to the chosen path ('+JSON.stringify(w)+')');
await run('/tmp/Sunset.jpg');ok(await p.evaluate(()=>!!document.getElementById('eQ')),'a .jpg shows the Quality slider');await p.click('#dlgOk');await p.waitForTimeout(1200);
w=await p.evaluate(()=>window.__written);ok(w.length===1&&w[0].path==='/tmp/Sunset.jpg'&&w[0].size>50,'OK writes the JPEG');
await run('/tmp/Sunset.gouache');w=await p.evaluate(()=>window.__written);ok(w.length===1&&w[0].path==='/tmp/Sunset.gouache'&&w[0].size>100,'a .gouache is saved straight away, with no options window ('+JSON.stringify(w)+')');
await run('/tmp/NoExtension');await p.waitForTimeout(300);w=await p.evaluate(()=>window.__written);ok(w.length===1&&/\.gouache$/.test(w[0].path),'a name with no extension gets the current type\'s extension: '+(w[0]&&w[0].path));
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
