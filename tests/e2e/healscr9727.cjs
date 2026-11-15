/* 0.97.27 (Georgian: heal and clone on the model picked colour from unrelated UV pieces across seams): on the model they copy from
   the surface as seen on screen. The model: two halves side by side in 3D, swapped in the texture (left half red, right half green). */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message+' '+(e.stack||'').split('\n')[1]));
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:256,layout:"3d"}));}catch(e){}});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);const W=ms=>p.waitForTimeout(ms||300);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await W(3000);
 const OBJ='v -1 -1 0\nv 0 -1 0\nv 0 1 0\nv -1 1 0\nv 0 -1 0\nv 1 -1 0\nv 1 1 0\nv 0 1 0\nvt .55 0\nvt .95 0\nvt .95 1\nvt .55 1\nvt .05 0\nvt .45 0\nvt .45 1\nvt .05 1\nf 1/1 2/2 3/3 4/4\nf 5/5 6/6 7/7 8/8\n';
 await p.evaluate(o=>{__gs.useModel(__gs.parseOBJ(o,'halves.obj'));},OBJ);await W(800);
 const n=await p.evaluate(()=>{const g=__gs;Object.assign(g.v3.cam,{yaw:0,pitch:0});g.v3.dirty=true;const L=g.allLayers().find(l=>l.name==='Paint');g.doc.active=L;g.doc.sel=new Set([L]);return g.doc.w;});
 const fill=()=>p.evaluate(n=>{const g=__gs,A=g.doc.active,gl=document.querySelector('#gl').getContext('webgl2'),T=g.mapT(A,'base'),px=new Uint8Array(n*n*4);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const u=(x+.5)/n;px.set(u<.45?[30,200,40,255]:u>.55?[220,30,30,255]:[30,30,220,255],(y*n+x)*4);}
   const T8=g.makeTarget(n,n,8,false);gl.bindTexture(gl.TEXTURE_2D,T8.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,n,n,gl.RGBA,gl.UNSIGNED_BYTE,px);g.copyScaled(T8,T);T.empty=false;A.lookVer=(A.lookVer||0)+1;g.v3.mapsDirty=true;g.requestRender(true);},n);
 await fill();await W(600);
 const hb=await p.locator('#v3Hit').boundingBox();
 const scrAt=wx=>p.evaluate(([wx,W,H])=>{const g=__gs,{VP}=g.v3ViewProj(W,H),q=g.scrProject(VP,[wx,0,0],W,H);return q;},[wx,hb.width,hb.height]);
 const page=q=>[hb.x+q[0],hb.y+hb.height-q[1]];
 /* texel of the left half at world x (u = .55 + .4*(x+1)) */
 const texel=wx=>p.evaluate(([wx,n])=>{const g=__gs,d=g.readRGBA8(g.mapT(g.doc.active,'base'));const u=.55+.4*(wx+1),x=Math.floor(u*n),y=Math.floor(n/2),i=(y*n+x)*4;return Array.from(d.slice(i,i+4));},[wx,n]);
 /* clone: source just left of the middle (red), paint further left: the copy runs across the middle onto the green half, as seen */
 await p.evaluate(()=>{const g=__gs;g.setTool('clone');g.heal.src=null;g.heal.off=null;g.heal.offS=null;Object.assign(g.brush,{size:14,opacity:1,hardness:.95});});
 const src=page(await scrAt(-0.12)),a=page(await scrAt(-0.62)),z=page(await scrAt(-0.22));
 await p.keyboard.down('Alt');await p.mouse.click(src[0],src[1]);await p.keyboard.up('Alt');await W(300);
 ok(await p.evaluate(()=>Array.isArray(__gs.heal.srcPos)),'Alt+click on the model keeps the source as a point of the model');
 await p.mouse.move(a[0],a[1]);await p.mouse.down();for(let i=1;i<=8;i++)await p.mouse.move(a[0]+(z[0]-a[0])*i/8,a[1]);await p.mouse.up();await W(700);
 const c1=await texel(-0.28),c0=await texel(-0.55);
 ok(c1[1]>150&&c1[0]<120,'clone copies the green half seen past the middle, not the texture beside the red piece ('+c1+')');
 ok(c0[0]>150&&c0[1]<120,'…and red where the source is still on the red half ('+c0+')');
 ok(await p.evaluate(()=>__gs.hist.undo[__gs.hist.undo.length-1].label==='Clone'),'one undo step “Clone”');
 /* spot healing on the model: a red speck on the green half heals from the green around it */
 await fill();await W(400);
 await p.evaluate(n=>{const g=__gs,T=g.mapT(g.doc.active,'base'),gl=document.querySelector('#gl').getContext('webgl2'),s=6,px=new Uint8Array(s*s*4);for(let i=0;i<s*s;i++)px.set([250,250,0,255],i*4);
   const u=.05+.4*.5,x=Math.floor(u*n)-3,y=Math.floor(n/2)-3;gl.bindTexture(gl.TEXTURE_2D,T.tex);gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,s,s,gl.RGBA,gl.UNSIGNED_BYTE,px);g.v3.mapsDirty=true;g.requestRender(true);},n);await W(500);
 await p.evaluate(()=>{const g=__gs;g.setTool('heal');g.heal.mode='spot';Object.assign(g.brush,{size:30,hardness:.9});});
 const h=page(await scrAt(0.5));await p.mouse.move(h[0]-4,h[1]);await p.mouse.down();await p.mouse.move(h[0]+4,h[1],{steps:4});await p.mouse.up();await W(800);
 const hc=await p.evaluate(n=>{const g=__gs,d=g.readRGBA8(g.mapT(g.doc.active,'base'));const u=.05+.4*.5,x=Math.floor(u*n),y=Math.floor(n/2),i=(y*n+x)*4;return Array.from(d.slice(i,i+4));},n);
 ok(hc[1]>140&&hc[0]<140,'spot healing on the model fills the speck from the green around it ('+hc+')');
 ok(!errs.length,'no page errors '+errs.join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
