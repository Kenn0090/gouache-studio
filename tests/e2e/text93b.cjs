/* 0.93.3: text effects (Disorder, Wave, Slant, Stretch, Case) */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.t3Bitmap,null,{timeout:60000});await p.waitForTimeout(1500);
 const r=await p.evaluate(async()=>{const base={content:'Hello World',font:'Sans',size:96,bold:true,italic:false,align:'left',lineHeight:1.15,tracking:0,outline:0};
   const px=async spec=>{const B=await __gs.t3Bitmap(spec,false),d=__gs.captureRegionNow(B.T,0,0,B.bw,B.bh).data;let n=0,h=0;for(let i=0;i<d.length;i+=4){if(d[i+3]>40){n++;h=(h*31+i+d[i+3])>>>0;}}return {w:B.bw,h:B.bh,ink:n,hash:h};};
   const plain=await px(base),dis=await px(Object.assign({},base,{disorder:.6,seed:3})),dis2=await px(Object.assign({},base,{disorder:.6,seed:4})),wide=await px(Object.assign({},base,{stretch:200})),slant=await px(Object.assign({},base,{slant:25})),wave=await px(Object.assign({},base,{wave:.6})),up=await px(Object.assign({},base,{caseMode:'upper'})),turn=await px(Object.assign({},base,{turn:30,turnPct:1,seed:6})),turnHalf=await px(Object.assign({},base,{turn:30,turnPct:.5,seed:6})),turnNone=await px(Object.assign({},base,{turn:30,turnPct:0,seed:6})),turnBack=await px(Object.assign({},base,{turn:-30,turnPct:1,seed:6})),same=await px(Object.assign({},base,{disorder:.6,seed:3}));
   return {plain,dis,dis2,wide,slant,wave,up,same,turn,turnHalf,turnNone,turnBack};});
 console.log(JSON.stringify(r));
 ok(r.dis.hash!==r.plain.hash&&r.dis.w>r.plain.w,'Disorder shakes the letters (and makes room for them)');
 ok(r.dis.hash!==r.dis2.hash,'Shuffle (another seed) gives another arrangement');
 ok(r.dis.hash===r.same.hash,'the same seed gives the same arrangement every time');
 ok(r.wide.w>r.plain.w*1.7,'Stretch 200% makes the words about twice as wide ('+r.plain.w+' → '+r.wide.w+')');
 ok(r.slant.hash!==r.plain.hash&&r.wave.hash!==r.plain.hash&&r.wave.h>r.plain.h,'Slant and Wave change the picture');
 ok(r.up.hash!==r.plain.hash,'Case: UPPERCASE changes the letters');
 ok(r.turn.hash!==r.plain.hash&&r.turnBack.hash!==r.turn.hash,'Letter turn rotates the letters left or right');
 ok(r.turnHalf.hash!==r.turn.hash&&r.turnHalf.hash!==r.turnNone.hash,'Letters turned sets how many of the letters turn (50% differs from all and from none)');
 ok(Math.abs(r.turnNone.ink-r.plain.ink)<30,'0% turns no letter at all ('+r.turnNone.ink+' vs '+r.plain.ink+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
