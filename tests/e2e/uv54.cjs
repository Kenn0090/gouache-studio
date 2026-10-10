/* 0.54: UV check on import, auto unwrap with a seed, review in the Bake tab, bad-UV fixes, export with UVs (OBJ, glTF, FBX). */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const sphereObj=(withUV)=>{const L=['o ball'],nu=24,nv=14,v=[],t=[],f=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++){const a=i/nu*Math.PI*2,b=j/nv*Math.PI;L.push('v '+(Math.sin(b)*Math.cos(a)).toFixed(5)+' '+Math.cos(b).toFixed(5)+' '+(Math.sin(b)*Math.sin(a)).toFixed(5));if(withUV)t.push('vt '+(i/nu).toFixed(5)+' '+(1-j/nv).toFixed(5));}
  L.push(...t);const W=nu+1;for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*W+i+1,b=a+1,c=a+W,d=c+1;if(j>0)f.push(withUV?`f ${a}/${a} ${c}/${c} ${b}/${b}`:`f ${a} ${c} ${b}`);if(j<nv-1)f.push(withUV?`f ${b}/${b} ${c}/${c} ${d}/${d}`:`f ${b} ${c} ${d}`);}return L.concat(f).join('\n')+'\n';};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:40000});
 await p.click('#modeTabs [data-mode=bake]');await p.waitForTimeout(1200);
 // ---- a model without UVs
 const noUV=sphereObj(false),withUV=sphereObj(true);
 const parsed=await p.evaluate(async txt=>{const f=new File([txt],'ball.obj',{type:'text/plain'});const m=await __gs.parseModelFile(f,[f]);window.__m=m;return {noUV:m.noUV,tris:m.tris};},noUV);
 ok(parsed.noUV===true,'an OBJ without UVs is detected ('+parsed.tris+' triangles)');
 // the question appears; choose Auto unwrap
 const pending=p.evaluate(async()=>{window.__r=await __gs.uvImportCheck(window.__m);return true;});
 await p.waitForSelector('#modal:not([hidden]) #dlgOk',{timeout:5000});
 const title=await p.textContent('#dlgTitle');ok(/no UVs/i.test(title),'the window says the model has no UVs ("'+title+'")');
 ok((await p.textContent('#dlgCancel'))==='Continue without UVs'&&(await p.textContent('#dlgOk'))==='Auto unwrap','it offers Auto unwrap or Continue without');
 await p.click('#dlgOk');await pending;
 const r1=await p.evaluate(()=>{const m=window.__r,an=__gs.uwAnalyze(m);return {noUV:m.noUV,verts:m.verts,tris:m.tris,charts:m.uvAuto&&m.uvAuto.charts,util:m.uvAuto&&m.uvAuto.util,overlap:an.overlapPct,out:an.outsidePct,issues:an.issues.length};});
 ok(r1.noUV===false&&r1.charts>=2&&r1.tris===parsed.tris,'auto unwrap made UVs ('+r1.charts+' pieces, '+Math.round(r1.util*100)+'% of the square)');
 ok(r1.overlap===0&&r1.out===0,'the new UVs do not overlap and stay inside the square');
 // ---- review in the Bake tab
 await p.evaluate(()=>{__gs.bakeSetModel('low',window.__r);});await p.waitForTimeout(800);
 ok(await p.locator('#uvCard').count()===1,'the Bake tab shows the UV card');
 await p.click('#uvToggle',{timeout:5000});await p.waitForTimeout(400);
 ok(await p.locator('#uvPrev').count()===1&&await p.locator('#uvSeed').count()===1,'the card has the layout picture and a seed');
 const before=await p.evaluate(()=>Array.from(__gs.bakeCfg.low.uv.slice(0,40)));const seed0=await p.inputValue('#uvSeed');
 await p.click('#uvRoll');await p.waitForFunction(()=>!__gs.uvw.busy,null,{timeout:20000});await p.waitForTimeout(400);
 const after=await p.evaluate(()=>({uv:Array.from(__gs.bakeCfg.low.uv.slice(0,40)),seed:__gs.bakeCfg.low.uwOpt.seed}));
 ok(String(after.seed)!==seed0&&JSON.stringify(after.uv)!==JSON.stringify(before),'Re-roll gives another layout (seed '+seed0+' → '+after.seed+')');
 // padding and layout change only repack
 const same=await p.evaluate(async()=>{const old=__gs.bakeCfg.low;await __gs.uvAct('layout',{padding:24});const nm=__gs.bakeCfg.low;return {charts:nm.uvAuto.charts===old.uvAuto.charts,pad:nm.uwOpt.padding};});
 ok(same.charts&&same.pad===24,'padding changes the packing without cutting again');
 const best=await p.evaluate(async()=>{const u0=__gs.bakeCfg.low.uvAuto.util;await __gs.uvAct('best');return [u0,__gs.bakeCfg.low.uvAuto.util];});
 ok(best[1]>=best[0]-1e-9,'Best of 24 keeps the tightest packing ('+Math.round(best[0]*100)+'% → '+Math.round(best[1]*100)+'%)');
 // the gap between islands is at least the padding
 const gap=await p.evaluate(()=>{const m=__gs.bakeCfg.low,isl=__gs.uwIslands(m),S=2048,box=[];for(let i=0;i<isl.count;i++)box.push([9,9,-9,-9]);for(let t=0;t<m.idx.length/3;t++){const b=box[isl.ids[t]];for(let k=0;k<3;k++){const v=m.idx[t*3+k];b[0]=Math.min(b[0],m.uv[v*2]);b[1]=Math.min(b[1],m.uv[v*2+1]);b[2]=Math.max(b[2],m.uv[v*2]);b[3]=Math.max(b[3],m.uv[v*2+1]);}}
   let min=9;for(let i=0;i<box.length;i++)for(let j=i+1;j<box.length;j++){const dx=Math.max(box[i][0]-box[j][2],box[j][0]-box[i][2]),dy=Math.max(box[i][1]-box[j][3],box[j][1]-box[i][3]);const d=Math.max(dx,dy);if(d<min)min=d;}return min*S;});
 ok(gap>=24*.9,'islands are at least the padding apart ('+gap.toFixed(1)+' px at 2048)');
 // ---- bad UVs: stack every island on top of each other
 const bad=await p.evaluate(async txt=>{const f=new File([txt],'ball_uv.obj',{type:'text/plain'});let m=await __gs.parseModelFile(f,[f]);const isl=__gs.uwIslands(m);window.__bad=m;const an=__gs.uwAnalyze(m);return {noUV:m.noUV,islands:an.islands,overlap:an.overlapPct,issues:an.issues.map(i=>i.kind)};},withUV);
 ok(bad.noUV===false&&bad.islands>=1,'a model with UVs is read ('+bad.islands+' island)');
 const stacked=await p.evaluate(()=>{const m=window.__bad,mm=window.__r;const a=Object.assign({},mm);const uv=Float32Array.from(mm.uv);for(let i=0;i<uv.length;i+=2){uv[i]=uv[i]*.5+.1;uv[i+1]=uv[i+1]*.5+.1;}a.uv=uv;a._uvAn=null;a.uwSrc=null;a.uwRes=null;a.uvAuto=null;window.__stack=a;const an=__gs.uwAnalyze(a);return {overlap:an.overlapPct,kinds:an.issues.map(i=>i.kind)};});
 ok(stacked.overlap<1,'an unwrap that is already clean has no overlap warning ('+stacked.overlap.toFixed(1)+'%)');
 const ovl=await p.evaluate(()=>{const a=window.__r,uv=Float32Array.from(a.uv),isl=__gs.uwIslands(a);/* move island 1 on top of island 0 */const idx=a.idx;let b0=[9,9],b1=[9,9];for(let t=0;t<idx.length/3;t++){const id=isl.ids[t];for(let k=0;k<3;k++){const v=idx[t*3+k];if(id===0){b0[0]=Math.min(b0[0],uv[v*2]);b0[1]=Math.min(b0[1],uv[v*2+1]);}if(id===1){b1[0]=Math.min(b1[0],uv[v*2]);b1[1]=Math.min(b1[1],uv[v*2+1]);}}}
   const seen=new Set();for(let t=0;t<idx.length/3;t++)if(isl.ids[t]===1)for(let k=0;k<3;k++){const v=idx[t*3+k];if(seen.has(v))continue;seen.add(v);uv[v*2]+=b0[0]-b1[0];uv[v*2+1]+=b0[1]-b1[1];}
   const m=Object.assign({},a,{uv,_uvAn:null,_uvIsl:null,uwSrc:null,uwRes:null,uvAuto:null});window.__ovl=m;const an=__gs.uwAnalyze(m);return {overlap:an.overlapPct,kinds:an.issues.map(i=>i.kind)};});
 ok(ovl.overlap>1&&ovl.kinds.includes('overlap'),'overlapping islands are found ('+ovl.overlap.toFixed(1)+'%)');
 const askP=p.evaluate(async()=>{window.__fixed=await __gs.uvImportCheck(window.__ovl);return true;});
 await p.waitForSelector('#modal:not([hidden]) #dlgOk',{timeout:5000});ok(/Check the UVs/i.test(await p.textContent('#dlgTitle'))&&(await p.textContent('#dlgOk'))==='Optimize layout','bad UVs get a warning with Optimize layout');
 await p.click('#dlgOk');await askP;
 const fixed=await p.evaluate(()=>{const an=__gs.uwAnalyze(window.__fixed);return {overlap:an.overlapPct,tris:window.__fixed.tris};});
 ok(fixed.overlap<1,'Optimize layout separates the overlapping islands ('+fixed.overlap.toFixed(1)+'%)');
 await p.screenshot({path:__dirname+'/out/uv54-bake.png',clip:{x:980,y:60,width:620,height:860}}).catch(()=>{});
 // ---- the New 3D Paint Project window: no UVs -> offers an auto unwrap, done when the project is made
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.dlgNew();});await p.waitForSelector('#p3NewModel',{timeout:5000});
 const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.locator('.dlg .p3newmesh button, #modal .p3newmesh button').first().click()]);
 await fc.setFiles({name:'crate.obj',mimeType:'text/plain',buffer:Buffer.from(noUV)});await p.waitForTimeout(1200);
 ok(await p.locator('#p3NewUvNote').isVisible()&&/no UVs/i.test(await p.textContent('#p3NewUvNote')),'the New project window tells you the chosen model has no UVs');
 ok(await p.inputValue('#p3NewUv')==='unwrap','and offers an auto unwrap, selected');
 await p.click('#dlgOk');await p.waitForTimeout(6000);
 const proj=await p.evaluate(()=>({noUV:__gs.v3.mesh&&__gs.v3.mesh.noUV,auto:!!(__gs.v3.mesh&&__gs.v3.mesh.uvAuto),tris:__gs.v3.mesh&&__gs.v3.mesh.tris}));
 ok(proj.noUV===false&&proj.auto&&proj.tris===parsed.tris,'the project starts on the unwrapped model ('+JSON.stringify(proj)+')');
 // ---- dropping a model without UVs on the 3D view
 const drop=p.evaluate(async txt=>{const f=new File([txt],'drop.obj',{type:'text/plain'});await __gs.v3DropModel([f]);return __gs.v3.mesh&&__gs.v3.mesh.noUV;},noUV);
 await p.waitForSelector('#modal:not([hidden]) #dlgOk',{timeout:8000});await p.click('#dlgCancel');const dropNoUV=await drop;
 ok(dropNoUV===true,'Continue without UVs loads it as it is (it cannot be painted)');
 // ---- export and read back
 const rt=await p.evaluate(async()=>{const m=window.__r,out={};for(const fmt of ['obj','glb','fbx']){const bytes=fmt==='fbx'?__gs.uvFBX(m,'ball',true):fmt==='glb'?__gs.uvGLB(m,'ball',true):__gs.uvOBJ(m,'ball',true);const f=new File([bytes],'ball.'+fmt);let r;try{r=await __gs.parseModelFile(f,[f]);}catch(e){out[fmt]={err:String(e.message||e)};continue;}
   const same=r.uv&&r.uv.length>0&&!r.noUV;out[fmt]={tris:r.tris,noUV:r.noUV,uvOK:same,bytes:bytes.length};}return out;});
 for(const fmt of ['obj','glb','fbx'])ok(rt[fmt]&&!rt[fmt].err&&rt[fmt].tris===parsed.tris&&rt[fmt].uvOK,fmt.toUpperCase()+' export reads back with its UVs ('+JSON.stringify(rt[fmt])+')');
 ok(errs.length===0,'no page errors '+errs.slice(0,2));
 await b.close();console.log(fails?'FAILED '+fails:'ALL PASS');process.exit(fails?1:0);})();
