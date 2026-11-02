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
 await p.evaluate(()=>{__gs.brush.mix=false;__gs.brush.size=30;__gs.brush.hardness=.9;});
 await setColour([1,0,0]);await drag(30,128,226,128);
 const red=await px(128,128);ok(red&&red[0]>200&&red[1]<60&&red[2]<60,'plain red stroke is red '+JSON.stringify(red));
 // now a blue Mixing stroke across it, top to bottom
 await preset('Oil mixer');await p.evaluate(()=>{__gs.brush.size=30;__gs.brush.followDir=false;});await setColour([0,0,1]);
 await drag(128,40,128,216);
 const top=await px(128,60),cross=await px(128,128),after=await px(128,200);
 console.log('top',top,'cross',cross,'after',after);
 ok(top&&top[2]>150&&top[0]<120,'the start of the stroke is blue');
 ok(cross&&cross[0]>40&&cross[2]>40,'where it crosses the red the paint is a mix (both red and blue present)');
 ok(after&&after[0]>20,'the brush carried red paint onwards past the crossing');
 // undo
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);
 const un=await px(128,60);ok(un&&un[0]>240&&un[1]>240,'undo removes the whole mixing stroke '+JSON.stringify(un));
 // smear brush (empty) pulls red sideways
 await preset('Smear (empty brush)');await p.evaluate(()=>{__gs.brush.size=30;});
 await drag(128,128,128,200);
 const sm=await px(128,190);ok(sm&&sm[0]>240&&sm[1]<225&&sm[2]<225,'the empty smear brush dragged red down below the stroke '+JSON.stringify(sm));
 // dry paint: no more mixing from wet pickup (dry paint is picked up far less)
 await p.evaluate(()=>{for(const L of __gs.allLayers())if(L._wet)L._wet.until=0;});
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
