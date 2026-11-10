/* 0.96.9 (Kenn): bake groups like Marmoset: a tree of groups (Low / High parts), auto by name, drag between groups, eye, bake tick,
   group colours, rename, delete, and a Quick loader at the top of the Bake tab. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:1500}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.click('#modeTabs [data-mode=bake]');await W(1200);
 ok(await p.evaluate(()=>!!document.querySelector('#btLoader #btSlot_low')&&!!document.querySelector('#btLoader #btSlot_high')),'the Quick loader has a Low and a High slot');
 await p.evaluate(async()=>{const G=__gs;const cube=(s,x,name)=>({v:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(q=>[(q[0]+x)*s,q[1]*s,q[2]*s]),name});
   const obj=cs=>{let t='vt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\n',base=1;for(const c of cs){t+='o '+c.name+'\n';for(const q of c.v)t+='v '+q.join(' ')+'\n';for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]])t+='f '+f.map((i,j)=>(i+base)+'/'+(j+1)).join(' ')+'\n';base+=8;}return new TextEncoder().encode(t);};
   const L=await G.parseModelBytes('crate_low.obj',obj([cube(1,-3,'a_low'),cube(1,0,'b_low'),cube(1,3,'c_low')]));
   const H=await G.parseModelBytes('crate_high.obj',obj([cube(1,-3,'a_high'),cube(1,0,'b_high'),cube(1,3,'z_high')]));
   G.bakeSetModel('low',L);G.bakeSetModel('high',H);});await W(600);
 const a=await p.evaluate(()=>{const G=__gs,T=G.btTree(),n=id=>T.groups.find(g=>g.id===id).name;return {groups:T.groups.map(g=>g.name),low:Object.fromEntries(Object.entries(T.low).map(([k,v])=>[k,n(v)])),high:Object.fromEntries(Object.entries(T.high).map(([k,v])=>[k,n(v)])),ui:document.querySelectorAll('#btTree .btgroup').length,chips:document.querySelectorAll('#btTree .btpart').length,mode:G.bakeCfg.groupMode};});
 ok(a.mode==='tree'&&a.groups.join()==='Default,a,b','groups by name: Default, a, b '+JSON.stringify(a));
 ok(a.low.a_low==='a'&&a.low.b_low==='b'&&a.low.c_low==='Default'&&a.high.a_high==='a'&&a.high.b_high==='b'&&a.high.z_high==='Default','matching names pair up, the rest go in Default');
 ok(a.ui===3&&a.chips===6,'the tree shows 3 groups and 6 parts');
 /* the bake: each group's low only sees its own high */
 const ids=()=>p.evaluate(()=>{const G=__gs,P=G.bakePrep(G.bkLow());return {low:[...new Set(P.low.vertPart)].sort().join(),high:[...new Set(P.high.bakePart)].sort().join()};});
 const i1=await ids();ok(i1.low==='1,2,3'&&i1.high==='1,2,3','each group has its own number in the bake '+JSON.stringify(i1));
 /* drag c_low onto group b's Low */
 const src=p.locator('#btTree .btpart[data-part="c_low"]'),dst=p.locator('#btTree .btgroup').nth(2).locator('.btfolder[data-side=low] .btfh');

 await src.dragTo(dst);await W(400);
 const d=await p.evaluate(()=>{const T=__gs.btTree();return T.groups.find(g=>g.id===T.low.c_low).name;});
 ok(d==='b','dragging a part onto another group moves it ('+d+')');
 /* leave group b out of the bake */
 await p.evaluate(()=>{const T=__gs.btTree();document.getElementById('btSkip_'+T.groups.find(g=>g.name==='b').id).click();});await W(300);
 const i2=await ids();ok(!i2.low.split(',').includes('3')&&i2.low.split(',').includes('0')&&i2.high.includes('9999'),'a group that is not baked gets nothing '+JSON.stringify(i2));
 /* hide group a in the view */
 const t0=await p.evaluate(()=>__gs.v3.mesh.idx.length/3);
 await p.evaluate(()=>{const T=__gs.btTree(),g=T.groups.find(g=>g.name==='a');document.querySelector('#btTree .btgroup[data-id="'+g.id+'"] .bteye').click();});await W(500);
 const t1=await p.evaluate(()=>__gs.v3.mesh.idx.length/3);
 ok(t0===36&&t1===24,'the eye hides a group’s parts in the view ('+t0+' → '+t1+')');
 /* Low and High folders have their own eyes: hiding b's High leaves the low-poly alone, hiding b's Low hides its low parts */
 await p.evaluate(()=>{const T=__gs.btTree(),g=T.groups.find(g=>g.name==='b');document.getElementById('btEye_high_'+g.id).click();});await W(400);
 const t2=await p.evaluate(()=>__gs.v3.mesh.idx.length/3);
 await p.evaluate(()=>{const T=__gs.btTree(),g=T.groups.find(g=>g.name==='b');document.getElementById('btEye_low_'+g.id).click();});await W(400);
 const t3=await p.evaluate(()=>__gs.v3.mesh.idx.length/3);
 ok(t2===24&&t3===0,'the Low and High folders hide on their own ('+t2+' → '+t3+')');
 ok(await p.evaluate(()=>document.querySelectorAll('#btTree .btfolder').length===6&&!!document.querySelector('#btTree .btfolder[data-side=low] .btset')),'every group shows a Low and a High folder, with the cage and skew settings in Low');
 const i3=await ids();ok(i3.low.split(',').includes('2'),'hidden groups are still baked '+JSON.stringify(i3));
 /* group colours */
 await p.click('#btColours');await W(600);
 const c=await p.evaluate(()=>{const G=__gs;G.requestRender(true);return {on:G.btg.colours,tex:!!G.btg.tex&&G.v3.btex&&G.v3.btex.base===G.btg.tex};});
 ok(c.on&&c.tex,'Group colours paints the low-poly in its groups’ colours '+JSON.stringify(c));
 /* rename and delete */
 await p.dblclick('#btTree .btgroup:nth-child(2) .btname');await p.keyboard.press('Control+A');await p.keyboard.type('Barrel');await p.keyboard.press('Enter');await W(300);
 ok(await p.evaluate(()=>__gs.btTree().groups.some(g=>g.name==='Barrel')),'double-click renames a group');
 await p.click('#btAdd');await W(200);const n4=await p.evaluate(()=>__gs.btTree().groups.length);
 await p.evaluate(()=>{const T=__gs.btTree();__gs.bgtDelete(T.groups[T.groups.length-1]);});await W(200);
 ok(n4===4&&await p.evaluate(()=>__gs.btTree().groups.length)===3,'+ Group adds one, × deletes it');
 await p.click('#btAuto');await W(300);
 ok(await p.evaluate(()=>{const T=__gs.btTree();return T.groups.map(g=>g.name).join()==='Default,a,b'&&!T.groups.some(g=>g.skip||g.hide);}),'Auto groups by name again');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
