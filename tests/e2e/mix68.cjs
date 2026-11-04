/* 0.68: watercolour edge colour and paint-like mixing for the Blend (smudge) brush */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:20});await p.mouse.up();await p.waitForTimeout(250);};
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'mix',false));await p.waitForTimeout(300);
 await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 /* ---- 1. edge colour ---- */
 const edgeStat=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base'));let n=0,s=0,al=0;for(let i=0;i<d.length;i+=4){const a=d[i+3];if(a<12)continue;const r=d[i]/a,g=d[i+1]/a,bl=d[i+2]/a;const mx=Math.max(r,g,bl),mn=Math.min(r,g,bl);n++;s+=mx>0?(mx-mn)/mx:0;al+=a;}return {n,sat:n?s/n:0,al:n?al/n:0};});
 const run=async(edge)=>{await p.evaluate(e=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:90,hardness:0,opacity:1,flow:.35,spacing:.06,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:true,edgeSat:e});__gs.ui.fg=[.72,.46,.36];},edge);await drag(40,100,260,100);const s=await edgeStat();await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);return s;};
 const e0=await run(0),e1=await run(1);
 ok(e0.n>300&&e1.n>300,'a soft stroke has a faint edge ('+e0.n+' px)');
 ok(e1.sat>e0.sat+0.12,'with Edge colour the faint edge is more saturated ('+e0.sat.toFixed(2)+' to '+e1.sat.toFixed(2)+')');
 ok(e1.al>e0.al,'and a little stronger ('+e0.al.toFixed(0)+' to '+e1.al.toFixed(0)+')');
 await p.evaluate(()=>{__gs.showPanel('tool');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('bEdgeSat')),'Edge colour is in the brush settings');
 ok(await p.evaluate(()=>['Watercolour glaze','Dual sponge wash','Watercolour dry edge','Wash'].every(n=>__gs.library.flatMap(s=>s.presets).some(x=>x.name===n&&x.edgeSat>0))),'the watercolour brushes have it on');
 /* ---- 2. paint-like mixing ---- */
 const mixed=async(pm)=>{await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'mix2',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
  await p.evaluate(()=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:90,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,dual:null});__gs.ui.fg=[.1,.2,.9];});
  await drag(20,100,120,100);await p.evaluate(()=>{__gs.ui.fg=[.95,.9,.1];});await drag(180,100,280,100);
  await p.evaluate(m=>{__gs.setTool('smudge');Object.assign(__gs.brush,{size:70,hardness:.8,strength:.5,charge:0,spacing:.05,smoothing:0,pSize:false,pOpacity:false,paintMix:m,tip:null,grain:0});},pm);
  await drag(80,100,220,100);await drag(220,100,80,100);await drag(80,100,220,100);await drag(220,100,80,100);
  return p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;let n=0,r=0,g=0,bl=0;for(let y=90;y<110;y++)for(let x=125;x<175;x++){const i=(y*W+x)*4,a=d[i+3];if(a<200)continue;n++;r+=d[i]/a;g+=d[i+1]/a;bl+=d[i+2]/a;}return {n,r:r/n,g:g/n,b:bl/n};});};
 const lin=await mixed(0),km=await mixed(1);
 ok(lin.n>200&&km.n>200,'the blended middle has paint ('+lin.n+', '+km.n+')');
 const gr=c=>c.g-Math.max(c.r,c.b);
 ok(gr(lin)<0.05,'with Paint mixing off, blue and yellow blend to a grey ('+[lin.r,lin.g,lin.b].map(v=>v.toFixed(2))+')');
 ok(gr(km)>0.08,'with Paint mixing on, blue and yellow blend to green ('+[km.r,km.g,km.b].map(v=>v.toFixed(2))+')');
 await p.evaluate(()=>{__gs.showPanel('tool');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('bPaintMix')),'Paint mixing is in the Blend brush settings');

 /* ---- 3. thin pigment (glaze) ---- */
 const flat=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;let n=0,s=0,l=0;for(let y=80;y<120;y++)for(let x=60;x<240;x++){const i=(y*W+x)*4,a=d[i+3];if(a<8)continue;const r=(d[i]+255-a)/255,g=(d[i+1]+255-a)/255,bl=(d[i+2]+255-a)/255;const mx=Math.max(r,g,bl),mn=Math.min(r,g,bl);n++;s+=mx>0?(mx-mn)/mx:0;l+=(r+g+bl)/3;}return {n,sat:s/n,lum:l/n};});
 const thin=async(gl)=>{await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'g',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
  await p.evaluate(g=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:60,hardness:1,opacity:.4,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:g,dual:null});__gs.ui.fg=[.1,.3,.7];},gl);
  await drag(40,100,260,100);return flat();};
 const g0=await thin(0),g1=await thin(1);
 ok(g1.sat>g0.sat+.1,'a thin layer of pigment keeps its colour instead of going pale ('+g0.sat.toFixed(2)+' to '+g1.sat.toFixed(2)+' saturation)');
 ok(g1.lum<g0.lum-.05,'and is deeper than the same stroke at the same opacity ('+g0.lum.toFixed(2)+' to '+g1.lum.toFixed(2)+')');
 const over=async(gl)=>{await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'g2',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
  await p.evaluate(g=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:60,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:0,dual:null});__gs.ui.fg=[.9,.1,.1];},gl);
  await drag(40,100,260,100);await p.evaluate(g=>{__gs.brush.glaze=g;__gs.ui.fg=[.5,.7,.9];},gl);await drag(40,100,260,100);
  return p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,i=(100*W+150)*4;return [d[i],d[i+1],d[i+2]];});};
 const o0=await over(0),o1=await over(1);
 ok(o0[1]-o1[1]>60,'a glaze lets the colour under it show through ('+o0+' against '+o1+')');
 ok(await p.evaluate(()=>!!document.getElementById('bGlaze')||(__gs.showPanel('tool'),true)),'ok');
 await p.evaluate(()=>__gs.showPanel('tool'));await p.waitForTimeout(300);ok(await p.evaluate(()=>!!document.getElementById('bGlaze')),'Thin pigment is in the brush settings');
 ok(await p.evaluate(()=>['Watercolour glaze','Dual sponge wash','Watercolour dry edge','Wash'].every(n=>__gs.library.flatMap(s=>s.presets).some(x=>x.name===n&&x.glaze>0))),'the watercolour brushes have it on');

 /* ---- 4. the ordinary brush mixes with the paint it goes over (not only the Blend brush) ---- */
 const wetOver=async(w)=>{await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'w',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
  await p.evaluate(()=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:60,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:0,wet:0,dual:null});__gs.ui.fg=[.95,.9,.1];});
  await drag(40,100,260,100);await p.evaluate(w=>{__gs.brush.wet=w;__gs.ui.fg=[.1,.2,.9];},w);await drag(40,100,260,100);
  return p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,i=(100*W+150)*4;return [d[i]/255,d[i+1]/255,d[i+2]/255];});};
 const w0=await wetOver(0),w1=await wetOver(1);
 ok(Math.abs(w0[2]-.9)<.05&&w0[0]<.15,'a plain brush covers what is under it ('+w0.map(v=>v.toFixed(2))+')');
 ok(w1[1]-Math.max(w1[0],w1[2])>.03||(w1[0]>.15&&w1[1]>.2),'with Paint mixing the new colour mixes with the paint it goes over ('+w1.map(v=>v.toFixed(2))+')');
 await p.evaluate(()=>__gs.showPanel('tool'));await p.waitForTimeout(300);
 ok(await p.evaluate(()=>{__gs.setTool('brush');return true;}),'ok');
 await p.waitForTimeout(300);ok(await p.evaluate(()=>!!document.getElementById('bWet')),'Paint mixing is in the Brush settings');
 ok(await p.evaluate(()=>['Oil filbert','Gouache filbert','Palette knife'].every(n=>__gs.library.flatMap(s=>s.presets).some(x=>x.name===n&&x.wet>0))),'the oil, gouache and knife brushes have it on');

 /* ---- 5. a brush that picks up paint carries colour along (it works like the Blend brush loaded with your colour) ---- */
 const alphaAt=(x)=>p.evaluate(x=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;const i=(100*W+x)*4;return [d[i],d[i+1],d[i+2],d[i+3]];},x);
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'pk',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:50,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:0,wet:0,pickup:0,dual:null});__gs.ui.fg=[.95,.9,.1];});
 await drag(30,100,120,100);
 await p.evaluate(()=>{__gs.brush.pickup=.7;__gs.brush.opacity=.9;__gs.ui.fg=[.1,.2,.9];});
 await drag(60,100,260,100);
 const pe=await alphaAt(230),m1=await alphaAt(100);
 ok(pe[3]>200&&pe[2]>200&&pe[0]<60,'a brush that picks up paint lays down its own colour past the old paint ('+pe+')');
 ok(m1[3]>200&&!(m1[0]>200&&m1[2]<80),'over the yellow it has mixed with it instead of just leaving yellow ('+m1+')');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(400);
 const u1=await alphaAt(230),u2=await alphaAt(100);
 ok(u1[3]===0&&u2[0]>200&&u2[2]<80,'one undo takes the whole stroke back ('+u1+' / '+u2+')');
 ok(await p.evaluate(()=>{__gs.showPanel('tool');return !!document.getElementById('bPickup');}),'Pick up paint is in the Brush settings');

 /* ---- 6. the bristle brush tips ---- */
 await p.evaluate(()=>{__gs.newDoc(300,300,8,[1,1,1],'br',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 ok(await p.evaluate(()=>['Bristle flat','Bristle dry brush','Bristle thin pigment'].every(n=>__gs.library.flatMap(s=>s.presets).some(x=>x.name===n&&x.tip))),'there are Bristle flat, Bristle dry brush and Bristle thin pigment brushes');
 await p.evaluate(()=>{__gs.setTool('brush');const pr=__gs.library.flatMap(s=>s.presets).find(x=>x.name==='Bristle flat');__gs.applyPreset(pr);Object.assign(__gs.brush,{size:100,opacity:1,wet:0,pickup:0,pOpacity:false,pSize:false,smoothing:0});__gs.ui.fg=[.05,.15,.5];});
 await drag(150,40,150,260);
 const prof=await p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;const col=y=>{const r=[];for(let x=60;x<240;x++)r.push(d[(y*W+x)*4+3]);return r;};const mid=col(150),start=col(46);let tr=0;for(let i=1;i<mid.length;i++)if(Math.abs(mid[i]-mid[i-1])>40)tr++;const wid=a=>a.filter(v=>v>30).length;return {tr,wm:wid(mid),ws:wid(start)};});
 ok(prof.tr>5,'a stroke is made of many separate hairs ('+prof.tr+' changes across it)');
 ok(prof.ws>0&&prof.ws<prof.wm*1.4+8,'the first dab already points along the stroke (width '+prof.ws+' at the start, '+prof.wm+' in the middle)');

 /* ---- 7. how much pigment ---- */
 const pig=async(v)=>{await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'pg',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
  await p.evaluate(v=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:60,hardness:1,opacity:.5,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:1,pigment:v,wet:0,pickup:0,dual:null,followDir:false});__gs.ui.fg=[.1,.3,.7];},v);
  await drag(40,100,260,100);return flat();};
 const q1=await pig(.4),q2=await pig(1),q3=await pig(2.5);
 ok(q1.lum>q2.lum&&q2.lum>q3.lum+.02,'more pigment makes the same stroke deeper ('+q1.lum.toFixed(2)+', '+q2.lum.toFixed(2)+', '+q3.lum.toFixed(2)+')');
 ok(await p.evaluate(()=>{__gs.showPanel('tool');return !!document.getElementById('bPig');}),'Pigment amount is in the brush settings');

 /* ---- 8. no black edges where red goes over blue (feedback from a tester) ---- */
 await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'rb',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:70,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:0,pigment:1,wet:0,pickup:0,dual:null,followDir:false});__gs.ui.fg=[.1,.3,.75];});
 await drag(100,40,100,160);
 await p.evaluate(()=>{Object.assign(__gs.brush,{hardness:.2,wet:.8,edgeSat:.6,opacity:.8});__gs.ui.fg=[.85,.15,.2];});await drag(30,100,200,100);
 const dark=await p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;let mn=9,n=0;for(let y=60;y<140;y++)for(let x=40;x<170;x++){const i=(y*W+x)*4,a=d[i+3];if(a<20)continue;const r=(d[i]+255-a)/255,g=(d[i+1]+255-a)/255,b=(d[i+2]+255-a)/255;const l=.299*r+.587*g+.114*b;n++;if(l<mn)mn=l;}return {mn,n};});
 ok(dark.n>1000&&dark.mn>.17,'red over blue has no black edges (darkest pixel '+dark.mn.toFixed(2)+')');

 /* ---- 9. the Lab mixing option ---- */
 const lab=async(on)=>{await p.evaluate(()=>{__gs.newDoc(300,200,8,[1,1,1],'lb',false);});await p.waitForTimeout(300);await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
  await p.evaluate(()=>{__gs.setTool('brush');Object.assign(__gs.brush,{size:60,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,pOpacity:false,buildup:false,edgeSat:0,glaze:0,wet:0,pickup:0,dual:null,followDir:false,mixLab:false});__gs.ui.fg=[.1,.2,.9];});
  await drag(40,100,260,100);await p.evaluate(on=>{__gs.brush.wet=1;__gs.brush.mixLab=on;__gs.ui.fg=[.95,.9,.1];},on);await drag(40,100,260,100);
  return p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,i=(100*W+150)*4;return [d[i]/255,d[i+1]/255,d[i+2]/255];});};
 const pg=await lab(false),lb=await lab(true);
 ok(pg[1]-Math.max(pg[0],pg[2])>.05,'pigment mixing turns blue and yellow green ('+pg.map(v=>v.toFixed(2))+')');
 ok(Math.abs(lb[1]-Math.max(lb[0],lb[2]))<.12&&Math.abs(lb[0]-pg[0])>.05,'Lab mixing gives its own, more neutral blend ('+lb.map(v=>v.toFixed(2))+')');
 await p.evaluate(()=>__gs.showPanel('tool'));await p.waitForTimeout(300);
 ok(await p.evaluate(()=>[...document.querySelectorAll('#brushBody button')].some(b=>b.textContent==='Lab')),'there is a Pigment / Lab choice in the brush settings');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
