/* 0.97.26 (Georgian via Kenn): a picture for a material channel in a set with UV tiles goes into its tile (1001, 1002…),
   or repeats once per tile, instead of being stretched over the whole 2:1 canvas */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const OBJ=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0','vt 0 0','vt 1 0','vt 1 1','vt 0 1','vt 1 0','vt 2 0','vt 2 1','vt 1 1',
 'usemtl Body','f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 2/5 5/6 6/7','f 2/5 6/7 3/8'].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const r=await p.evaluate(async obj=>{const g=__gs;g.setMode('paint');g.p3.started=false;g.p3.imported=null;g.v3.imported=null;g.v3.mesh=null;
  const mesh=g.parseOBJ(obj,'udim.obj');await g.p3NewProject(128,{modelKey:'imported',imported:mesh,udim:true});
  const pic=async(name,draw)=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');draw(x);return new File([await new Promise(r=>c.toBlob(r,'image/png'))],name,{type:'image/png'});};
  const solid=col=>x=>{x.fillStyle=col;x.fillRect(0,0,64,64);};
  const f1=await pic('Tpose_1001_D.png',solid('#ff0000')),f2=await pic('Tpose_1002_D.png',solid('#0000ff'));
  g.cmdNewFillLayer();const L=g.doc.active;const s=L.fill.maps.base;
  const read=()=>{g.fillRender(L);g.changedAll();const t=g.compositeMap('base'),d=g.captureRegionNow(t,0,0,t.w,t.h).data,w=t.w,h=t.h;g.release(t);
    const at=(x,y)=>{const i=(Math.round(y)*w+Math.round(x))*4;return [d[i],d[i+1],d[i+2]];};const B=g.p3.ua.mats.Body,T1=B.tiles.find(t=>t.id===1001),T2=B.tiles.find(t=>t.id===1002);
    const r1=g.udimTileRect('Body',T1,w,h),r2=g.udimTileRect('Body',T2,w,h);
    return {w,h,a:at(r1[0]+r1[2]/2,r1[1]+r1[3]/2),b:at(r2[0]+r2[2]/2,r2[1]+r2[3]/2),aL:at(r1[0]+r1[2]*.2,r1[1]+r1[3]/2),aR:at(r1[0]+r1[2]*.8,r1[1]+r1[3]/2),bL:at(r2[0]+r2[2]*.2,r2[1]+r2[3]/2),bR:at(r2[0]+r2[2]*.8,r2[1]+r2[3]/2)};};
  await g.fillUseImage(L,'base',s,[f1,f2],()=>{s.on=true;});const tiles=read(),name1=s.name;
  const grad=await pic('Skin.png',x=>{x.fillStyle='#000';x.fillRect(0,0,32,64);x.fillStyle='#fff';x.fillRect(32,0,32,64);});
  await g.fillUseImage(L,'base',s,grad,()=>{s.on=true;});const plain=read();
  await g.fillUseImage(L,'base',s,[f1],()=>{s.on=true;});const half=read();
  /* a square texture from anywhere (Library, Textures, smart materials): repeats per tile */
  const sq=await pic('Rock.png',x=>{x.fillStyle='#000';x.fillRect(0,0,32,64);x.fillStyle='#fff';x.fillRect(32,0,32,64);});
  const tsq=await g.fileTarget(sq);g.setWrap(tsq,true);L._fillImg.base=tsq;s.name='Rock.png';s.src='image';delete s.atlas;const lib=read();
  /* Materials › From textures with tile files */
  const b1=await pic('Tpose_1001_BaseColor.png',solid('#ff0000')),b2=await pic('Tpose_1002_BaseColor.png',solid('#00ff00'));
  const rec=await g.miBuild([b1,b2],'Tpose',2048);const bi=rec.imgs.base,bm=rec.fill.maps.base;
  const ft={w:bi.w,h:bi.h,atlas:bm.atlas,name:bm.name,uT:g.fillUdimT({w:bi.w,h:bi.h},bm),left:[...bi.data.slice((Math.floor(bi.h/2)*bi.w+Math.floor(bi.w/4))*4,(Math.floor(bi.h/2)*bi.w+Math.floor(bi.w/4))*4+3)],right:[...bi.data.slice((Math.floor(bi.h/2)*bi.w+Math.floor(bi.w*3/4))*4,(Math.floor(bi.h/2)*bi.w+Math.floor(bi.w*3/4))*4+3)]};
  /* triplanar covers the whole mesh (both tiles) */
  const red=await pic('Red.png',solid('#ff0000'));delete s.atlas;await g.fillUseImage(L,'base',s,red,()=>{s.on=true;});L.fill.proj='tri';const tri=read();L.fill.proj='uv';
  /* a procedural (noise mask row in UV) keeps its proportions: as much detail across as down */
  g.cmdNewFillLayer();const N=g.doc.active;g.msAdd(N,'fill',{p:{v:0}});g.msAdd(N,'noise',{p:{type:'clouds',scale:6,contrast:3,level:0,seed:3,tri:false,inv:false}});g.msUpdate&&g.msUpdate(N);
  await new Promise(r=>setTimeout(r,400));const mt=N.mask.target,md=g.captureRegionNow(mt,0,0,mt.w,mt.h).data;let dx=0,dy=0;
  for(let y=1;y<mt.h-1;y++)for(let x=1;x<mt.w-1;x++){const i=(y*mt.w+x)*4;dx+=Math.abs(md[i+4]-md[i]);dy+=Math.abs(md[i+mt.w*4]-md[i]);}
  const noise={ratio:dx/Math.max(1,dy)};
  /* mesh maps (input maps): AO tiles, then a batch drop of normal tiles */
  const ao1=await pic('Tpose_1001_AO.png',solid('#202020')),ao2=await pic('Tpose_1002_AO.png',solid('#e0e0e0'));
  await g.p3MapImport('ao',[ao1,ao2]);
  const mm=k=>{const t=g.doc.meshMaps[k],d=g.captureRegionNow(t,0,0,t.w,t.h).data,w=t.w,h=t.h,B=g.p3.ua.mats.Body;
    const c=T=>{const R=g.udimTileRect('Body',B.tiles.find(x=>x.id===T),w,h),i=(Math.round(R[1]+R[3]/2)*w+Math.round(R[0]+R[2]/2))*4;return [d[i],d[i+1],d[i+2]];};return {w,h,a:c(1001),b:c(1002),name:g.doc.meshMapInfo[k].name};};
  const ao=mm('ao');
  const n1=await pic('Tpose_1001_Normal.png',solid('#ff8080')),n2=await pic('Tpose_1002_Normal.png',solid('#8080ff'));
  await g.p3MapBatch([n1,n2]);const nm=mm('normal');
  return {box:g.udimImgBox()&&g.udimImgBox().B.tiles.map(t=>t.id),tiles,name1,plain,half,ao,nm,lib,ft,tri,noise};},OBJ);
 console.log(JSON.stringify(r));
 ok(r.box&&r.box.join()==='1001,1002'&&r.tiles.w===2*r.tiles.h,'the set has tiles 1001 and 1002 on a 2:1 canvas');
 ok(r.tiles.a[0]>200&&r.tiles.a[2]<60&&r.tiles.b[2]>200&&r.tiles.b[0]<60,'Tpose_1001 lands in tile 1001 and Tpose_1002 in tile 1002 '+JSON.stringify([r.tiles.a,r.tiles.b]));
 ok(r.name1==='Tpose_<UDIM>_D.png','the channel shows the tile name pattern '+r.name1);
 ok(r.plain.aL[0]<60&&r.plain.aR[0]>200&&r.plain.bL[0]<60&&r.plain.bR[0]>200,'a plain picture repeats once in each tile (not stretched) '+JSON.stringify(r.plain));
 ok(r.half.a[0]>200&&Math.abs(r.half.b[0]-r.half.b[2])<10,'with only the 1001 picture, tile 1002 is left alone (the grey base shows) '+JSON.stringify([r.half.a,r.half.b]));
 ok(r.ao.w===r.tiles.w&&r.ao.a[0]<60&&r.ao.b[0]>200,'mesh map tiles go into their own tiles (AO 1001 dark, 1002 light) '+JSON.stringify(r.ao));
 ok(r.nm.a[0]>200&&r.nm.b[2]>200&&r.nm.b[0]<160,'tile mesh maps dropped together are sorted into one map with each tile in place '+JSON.stringify(r.nm));
 ok(r.lib.aL[0]<60&&r.lib.aR[0]>200&&r.lib.bL[0]<60&&r.lib.bR[0]>200,'a square texture from the Library or Textures repeats once per tile '+JSON.stringify(r.lib));
 ok(r.ft.w===2*r.ft.h&&r.ft.atlas===true&&r.ft.uT.join()==='0.5,1'&&r.ft.left[0]>200&&r.ft.right[1]>200,'Materials › From textures puts the 1001 and 1002 pictures together into one 2:1 picture '+JSON.stringify(r.ft));
 ok(r.tri.a[0]>200&&r.tri.b[0]>200&&r.tri.b[1]<60,'triplanar covers the whole mesh, both tiles '+JSON.stringify([r.tri.a,r.tri.b]));
 ok(r.noise.ratio>.7&&r.noise.ratio<1.4,'a noise mask keeps its proportions on the 2:1 canvas (detail across/down '+r.noise.ratio.toFixed(2)+')');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
