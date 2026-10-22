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
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
