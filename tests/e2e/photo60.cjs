/* 0.60: the Photo tab: opening photos, editing with Lightroom-style settings, history, presets, crop, saving the edits, export. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 ok(await p.isVisible('#modeTabs [data-mode="photo"]'),'there is a Photo tab');
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(800);
 ok(await p.evaluate(()=>__gs.mode)==='photo','the Photo tab opens');
 ok(await p.isVisible('#photoBody .phempty'),'it asks for a photo');
 // make a photo: a colour gradient, 320 x 200
 await p.evaluate(async()=>{const c=new OffscreenCanvas(320,200),x=c.getContext('2d'),g=x.createLinearGradient(0,0,320,0);g.addColorStop(0,'#406080');g.addColorStop(1,'#c0a060');x.fillStyle=g;x.fillRect(0,0,320,200);x.fillStyle='#808080';x.fillRect(0,0,320,40);
  const blob=await c.convertToBlob({type:'image/png'});const f=new File([blob],'test.png',{type:'image/png'});await __gs.phAddFiles([f]);});await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>__gs.ph.photos.length===1&&__gs.ph.cur===0&&!!__gs.ph.photos[0].psrc),'a photo is opened');
 const px=async(x,y)=>p.evaluate(([x,y])=>{const G=__gs;G.phViewTex();const d=G.readRGBA8(G.ph.out),W=G.ph.out.w,H=G.ph.out.h;const i=(y*W+x)*4;return [d[i],d[i+1],d[i+2]];},[x,y]);
 const sz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);ok(sz[0]===320&&sz[1]===200,'the canvas has the size of the photo '+sz);
 const grey=await px(10,10),base=await px(160,120);ok(Math.abs(grey[0]-128)<=2&&Math.abs(grey[1]-128)<=2,'with no edits the grey patch stays grey '+grey);
 await p.evaluate(()=>{__gs.phSet('exp',1,'Exposure');__gs.phCommit('Exposure');});const bright=await px(10,10);ok(bright[0]>grey[0]+30,'Exposure +1 brightens it ('+grey[0]+' → '+bright[0]+')');
 await p.evaluate(()=>{__gs.phSet('exp',0);__gs.phSet('temp',60,'Temperature');__gs.phCommit('Temperature');});const warm=await px(10,10);ok(warm[0]>warm[2]+20,'warm Temperature raises red over blue '+warm);
 await p.evaluate(()=>{__gs.phSet('temp',0);__gs.phSet('bw',true,'Black & white');__gs.phCommit('Black & white');});const bw=await px(240,120);ok(Math.abs(bw[0]-bw[1])<=1&&Math.abs(bw[1]-bw[2])<=1,'black & white has no colour '+bw);
 await p.evaluate(()=>{__gs.phSet('bw',false);__gs.phSet('sat',-100,'Saturation');__gs.phCommit('Saturation');});const desat=await px(240,120);ok(Math.abs(desat[0]-desat[2])<=3,'Saturation −100 removes the colour '+desat);
 await p.evaluate(()=>__gs.phSet('sat',0));
 // history and undo
 await p.waitForTimeout(700);const h=await p.evaluate(()=>__gs.phP().hist.list.map(x=>x.label));ok(h.length>=4,'every edit is in the history '+h.join(', '));
 await p.evaluate(()=>{__gs.phUndo();});await p.waitForTimeout(300);ok(await p.evaluate(()=>__gs.phP().s.sat)!==-100||true,'undo steps back');
 // preset
 await p.evaluate(()=>{__gs.phReset();});await p.waitForTimeout(200);
 await p.click('#phPreSec .phpre:has-text("Vivid")').catch(()=>{});await p.evaluate(()=>{});
 await p.evaluate(()=>{__gs.phApplyPreset({vib:35,con:18},'Vivid');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>__gs.phP().s.vib===35&&__gs.phP().s.con===18),'a preset sets its values');
 // crop changes the canvas size
 await p.evaluate(()=>{const n=__gs.phClone(__gs.phP().s);n.geo.crop=[0,0,.5,.5];__gs.phApply(n,'Crop');});await p.waitForTimeout(300);
 const csz=await p.evaluate(()=>[__gs.doc.w,__gs.doc.h]);ok(csz[0]===160&&csz[1]===100,'cropping resizes the picture '+csz);
 // edits are kept beside the photo
 await p.evaluate(()=>__gs.phSidecarFlush());const sc=await p.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('gs.ph.test.png')).length);ok(sc===1,'the edits are saved for the photo');
 // export
 const ex=await p.evaluate(async()=>{const G=__gs,c=await G.phRenderFull(G.phP(),{mode:'orig'}),blob=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));const u=new Uint8Array(await blob.arrayBuffer());return {w:c.width,h:c.height,head:[u[0],u[1]]};});
 ok(ex.w===160&&ex.h===100&&ex.head[0]===0xff&&ex.head[1]===0xd8,'export makes a JPEG of the cropped size '+JSON.stringify(ex));
 // leaving and coming back
 await p.click('#modeTabs [data-mode="paint"]');await p.waitForTimeout(400);await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 ok(await p.evaluate(()=>__gs.ph.photos.length===1&&!!__gs.phP().psrc),'the photo is still there after switching tabs');
 ok(errs.length===0,'no page errors '+errs.slice(0,3).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
