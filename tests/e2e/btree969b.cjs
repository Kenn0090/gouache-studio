/* 0.96.9 part 2 (Kenn): each bake group has its own cage distance (Front / Back) and its own skew amount. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:880}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'Test',false));await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(1200);
 /* two cubes, each in its own half of the UV square; the high-poly cubes are 4% bigger */
 await p.evaluate(async()=>{const G=__gs;const cube=(s,x,name,u0)=>({v:[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(q=>[q[0]*s+x,q[1]*s,q[2]*s]),name,u0});
   const obj=cs=>{let t='',base=1,vt=1;for(const c of cs){const u=c.u0;t+='vt '+(u+.02)+' .02\nvt '+(u+.48)+' .02\nvt '+(u+.48)+' .98\nvt '+(u+.02)+' .98\n';t+='o '+c.name+'\n';for(const q of c.v)t+='v '+q.join(' ')+'\n';
     for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[2,3,7,6],[1,2,6,5],[0,4,7,3]])t+='f '+f.map((i,j)=>(i+base)+'/'+(j+vt)).join(' ')+'\n';base+=8;vt+=4;}return new TextEncoder().encode(t);};
   G.bakeSetModel('low',await G.parseModelBytes('crate_low.obj',obj([cube(1,-3,'a_low',0),cube(1,3,'b_low',.5)])));
   G.bakeSetModel('high',await G.parseModelBytes('crate_high.obj',obj([cube(1.04,-3,'a_high',0),cube(1.04,3,'b_high',.5)])));
   const C=G.bakeCfg;C.kinds={height:true};C.front=8;C.back=8;C.ss=1;C.perMat=false;});await W(500);
 const bakeHalves=async()=>{await p.evaluate(async()=>{const G=__gs;await G.runBake(G.bkLow(),['height']);});for(let i=0;i<80;i++){if(!await p.evaluate(()=>__gs.bk.busy))break;await W(250);}
   return p.evaluate(()=>{const G=__gs,t=G.bk.res.height,d=G.captureRegionNow(t,0,0,t.w,t.h).data;const half=(x0,x1)=>{let s=0,n=0;for(let y=Math.round(t.h*.2);y<t.h*.8;y++)for(let x=Math.round(t.w*x0);x<t.w*x1;x++){s+=d[(y*t.w+x)*4];n++;}return s/n;};return [half(.08,.42),half(.58,.92)];});};
 const g0=await p.evaluate(()=>{const T=__gs.btTree();return T.groups.map(g=>g.name).join();});
 ok(g0==='Default,a,b','two groups by name '+g0);
 ok(await p.evaluate(()=>__gs.btGFB(__gs.bakeCfg)===null),'nothing per group yet: the baker gets no group table');
 const h0=await bakeHalves();
 ok(Math.abs(h0[0]-h0[1])<12,'with the same cage both cubes bake alike '+JSON.stringify(h0));
 /* group a: its own cage with no distance: its rays find nothing */
 await p.evaluate(()=>{const T=__gs.btTree(),a=T.groups.find(g=>g.name==='a');document.getElementById('btOwn_'+a.id).click();});await W(300);
 ok(await p.evaluate(()=>{const T=__gs.btTree(),a=T.groups.find(g=>g.name==='a');return !!document.getElementById('btFront_'+a.id)&&a.front===8;}),'Own cage shows the group’s Front and Back, starting from General’s');
 await p.evaluate(()=>{const T=__gs.btTree(),a=T.groups.find(g=>g.name==='a');a.front=0;a.back=0;});
 const gfb=await p.evaluate(()=>{const G=__gs,T=G.btTree(),a=T.groups.find(g=>g.name==='a'),f=G.btGFB(G.bakeCfg);return [...f.slice(a.id*4,a.id*4+4)];});
 ok(gfb[0]===0&&gfb[2]===1&&gfb[3]===1,'the baker gets group a’s own distances '+JSON.stringify(gfb));
 const h1=await bakeHalves();
 ok(Math.abs(h1[1]-h0[1])<6&&Math.abs(h1[0]-h0[0])>12,'only group a bakes differently '+JSON.stringify({before:h0,after:h1}));
 /* skew per group */
 await p.evaluate(()=>{const T=__gs.btTree(),b=T.groups.find(g=>g.name==='b');b.skew=0;});
 const sk=await p.evaluate(()=>{const G=__gs,T=G.btTree(),b=T.groups.find(g=>g.name==='b'),f=G.btGFB(G.bakeCfg);return f[b.id*4+3];});
 ok(sk===0,'a group’s Skew reaches the baker');
 await bakeHalves();
 ok(await p.evaluate(()=>!!document.getElementById('btSkew_'+__gs.btTree().groups[1].id)),'every group has a Skew slider');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
