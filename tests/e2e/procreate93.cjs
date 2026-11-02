/* 0.93.2: Procreate settings read from a real .brushset's key names (numbers only; the file itself is not in the repo) */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.bzProcreateSettings,null,{timeout:60000});
 const r=await p.evaluate(()=>{const notes=new Set();const x=__gs.bzProcreateSettings({plotSpacing:.0099,shapeCount:.0625,shapeScatter:.754,shapeRotation:1,shapeAngle:0,dynamicsJitterSize:.62,dynamicsPressureSize:1,plotSmoothing:.28,paintSize:.052,maxOpacity:1,bundledGrainPath:'Brush-Preset-Blank.png',dynamicsJitterHue:.2},notes);return {x,notes:[...notes]};});
 console.log(JSON.stringify(r.x));
 ok(r.x.count===1&&r.x.angle===undefined,'the shape count is a fraction of 16 and "rotation" is not read as an angle');
 ok(Math.abs(r.x.sizeJitter-.62)<.01&&Math.abs(r.x.smoothing-.28)<.01&&r.x.size===42,'size jitter, smoothing and size come across');
 ok(r.x.grain===undefined,'a blank grain is not turned into grain');
 ok(r.x.hueJitter===.2&&r.x.jitterPerStroke===false,'hue jitter comes across');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
