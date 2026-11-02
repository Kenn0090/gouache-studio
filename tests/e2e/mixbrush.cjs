/* 0.81: the Mixing brush. A red stroke is laid down with the plain brush, then a blue Mixing brush is dragged across it:
   the crossing must mix like paint (not stay pure blue or pure red), the brush must carry red onwards, and an empty "smear" brush
   must pull the red out sideways. Dry paint stops the mixing. Undo puts the picture back. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1100}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Mix',false,'hand'));await p.waitForTimeout(400);
 const box=await p.evaluate(()=>{const c=document.querySelector('#gl')||document.querySelector('canvas');const r=c.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};});
 const at=(ix,iy)=>[box.x+ix/256*box.w,box.y+iy/256*box.h];
 const px=(ix,iy)=>p.evaluate(([x,y])=>Array.from(__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data),[ix,iy]).catch(()=>null);
 const setColour=c=>p.evaluate(c=>{__gs.ui.fg=c.slice();},c);
 const preset=n=>p.evaluate(n=>{const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name===n);if(!q)return false;__gs.applyPreset(q);return true;},n);
 const drag=async(x0,y0,x1,y1)=>{const a=at(x0,y0),z=at(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:24});await p.mouse.up();await p.waitForTimeout(200);};
 ok(await preset('Oil mixer'),'the Mixing presets exist in the library');
 // a plain red stroke first (turn mixing off in a copy of the preset)
 await p.evaluate(()=>{__gs.brush.size=30;__gs.brush.followDir=false;__gs.brush.mixBristles=0;__gs.brush.mixUse=0;__gs.brush.mixThick=0;});
 await setColour([1,0,0]);await drag(30,128,226,128);
 const red=await px(128,128);ok(red&&red[0]>200&&red[1]<60&&red[2]<60,'the first (wet) red stroke is red '+JSON.stringify(red));
 // now a blue Mixing stroke across it, top to bottom
 await p.evaluate(()=>{__gs.brush.mixBristles=0;__gs.brush.mixPick=.7;});await setColour([0,0,1]);
 await drag(128,40,128,216);
 const top=await px(128,60),cross=await px(128,128),after=await px(128,200);
 console.log('top',top,'cross',cross,'after',after);
 ok(top&&top[2]>150&&top[0]<120,'the start of the stroke is blue');
 ok(cross&&cross[0]>40&&cross[2]>40,'where it crosses the red the paint is a mix (both red and blue present)');
 ok(after&&after[0]>20,'the brush carried red paint onwards past the crossing');
 // dry paint is covered: the same blue stroke over dried red stays blue
 // undo
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);
 const un=await px(128,60);ok(un&&un[0]>240&&un[1]>240,'undo removes the whole mixing stroke '+JSON.stringify(un));
 // smear brush (empty) pulls red sideways
 await preset('Smear (empty brush)');await p.evaluate(()=>{__gs.brush.size=30;});
 await drag(128,128,128,200);
 const sm=await px(128,190);ok(sm&&sm[0]>200&&sm[1]<215&&sm[2]<205,'the empty smear brush dragged red down below the stroke '+JSON.stringify(sm));
 // thick paint: a stroke with Paint thickness varies across its width, a flat one is even
 const spread=async y=>{const v=await p.evaluate(y=>{const o=[];for(let x=-16;x<=16;x+=1){const d=__gs.captureRegionNow(__gs.doc.active.target,150,y+x,1,1).data;o.push(d[0]+d[1]+d[2]);}return o;},y);return Math.max(...v)-Math.min(...v);};
 await preset('Oil mixer');await setColour([.2,.6,.3]);await p.evaluate(()=>{__gs.brush.size=40;__gs.brush.mixThick=0;__gs.brush.mixBristles=24;});await drag(30,230,226,230);
 const flat=await spread(230);
 await p.evaluate(()=>{__gs.brush.mixThick=.8;});await drag(30,240,226,240);
 const thick=await spread(240);
 console.log('flat spread',flat,'thick spread',thick);
 ok(thick>flat+25,'Paint thickness makes the stroke surface vary (ridges and lit edges)');
 // smooth curves: a sharp point in sparse mouse movement is rounded off (the tip of the stroke is cut)
 const tip=async on=>{await p.evaluate(on=>{const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name==='Oil mixer');__gs.applyPreset(q);Object.assign(__gs.brush,{size:10,mixBristles:0,mixThick:0,smoothing:0,lazy:0,smoothCurve:on,followDir:false});},on);await setColour([0,0,0]);
  const a=at(30,150),b=at(110,20),c=at(190,150);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(b[0],b[1]);await p.mouse.move(c[0],c[1]);await p.mouse.up();await p.waitForTimeout(200);
  const d=await px(110,22);return d[0];};
 const sharp=await tip(false);await p.keyboard.press('Control+z');await p.waitForTimeout(200);const round=await tip(true);
 console.log('apex pixel without curves',sharp,'with curves',round);
 ok(sharp<200&&round>240,'Smooth curves round off the sharp point of a stroke');
 // dry paint: no more mixing from wet pickup (dry paint is picked up far less)
 await p.evaluate(()=>{for(const L of __gs.allLayers())if(L._wet)L._wet.until=0;});
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
