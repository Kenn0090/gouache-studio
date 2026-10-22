/* 0.65.1: Dual brush (a second tip masks the first) and the cursor outline of faint tips such as the Watercolour pool */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1)=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:20});await p.mouse.up();await p.waitForTimeout(200);};
 // 1. the cursor outline of a faint tip
 const ol=await p.evaluate(()=>{const c=__gs.tipOutline(__gs.library.flatMap(s=>s.presets).find(x=>x.name==='Watercolour glaze').tip,96);const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=3;i<d.length;i+=4)if(d[i]>0)n++;return {n,empty:!!c._empty};});
 ok(ol.n>40&&!ol.empty,'the Watercolour pool tip now has a cursor outline ('+ol.n+' px)');
 const ol2=await p.evaluate(()=>{const c=__gs.tipOutline(__gs.TIPS.sponge,96);return !c._empty;});ok(ol2,'normal tips still have one');
 // 2. dual brush
 await p.evaluate(()=>__gs.newDoc(300,160,8,[1,1,1],'dual',false));await p.waitForTimeout(300);
 await p.keyboard.press('Control+Shift+n');await p.waitForTimeout(200);
 await p.evaluate(()=>{Object.assign(__gs.brush,{size:70,hardness:1,opacity:1,flow:1,spacing:.05,smoothing:0,grain:0,tip:null,pSize:false,dual:null});__gs.ui.fg=[0,0,0];});
 const part=async()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w;let core=0,partial=0;for(let y=60;y<100;y++)for(let x=60;x<240;x++){const a=d[(y*W+x)*4+3];if(a>5){core++;if(a<200)partial++;}}return {core,partial};});
 await drag(40,80,260,80);const plain=await part();ok(plain.core>3000&&plain.partial<plain.core*.1,'a plain stroke is solid ('+plain.partial+' of '+plain.core+' partly see-through)');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);
 await p.evaluate(()=>{__gs.brush.dual={on:true,tipKey:'b:sponge',size:30,spacing:150,scatter:80,count:1,mode:0,amount:100};});
 await drag(40,80,260,80);const dm=await part();ok(dm.partial>dm.core*.2,'with a dual brush (Multiply) the stroke is broken up by the second tip ('+dm.partial+' of '+dm.core+')');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);
 await p.evaluate(()=>{__gs.brush.dual={on:true,tipKey:'b:sponge',size:30,spacing:150,scatter:80,count:1,mode:1,amount:100};});
 await drag(40,80,260,80);const dk=await part();ok(dk.partial+(7200-dk.core)>700&&dk.core>5000,'Knock out cuts holes instead ('+dk.partial+' partly see-through, '+(7200-dk.core)+' gone, of 7200)');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);
 await p.evaluate(()=>{__gs.brush.dual={on:true,tipKey:'b:sponge',size:30,spacing:150,scatter:80,count:1,mode:0,amount:0};});
 await drag(40,80,260,80);const d0=await part();ok(d0.partial<d0.core*.1,'Amount 0% leaves the stroke solid ('+d0.partial+' of '+d0.core+')');
 await p.evaluate(()=>__gs.undo());await p.waitForTimeout(300);
 // 3. the settings, and it saves with a brush
 await p.evaluate(()=>{__gs.brush.dual=null;__gs.showPanel('brushes');});await p.waitForTimeout(300);
 await p.evaluate(()=>{__gs.showPanel('tool');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('bDualOn')),'Dual brush is in the brush settings');
 await p.evaluate(()=>document.getElementById('bDualOn').click());await p.waitForTimeout(400);
 ok(await p.evaluate(()=>!!(__gs.brush.dual&&__gs.brush.dual.on)&&!!document.getElementById('bDualRand')&&!!document.getElementById('bDualTip')&&!!document.getElementById('bDualSize')&&!!document.getElementById('bDualScatter')&&!!document.getElementById('bDualAmt')),'ticking it shows the tip, size, spacing, scatter, count and amount');
 ok(await p.evaluate(()=>{const a=__gs.brush.dual;__gs.brushEdited();return JSON.parse(JSON.stringify(a)).tipKey==='b:sponge';}),'the settings are plain data (they save with a brush)');
 ok(await p.evaluate(()=>__gs.library.flatMap(s=>s.presets).some(x=>x.name==='Dual sponge wash'&&x.dual&&x.dual.on)),'there is a ready-made Dual sponge wash brush');
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
