/* 0.97.27 (Georgian: "proper curvature controls to tune big shapes, medium and small shapes, like in Substance") */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 /* a test curvature map: a broad left-to-right ramp (big shapes) plus a fine 4-px checker (small details) */
 const r=await p.evaluate(()=>{const g=__gs,W=g.doc.w,H=g.doc.h,gl=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(W*H*4);
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){const v=Math.round(255*(.5+.3*(x/W-.5)+(((x>>2)+(y>>2))&1?.08:-.08)));px.set([v,v,v,255],(y*W+x)*4);}
   const src=g.makeTarget(W,H,8,false);gl.bindTexture(gl.TEXTURE_2D,src.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,W,H,gl.RGBA,gl.UNSIGNED_BYTE,px);
   const read=t=>g.captureRegionNow(t,0,0,W,H).data;
   const stats=d=>{/* fine detail: mean |difference to the right neighbour|; broad ramp: mean of the right quarter minus the left quarter */let fine=0,n=0,L=0,R=0,nl=0,nr=0;
     for(let y=8;y<H-8;y+=3)for(let x=8;x<W-8;x+=3){const i=(y*W+x)*4;fine+=Math.abs(d[i]-d[i+4]);n++;if(x<W/4){L+=d[i];nl++;}if(x>W*3/4){R+=d[i];nr++;}}return {fine:fine/n,ramp:R/nr-L/nl};};
   const s0=stats(read(src));
   const one=(o)=>{const t=g.curvBands(src,o,8);const st=stats(read(t));g.release(t);return st;};
   const all=one({big:1,med:1,small:1.0001}),noSmall=one({small:0}),noBig=one({big:0,med:0}),pushBig=one({big:2.5});
   return {s0,all,noSmall,noBig,pushBig,on:[g.curvBandsOn(undefined),g.curvBandsOn({big:1,med:1,small:1}),g.curvBandsOn({small:.5})]};});
 ok(!r.on[0]&&!r.on[1]&&r.on[2],'at 100% each nothing is changed (the step is skipped)');
 ok(Math.abs(r.all.fine-r.s0.fine)<r.s0.fine*.1&&Math.abs(r.all.ramp-r.s0.ramp)<6,'the three sizes add back up to the original map '+JSON.stringify([r.s0,r.all]));
 ok(r.noSmall.fine<r.s0.fine*.35&&Math.abs(r.noSmall.ramp-r.s0.ramp)<r.s0.ramp*.25,'Small details 0% takes the fine detail out and keeps the big shape '+JSON.stringify(r.noSmall));
 ok(r.noBig.ramp<r.s0.ramp*.35&&r.noBig.fine>r.s0.fine*.7,'Big and medium 0% flatten the broad shape and keep the fine detail '+JSON.stringify(r.noBig));
 ok(r.pushBig.ramp>r.s0.ramp*1.6,'Big shapes 250% pushes the broad shape '+JSON.stringify(r.pushBig));
 /* the sliders: in the generator settings (3D Paint) and the Bake tab's curvature */
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await p.waitForTimeout(3000);
 const gen=await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;const row=g.msAdd(L,'gen',{p:g.msGenDefaults('edge')});g.msSelect(L,'m',(row||L.mask.stack[L.mask.stack.length-1]).id);
   return {big:!!document.getElementById('msCb_big'),med:!!document.getElementById('msCb_med'),small:!!document.getElementById('msCb_small'),card:!!document.getElementById('msC_curvbands')};});
 ok(gen.big&&gen.med&&gen.small,'a generator has Big shapes, Medium shapes and Small details sliders '+JSON.stringify(gen));
 const before=await p.evaluate(()=>{const g=__gs,L=g.doc.active;g.msUpdate&&g.msUpdate(L);const t=L.mask.target,d=g.captureRegionNow(t,0,0,t.w,t.h).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return s;});
 await p.evaluate(()=>{const i=document.querySelector('#msCb_small');i.value='0';i.dispatchEvent(new Event('input',{bubbles:true}));});await p.waitForTimeout(900);
 const after=await p.evaluate(()=>{const g=__gs,L=g.doc.active,row=L.mask.stack[L.mask.stack.length-1];g.msUpdate&&g.msUpdate(L);const t=L.mask.target,d=g.captureRegionNow(t,0,0,t.w,t.h).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];return {s,cb:row.p.cb};});
 ok(after.cb&&after.cb.small===0,'moving the slider stores it on the generator '+JSON.stringify(after.cb));
 ok(after.s!==before,'…and changes the mask ('+before+' → '+after.s+')');
 /* the Mask Builder: the sliders sit right under its curvature inputs */
 const mb=await p.evaluate(()=>{const g=__gs,L=g.doc.active,row=g.msAdd(L,'gen',{p:g.msGenDefaults('builder')});g.msSelect(L,'m',(row||L.mask.stack[L.mask.stack.length-1]).id);
   const b=document.getElementById('matEdBody'),cav=b.querySelector('#ms_cavityWeight'),card=b.querySelector('#msC_curvbands');
   return {card:!!card,big:!!b.querySelector('#msCb_big'),after:!!(cav&&card&&(cav.compareDocumentPosition(card)&Node.DOCUMENT_POSITION_FOLLOWING))};});
 ok(mb.card&&mb.big&&mb.after,'the Mask Builder has the curvature detail sliders, under its curvature inputs '+JSON.stringify(mb));
 /* the Bake mesh maps window in 3D Paint */
 const pb=await p.evaluate(()=>{__gs.dlgP3Bake();const ok=!!document.getElementById('p3bkCb_big')&&!!document.getElementById('p3bkCb_small');document.getElementById('dlgCancel')?.click();return ok;});
 ok(pb,'the Bake mesh maps window has them too');
 /* the converter Curvature from normal */
 ok(await p.evaluate(()=>['cbBig','cbMed','cbSmall'].every(k=>__gs.CONVERTERS.curvFromNormal.defs.some(d=>d.key===k))),'the Curvature from normal converter has Big / Medium / Small');
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=bake]').click());await p.waitForTimeout(2500);
 const bk=await p.evaluate(()=>{const g=__gs;g.bakeCfg.mapOpen=Object.assign({},g.bakeCfg.mapOpen,{curv:true});g.buildBakePanel&&g.buildBakePanel();return !!document.getElementById('bkCb_big')&&!!document.getElementById('bkCb_small');});
 ok(bk,'the Bake tab\'s curvature has the same sliders');
 /* the Convert tab's curvature */
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=convert]').click());await p.waitForTimeout(2500);
 const cv=await p.evaluate(()=>{const g=__gs;g.cvS.tab='curv';g.buildConvertPanel&&g.buildConvertPanel();return !!document.getElementById('cvCb_big')&&!!document.getElementById('cvCb_small');});
 ok(cv,'the Convert tab\'s curvature has them as well');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
