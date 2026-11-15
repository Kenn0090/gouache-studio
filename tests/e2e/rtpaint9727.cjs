/* 0.97.27 (Kenn: "when painting it's flickering a lot"): in the Ray traced view the traced textures follow the paint during a stroke */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(3000);
 await p.evaluate(()=>{const g=__gs,L=g.allLayers().find(l=>l.name==='Paint');g.doc.active=L;g.doc.sel=new Set([L]);g.setTool('brush');Object.assign(g.brush,{size:40,opacity:1,flow:1});g.v3s().rtSamples=2;g.v3.rt=true;g.v3.dirty=true;g.requestRender(true);});
 for(let i=0;i<60&&!(await p.evaluate(()=>!!__gs.rt.mat));i++)await p.waitForTimeout(500);
 ok(await p.evaluate(()=>!!__gs.rt.mat),'the ray-traced view is ready');
 const k0=await p.evaluate(()=>__gs.rt.matKey);
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.mouse.move(cx-40,cy);await p.mouse.down();const keys=new Set();
 for(let i=0;i<6;i++){await p.mouse.move(cx-40+i*14,cy);await p.waitForTimeout(250);keys.add(await p.evaluate(()=>__gs.rt.matKey));}
 await p.mouse.up();
 ok([...keys].some(k=>k!==k0)&&keys.size>=3,'during the stroke the traced textures are remade with the paint ('+keys.size+' versions)');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
