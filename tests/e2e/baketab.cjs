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
 const W=ms=>p.waitForTimeout(ms||200);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||10});await p.mouse.up();await W(150);};
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};
 const waitIdle=async()=>{for(let i=0;i<600;i++){if(await p.evaluate(()=>!__gs.bk.busy&&!__gs.bk.regionBusy))return;await W(100);}};
 const rd=(which,pts)=>p.evaluate(([which,pts])=>{const t=which==='skew'||which==='offset'?__gs.bk.maps[which]:__gs.bk.res[which];if(!t)return null;const d=__gs.readRGBA8(t),Wd=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*Wd+x)*4,(y*Wd+x)*4+3)));},[which,pts]);
 await p.addScriptTag({path:__dirname+'/fixtures/bumpy.js'});await p.evaluate(()=>{__gs.newDoc(512,512,8,[.5,.5,.5],'BakeTab',false);});await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(600);
 let st=await p.evaluate(()=>({mode:__gs.ui.mode,v3:__gs.v3.on,sec:getComputedStyle(document.querySelector('#bakeSec')).display,lay:getComputedStyle(document.querySelector('.sec[aria-labelledby=hLayers]')).display}));
 ok(st.mode==='bake'&&st.v3&&st.sec!=='none'&&st.lay==='none','Bake tab layout '+JSON.stringify(st));
 await p.evaluate(()=>{const C=__gs.bakeCfg;C.low=__gs.primMesh('cube',0);C.high=__bumpy(__gs.primMesh('sphere',4));C.ss=4;C.pad=4;C.front=20;C.back=20;C.match=false;C.cage=null;C.average=true;for(const k in C.kinds)C.kinds[k]=k==='normal';});
 await p.evaluate(()=>__gs.act('bake'));await W(100);
 // bake, polling for partial results
 await p.click('#bkGo');await W(300);await waitIdle();const tiles=await p.evaluate(()=>__gs.bk.tiles);
 ok(tiles>=4,'the model is updated after each finished piece ('+tiles+' updates)');
 st=await p.evaluate(()=>({res:Object.keys(__gs.bk.res),layers:__gs.allLayers().length,mesh:__gs.v3.mesh&&__gs.v3.mesh.tris}));ok(st.res.includes('normal')&&st.layers===1,'bake kept in the tab '+JSON.stringify(st));
 await W(400);await p.screenshot({path:OUT+'baketab.png'});
 // sample points spread over the map (covered texels)
 const pts=[];for(let y=40;y<500;y+=40)for(let x=40;x<500;x+=40)pts.push([x,y]);
 const n0=await rd('normal',pts);
 // skew: paint black over the left half on the canvas
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#bakeBody .seg button')].find(b=>b.textContent==='Skew');b.click();});await W(200);
 ok(await p.evaluate(()=>__gs.bk.paint==='skew'&&!!__gs.bk.maps.skew),'skew map ready');
 await setFG('#000000');await p.evaluate(()=>Object.assign(__gs.brush,{size:120,hardness:1,opacity:1,flow:1,smoothing:0,pSize:false,tip:null}));
 for(let y=30;y<500;y+=90)await drag(10,y,240,y,{steps:14});
 await waitIdle();await W(200);
 const sk=await rd('skew',[[100,100],[400,100]]);ok(sk[0][0]<20&&sk[1][0]>240,'skew painted '+JSON.stringify(sk));
 const n1=await rd('normal',pts);let chL=0,chR=0;pts.forEach((q,i)=>{const d=Math.abs(n0[i][0]-n1[i][0])+Math.abs(n0[i][1]-n1[i][1])+Math.abs(n0[i][2]-n1[i][2]);if(d>6){if(q[0]<230)chL++;else if(q[0]>280)chR++;}});
 ok(chL>3&&chR===0,'skew re-baked the painted side only (changed left '+chL+', right '+chR+')');
 await p.screenshot({path:OUT+'baketab-skew.png'});
 await p.keyboard.press('Control+z');await waitIdle();await W(200);
 // mesh painting on the skew map in the 3D view
 const hb=await p.locator('#v3Hit').boundingBox();
 const before=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.bk.maps.skew);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<128)n++;return n;});
 await p.mouse.move(hb.x+hb.width*.4,hb.y+hb.height*.5);await p.mouse.down();await p.mouse.move(hb.x+hb.width*.6,hb.y+hb.height*.52,{steps:10});await p.mouse.up();await waitIdle();await W(300);
 const after=await p.evaluate(()=>{const d=__gs.readRGBA8(__gs.bk.maps.skew);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<128)n++;return n;});
 ok(after>before+200,'painting on the model paints the skew map ('+before+' → '+after+')');
 await p.screenshot({path:OUT+'baketab-mesh.png'});
 // send to document, twice (replaces)
 await p.click('#bkSend');await W(300);await p.click('#bkSend');await W(300);
 st=await p.evaluate(()=>__gs.allLayers().map(l=>l.name));ok(st.filter(n=>n==='Baked normal').length===1,'send to document (replacing) '+st.join('|'));
 // estimate offset
 await p.evaluate(()=>{const b=[...document.querySelectorAll('#bakeBody button')].find(b=>b.textContent==='Estimate offset');b.click();});await W(300);await waitIdle();
 const of=await p.evaluate(()=>{const t=__gs.bk.maps.offset;if(!t)return null;const d=__gs.readRGBA8(t);let mn=255,mx=0;for(let i=0;i<d.length;i+=4){mn=Math.min(mn,d[i]);mx=Math.max(mx,d[i]);}return [mn,mx];});
 ok(of&&of[1]-of[0]>10,'estimate offset fills the offset map '+JSON.stringify(of));
 // save/open keeps the fix maps
 const kept=await p.evaluate(async()=>{const b=await __gs.encodeGouache();await __gs.openGouache(await b.arrayBuffer(),'x.gouache');return [!!__gs.bk.maps.skew,!!__gs.bk.maps.offset,__gs.ui.mode];});
 ok(kept[0]&&kept[1],'skew and offset maps saved in .gouache '+JSON.stringify(kept));
 // paint tab: paint on the model into the layer
 await p.click('#modeTabs [data-mode=paint]');await W(400);
 st=await p.evaluate(()=>({mode:__gs.ui.mode,sec:getComputedStyle(document.querySelector('#bakeSec')).display}));ok(st.mode==='paint'&&st.sec==='none','back to Paint');
 if(!(await p.evaluate(()=>__gs.v3.on)))await p.keyboard.press('F3');await W(400);
 await p.evaluate(()=>{__gs.v3s&&0;});
 await setFG('#ff0000');await p.keyboard.press('b');
 if(!(await p.evaluate(()=>__gs.v3.paintOn)))await p.click('#v3Paint');
 const hb2=await p.locator('#v3Hit').boundingBox();
 await p.mouse.move(hb2.x+hb2.width*.45,hb2.y+hb2.height*.5);await p.mouse.down();await p.mouse.move(hb2.x+hb2.width*.55,hb2.y+hb2.height*.5,{steps:8});await p.mouse.up();await W(400);
 const red=await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.name==='Background');const d=__gs.readRGBA8(L.target);let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>200&&d[i+1]<60)n++;return n;});
 ok(red>100,'painting on the model in Paint paints the layer ('+red+' px)');
 await p.screenshot({path:OUT+'paint-mesh.png'});
 ok(errs.length===0,'no errors '+errs.join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();
})();
