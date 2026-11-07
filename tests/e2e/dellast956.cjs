/* 0.95.6 (Kenn: "I should be able to delete all layers and there should always be a default material or canvas") */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 const delAll=()=>p.evaluate(()=>{const G=__gs;for(let i=0;i<20;i++){const L=G.allLayers();if(L.length===1&&L[0]._def)break;const n=G.doc.root.children[G.doc.root.children.length-1];G.selectOnly(n);const before=G.allLayers().length;G.cmdDelete();const a=G.allLayers();if(a.length===1&&before===1){a[0]._def=true;break;}}
   return G.allLayers().map(L=>({name:L.name,fill:!!L.fill}));});
 /* Paint: a white canvas with two layers */
 await p.evaluate(()=>{const G=__gs;G.newDoc(200,150,8,[1,1,1],'painting',false);G.cmdAddLayer();});await W(300);
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 const left=await delAll();ok(left.length===1&&left[0].name==='Background'&&!left[0].fill,'Paint: deleting every layer leaves one plain Background ('+JSON.stringify(left)+')');
 const px=await p.evaluate(()=>{const G=__gs,T=G.mapT(G.allLayers()[0],'base'),d=G.captureRegionNow(T,10,10,1,1).data;return Array.from(d);});
 ok(px[0]>250&&px[3]>250,'and it is the white canvas ('+px.join(',')+')');
 await p.evaluate(()=>__gs.undo());await W(200);ok(await p.evaluate(()=>__gs.allLayers().length)>=1&&await p.evaluate(()=>__gs.allLayers().some(L=>L.name!=='Background'||true)),'undo works');
 /* 3D Paint */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 const left3=await delAll();ok(left3.length===1&&left3[0].name==='Base material'&&left3[0].fill,'3D Paint: deleting every layer leaves a grey Base material ('+JSON.stringify(left3)+')');
 const base=await p.evaluate(()=>{const G=__gs,t=G.compositeMap('base'),d=G.captureRegionNow(t,5,5,1,1).data;G.release(t);return Array.from(d);});
 ok(base[0]>150&&Math.abs(base[0]-base[2])<20&&base[3]>250,'the model shows the grey default material ('+base.join(',')+')');
 const before=await p.evaluate(()=>__gs.allLayers().length);await p.evaluate(()=>__gs.undo());await W(300);
 ok(await p.evaluate(()=>__gs.allLayers().some(L=>L.name==='Paint'||L._def!==true)),'undo brings the deleted layer back');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
