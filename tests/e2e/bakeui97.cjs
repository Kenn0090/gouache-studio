/* 0.97 (Kenn, with Painter and Marmoset screenshots): the Bake panel has no tabs: the group tree on top, then foldable sections
   (Geometry, Output, Maps, Fix the bake, Bake log); each map row has a tick, ⚙ (its settings unfold under it) and 🔍 (it on the model). */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:1400}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.removeItem('gs.bkSec');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'Test',false));await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(1200);
 await p.evaluate(async()=>{const G=__gs;const cube=(s,x,name,u0)=>({v:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(q=>[q[0]*s+x,q[1]*s,q[2]*s]),name,u0});
   const obj=cs=>{let t='',base=1,vt=1;for(const c of cs){const u=c.u0;t+='vt '+(u+.02)+' .02\nvt '+(u+.48)+' .02\nvt '+(u+.48)+' .98\nvt '+(u+.02)+' .98\no '+c.name+'\n';for(const q of c.v)t+='v '+q.join(' ')+'\n';
     for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]])t+='f '+f.map((i,j)=>(i+base)+'/'+(j+vt)).join(' ')+'\n';base+=8;vt+=4;}return new TextEncoder().encode(t);};
   G.bakeSetModel('low',await G.parseModelBytes('crate_low.obj',obj([cube(1,-3,'a_low',0),cube(1,3,'b_low',.5)])));
   G.bakeSetModel('high',await G.parseModelBytes('crate_high.obj',obj([cube(1.04,-3,'a_high',0),cube(1.04,3,'b_high',.5),cube(1,9,'z_high',0)])));
   G.bakeCfg.kinds={height:true};G.bakeCfg.ss=1;G.bakeCfg.perMat=false;G.buildBakePanel();});await W(500);
 const a=await p.evaluate(()=>({tabs:!!document.querySelector('#bakeBody .bktabs'),secs:['geo','out','maps','fix','log'].filter(k=>document.getElementById('bkS_'+k)),
   rows:document.querySelectorAll('#bkList .bkmap').length,gears:document.querySelectorAll('#bkList .bkgear').length,looks:document.querySelectorAll('#bkList .bklook').length,open:document.querySelectorAll('.bkmapset:not([hidden])').length,
   tree:!!document.querySelector('#btWide #btTree'),nul:/\bnull\b/.test(document.getElementById('bakeBody').innerText)}));
 ok(!a.tabs&&a.secs.length===5&&a.tree,'no tabs: the group tree, then Geometry, Output, Maps, Fix the bake and Bake log '+JSON.stringify(a));
 ok(a.rows===9&&a.gears===9&&a.looks===9&&a.open===0,'every map is a row with a tick, ⚙ and 🔍; settings start folded');
 ok(!a.nul,'no stray "null" text in the panel');
 /* ⚙ unfolds that map's settings under it; several can be open */
 await p.click('#bkGear_ao');await p.click('#bkGear_curv');await W(200);
 const g=await p.evaluate(()=>({ao:!document.getElementById('bkMapSet_ao').hidden&&!!document.querySelector('#bkMapSet_ao #bkRays'),curv:!document.getElementById('bkMapSet_curv').hidden&&!!document.querySelector('#bkMapSet_curv #bkCurvR'),
   under:document.getElementById('bkMapSet_ao').parentElement.dataset.k,nul:/\bnull\b/.test(document.getElementById('bkMapSet_ao').innerText)}));
 ok(g.ao&&g.curv&&g.under==='ao'&&!g.nul,'⚙ opens a map’s settings right under it, several at once '+JSON.stringify(g));
 await p.click('#bkGear_ao');await W(100);ok(await p.evaluate(()=>document.getElementById('bkMapSet_ao').hidden),'⚙ again folds them');
 /* sections fold and remember it */
 await p.click('#bkSec_out');await W(100);
 ok(await p.evaluate(()=>document.querySelector('#bkS_out .bksecb').hidden&&JSON.parse(localStorage.getItem('gs.bkSec')).out===false),'a section folds and is remembered');
 await p.click('#bkSec_out');await W(100);
 /* Show high / Hide low */
 await p.click('#bkShowHi');await W(200);const h1=await p.evaluate(()=>__gs.bk.showHigh);
 await p.click('#bkHideLo');await W(200);const h2=await p.evaluate(()=>__gs.bk.showHigh);
 await p.click('#bkHideLo');await W(200);const h3=await p.evaluate(()=>__gs.bk.showHigh);
 ok(h1==='over'&&h2==='only'&&h3==='over','Show high and Hide low switch what the view shows ('+[h1,h2,h3]+')');
 /* the log: matching, then a line per bake */
 const m=await p.evaluate(()=>document.getElementById('bkLog').innerText);
 ok(/a: 1 low · 1 high/.test(m)&&/Default: 0 low · 1 high — no low-poly parts/.test(m),'the Bake log lists what each group matched, and a group whose high-poly is not used '+JSON.stringify(m.slice(0,200)));
 ok(await p.evaluate(()=>document.getElementById('bkLook_height').disabled),'🔍 waits until the map is baked');
 await p.evaluate(async()=>{const G=__gs;await G.runBake(G.bkLow(),['height']);});for(let i=0;i<80&&await p.evaluate(()=>__gs.bk.busy);i++)await W(250);await W(300);
 const lg=await p.evaluate(()=>document.getElementById('bkLogList').innerText);
 ok(/Baked Height at 64 px in [\d.]+ s/.test(lg),'each bake leaves a line in the log '+JSON.stringify(lg));
 await p.click('#bkLook_height');await W(200);const s1=await p.evaluate(()=>__gs.bk.show);
 await p.click('#bkLook_height');await W(200);const s2=await p.evaluate(()=>__gs.bk.show);
 ok(s1==='height'&&s2==='material','🔍 shows that map on the model, again goes back to the material ('+s1+', '+s2+')');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
