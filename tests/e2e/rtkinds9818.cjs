/* 0.98.18: every viewer shader traces in the ray-traced view: the tracer compiles, each look gives a picture, and the special ones differ
   from Standard (glass bends the sky through, car paint has a clear coat, toon has bands...). */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:800,height:560}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(async()=>{const g=__gs;g.setMode('paint');g.p3.started=false;await g.p3NewProject(128,{modelKey:'sphere'});const L=g.paintLayers().find(x=>x.fill);
   L.fill.maps.base.c=[.7,.5,.4];if(L.fill.maps.rough){L.fill.maps.rough.on=true;L.fill.maps.rough.v=.4;}g.fillRender(L);
   const s=g.v3s();s.env='none';s.sunI=3;s.sunAz=40;s.sunEl=40;s.envBg=false;s.rtSamples=6;s.rtMove=1;
   Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:3,tx:0,ty:0,tz:0});g.v3.rt=true;g.v3.mapsDirty=true;g.v3.dirty=true;g.requestRender(true);});
 await p.waitForTimeout(3000);
 const render=async kind=>{await p.evaluate(k=>{const g=__gs;g.shadeEdit(x=>{x.kind=k;});g.v3.dirty=true;g.requestRender(true);},kind);await p.waitForTimeout(1500);
   for(let i=0;i<200;i++){await p.waitForTimeout(400);const n=await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);return __gs.rt.view?__gs.rt.view.n:0;});if(n>=6){await p.waitForTimeout(600);if(await p.evaluate(()=>__gs.rt.view.n)>=6)break;}}
   return await p.evaluate(()=>{const g=__gs,S=g.rt.view,d=g.rtPixels(S,true),w=S.w,h=S.h;let c=[0,0,0],n=0,bad=0;
     for(let y=Math.round(h*.3);y<h*.7;y+=2)for(let x=Math.round(w/2-h*.2);x<w/2+h*.2;x+=2){const i=(y*w+x)*4;for(let j=0;j<3;j++)c[j]+=d[i+j];n++;}
     return {c:c.map(v=>+(v/n).toFixed(1)),n:S.n};});};
 const kinds=['std','skin','glass','car','iridescent','velvet','cloth','aniso','wax','eye','fur','toon','cel','halfcel','ink','hatch','hologram'];const R={};
 for(const k of kinds){R[k]=await render(k);console.log(k.padEnd(11),JSON.stringify(R[k]));}
 ok(kinds.every(k=>R[k].n>=6&&R[k].c.every(Number.isFinite)),'every shader traces');
 const dif=(a,b)=>Math.abs(a.c[0]-b.c[0])+Math.abs(a.c[1]-b.c[1])+Math.abs(a.c[2]-b.c[2]);
 const differ=kinds.filter(k=>k!=='std'&&dif(R[k],R.std)>4);console.log('different from Standard:',differ.join(' '));
 ok(R.glass.c[2]>60,'glass lets the sky through ('+R.glass.c+')');
 for(const k of ['glass','car','toon','hologram','velvet'])ok(differ.includes(k),k+' looks different from Standard');
 ok(!errs.length,'no page errors '+[...new Set(errs)].slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
