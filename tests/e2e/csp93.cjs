/* 0.93.2: Clip Studio brushes (.sut/.sutg are SQLite): settings and tip picture are read. The fixture is a tiny database made for this test. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');const fs=require('fs'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.cspFromDb,null,{timeout:60000});await p.waitForTimeout(1500);
 const b64=fs.readFileSync(path.join(__dirname,'fixtures/csp-mini.sqlite.b64'),'utf8');
 const r=await p.evaluate(async b64=>{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const t=__gs.sqliteTables(u,['Node','Variant','MaterialFile']);
   const out=await __gs.cspFromDb(u,'mini.sut',new Set());const q=out.presets[0];
   return {nodes:t.Node.length,mat:t.MaterialFile[0].FileData.length,n:out.presets.length,name:q.name,size:q.size,hard:q.hardness,opacity:q.opacity,spacing:q.spacing,round:q.roundness,angle:q.angle,aj:q.angleJitter,pSize:q.pSize,pOp:q.pOpacity,tip:q.tip?q.tip.w+'x'+q.tip.h:null};},b64);
 console.log(JSON.stringify(r));
 ok(r.nodes===2&&r.mat>3000,'the SQLite reader reads the tables, including a picture that spans several pages');
 ok(r.n===1&&r.name==='Test pen','one brush, named from the file');
 ok(r.size===17&&r.hard===1&&r.opacity===.8&&Math.abs(r.spacing-.1)<1e-9&&r.round===.83&&r.angle===330&&Math.abs(r.aj-.15)<1e-9,'size (mm to pixels), hardness, opacity, spacing, roundness and rotation come across');
 ok(r.pSize===true&&r.pOp===false,'pen pressure flags are read');
 ok(r.tip==='16x16','the tip picture is found through the brush\'s material path');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
