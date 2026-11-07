/* 0.95.6: new smart materials (weapons, sci-fi, fantasy, stylised, staples) and smart masks; old ones upgraded (Distort + Warp
   breakup, height on wear/dirt layers); mixed grunges in Textures */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1440,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();const m=u.match(/materials\/([a-z0-9-]+\.gmat)$/);if(m)return r.fulfill({path:path.join(__dirname,'../../assets/materials',m[1]),contentType:'application/octet-stream'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 const NEW=['Handled Gunmetal','Blued Steel','Battle-Worn Plate','Sci-fi Hull Paint','Anodised Aluminium','Glowing Trim','Ornate Gold','Enchanted Iron','Weathered Skin','Stylised Wood','Stylised Stone','Stylised Steel','Stylised Gold','Stylised Leather','Painted Steel Worn','Smudged Chrome','Dusty Rubber','Matte Plastic','Forged Iron','Tarnished Silver','Stained Aluminium'];
 const have=await p.evaluate(()=>__gs.smBuiltins().map(r=>r.name));
 ok(NEW.every(n=>have.includes(n)),'all '+NEW.length+' new smart materials are listed ('+NEW.filter(n=>!have.includes(n)).join(', ')+')');
 const up=await p.evaluate(()=>{const r=__gs.smBuiltins().find(r=>r.name==='Gun Metal'),worn=r.tree.kids[1];return {warp:worn.mask.rows.some(x=>x.kind==='filter'&&x.own==='warp'),dist:worn.mask.rows[0].p.distort,h:worn.fill.maps.height&&worn.fill.maps.height.v};});
 ok(up.warp&&up.dist>0&&Math.abs(up.h-.46)<1e-6,'old built-ins are upgraded: Warp row, Distort and height on the wear layer '+JSON.stringify(up));
 const hp=await p.evaluate(()=>{const r=__gs.smBuiltins().find(r=>r.name==='Stylised Gold'),c=r.tree.kids[0].cfx[0];return {fx:c.fx,base:c.v.base,preset:c.v.preset};});
 ok(hp.fx==='handPaint'&&Array.isArray(hp.base),'stylised ones carry the Hand-painted look with its preset filled in '+JSON.stringify(hp));
 for(const n of NEW){const r=await p.evaluate(async n=>{const G=__gs;const rec=G.smBuiltins().find(r=>r.name===n);G.selectOnly(G.layerByName('Base material'));const node=await G.smApply(rec);if(!node)return 'none';G.composite&&G.composite();const kids=(node.children||[]).length;G.selectOnly(node);G.cmdDelete();return kids;},n);
   ok(typeof r==='number'&&r>=1,'adds “'+n+'” ('+r+' layer'+(r===1?'':'s')+')');}
 const masks=await p.evaluate(()=>__gs.smaskBuiltins().map(r=>r.name));
 const NEWM=['Battle damage','Blade scratches','Bullet nicks','Grip wear','Scorch marks','Torn coating','Gashed paint','Moss in cavities','Water streaks','Sun-bleached top','Snow on top','Sand in crevices','Mud splash low','Ground dirt','Surface leaks','Dust in occlusion','Painterly edge highlight','Top light','Hand-painted cavity shade','Colour variation patches','Height bottom to top','Ambient occlusion only','Curvature edges only','Thin parts (thickness)'];
 ok(NEWM.every(n=>masks.includes(n)),NEWM.length+' new smart masks are listed ('+NEWM.filter(n=>!masks.includes(n)).join(', ')+')');
 const mres=await p.evaluate(async names=>{const G=__gs,out={};G.cmdNewFillLayer({name:'M',maps:{base:{on:true,c:[1,0,0]}}});const L=G.doc.active;
   for(const n of names){await G.smMaskApply(G.smaskBuiltins().find(r=>r.name===n));L.mask._key=null;G.msUpdate(L,true);const T=L.mask.target,d=G.captureRegionNow(T,0,0,T.w,T.h).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i];out[n]=+(s/(d.length/4)).toFixed(1);}return out;},NEWM);
 console.log('  mask means:',JSON.stringify(mres));
 const empty=Object.entries(mres).filter(([k,v])=>!(v>0.2)&&!/occlusion only|Curvature edges|Thin parts/.test(k));
 ok(!empty.length,'every new smart mask gives a mask on the default model ('+empty.map(e=>e[0]).join(', ')+')');
 const tx=await p.evaluate(()=>__gs.txItems().filter(i=>i.category==='Mixed').map(i=>i.name));
 ok(tx.length===12,'the 12 mixed grunges are in Textures › Mixed ('+tx.length+')');
 ok(!errs.length,'no errors '+errs.join('|').slice(0,800));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
