/* 0.97.10 (Kenn): border lock - a moved or scaled layer snaps its edges and centre to the canvas edges and centre.
   The maths is checked here; dragging a real transform needs the desktop-like browser (msedge) the other transform tests use. */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await(await b.newContext({viewport:{width:1400,height:900}})).newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
await p.evaluate(()=>{__gs.newDoc(400,300);__gs.view.zoom=1;});await p.waitForTimeout(400);
const S=bb=>p.evaluate(bb=>__gs.xfSnapShift(bb),bb);
let r=await S([6,50,106,120]);ok(r[0]===-6&&r[2]===0,'a left edge 6 px from the canvas edge snaps onto it: '+r);
r=await S([290,50,394,120]);ok(r[0]===6&&r[2]===400,'a right edge 6 px short snaps onto the right edge: '+r);
r=await S([150,50,246,120]);ok(r[0]===2&&r[2]===200,'the centre snaps onto the canvas centre: '+r);
r=await S([30,60,100,120]);ok(r[0]===null&&r[1]===null,'far from every edge nothing snaps');
r=await S([30,140,100,164]);ok(r[1]===-2&&r[3]===150,'the vertical centre snaps too: '+r);
ok(await p.evaluate(()=>{localStorage.removeItem('gs.xfSnap');return __gs.xfSnapOn()}),'on by default');
ok(!await p.evaluate(()=>{localStorage.setItem('gs.xfSnap','0');return __gs.xfSnapOn()}),'the View switch turns it off');
ok(errs.length===0,'no page errors '+errs.join('|'));
await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0)})();
