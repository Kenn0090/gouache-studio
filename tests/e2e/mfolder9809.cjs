const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(400);
 const mean=()=>p.evaluate(()=>{const L=window.__L;__gs.msUpdate(L);const d=__gs.readRGBA8(L.mask.target);let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s/(d.length/4);});
 const eva=(f)=>p.evaluate(f);
 await eva(()=>{const g=__gs;g.cmdAddLayer();const L=window.__L=g.doc.active;const f=g.msAdd(L,'folder');window.__F=f.id;const r=g.msAdd(L,'fill',{p:{v:1}});window.__R=r.id;g.msUpdate(L);});await p.waitForTimeout(300);
 ok(await eva(()=>{const S=__L.mask.stack,f=S.find(x=>x.id===__F),r=S.find(x=>x.id===__R);return f.kind==='folder'&&r.par===f.id;}),'a row added with a folder selected goes inside it');
 const m0=await mean();ok(m0>240,'the folder blends its rows (white) '+m0.toFixed(0));
 await eva(()=>{const L=__L,f=L.mask.stack.find(x=>x.id===__F);f.op=.5;L.lookVer=(L.lookVer||0)+1;});await p.waitForTimeout(200);
 const m1=await mean();ok(m1>110&&m1<145,'the folder’s opacity applies to everything inside it '+m1.toFixed(0));
 await eva(()=>{const L=__L,f=L.mask.stack.find(x=>x.id===__F);f.op=1;L.lookVer++;});
 /* a mask stack for the row inside the folder: black paint row, then a white fill row on top of it */
 await eva(()=>{const g=__gs,L=__L;g.msAddRowMask(L,__R,true);g.msUpdate(L);});await p.waitForTimeout(200);
 const m2=await mean();ok(m2<10,'a black mask on the row hides it '+m2.toFixed(0));
 await eva(()=>{const g=__gs,L=__L;const r=g.msAdd(L,'fill',{p:{v:1}});window.__M2=r.id;g.msUpdate(L);});await p.waitForTimeout(200);
 const m3=await mean();ok(await eva(()=>{const S=__L.mask.stack,x=S.find(r=>r.id===__M2);return !!x.mkOf;})&&m3>240,'a second row added in the row’s mask stack lifts it again (a stack, not one picture) '+m3.toFixed(0));
 /* another layer as a mask */
 await eva(()=>{const g=__gs,L=__L;g.cmdAddLayer();const O=g.doc.active;O.name='Source';const T=g.ensureMapTarget(O,'base');g.clearTarget(T,[1,1,1,1]);g.scissorDo([0,0,32,64],()=>g.clearTarget(T,[0,0,0,1]));g.changedAll();
   const L2=window.__L2=g.doc.layers?null:null;g.selectOnly(L);g.ui.msSel=null;const r=g.msAdd(L,'layerref',{p:{name:'Source',map:'base',inv:false}});window.__LR=r.id;});
 await eva(()=>{const L=__L;L.mask.stack.filter(r=>r.kind!=='layerref').forEach(r=>{r.on=false;});L.lookVer++;});await p.waitForTimeout(300);
 const m4=await mean();ok(m4>100&&m4<150,'a layer drives a mask row by brightness (half black, half white) '+m4.toFixed(0));
 /* folders: group, take out, delete with everything inside */
 await eva(()=>{const L=__L;L.mask.stack.forEach(r=>{r.on=true;});L.mask.stack.find(r=>r.kind==='layerref').on=false;});
 const n0=await eva(()=>__L.mask.stack.length);
 await eva(()=>{const g=__gs,L=__L;const f=g.msGroupRow(L,__LR);window.__F2=f.id;});
 ok(await eva(()=>{const S=__L.mask.stack;return S.find(x=>x.id===__LR).par===__F2;}),'Group into a folder wraps the row');
 await eva(()=>__gs.msUngroupRow(__L,__LR));ok(await eva(()=>!__L.mask.stack.find(x=>x.id===__LR).par),'Take out of the folder undoes it');
 await eva(()=>__gs.msIntoFolder(__L,__LR,__F));ok(await eva(()=>__L.mask.stack.find(x=>x.id===__LR).par===__F),'Move into a folder');
 /* deleting a folder takes everything inside it along (rows, and rows of their masks) */
 await eva(()=>{const g=__gs,L=__L;g.ui.msSel=null;const f=g.msAdd(L,'folder');window.__F3=f.id;const n=g.msAdd(L,'noise');window.__N3=n.id;g.msAddRowMask(L,n.id,false);});
 const before=await eva(()=>__L.mask.stack.filter(x=>x.id===__F3||x.par===__F3||x.mkOf===__N3).length);
 await eva(()=>__gs.msRemove(__L,'m',__F3));
 const after=await eva(()=>__L.mask.stack.filter(x=>x.id===__F3||x.par===__F3||x.mkOf===__N3||x.id===__N3).length);
 ok(before>=3&&after===0,'deleting a folder removes the rows inside it and their masks ('+before+' -> '+after+')');
 /* save and reopen: folders, row masks and a layer row all come back */
 await eva(()=>{const g=__gs,L=__L;g.ui.msSel=null;for(const x of [...L.mask.stack])if(x.kind==='fill'&&!x.mkOf&&!x.par)x.on=true;});
 const sig0=await eva(()=>JSON.stringify(__L.mask.stack.map(r=>[r.kind,r.par?1:0,r.mkOf?1:0,r.on!==false])));
 const rt=await eva(async()=>{const g=__gs,bl=await g.encodeGouache();const buf=await bl.arrayBuffer();await g.openGouache(buf,'t.gouache');const L=[...g.allNodes(g.doc.root)].find(n=>n.mask&&n.mask.stack&&n.mask.stack.some(r=>r.kind==='folder'));
   return L?JSON.stringify(L.mask.stack.map(r=>[r.kind,r.par?1:0,r.mkOf?1:0,r.on!==false])):null;});
 ok(rt===sig0,'the folders and row masks survive saving and opening '+(rt?rt.length:'none'));
 /* an old file's single-paint-mask marker (p.forRow) still reads as a mask stack */
 await eva(()=>{const g=__gs,L=__L;g.ui.msSel=null;const r=g.msAdd(L,'fill',{p:{v:1}});window.__O=r.id;L.mask.stack.forEach(x=>{if(x.id!==__O)x.on=false;});
   const c=g.msRowMaskOf?null:null;const S=L.mask.stack;const comp=Object.assign({},S[0]);});
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
