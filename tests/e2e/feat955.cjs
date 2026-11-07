/* 0.95.5 (Kenn's list): wireframe opacity, [ ] resize with outline and hold-to-speed-up, tool tooltips with the right key per tab,
   instant colour pick (one pick picture per view), Quick mask leaves no selection behind, Projection section (alignment incl. UV,
   culling angle, size space), Polygon fill, Shift + drag smooths in 3D Paint */
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
 /* ---- tooltips in Paint ---- */
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await W(300);
 await p.hover('#tools .tool[data-tool="brush"]');await W(100);
 const tPaint=await p.evaluate(()=>document.querySelector('#tools .tool[data-tool="brush"]').title);ok(/\(B\b/.test(tPaint),'Paint: the Brush tooltip says B ('+tPaint+')');
 /* ---- Quick mask on and off leaves no selection ---- */
 await p.mouse.move(700,450);await p.keyboard.press('q');await W(200);await p.keyboard.press('q');await W(200);
 ok(await p.evaluate(()=>!__gs.sel.active&&!__gs.sel.quick),'Paint: Q twice without painting leaves no selection');
 /* ---- 3D Paint ---- */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.evaluate(()=>{const G=__gs;G.v3s().model='plane';G.v3.mesh=null;G.v3.dirty=true;G.requestRender(true);Object.assign(G.v3.cam,{yaw:0,pitch:0});});await W(1200);
 await p.hover('#tools .tool[data-tool="brush"]');await W(100);
 const t3=await p.evaluate(()=>document.querySelector('#tools .tool[data-tool="brush"]').title);ok(/\(1\b/.test(t3),'3D Paint: the Brush tooltip says 1 ('+t3+')');
 await p.evaluate(()=>{const s=document.getElementById('v3Settings');if(s)s.hidden=false;});
 ok(await p.evaluate(()=>!!document.getElementById('v3WireOp')),'the 3D settings have a Wireframe opacity slider');
 await p.evaluate(()=>{const s=document.getElementById('v3Settings');if(s)s.hidden=true;});
 /* Q twice in 3D Paint: no orange left on the model */
 const hb=await p.locator('#v3Hit').boundingBox(),cx=hb.x+hb.width/2,cy=hb.y+hb.height/2;
 await p.mouse.move(cx,cy);await p.keyboard.press('q');await W(200);await p.keyboard.press('q');await W(300);
 ok(await p.evaluate(()=>!__gs.sel.active),'3D Paint: Q twice leaves no selection (no orange on the model)');
 /* ---- [ ] with the pointer resting on the model: the outline follows at once; holding speeds up ---- */
 await p.evaluate(()=>{Object.assign(__gs.brush,{size:40});__gs.setTool('brush');});await p.mouse.move(cx+5,cy+5);await W(200);
 const w0=await p.evaluate(()=>{const c=__gs.v3.curEl;return c&&!c.hidden?parseFloat(c.style.width):0;});
 await p.keyboard.press(']');await W(100);
 const w1=await p.evaluate(()=>{const c=__gs.v3.curEl;return c&&!c.hidden?parseFloat(c.style.width):0;});
 ok(w0>0&&w1>w0,'] grows the outline on the model without moving the mouse ('+w0.toFixed(1)+' → '+w1.toFixed(1)+')');
 const steps=await p.evaluate(()=>{const G=__gs;G.brush.size=40;G.kbBrushSize(1,false);const f1=G.brush.size/40;for(let i=0;i<12;i++)G.kbBrushSize(1,true);const a=G.brush.size;G.kbBrushSize(1,true);return [f1,G.brush.size/a];});
 ok(steps[1]>steps[0]+.08,'holding ] speeds up (first step ×'+steps[0].toFixed(2)+', later ×'+steps[1].toFixed(2)+')');
 await p.evaluate(()=>{__gs.brush.size=40;});
 /* ---- colour pick: one pick picture for a still view, colour set on the key press ---- */
 await p.evaluate(()=>{const G=__gs;G.setFG([.9,.1,.1]);});
 await p.evaluate(()=>{const G=__gs;G.selectOnly(G.layerByName('Base material'));});
 const b0=await p.evaluate(()=>__gs.v3PickStats.builds);
 await p.mouse.move(cx,cy);await p.keyboard.down('Alt');await W(50);
 for(let i=0;i<8;i++){await p.mouse.move(cx+i*6,cy+i*3);await W(30);}
 await p.keyboard.up('Alt');await W(100);
 const ps=await p.evaluate(()=>({b:__gs.v3PickStats.builds,l:__gs.v3PickStats.looks,fg:__gs.ui.fg}));
 ok(ps.b-b0<=1&&ps.l>=3,'Alt-picking over a still view reads one pick picture ('+(ps.b-b0)+' built, '+ps.l+' looks)');
 ok(Math.abs(ps.fg[0]-ps.fg[1])<.15,'and the picked colour is the grey base material ('+ps.fg.map(v=>v.toFixed(2)).join(',')+')');
 /* ---- Projection section ---- */
 ok(await p.evaluate(()=>!!document.getElementById('p3Proj')&&!!document.getElementById('projAlign')&&!!document.getElementById('projSize')&&!!document.getElementById('projCull')),'3D Paint has a Projection section (Alignment, Backface culling, Size Space)');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#projAlign option')].map(o=>o.textContent).join('|'))==='Tangent | Wrap|Camera|UV','Alignment: Tangent | Wrap, Camera, UV');
 ok(await p.evaluate(()=>[...document.querySelectorAll('#projSize option')].map(o=>o.textContent).join('|'))==='Object|Viewport|Texture','Size Space: Object, Viewport, Texture');
 const vp=await p.evaluate(()=>{const s=__gs.v3s();s.sizeSpace='viewport';const r=1;const out={};const sel=document.getElementById('projSize');sel.value='viewport';sel.dispatchEvent(new Event('change'));return __gs.v3s().sizeSpace;});
 ok(vp==='viewport','choosing Viewport sets the size space');
 await p.evaluate(()=>{const sel=document.getElementById('projSize');sel.value='object';sel.dispatchEvent(new Event('change'));});
 /* UV alignment: the stroke lands at the texture spot under the pointer */
 const red=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint')||__gs.doc.active,T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]>150&&d[i+1]<80&&d[i+3]>200)n++;return n;});
 await p.evaluate(()=>{const G=__gs,P=G.layerByName('Paint');if(P)G.selectOnly(P);G.setFG([.85,.1,.1]);Object.assign(G.brush,{size:30,hardness:1,opacity:1,flow:1,smoothing:0,lazy:0,pSize:false,tip:null});const sel=document.getElementById('projAlign');sel.value='uv';sel.dispatchEvent(new Event('change'));});await W(300);
 const r0=await red();await p.mouse.move(cx-40,cy);await p.mouse.down();await p.mouse.move(cx+40,cy,{steps:8});await p.mouse.up();await W(500);const r1=await red();
 ok(r1>r0+100,'UV alignment paints onto the texture ('+(r1-r0)+' px)');
 await p.evaluate(()=>{__gs.undo();const sel=document.getElementById('projAlign');sel.value='wrap';sel.dispatchEvent(new Event('change'));});await W(400);
 /* culling angle: a small angle stops paint on a plane seen at a slant */
 await p.evaluate(()=>{const G=__gs;Object.assign(G.v3.cam,{yaw:0,pitch:-1.0});G.v3s().cullAngle=20;G.v3.dirty=true;});await W(600);
 const c0=await red();await p.mouse.move(cx-40,cy);await p.mouse.down();await p.mouse.move(cx+40,cy,{steps:8});await p.mouse.up();await W(500);const c1=await red();
 await p.evaluate(()=>{const G=__gs;G.v3s().cullAngle=90;});const c2=await red();await p.mouse.move(cx-40,cy+5);await p.mouse.down();await p.mouse.move(cx+40,cy+5,{steps:8});await p.mouse.up();await W(500);const c3=await red();
 ok(c1-c0<20&&c3-c2>100,'a culling angle of 20° keeps paint off a plane seen at a slant, 90° paints it ('+(c1-c0)+' vs '+(c3-c2)+')');
 await p.evaluate(()=>{const G=__gs;G.undo();Object.assign(G.v3.cam,{yaw:0,pitch:0});G.v3.dirty=true;});await W(600);
 /* ---- Shift + drag smooths a hard edge ---- */
 await p.evaluate(()=>{Object.assign(__gs.brush,{size:60});});
 await p.mouse.move(cx-60,cy);await p.mouse.down();await p.mouse.move(cx+60,cy,{steps:8});await p.mouse.up();await W(500);
 const soft=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let n=0;for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a>20&&a<235)n++;}return n;});
 const s0=await soft();
 /* (0.95.6) Shift + click is only a straight line: it adds paint and does not smooth */
 const lab=()=>p.evaluate(()=>{const u=__gs.hist&&__gs.hist.undo;return u&&u.length?u[u.length-1].label:'';});
 await p.keyboard.down('Shift');await p.mouse.move(cx+40,cy+30);await p.mouse.down();await p.mouse.move(cx+42,cy+31);await p.mouse.up();await p.keyboard.up('Shift');await W(600);
 const l1=await lab();ok(!/Blend|Smooth/.test(l1),'Shift + click (even with a small slip) draws a straight line, not a smooth ('+l1+')');
 await p.evaluate(()=>__gs.undo());await W(400);const s0b=await soft();
 await p.keyboard.down('Control');await p.mouse.move(cx-50,cy-12);await p.mouse.down();await p.mouse.move(cx+50,cy+12,{steps:12});await p.mouse.up();await p.keyboard.up('Control');await W(600);
 const s1=await soft();ok(s1>s0b+30,'Ctrl + drag smooths the paint (soft edge pixels '+s0b+' → '+s1+')');
 /* ---- Polygon fill ---- */
 ok(await p.evaluate(()=>!!document.querySelector('#tools .tool[data-tool="pfill"]')&&getComputedStyle(document.querySelector('#tools .tool[data-tool="pfill"]')).display!=='none'),'3D Paint has a Polygon fill tool button');
 await p.evaluate(()=>{const G=__gs;G.undo();G.undo();G.selectOnly(G.layerByName('Paint'));G.setFG([.1,.2,.9]);G.setTool('pfill');G.pf.kind='island';});await W(300);
 ok(await p.evaluate(()=>/Face/.test(document.getElementById('brushBody').textContent)&&/UV island/.test(document.getElementById('brushBody').textContent)),'its options: Face, Triangle, Loop, UV island');
 const blue=()=>p.evaluate(()=>{const L=__gs.layerByName('Paint'),T=__gs.mapT(L,'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i+2]>180&&d[i]<80&&d[i+3]>200)n++;return [n,d.length/4];});
 const h0=await p.evaluate(()=>__gs.hist?__gs.hist.undo.length:0);const q0=await blue();
 await p.mouse.move(cx,cy);await W(100);await p.mouse.down();await p.mouse.up();await W(600);const q1=await blue();
 ok(q1[0]-q0[0]>q1[1]*.5,'Polygon fill › UV island fills the plane\'s island with the colour ('+(q1[0]-q0[0])+' of '+q1[1]+' px)');
 await p.evaluate(()=>{__gs.undo();});await W(300);const q2=await blue();ok(q2[0]<=q0[0]+5,'one undo removes it');
 await p.evaluate(()=>{__gs.pf.kind='tri';});await p.mouse.move(cx+3,cy+3);await p.mouse.down();await p.mouse.up();await W(600);const q3=await blue();
 ok(q3[0]-q2[0]>0&&q3[0]-q2[0]<q1[0]-q0[0],'Triangle fills less than the island ('+(q3[0]-q2[0])+')');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
