/* 0.97.27 fixes from Kenn: zoom range, project textures into a material channel, Texture Set Settings refresh and Alt+click,
   only the material's own channels shown, Recolour with Tint & adjust, reflectivity in the material editor, clone/heal on the model */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1600,height:1000}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));localStorage.setItem('gs.matOpen','all');}catch(e){}});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>document.querySelector('#modeTabs [data-mode=p3d]').click());await W(3000);
 /* zoom: much closer and much farther than the old 0.2 … 50, and the near cut-off follows */
 const z=await p.evaluate(()=>{const g=__gs,r=g.v3.mesh.radius,L=g.v3ZoomLim();g.v3.cam.dist=L[0];const near=g.v3Clip()[0];g.v3.cam.dist=4;return {lo:L[0],hi:L[1],r,near};});
 ok(z.lo<.2&&z.hi>50&&z.near<=z.lo*.06,'the zoom goes closer and farther, with the near cut-off following '+JSON.stringify(z));
 const hb=await p.locator('#v3Hit').boundingBox();await p.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);
 for(let i=0;i<40;i++)await p.mouse.wheel(0,-400);await W(200);
 ok(await p.evaluate(()=>__gs.v3.cam.dist<.2),'the mouse wheel zooms past the old limit '+await p.evaluate(()=>__gs.v3.cam.dist.toFixed(4)));
 await p.evaluate(()=>{__gs.v3.cam.dist=4;__gs.v3.dirty=true;});
 /* the material editor shows only the channels the material sets */
 await p.evaluate(()=>{const L=__gs.allLayers().find(l=>l.fill);__gs.doc.active=L;__gs.doc.sel=new Set([L]);__gs.showPanel('matEd');__gs.renderMatEd(true);});await W(400);
 const vis=await p.evaluate(()=>[...document.querySelectorAll('#matEdBody .fillcard[data-material-channel]')].filter(c=>!c.hidden).map(c=>c.dataset.materialChannel));
 const offK=await p.evaluate(()=>{const L=__gs.doc.active;return Object.keys(L.fill.maps).filter(k=>!L.fill.maps[k].on&&__gs.doc.maps.includes(k));});
 ok(vis.length&&offK.every(k=>!vis.includes(k)),'cards are shown only for channels that are on '+JSON.stringify(vis)+' off '+JSON.stringify(offK));
 /* Recolour sits with Tint & adjust, without its own copy of contrast/brightness/saturation */
 const rc=await p.evaluate(()=>{const b=document.getElementById('matEdBody'),r=b.querySelector('.recolBox'),t=[...b.querySelectorAll('.fillcard.tint')].pop();return {after:!!(r&&t&&t.nextElementSibling===r),dup:!!b.querySelector('#rc_con')};});
 ok(rc.after&&!rc.dup,'Recolour is right under Tint & adjust, without the duplicate sliders '+JSON.stringify(rc));
 /* Alt+click a channel button: only that channel; Alt+click again: the others come back */
 const before=await p.evaluate(()=>{const L=__gs.doc.active;return Object.keys(L.fill.maps).filter(k=>L.fill.maps[k].on);});
 await p.click('#tssMat_rough',{modifiers:['Alt']});await W(400);
 const solo=await p.evaluate(()=>{const L=__gs.doc.active;return Object.keys(L.fill.maps).filter(k=>L.fill.maps[k].on);});
 ok(solo.length===1&&solo[0]==='rough','Alt+click leaves only that channel on '+JSON.stringify(solo));
 await p.click('#tssMat_rough',{modifiers:['Alt']});await W(400);
 const back=await p.evaluate(()=>{const L=__gs.doc.active;return Object.keys(L.fill.maps).filter(k=>L.fill.maps[k].on);});
 ok(JSON.stringify(back.sort())===JSON.stringify(before.sort()),'Alt+click again brings the others back '+JSON.stringify(back));
 /* removing a channel from the set updates the material editor at once */
 await p.evaluate(()=>{__gs.tssAdd('emis');__gs.doc.active.fill.maps.emis=Object.assign(__gs.doc.active.fill.maps.emis||{},{on:true,src:'value',c:[1,0,0]});__gs.renderMatEd(true);});await W(300);
 const had=await p.evaluate(()=>!!document.querySelector('#matEdBody .fillcard[data-material-channel=emis]:not([hidden])'));
 await p.evaluate(()=>__gs.tssRemove('emis'));await W(100);
 const gone=await p.evaluate(()=>!document.querySelector('#matEdBody .fillcard[data-material-channel=emis]:not([hidden])')&&!document.querySelector('#tssMat_emis'));
 ok(had&&gone,'removing Emissive from the set takes its card away straight away');
 /* reflectivity: Specular shows Specular colour instead of Metallic */
 await p.evaluate(()=>{__gs.showPanel('shading');__gs.renderShading();__gs.skSetRefl('spec');});await W(500);
 const sp=await p.evaluate(()=>({metal:!!document.querySelector('#tssMat_metal'),specc:!!document.querySelector('#tssMat_specc'),mc:!!document.querySelector('#matEdBody .fillcard[data-material-channel=metal]:not([hidden])')}));
 ok(!sp.metal&&sp.specc&&!sp.mc,'Specular reflectivity: the material editor offers Specular colour instead of Metallic '+JSON.stringify(sp));
 await p.evaluate(()=>__gs.skSetRefl('metal'));await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#tssMat_metal')&&!document.querySelector('#tssMat_specc')),'…and Metalness brings Metallic back');
 /* a project texture dropped on a channel card becomes that channel's picture */
 const pa=await p.evaluate(async()=>{const g=__gs,P=g.allLayers().find(l=>!l.fill&&l.maps);const T=g.mapT(P,'base');g.clearTarget(T,[.2,.6,.9,1]);T.empty=false;
   const e=g.paEntries().find(x=>x.kind==='tex'&&x.layer===P&&x.channel==='base');const L=g.allLayers().find(l=>l.fill);g.doc.active=L;g.doc.sel=new Set([L]);
   await g.paToChannel(e,'rough');const s=L.fill.maps.rough;return {src:s.src,on:s.on,img:!!(L._fillImg&&L._fillImg.rough),name:s.name};});
 ok(pa.src==='image'&&pa.on&&pa.img,'a project texture goes into a material channel '+JSON.stringify(pa));
 ok(await p.evaluate(()=>__gs.MESH_WRAP_ONLY.includes('clone')&&__gs.MESH_WRAP_ONLY.includes('heal')),'clone and heal paint on the model even when the alignment is UV (heal.cjs covers the stroke)');
 ok(!errs.length,'no page errors '+errs.join(' | ').slice(0,300));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
