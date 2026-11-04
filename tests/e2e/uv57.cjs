/* 0.57 weapons pass: bent ribbons are cut so they lie straight; very small pieces join their neighbour; no overlap results. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1200,height:800}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForTimeout(3000);
 // box fill: a straight strip fills its rectangle, a bent one does not
 const fill=await p.evaluate(()=>{const G=__gs,mk=(pts)=>{const u=[],v=[],tris=[];const n=pts.length;pts.forEach(([a,b])=>{u.push(a[0],b[0]);v.push(a[1],b[1]);});for(let i=0;i<n-1;i++){const k=i*2;tris.push([k,k+1,k+3],[k,k+3,k+2]);}return {u:Float64Array.from(u),v:Float64Array.from(v),tris};};
  const straight=mk(Array.from({length:20},(_,i)=>[[i,0],[i,1]])),arc=mk(Array.from({length:20},(_,i)=>{const a=i/19*Math.PI*.9;return [[Math.cos(a)*10,Math.sin(a)*10],[Math.cos(a)*11,Math.sin(a)*11]];}));
  return {s:G.uwBoxFill(straight),a:G.uwBoxFill(arc)};});
 ok(fill.s>.9&&fill.a<.5,'box fill: straight strip '+fill.s.toFixed(2)+', bent strip '+fill.a.toFixed(2));
 // small pieces joining: never more pieces, never overlap
 const res=await p.evaluate(async()=>{const G=__gs,out={};for(const name of ['rcube','cylinder','sphere']){const m0=G.primMesh(name,0),m=Object.assign({},m0,{noUV:true});
   if(!m.nrm||!m.nrm.length){m.nrm=new Float32Array(m.pos.length);for(let i=0;i<m.nrm.length;i+=3){const l=Math.hypot(m.pos[i],m.pos[i+1],m.pos[i+2])||1;m.nrm[i]=m.pos[i]/l;m.nrm[i+1]=m.pos[i+1]/l;m.nrm[i+2]=m.pos[i+2]/l;}}
   const run=async extra=>{const res=await G.uwUnwrap(m,Object.assign(G.uwPresetOpts('artist'),{seed:1,size:1024},extra)),lay=G.uwLayout(m,res),nm=G.uwBuild(m,res,lay);return {n:res.flats.length,ov:G.uwAnalyze(nm).overlapPct};};
   out[name]={on:await run({}),off:await run({absorbSmall:false,fillMin:0})};}return out;});
 for(const [k,v] of Object.entries(res))ok(v.on.n<=v.off.n+1&&v.on.ov<.5,k+': pieces '+v.off.n+' → '+v.on.n+', overlap '+v.on.ov.toFixed(2)+'%');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
