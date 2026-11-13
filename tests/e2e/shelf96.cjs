/* 0.96 (Kenn): the 3D Paint shelf like Painter's: categories with icons, quick bar, Brushes for 3D, Alphas, condensed brush settings */
const {chromium}=require('playwright'),path=require('path');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const ctx=await b.newContext({viewport:{width:1600,height:950}});const p=await ctx.newPage();
 /* an OLD saved 3D Paint layout: the Brushes panel in the right dock, the old shelf list (no gs.shelf96 flag yet) */
 await p.addInitScript(()=>{try{if(!localStorage.getItem('gs.shelf96')&&!localStorage.getItem('gs.dock')){const old={groups:[{tabs:['p3d','p3bake','shading'],f:1.2},{tabs:['layers','maps','chan','hist','brushes'],f:2.5}],shelf:{tabs:['mats','textures','decals','envs','projects','meshmaps','weldtools'],f:1,h:260},icons:[],floats:[],tb:{side:'left',cols:1},opt:true,w:300,extra:{v3:.45}};
   localStorage.setItem('gs.dock',JSON.stringify({ws:'texturing',modeWs:{p3d:'texturing'},modeLayouts:{p3d:{texturing:old}},saved:{texturing:old}}));localStorage.setItem('gs.layout37','1');localStorage.setItem('gs.layout371','1');localStorage.setItem('gs.shelf36','1');}}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.click('#modeTabs [data-mode=p3d]');await W(3000);
 /* categories */
 const cats=await p.evaluate(()=>({tabs:__gs.dk.L.shelf.tabs.slice(),names:[...document.querySelectorAll('#dkShelf .dktab')].map(b=>b.textContent.trim()),icons:[...document.querySelectorAll('#dkShelf .dktab')].filter(b=>b.querySelector('svg.dkti')).length,brushesInDock:__gs.dk.L.groups.some(g=>g.tabs.includes('brushes')),hidden:__gs.dk.L.hidden.slice()}));
 ok(cats.tabs.join()==='shbrush,mats,smats,smasks,shgen,shalpha,textures,decals,envs,meshmaps,shtools,projects','shelf categories in the Painter-like order '+cats.tabs.join());
 ok(cats.names.slice(0,6).join()==='Brushes,Materials,Smart materials,Smart masks,Generators,Alphas'&&cats.icons===cats.names.length,'each category has an icon: '+cats.names.join(' · '));
 ok(!cats.brushesInDock&&cats.hidden.includes('brushes'),'an older saved layout loses the Brushes panel from the 3D Paint dock (it is the shelf’s first category now)');
 /* the quick bar on every tile category */
 for(const c of ['shbrush','mats','smats','smasks','shalpha','textures','decals','envs']){await p.evaluate(c=>__gs.showPanel(c),c);await W(900);
   const has=await p.evaluate(c=>{const bar=document.getElementById('shbar_'+c);return !!bar&&!!bar.querySelector('.shq')&&!!bar.querySelector('#sh_fav_'+c)&&!!bar.querySelector('#sh_recent_'+c)&&bar.querySelectorAll('.shsz').length===3&&bar.querySelectorAll('.shvw').length===2&&bar.offsetParent!==null;},c);
   ok(has,'quick bar (search, ★, recent, S M L, grid/list) in '+c);}
 /* search, size and list */
 await p.evaluate(()=>__gs.showPanel('mats'));await W(800);
 const n0=await p.evaluate(()=>[...document.querySelectorAll('#matSec .mattile')].filter(t=>!(t.closest('.matwrap')||t).hidden).length);
 await p.fill('#shq_mats','steel');await W(300);
 const n1=await p.evaluate(()=>{const v=[...document.querySelectorAll('#matSec .mattile')].filter(t=>!(t.closest('.matwrap')||t).hidden);return {n:v.length,all:v.every(t=>/steel/i.test(t.textContent))};});
 ok(n0>20&&n1.n>0&&n1.n<n0&&n1.all,'search filters the tiles ('+n0+' → '+n1.n+')');await p.fill('#shq_mats','');await W(300);
 await p.click('#shsz_l_mats');await W(1200);const tw=await p.evaluate(()=>getComputedStyle(document.getElementById('matSec')).getPropertyValue('--tw').trim());
 await p.click('#shsz_s_mats');await W(1200);const tws=await p.evaluate(()=>getComputedStyle(document.getElementById('matSec')).getPropertyValue('--tw').trim());
 ok(tw==='104px'&&tws==='44px','tile size S/M/L changes the tiles ('+tws+' · '+tw+')');await p.click('#shsz_m_mats');await W(800);
 await p.click('#shvw_list_mats');await W(500);ok(await p.evaluate(()=>document.getElementById('matSec').classList.contains('shlist')),'list view');await p.click('#shvw_grid_mats');await W(300);
 /* favourites and recent */
 const key=await p.evaluate(()=>{const t=document.querySelector('#matSec #matLib .mattile');t.querySelector('.shstar').click();return t.dataset.shkey;});
 ok(await p.evaluate(k=>JSON.parse(localStorage.getItem('gs.shFav')).includes(k),key),'the star keeps a favourite ('+key+')');
 await p.click('#sh_fav_mats');await W(500);
 const fv=await p.evaluate(()=>[...document.querySelectorAll('#matSec .mattile')].filter(t=>!(t.closest('.matwrap')||t).hidden).map(t=>t.dataset.shkey));
 ok(fv.length===1&&fv[0]===key,'★ shows only the favourites');await p.click('#sh_fav_mats');await W(300);
 await p.evaluate(()=>{const ts=[...document.querySelectorAll('#matSec #matLib .mattile')];ts[3].click();});await W(300);
 await p.click('#sh_recent_mats');await W(500);
 const rc=await p.evaluate(()=>[...document.querySelectorAll('#matSec .mattile')].filter(t=>!(t.closest('.matwrap')||t).hidden).length);
 ok(rc===1,'🕒 shows what was used recently');await p.click('#sh_recent_mats');await W(300);
 /* smart materials and masks are their own categories */
 await p.evaluate(()=>__gs.showPanel('smats'));await W(900);
 const sm=await p.evaluate(()=>({a:document.querySelectorAll('#smGrid .mattile').length,m:!!document.querySelector('#matBody #smGrid')}));
 await p.evaluate(()=>__gs.showPanel('smasks'));await W(900);const mk=await p.evaluate(()=>document.querySelectorAll('#smMaskGrid .mattile').length);
 ok(sm.a>=30&&!sm.m&&mk>=20,'Smart materials ('+sm.a+') and Smart masks ('+mk+') are categories of their own, not chips inside Materials');
 /* Brushes: the ones that work on the model */
 await p.evaluate(()=>__gs.showPanel('shbrush'));await W(1200);
 const br=await p.evaluate(()=>{const g=__gs,all=g.library.flatMap(s=>s.presets),w=all.filter(g.shWorks3D),bad=all.filter(x=>!g.shWorks3D(x));return {all:all.length,w:w.length,tiles:document.querySelectorAll('#shBrushBody .shbt').length,mixing:!![...document.querySelectorAll('#shBrushBody .shbt')].find(t=>bad.some(x=>x.name===t._preset.name&&x.mix)),badN:bad.length};});
 ok(br.tiles>0&&br.tiles<br.all&&br.badN>0&&!br.mixing,'Brushes lists the ones that work on the model ('+br.tiles+' of '+br.all+')');
 await p.evaluate(()=>{__gs.v3s().paintAlign='wrap';__gs.shMarkDirty('shbrush');});await W(1000);const brw=await p.evaluate(()=>document.querySelectorAll('#shBrushBody .shbt').length);await p.evaluate(()=>{__gs.v3s().paintAlign='uv';__gs.shMarkDirty('shbrush');});await W(1000);
 ok(brw<br.tiles,'with Tangent | Wrap fewer brushes work than with UV alignment ('+brw+' < '+br.tiles+')');
 await p.click('#shall_all');await W(1500);const all=await p.evaluate(()=>document.querySelectorAll('#shBrushBody .shbt').length);
 ok(all>br.tiles,'“All brushes” shows every brush ('+all+')');await p.click('#shall_3d');await W(1200);
 const pick=await p.evaluate(()=>{const t=[...document.querySelectorAll('#shBrushBody .shbt')].find(x=>x._preset.name!==__gs.activePreset?.name);t.click();return {n:t._preset.name,act:__gs.activePreset&&__gs.activePreset.name};});await W(400);
 ok(pick.n===pick.act&&await p.evaluate(()=>!!document.querySelector('#shBrushBody .shbt.sel')),'clicking a brush tile selects the brush ('+pick.n+')');
 /* Alphas */
 await p.evaluate(()=>__gs.showPanel('shalpha'));await W(1200);
 const al=await p.evaluate(()=>{const t=document.querySelectorAll('#shAlphaBody .shat');const x=t[3];x.click();return {n:t.length,tip:__gs.brush.tip&&__gs.brush.tip.name,want:x._tip.name};});
 ok(al.n>20&&al.tip===al.want,'Alphas lists the brush tips; a click gives the brush that tip ('+al.n+' tips, '+al.want+')');
 /* the condensed brush settings: what is hidden depends on the projection alignment (UV, the default, works like the flat canvas) */
 const sets=async(align)=>{await p.evaluate(a=>{__gs.v3s().paintAlign=a;__gs.setTool('erase');__gs.setTool('brush');},align);await W(500);await p.evaluate(()=>__gs.showPanel('tool'));await W(400);
   return p.evaluate(()=>({mix:!!document.getElementById('bMix'),drip:!!document.getElementById('bDrip'),sp:!!document.getElementById('bSpace'),groups:document.querySelectorAll('#brushBody details.brg3').length,sym:!!document.querySelector('#brushBody [id^=sym]'),prev:!!document.querySelector('#toolSec #brushPrev'),stencil:!!document.querySelector('#toolSec #stBrush'),all:!!document.getElementById('bShowAll3d'),curve:!!document.getElementById('bSmCurve')}));};
 const cw=await sets('wrap');
 ok(!cw.mix&&!cw.drip&&!cw.curve&&cw.sp&&cw.groups>=2&&cw.all&&!cw.sym,'Tangent | Wrap: mixing, drips and smooth curves are hidden; spacing sits in a folding group '+JSON.stringify(cw));
 const cu=await sets('uv');
 ok(cu.mix&&cu.drip&&cu.curve&&cu.sp&&cu.groups>=2,'UV alignment (works like the canvas): mixing, drips and smooth curves are there '+JSON.stringify(cu));
 ok(cu.prev&&cu.stencil,'the stroke preview and the stencil sit with the brush settings');
 await sets('wrap');await p.evaluate(()=>{document.getElementById('bShowAll3d').click();});await W(600);
 const c2=await p.evaluate(()=>({mix:!!document.getElementById('bMix'),drip:!!document.getElementById('bDrip')}));
 ok(c2.mix&&c2.drip,'“Show all settings” brings the rest back');await p.evaluate(()=>{document.getElementById('bShowAll3d').click();});await W(400);await sets('uv');
 /* Pressure without a pen now works on the model too (it did nothing there before) */
 await p.evaluate(async()=>{const G=__gs;G.setMode('p3d',true);G.p3.savedAt=G.p3Sig();await G.p3NewProject(128,{modelKey:'plane'});G.useModel(G.primMesh('plane',1));Object.assign(G.v3.cam,{yaw:0,pitch:0,dist:3.2,tx:0,ty:0,tz:0});Object.assign(G.v3s(),{disp:0,showUV:false,litUV:false});G.v3.paintOn=true;G.prefs.paintSpeed='best';G.setTool('brush');G.setFG([1,0,0]);});
 await W(1500);const box=await p.locator('#v3Hit').boundingBox();
 const stroke=async(sim,zig)=>{await p.evaluate(sim=>{const G=__gs,b=G.brush,d=G.BRUSH_DEFAULTS;for(const k of G.SETTING_KEYS)if(!['size','opacity','flow','hardness'].includes(k))b[k]=d[k];b.size=34;b.opacity=1;b.flow=1;b.hardness=.85;b.tip=null;Object.assign(b,sim);const t=G.compositeMap('base');window.__pre=G.captureRegionNow(t,0,0,t.w,t.h).data.slice();G.release(t);},sim);
   await p.mouse.move(box.x+box.width*.3,box.y+box.height*.5);await p.mouse.down();for(let i=1;i<=10;i++){await p.mouse.move(box.x+box.width*(.3+.04*i),box.y+box.height*(.5+(zig?(i%2?.12:-.12):0)));await W(30);}await p.mouse.up();await W(600);
   const n=await p.evaluate(()=>{const G=__gs,t=G.compositeMap('base'),d=G.captureRegionNow(t,0,0,t.w,t.h).data;G.release(t);let n=0;for(let i=0;i<d.length;i+=4)if(Math.abs(d[i]-__pre[i])+Math.abs(d[i+1]-__pre[i+1])+Math.abs(d[i+2]-__pre[i+2])>30)n++;return n;});
   await p.evaluate(()=>__gs.undo());await W(300);return n;};
 const full=await stroke({}),thin=await stroke({simP:'fixed',simLevel:.2}),tap=await stroke({simP:'taper'});
 ok(full>400&&thin<full*.6,'Pressure without a pen (Fixed) thins a stroke on the model ('+thin+' pixels instead of '+full+')');
 ok(tap!==full,'…and Taper changes it too ('+tap+')');
 const lz=await stroke({lazy:90}),smo=await stroke({smoothing:.95},true),zg=await stroke({smoothing:0},true);
 ok(lz<full*.85,'Lazy mouse works with UV alignment on the model ('+lz+' pixels instead of '+full+')');
 ok(smo<zg*.9,'…and Smoothing rounds a zigzag off ('+smo+' pixels instead of '+zg+')');
 /* the Paint tab keeps its own Brushes panel and settings */
 await p.evaluate(()=>__gs.setMode('paint',true));await W(1200);
 const pt=await p.evaluate(()=>({lib:!!document.querySelector('#libBody')&&document.querySelector('#libBody').offsetParent!==null,mix:!!document.getElementById('bMix'),stIn:document.getElementById('stBrush').parentNode.id||document.getElementById('stBrush').parentNode.className}));
 ok(pt.lib&&pt.mix,'the Paint tab still has the full brush library and every setting ('+JSON.stringify(pt)+')');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
