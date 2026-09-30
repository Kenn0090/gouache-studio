/* 0.23.1: projections (UV, triplanar, planar, spherical) with the 3D gizmo and the 2D frame. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1200);
 await p.evaluate(()=>{__gs.useModel(__gs.parseOBJ('v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n','quad.obj'));Object.assign(__gs.v3.cam,{yaw:.35,pitch:.25});__gs.v3.dirty=true;});await W(800);
 /* a material with a checker picture in its base colour */
 await p.evaluate(()=>{const n=64,t=__gs.makeTarget(n,n,8,true),g=document.querySelector('#gl').getContext('webgl2'),px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const on=((x>>3)+(y>>3))%2;px.set(on?[230,40,40,255]:[30,30,220,255],(y*n+x)*4);}g.bindTexture(g.TEXTURE_2D,t.tex);g.texSubImage2D(g.TEXTURE_2D,0,0,0,n,n,g.RGBA,g.UNSIGNED_BYTE,px);
   const L=__gs.cmdNewFillLayer({name:'Checker',maps:{base:{src:'image',tile:1,rot:0,name:'checker'},rough:{v:.5}},imgs:{base:t}});__gs.showPanel('matEd');});await W(500);
 const baseSig=()=>p.evaluate(()=>{const d=__gs.readRGBA8(__gs.mapT(__gs.doc.active,'base'));let r=0,b=0,h=0;for(let i=0;i<d.length;i+=4){if(d[i]>150&&d[i+2]<90)r++;else if(d[i+2]>150&&d[i]<90)b++;h=(h*31+d[i]+d[i+2])>>>0;}return {r,b,h};});
 const seg=async(t)=>{await p.click('#fl_proj .segb:text-is("'+t+'")');await W(900);};
 ok(await p.evaluate(()=>[...document.querySelectorAll('#fl_proj .segb')].map(b=>b.textContent).join()==='UV,Triplanar,Planar,Spherical'),'four projections in Properties');
 await seg('Planar');let s1=await baseSig();ok(s1.r>1000&&s1.b>1000,'planar projects the picture '+JSON.stringify(s1));
 ok(await p.evaluate(()=>{const c=document.querySelector('.v3gz');return !!c&&!c.hidden&&!!__gs.pgzGeom(document.getElementById('v3Hit'));}),'the gizmo shows on the model');
 const hb=await p.locator('#v3Hit').boundingBox();
 const G=async()=>p.evaluate(()=>{const g=__gs.pgzGeom(document.getElementById('v3Hit'));return {p0:g.p0,tips:g.tips,boxes:g.boxes,ring:g.rings[2].pts[8]};});
 let g=await G();
 const dragS=async(a,b)=>{await p.mouse.move(hb.x+a[0],hb.y+a[1]);await p.mouse.down();await p.mouse.move(hb.x+b[0],hb.y+b[1],{steps:8});await p.mouse.up();await W(600);};
 /* move along X */
 {const t=g.tips[0],a=[g.p0[0]+(t[0]-g.p0[0])*.85,g.p0[1]+(t[1]-g.p0[1])*.85],d=[t[0]-g.p0[0],t[1]-g.p0[1]],l=Math.hypot(...d);await dragS(a,[a[0]+d[0]/l*40,a[1]+d[1]/l*40]);}
 let x1=await p.evaluate(()=>__gs.pxfNorm(__gs.doc.active.fill.xf));ok(x1.t[0]>.05&&Math.abs(x1.t[1])<1e-3,'dragging the X arrow moves it along X '+JSON.stringify(x1.t));
 let s2=await baseSig();ok(s2.h!==s1.h,'…and the picture moves on the model');
 await W(800);await p.keyboard.press('Control+z');await W(400);ok(await p.evaluate(()=>__gs.pxfNorm(__gs.doc.active.fill.xf).t[0]===0),'one undo puts it back');

 /* turn with the Z ring, scale with the X box */
 g=await G();await dragS(g.ring,[g.ring[0]+30,g.ring[1]+25]);ok(await p.evaluate(()=>Math.abs(__gs.pxfNorm(__gs.doc.active.fill.xf).r[2])>3),'the ring turns it');
 await p.evaluate(()=>localStorage.setItem('gs.pxfLock','0'));
 g=await G();{const b=g.boxes[0],d=[b[0]-g.p0[0],b[1]-g.p0[1]];await dragS(b,[b[0]+d[0]*.5,b[1]+d[1]*.5]);}
 ok(await p.evaluate(()=>{const s=__gs.pxfNorm(__gs.doc.active.fill.xf).s;return s[0]>1.2&&Math.abs(s[1]-1)<1e-3;}),'the X box scales along X');
 /* with the chain on, one box scales every axis */
 await p.evaluate(()=>localStorage.setItem('gs.pxfLock','1'));
 g=await G();{const s0=await p.evaluate(()=>__gs.pxfNorm(__gs.doc.active.fill.xf).s.slice());const b=g.boxes[1],d=[b[0]-g.p0[0],b[1]-g.p0[1]];await dragS(b,[b[0]+d[0]*.5,b[1]+d[1]*.5]);
  ok(await p.evaluate(s0=>{const s=__gs.pxfNorm(__gs.doc.active.fill.xf).s;return s[1]>s0[1]*1.2&&s[0]>s0[0]*1.2;},s0),'with the chain on, a box scales X and Y together');}
 ok(await p.evaluate(()=>{const e=document.querySelector('#pxf_s0');return !!e&&parseFloat(e.value)<0.85;}),'the fields show the new numbers (Tiling shrinks when the picture grows)');
 await p.evaluate(()=>{__gs.pxfTarget().edit(x=>Object.assign(x,{t:[0,0,0],r:[0,180,0],s:[1,1,1]}));});await W(900);let sb=await baseSig();
 await p.click('#fl_front');await W(900);let sf=await baseSig();ok(sb.r+sb.b>10000&&sf.r+sf.b<100,'Front faces only: a planar picture aimed from behind stays off the front '+JSON.stringify([sb.r+sb.b,sf.r+sf.b]));
 await p.click('#fl_front');await W(600);
 await seg('Spherical');await p.evaluate(()=>{__gs.pxfTarget().edit(x=>{x.t[2]=-1;});});await W(900);let s3=await baseSig();ok(s3.r>200&&s3.b>200,'spherical projects the picture '+JSON.stringify(s3));
 await seg('Triplanar');let s4=await baseSig();ok(s4.r>200&&s4.b>200,'triplanar still works with the transform '+JSON.stringify(s4));
 /* UV: the frame on the flat canvas */
 await seg('UV');await p.click('#pxfReset');await W(900);await p.click('#p3dBody .segb:text-is("2D")');await W(600);
 ok(await p.evaluate(()=>!document.querySelector('.v3gz')||document.querySelector('.v3gz').hidden),'no gizmo for UV');
 const fr=await p.evaluate(()=>{const o=document.getElementById('xfOv');return {n:o.querySelectorAll('rect.hs').length,rot:!!o.querySelector('circle.ge')};});ok(fr.n===4&&fr.rot,'UV shows a frame with corner and turn handles on the flat canvas '+JSON.stringify(fr));
 const st=await p.locator('#stage').boundingBox(),corner=await p.evaluate(([w,h])=>{const rs=[...document.querySelectorAll('#xfOv rect.hs')].map(r=>[parseFloat(r.getAttribute('x'))+5,parseFloat(r.getAttribute('y'))+5]);rs.sort((a,b)=>Math.hypot(a[0]-w/2,a[1]-h/2)-Math.hypot(b[0]-w/2,b[1]-h/2));return rs[0];},[st.width,st.height]);
 const before=await p.evaluate(()=>__gs.pxfNorm(__gs.doc.active.fill.xf).s.slice());

 await p.mouse.move(st.x+corner[0],st.y+corner[1]);await p.mouse.down();await p.mouse.move(st.x+corner[0]+(st.width/2-corner[0])*.3,st.y+corner[1]+(st.height/2-corner[1])*.3,{steps:6});await p.mouse.up();await W(500);
 ok(await p.evaluate(b=>{const s=__gs.pxfNorm(__gs.doc.active.fill.xf).s;return s[0]!==b[0]&&s[1]!==b[1];},before),'dragging a corner scales the UV projection');
 /* a mask row's pattern gets the gizmo too */
 await p.click('#p3dBody .segb:text-is("3D")');await W(400);
 await p.evaluate(()=>{const L=__gs.doc.active;__gs.msAdd(L,'noise',{p:{type:'clouds',scale:4,contrast:2,level:0,seed:1,inv:false}});});await W(500);
 ok(await p.evaluate(()=>{const T=__gs.pxfTarget();return T&&T.kind==='row'&&T.mode==='world'&&!!__gs.pgzGeom(document.getElementById('v3Hit'));}),'a noise row (World) gets the gizmo');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
