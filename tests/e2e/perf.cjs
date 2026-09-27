const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
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

 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'c',false));
 await setFG('#ff0000');await p.keyboard.press('b');await p.evaluate(()=>{__gs.brush.size=30;});
 await drag(20,100,280,100);            // red line on Background
 await p.keyboard.press('Control+Shift+n');await setFG('#0000ff');await drag(150,20,150,180); // blue on Layer 1
 await p.keyboard.press('Control+Shift+n');await setFG('#00ff00');
 const cp=async pts=>p.evaluate(pts=>{const d=__gs.readRGBA8(__gs.compOut()),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},pts);
 const a=await scr(40,40),c=await scr(260,160);await p.mouse.move(a[0],a[1]);await p.mouse.down();
 for(let i=1;i<=10;i++){await p.mouse.move(a[0]+(c[0]-a[0])*i/10,a[1]+(c[1]-a[1])*i/10);await p.waitForTimeout(40);}
 await p.waitForTimeout(100);const mid=await cp([[60,100],[150,60],[150,100],[100,160],[250,150]]);
 const hasCache=await p.evaluate(()=>0);
 await p.mouse.up();await p.waitForTimeout(200);const end=await cp([[60,100],[150,60],[150,100],[100,160],[250,150]]);
 ok(JSON.stringify(mid)===JSON.stringify(end),'composite during stroke (cached) equals after '+JSON.stringify(mid)+' '+JSON.stringify(end));
 await p.keyboard.press('Control+z');await p.waitForTimeout(100);await p.keyboard.press('Control+Shift+Z');await p.waitForTimeout(100);
 const re=await cp([[250,150]]);ok(re[0][1]===255,'undo/redo after async capture '+JSON.stringify(re));
 await p.click('text=View');await p.click('text=Performance monitor');await p.waitForTimeout(700);
 const t=await p.textContent('.perfbox');ok(/fps/.test(t),'perf monitor '+t.replace(/\n/g,' | '));
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
