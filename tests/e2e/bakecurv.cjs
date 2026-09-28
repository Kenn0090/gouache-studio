/* Curvature bakes (from the shape, from the baked normal with Flip green), the Bake panel's tabs,
   and sending bakes as layers (base colour too, so they blend) or as maps only. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* a flat plate with a raised square plateau: convex rim at |x|,|y| = 0.4, concave foot at 0.55 */
function mesa(N){const v=[],f=[];for(let j=0;j<=N;j++)for(let i=0;i<=N;i++){const x=i/N*2-1,y=1-j/N*2,m=Math.max(Math.abs(x),Math.abs(y)),t=Math.min(1,Math.max(0,(.55-m)/.15));v.push('v '+x+' '+y+' '+(.12*t));}
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const a=j*(N+1)+i+1,b=a+1,c=a+N+1,d=c+1;f.push('f '+a+' '+c+' '+b,'f '+b+' '+c+' '+d);}return v.join('\n')+'\n'+f.join('\n');}
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:')||u.startsWith('blob:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[.5,.5,.5],'curv',false));
 await p.evaluate(txt=>{const C=__gs.bakeCfg;C.high=__gs.parseOBJ(txt,'high');C.ss=1;C.pad=4;C.front=12;C.back=12;C.rays=16;C.replace=true;},mesa(160));
 const bake=(opts,kinds)=>p.evaluate(async([opts,kinds])=>{const C=__gs.bakeCfg;Object.assign(C,opts);for(const k in C.kinds)C.kinds[k]=kinds.includes(k);
   await __gs.runBake(__gs.bakeViewModel(),kinds);return __gs.allLayers().map(l=>l.name);},[opts,kinds]);
 const cv=pts=>p.evaluate(pts=>{const L=__gs.layerByName('Baked curvature'),d=__gs.readRGBA8(__gs.mapT(L,'curv')),W=__gs.doc.w;return pts.map(([x,y])=>d[(y*W+x)*4]);},pts);
 /* rim (convex) right and top, foot (concave) right and top, flat top, flat plate */
 const PTS=[[179,128],[128,77],[198,128],[128,58],[128,128],[245,128]];
 await bake({curvSrc:'mesh',curvRadius:3,curvStr:1,curvEdges:1,curvCreases:1,curvParts:true,sendAs:'layers'},['ao','curv']);
 let v=await cv(PTS);console.log('shape',JSON.stringify(v));
 ok(v[0]>150&&v[1]>150,'from the shape: rims light on both axes');
 ok(v[2]<106&&v[3]<106,'from the shape: feet dark on both axes');
 ok(Math.abs(v[4]-128)<8&&Math.abs(v[5]-128)<8,'from the shape: flat areas mid-grey');
 /* sent as layers: base colour too, edges and creases in the curvature group */
 const st=await p.evaluate(()=>{const g=__gs.doc.root.children.map(n=>n.name+':'+(n.children||[]).map(c=>c.name+(c.visible?'':'(hidden)')).join('/'));
   const ao=__gs.layerByName('Baked AO'),cu=__gs.layerByName('Baked curvature'),e=__gs.layerByName('Curvature edges');
   const px=(L,k,x,y)=>__gs.readRGBA8(__gs.mapT(L,k))[(y*__gs.doc.w+x)*4];
   return {g,maps:__gs.doc.maps.join(),aoBase:!!__gs.mapT(ao,'base')&&!__gs.mapT(ao,'base').empty,cuBase:px(cu,'base',179,128),edge:px(e,'base',179,128),edgeFlat:px(e,'base',128,128)};});
 console.log(JSON.stringify(st));
 ok(st.aoBase&&st.cuBase>150,'as layers: AO and curvature are in the base colour too');
 ok(/ao/.test(st.maps)&&/curv/.test(st.maps),'as layers: and in their own maps');
 ok(st.g.some(x=>/^Baked curvature:Curvature creases\(hidden\)\/Curvature edges\(hidden\)\/Baked curvature$/.test(x)),'curvature group: edges and creases layers under it (hidden)');
 ok(st.edge>80&&st.edgeFlat<10,'edges-only map: white on the rim, black on flat');
 /* blending: curvature on Overlay over AO changes the base colour */
 const bl=await p.evaluate(async()=>{const cu=__gs.layerByName('Baked curvature'),g=cu.parent;const read=()=>{const t=__gs.compositeMap('base'),d=__gs.readRGBA8(t);__gs.release(t);return d[(128*__gs.doc.w+179)*4];};
   const before=read();cu.mode=3;/* Overlay */const after=read();return [before,after];});
 console.log('blend',bl);ok(bl[0]!==bl[1],'curvature blends over AO in the base colour');
 /* from the baked normal, then with Flip green: the vertical rim turns dark, the horizontal one stays light */
 await bake({curvSrc:'normal',curvFlip:false,curvRadius:2},['curv']);v=await cv(PTS);console.log('normal',JSON.stringify(v));
 ok(v[0]>140&&v[1]>140&&v[2]<116,'from the baked normal: rims light, foot dark');
 await bake({curvSrc:'normal',curvFlip:true},['curv']);v=await cv(PTS);console.log('flipped',JSON.stringify(v));
 ok(v[0]>140&&v[1]<116,'Flip green swaps the vertical edges only');
 /* maps only: nothing in the base colour */
 await bake({curvSrc:'mesh',curvFlip:false,sendAs:'maps'},['ao']);
 const mo=await p.evaluate(()=>{const ao=__gs.layerByName('Baked AO');const t=__gs.mapT(ao,'base');return !t||t.empty||ao.blankBase;});ok(mo,'maps only: AO not in the base colour');
 /* the panel: tabs */
 await p.evaluate(()=>{__gs.bakeCfg.tab='general';__gs.bakeCfg.sendAs='layers';});await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(500);
 await p.click('#bakeBody .segb:text-is("Curvature"), #bakeBody .segb:text-is("Curvature •")');await p.waitForTimeout(200);
 ok(await p.isVisible('#bkTab_curv')&&await p.isVisible('#bkCurvR'),'Curvature tab shows its settings');
 ok(!(await p.isVisible('#bkCurvFlip')),'Flip green hidden for the shape');
 await p.click('#bkTab_curv .segb:text-is("Baked normal")');ok(await p.isVisible('#bkCurvFlip')&&await p.evaluate(()=>__gs.bakeCfg.curvSrc)==='normal','choosing Baked normal shows Flip green');
 await p.click('#bakeBody .segb:has-text("AO")');await p.waitForTimeout(200);ok(await p.isVisible('#bkAoS'),'AO tab has Spread');
 await p.locator('#bakeBody').screenshot({path:OUT+'bake-tabs.png'});
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
