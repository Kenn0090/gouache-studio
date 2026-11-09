/* 0.96.1 (Kenn): Generators lists the baked maps (AO, Curvature, …) and their rows have Balance / Contrast / Invert (+ edges/cavities for curvature) */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const G=__gs,d=G.doc;d.meshMaps=d.meshMaps||{};const mk=v=>{const t=G.makeTarget(d.w,d.h,8,false);G.clearTarget(t,[v,v,v,1]);return t;};d.meshMaps.ao=mk(.3);d.meshMaps.curv=mk(.75);
   G.selectOnly(G.layerByName('Paint'));G.cmdAddMask&&G.cmdAddMask();});await W(400);
 /* the right-click menu lists them under Generators */
 const names=await p.evaluate(()=>{const G=__gs,L=G.doc.active;const m=G.layerMenu?null:null;return G.MS_MESH_GENS?G.MS_MESH_GENS.map(x=>x[1]):null;});
 let menuOk=false;{const target=p.locator('.lrow').filter({has:p.locator('.lname',{hasText:'Paint'})}).first();await target.locator('.mthumb').click({button:'right'});await W(200);
   await p.getByRole('menuitem',{name:'Generators',exact:true}).click();await W(200);
   menuOk=await p.getByRole('menuitem',{name:'Ambient occlusion',exact:true}).count()===1&&await p.getByRole('menuitem',{name:'Curvature: edges',exact:true}).count()===1;
   if(menuOk){await p.getByRole('menuitem',{name:'Ambient occlusion',exact:true}).click();await W(300);menuOk=await p.evaluate(()=>{const r=__gs.doc.active.mask.stack.at(-1);return r.kind==='mesh'&&r.p.k==='ao';});}}
 ok(menuOk,'right-click › Generators lists Ambient occlusion and Curvature (edges/cavities)');
 const val=async(set)=>p.evaluate(set=>{const G=__gs,L=G.doc.active;L.mask.stack.splice(0);G.msAdd(L,'mesh',{p:Object.assign(G.MS_KINDS.mesh.p(),set)});G.msUpdate(L);const t=L.mask.target;return G.captureRegionNow(t,8,8,1,1).data[0];},set);
 const ao=await val({k:'ao'}),aoB=await val({k:'ao',bal:.4}),aoC=await val({k:'ao',con:1}),aoI=await val({k:'ao',inv:true});
 ok(Math.abs(ao-77)<4,'AO row reads the baked map ('+ao+')');ok(Math.abs(aoB-128)<5,'Balance lifts it ('+aoB+')');ok(aoC<10,'Contrast pushes it apart ('+aoC+')');ok(Math.abs(aoI-178)<4,'Invert flips it ('+aoI+')');
 const ce=await val({k:'curv',part:'edges'}),cc=await val({k:'curv',part:'cavities'});
 ok(Math.abs(ce-128)<5&&cc<4,'Curvature: edges keeps the bright part, cavities the dark part ('+ce+', '+cc+')');
 await p.evaluate(()=>{const G=__gs,L=G.doc.active,r=L.mask.stack[0];G.ui.msSel={L,where:'m',id:r.id};G.ui.editMask=true;G.showPanel('matEd');G.renderMatEd(true);});await W(400);
 ok(await p.isVisible('#ms_bal')&&await p.isVisible('#ms_con'),'Properties shows Balance and Contrast for the row');
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
