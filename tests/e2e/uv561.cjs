/* 0.56.1: a bucket shape (a tube with a flat shoulder) is laid flat instead of fanned out; the overlap check sees a piece lying on itself;
   a small piece that hugs its neighbour is not cut out on its own. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000}).catch(()=>{});
 await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(1200);
 const r=await p.evaluate(async()=>{const G=__gs,out={};
   /* a bucket: wall of a tube, a flat flange to a small neck hole on top, open at the bottom and in a gap at the front */
   const Nc=40,Nh=14,Nr=7,R=1,H=1.3,rn=.3,pos=[],idx=[],a0=.25,a1=2*Math.PI-.25;
   const ring=(r,y)=>{const base=pos.length/3;for(let i=0;i<=Nc;i++){const a=a0+(a1-a0)*i/Nc;pos.push(Math.cos(a)*r,y,Math.sin(a)*r);}return base;};
   const rows=[];for(let j=0;j<=Nh;j++)rows.push(ring(R,H*j/Nh));for(let k=1;k<=Nr;k++)rows.push(ring(R+(rn-R)*k/Nr,H));
   for(let j=0;j<rows.length-1;j++)for(let i=0;i<Nc;i++){const a=rows[j]+i,b=rows[j]+i+1,c=rows[j+1]+i,d=rows[j+1]+i+1;idx.push(a,c,b,b,c,d);}
   const nrm=new Float32Array(pos.length);for(let i=0;i<pos.length/3;i++){nrm[i*3+1]=1;}
   const m={name:'bucket',pos:Float32Array.from(pos),nrm,idx:Uint32Array.from(idx),uv:null,noUV:true,tris:idx.length/3};
   const nm=await G.uvRunUnwrap(m,Object.assign({},G.uwPresetOpts('clothing'),{seed:1,size:1024}),true);
   const ov=G.uvOverlapCheck(nm);out.bucket={tris:m.tris,islands:G.uwAnalyze(nm).islands,pct:+ov.pct.toFixed(2),pixelPct:+ov.pixelPct.toFixed(2)};
   /* a strip bent round on itself with no flipped triangle: the check used to say nothing */
   const n=60,P=[],UV=[],I=[];for(let i=0;i<=n;i++)for(let j=0;j<=1;j++){P.push(i*.1,j*.1,0);const a=i/n*2*Math.PI*1.3,rr=.25+j*.08;UV.push(.5+Math.cos(a)*rr,.5+Math.sin(a)*rr);}
   for(let i=0;i<n;i++){const a=i*2,b=i*2+1,c=i*2+2,d=i*2+3;I.push(a,c,b,b,c,d);}
   const sp={name:'spiral',pos:Float32Array.from(P),nrm:new Float32Array(P.length).map((v,i)=>i%3===2?1:0),idx:Uint32Array.from(I),uv:Float32Array.from(UV),tris:I.length/3,noUV:false};
   const sc=G.uvOverlapCheck(sp);out.spiral={faces:sc.faces,folded:sc.folded};
   return out;});
 console.log(JSON.stringify(r));
 ok(r.bucket.islands<=10,'the bucket is cut into a handful of pieces ('+r.bucket.islands+')');
 ok(r.bucket.pct<3,'the bucket lies flat with almost no overlap ('+r.bucket.pct+'% of faces)');
 ok(r.spiral.faces>0&&r.spiral.folded>0,'the overlap check sees a piece that covers itself ('+JSON.stringify(r.spiral)+')');
 ok(errs.length===0,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASSED');process.exit(fails?1:0);
})();
