/* Gradient picker anchoring, exposed-edge wear, and opt-in baked Lighting layers. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(__dirname, '../../dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server = http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL||undefined,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1440,height:950}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('gs.welcome','no');
      localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'2d'}));
    });
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.goto(origin+'/index.html?debug');
    await page.waitForFunction(()=>window.__gs?.p3Bake);
    const drag=await page.evaluate(()=>{
      const G=__gs;
      G.closeWelcome();G.setMode('paint',true);G.setWorkspace('painting');
      G.newDoc(128,128,8,null,'Gradient',false);G.ui.gradLive=true;G.setTool('gradient');G.showPanel('tool');
      const stage=document.getElementById('stage').getBoundingClientRect();
      return [[20,64],[108,64]].map(([x,y])=>{
        const [left,top]=G.toScreen(x,y);return [left+stage.left,top+stage.top];
      });
    });
    await page.mouse.move(...drag[0]);await page.mouse.down();await page.mouse.move(...drag[1],{steps:8});await page.mouse.up();
    await page.waitForFunction(()=>__gs.doc.active.grad);
    const checkPicker=async(id,hex)=>{
      const anchor=page.locator('#'+id);
      const before=await anchor.inputValue();
      const handle=await anchor.elementHandle();
      await anchor.click();
      await page.locator('#cp_hex').waitFor();
      assert.equal(await anchor.inputValue(),before);
      assert.equal(await page.getByRole('button',{name:'System picker…',exact:true}).count(),0);
      const position=()=>page.evaluate(id=>{
        const swatch=document.getElementById(id).getBoundingClientRect(),pop=document.querySelector('.colpop');
        return {left:parseFloat(pop.style.left),top:parseFloat(pop.style.top),anchorLeft:swatch.left};
      },id);
      const placed=await position();
      assert.ok(placed.left>40&&Math.abs(placed.left-placed.anchorLeft)<260,JSON.stringify(placed));
      await page.locator('#cp_hex').fill(hex);
      await page.locator('#cp_hex').press('Tab');
      assert.equal(await anchor.inputValue(),hex);
      assert.equal(await handle.evaluate((old,id)=>document.getElementById(id)===old,id),true);
      assert.deepEqual(await position(),placed);
      await page.locator('#cp_close').click();
    };
    await checkPicker('gsColor','#ff3344');
    const stop=await page.evaluate(()=>__gs.toHex(__gs.doc.active.grad.def.stops[0].c));
    assert.equal(stop,'#ff3344');
    await page.evaluate(()=>__gs.fxMenu('gradMap'));
    await checkPicker('gmCol','#2255ee');
    await page.locator('#dlgCancel').click();
    console.log('PASS Gradient and Gradient Map keep the live picker at the swatch');

    const wear=await page.evaluate(()=>{
      const G=__gs;
      G.setMode('p3d',true);G.useModel(G.primMesh('plane',0));
      const {w,h}=G.doc;
      const map=values=>{
        const t=G.makeTarget(w,h,8,false),pixels=new Uint8Array(w*h*4);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4;
          pixels[i]=pixels[i+1]=pixels[i+2]=values[Math.floor(x*4/w)];
          pixels[i+3]=255;
        }
        G.writeRegion(t,0,0,w,h,pixels);return t;
      };
      G.doc.meshMaps={curv:map([230,25,128,230]),ao:map([255,255,255,0])};
      const L=G.cmdNewFillLayer({name:'Exposed metal',maps:{base:{c:[.65,.65,.65]},metal:{v:1}}});
      const row=G.msAdd(L,'gen',{p:{...G.msGenDefaults('metalWear'),metalScan:'',breakup:0,distort:0,scratchAmount:0}});
      const sample=()=>{
        L.mask._key=null;G.msUpdate(L);
        return [1,3,5,7].map(x=>G.captureRegionNow(L.mask.target,Math.floor(w*x/8),Math.floor(h/2),1,1).data[0]);
      };
      const standard=sample();
      row.p.cavityProtection=0;
      const unprotected=sample();
      G.doc.meshMaps.curvEdge=map([0,230,0,0]);
      const bakedEdges=sample();
      const flatPixels=()=>G.captureRegionNow(L.mask.target,Math.floor(w/8),0,Math.floor(w/10),h).data;
      Object.assign(row.p,{scratchAmount:1,scratchReach:0,proj:'uv'});
      sample();
      const edgeOnly=flatPixels();
      row.p.scratchReach=1;
      sample();
      const scratched=flatPixels();
      row.p.scratchAngle=90;
      sample();
      const turned=flatPixels();
      const scratchDelta=scratched.reduce((sum,v,i)=>sum+Math.abs(v-edgeOnly[i]),0);
      const angleDelta=scratched.reduce((sum,v,i)=>sum+Math.abs(v-turned[i]),0);
      row.p.amount=0;
      return {standard,unprotected,bakedEdges,zero:sample(),scratchDelta,angleDelta};
    });
    assert.ok(wear.standard[0]>220&&wear.standard[1]===0&&wear.standard[2]===0&&wear.standard[3]<80,JSON.stringify(wear));
    assert.ok(wear.unprotected[3]>220&&wear.bakedEdges[0]===0&&wear.bakedEdges[1]>220,JSON.stringify(wear));
    assert.deepEqual(wear.zero,[0,0,0,0]);
    assert.ok(wear.scratchDelta>1000&&wear.angleDelta>1000,JSON.stringify(wear));
    assert.equal(await page.locator('#ms_g').inputValue(),'metalWear');
    assert.equal(await page.locator('#ms_cavityProtection').count(),1);
    console.log('PASS Metal Edge Wear follows baked edges, protects recesses, and adds adjustable scratches');

    await page.evaluate(()=>{
      const G=__gs,L=G.doc.active,row=L.mask.stack.at(-1);
      Object.assign(row.p,{amount:.65,metalScanAmount:.85,metalScanTile:2,scratchAmount:0,scratchReach:0,cavityProtection:1});
      const {w,h}=G.doc,t=G.doc.meshMaps.curvEdge,rgba=new Uint8Array(w*h*4);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const i=(y*w+x)*4,v=[0,230,0,230][Math.floor(x*4/w)];
        rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;
      }
      G.writeRegion(t,0,0,w,h,rgba);
      window.metalWearStrip=(strip,settings={})=>{
        Object.assign(row.p,settings);
        L.mask._key=null;G.msUpdate(L);
        return [...G.captureRegionNow(L.mask.target,w*strip/4,0,w/4,h).data.filter((_,i)=>i%4===0)];
      };
    });
    assert.equal(await page.locator('#ms_metalScan').inputValue(),'');
    const metalStrip=(strip,settings)=>page.evaluate(([strip,settings])=>window.metalWearStrip(strip,settings),[strip,settings]);
    const difference=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
    const unscannedEdge=await metalStrip(1);
    const metalSamples=[];
    for(const slug of ['metal-gouged-iron-scan','metal-pitted-steel-scan','metal-chipped-steel-scan']){
      await page.locator('#ms_metalScan').selectOption(slug);
      await page.waitForFunction(slug=>__gs.tx.cache.has('photo:'+slug),slug);
      assert.ok(await page.evaluate(slug=>__gs.txItems().some(t=>t.kind==='photo'&&t.id===slug),slug));
      metalSamples.push(await metalStrip(1));
    }
    assert.ok(metalSamples.every(sample=>difference(unscannedEdge,sample)>1000));
    assert.ok(difference(metalSamples[0],metalSamples[1])>1000&&difference(metalSamples[1],metalSamples[2])>1000);
    const angled=await metalStrip(1,{metalScanAngle:68});
    const tiledMetal=await metalStrip(1,{metalScanTile:4});
    assert.ok(difference(metalSamples[2],angled)>1000&&difference(angled,tiledMetal)>1000);
    assert.deepEqual(await metalStrip(1,{metalScanAmount:0}),unscannedEdge);
    const flatNear=await metalStrip(0,{metalScanAmount:.85,scratchAmount:.65,scratchReach:0});
    const flatFar=await metalStrip(0,{scratchReach:1});
    const protectedRecess=await metalStrip(3);
    assert.ok(flatNear.every(v=>v===0)&&flatFar.some(v=>v>10)&&protectedRecess.every(v=>v===0));
    console.log('PASS The three metal scans break up edges offline, honor scratch reach and AO, and support independent tiling and rotation');

    const edgeShape=await page.evaluate(()=>{
      const G=__gs;
      const mesh=G.parseOBJ([
        'v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0',
        'vt .06 .1','vt .4 .1','vt .4 .9','vt .06 .9','vt .6 .1','vt .84 .1','vt .84 .9','vt .6 .9',
        'f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 2/5 5/6 6/7','f 2/5 6/7 3/8'
      ].join('\n'),'Split plane');
      G.v3s().uvs=1;G.useModel(mesh);
      const {w,h}=G.doc;
      const t=G.makeTarget(w,h,8,false),data=new Uint8Array(w*h*4);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const u=(x+.5)/w,inIsland=(u>=.06&&u<.4)||(u>=.6&&u<.84);
        const distance=Math.abs(y+.5-h/2);
        const v=!inIsland?0:distance<2?230:distance<6?35:0;
        const i=(y*w+x)*4;data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
      }
      G.writeRegion(t,0,0,w,h,data);
      G.doc.meshMaps={curvEdge:t};
      const L=G.cmdNewFillLayer({name:'Edge distortion',maps:{base:{c:[1,1,1]}}});
      const row=G.msAdd(L,'gen',{p:{...G.msGenDefaults('metalWear'),metalScan:'',edgeStrength:1,
        proj:'world',amount:.8,width:.5,distort:0,scratchAmount:0,breakup:0}});
      const sample=settings=>{
        Object.assign(row.p,settings);L.mask._key=null;G.msUpdate(L);
        return G.captureRegionNow(L.mask.target,0,0,w,h).data;
      };
      const weak=sample({edgeStrength:.5}),strong=sample({edgeStrength:2});
      const undistorted=sample({edgeStrength:1});
      const grown=sample({edgeGrow:1}),uvGrown=sample({proj:'uv'});
      const warped=sample({proj:'world',edgeGrow:0,distort:1,edgeDistortScale:9});
      const finer=sample({edgeDistortScale:20}),uvWarped=sample({proj:'uv',edgeDistortScale:9});
      const disabled=sample({proj:'world',distort:0,edgeStrength:0});
      const value=(d,x,y)=>d[(y*w+x)*4],sum=d=>d.reduce((s,v,i)=>s+(i%4===0?v:0),0);
      const difference=(a,b)=>a.reduce((s,v,i)=>s+(i%4===0?Math.abs(v-b[i]):0),0);
      const centre=(d,x)=>{
        let mass=0,weighted=0;
        for(let y=h/2-12;y<h/2+12;y++){
          const v=value(d,x,y);mass+=v;weighted+=v*y;
        }
        return weighted/mass;
      };
      const band=Array.from({length:30},(_,i)=>centre(warped,12+i));
      return {weak:sum(weak),strong:sum(strong),disabled:sum(disabled),
        growRatio:sum(grown)/sum(undistorted),uvGrowRatio:sum(uvGrown)/sum(undistorted),
        grownGap:value(grown,Math.floor(w/2),Math.floor(h/2)),
        warpDelta:difference(undistorted,warped),scaleDelta:difference(warped,finer),uvDelta:difference(undistorted,uvWarped),
        bandMovement:Math.max(...band)-Math.min(...band),
        seamError:Math.abs(centre(warped,Math.floor(.4*w)-1)-centre(warped,Math.ceil(.6*w))),
        gap:value(warped,Math.floor(w/2),Math.floor(h/2))};
    });
    assert.ok(edgeShape.weak>0&&edgeShape.strong>edgeShape.weak*1.5&&edgeShape.disabled===0,JSON.stringify(edgeShape));
    assert.ok(edgeShape.warpDelta>1000&&edgeShape.scaleDelta>1000&&edgeShape.uvDelta>1000&&edgeShape.bandMovement>1,JSON.stringify(edgeShape));
    assert.ok(edgeShape.seamError<2&&edgeShape.gap===0,JSON.stringify(edgeShape));
    assert.ok(edgeShape.growRatio>1.4&&edgeShape.uvGrowRatio>1.4&&edgeShape.grownGap===0,JSON.stringify(edgeShape));
    assert.equal(await page.locator('label[for="ms_dist"]').textContent(),'Edge distortion');
    assert.equal(await page.locator('#ms_edgeDistortScale').count(),1);
    assert.equal(await page.locator('#ms_edgeGrow').count(),1);
    console.log('PASS Edge strength, growth, and distortion control the band in UV and World modes');

    const useWear=await page.evaluate(async()=>{
      const G=__gs,{w,h}=G.doc,ao=G.makeTarget(w,h,8,false),rgba=new Uint8Array(w*h*4);
      for(let i=0;i<rgba.length;i+=4){
        const v=(i/4)%w<w/2?0:255;
        rgba[i]=rgba[i+1]=rgba[i+2]=v;rgba[i+3]=255;
      }
      G.writeRegion(ao,0,0,w,h,rgba);
      G.doc.meshMaps={ao};
      const L=G.cmdNewFillLayer({name:'Contact wear',maps:{base:{c:[1,1,1]}}});
      const row=G.msAdd(L,'gen',{p:{...G.msGenDefaults('useWear'),proj:'uv',edgeStrength:0,distort:0,
        edgeGrow:0,scratchAmount:0,breakup:0,cavityProtection:1,contactAmount:1,metalScan:''}});
      const sample=()=>{
        L.mask._key=null;G.msUpdate(L);
        const data=G.captureRegionNow(L.mask.target,0,0,w,h).data;
        const total=(start,end)=>data.reduce((sum,v,i)=>sum+(i%4===0&&(i/4)%w>=start&&(i/4)%w<end?v:0),0);
        return {shadow:total(0,w/2),exposed:total(w/2,w)};
      };
      const contact=sample();
      row.p.contactAxis='-z';
      const turned=sample();
      row.p.contactAxis='';
      const scans=['grunge-concrete-pores','grunge-concrete-cracks','grunge-oxidized-steel','grunge-scuffed-steel'];
      const found=G.txItems().filter(t=>t.kind==='photo'&&scans.includes(t.id)).length;
      for(const id of scans)await G.txTarget({kind:'photo',id});
      row.p.metalScan='grunge-scuffed-steel';
      const scanned=sample();
      row.p.contactAmount=0;
      const disabled=sample();
      return {contact,turned,scanned,disabled,found};
    });
    assert.ok(useWear.found===4&&useWear.contact.exposed>1000&&useWear.contact.shadow===0&&useWear.turned.exposed<useWear.contact.exposed*.05,JSON.stringify(useWear));
    assert.ok(useWear.scanned.exposed>0&&useWear.scanned.exposed<useWear.contact.exposed&&useWear.disabled.exposed===0,JSON.stringify(useWear));
    assert.equal(await page.locator('#ms_g').inputValue(),'useWear');
    assert.equal(await page.locator('#ms_contactAmount').count(),1);
    console.log('PASS Use Wear adds directional contact scuffs to exposed areas and reads the new scans offline');

    const damage=await page.evaluate(()=>{
      const G=__gs;
      const read=L=>{
        L.mask._key=null;G.msUpdate(L);
        return G.captureRegionNow(L.mask.target,0,0,G.doc.w,G.doc.h).data.filter((_,i)=>i%4===0);
      };
      const create=g=>{
        const L=G.cmdNewFillLayer({name:g,maps:{base:{c:[.5,.5,.5]}}});
        const row=G.msAdd(L,'gen',{p:{...G.msGenDefaults(g),proj:'uv'}});
        const original=read(L);
        row.p.seed+=4;
        const seeded=read(L);
        row.p.amount=0;
        const zero=read(L).every(v=>v===0);
        return {original,seeded,zero};
      };
      const peel=create('peelingPaint'),bubbles=create('paintBubbles');
      const describe=({original,seeded,zero})=>({bright:original.filter(v=>v>150).length,
        dark:original.filter(v=>v<10).length,mid:original.filter(v=>v>=10&&v<=150).length,zero,
        seedDiff:original.reduce((sum,v,i)=>sum+Math.abs(v-seeded[i]),0)});
      return {peel:describe(peel),bubbles:describe(bubbles),
        distinct:peel.original.reduce((sum,v,i)=>sum+Math.abs(v-bubbles.original[i]),0)};
    });
    for(const pattern of [damage.peel,damage.bubbles]){
      assert.ok(pattern.bright>10&&pattern.dark>10&&pattern.mid>10&&pattern.seedDiff>1000&&pattern.zero,JSON.stringify(damage));
    }
    assert.ok(damage.distinct>1000,JSON.stringify(damage));
    assert.equal(await page.getByRole('option',{name:'Peeling Paint',exact:true}).count(),1);
    assert.equal(await page.locator('label[for="ms_w"]').textContent(),'Bubble radius');
    console.log('PASS Peeling Paint and Paint Bubbles generate distinct, adjustable masks');

    const peelSettings=await page.evaluate(()=>{
      const G=__gs,L=G.allLayers().find(layer=>layer.name==='peelingPaint');
      const row=L.mask.stack.at(-1);
      row.p.amount=G.msGenDefaults('peelingPaint').amount;
      G.msSelect(L,'m',row.id);
      window.readPeel=()=>{
        L.mask._key=null;G.msUpdate(L);
        return [...G.captureRegionNow(L.mask.target,0,0,G.doc.w,G.doc.h).data.filter((_,i)=>i%4===0)];
      };
      return {seed:row.p.seed};
    });
    const samplePeel=()=>page.evaluate(()=>window.readPeel());
    const comparePeel=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
    const cracked=await samplePeel();
    await page.locator('#ms_peelPreset').selectOption('heavy');
    const heavy=await samplePeel();
    await page.locator('#ms_peelOutput').selectOption('height');
    const relief=await samplePeel();
    await page.locator('#ms_peelPreset').selectOption('directional');
    const directional=await samplePeel();
    assert.ok(comparePeel(cracked,heavy)>1000&&comparePeel(heavy,relief)>1000&&comparePeel(relief,directional)>1000);
    assert.equal(await page.locator('#ms_peelOutput').inputValue(),'height');
    assert.equal(await page.evaluate(()=>__gs.doc.active.mask.stack.at(-1).p.seed),peelSettings.seed);
    console.log('PASS Peeling Paint presets and relief output change the mask and retain the seed');

    assert.equal(await page.locator('#ms_peelScan').inputValue(),'peeling-wood-scan');
    await page.waitForFunction(()=>__gs.tx.cache.has('photo:peeling-wood-scan'));
    const woodRelief=await samplePeel();
    await page.locator('#ms_peelScan').selectOption('peeling-wall-scan');
    await page.waitForFunction(()=>__gs.tx.cache.has('photo:peeling-wall-scan'));
    const wallRelief=await samplePeel();
    const editPeel=async values=>{
      await page.evaluate(values=>Object.assign(__gs.doc.active.mask.stack.at(-1).p,values),values);
      return samplePeel();
    };
    const tiled=await editPeel({peelScanTile:3.5});
    const zeroScan=await editPeel({peelScanAmount:0});
    await page.locator('#ms_peelScan').selectOption('');
    const noScan=await editPeel({peelScanAmount:.65});
    assert.equal(await page.locator('#ms_peelScanAmount').count(),0);
    assert.deepEqual(noScan,zeroScan);
    assert.ok(comparePeel(woodRelief,wallRelief)>1000&&comparePeel(wallRelief,tiled)>1000&&comparePeel(tiled,noScan)>1000);
    console.log('PASS Both offline paint scans add distinct relief, support tiling, and preserve the procedural result when disabled');

    const emboss=await page.evaluate(()=>{
      const G=__gs,F=G.FX.paintEmboss,size=64;
      const source=G.makeTarget(size,size,8,false),output=G.makeTarget(size,size,8,false);
      const make=opaque=>{
        const bytes=new Uint8Array(size*size*4);
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
          const i=(y*size+x)*4,inside=x>=18&&x<46&&y>=18&&y<46;
          if(inside||opaque)bytes.set(inside?[140,60,35,255]:[18,18,18,255],i);
        }
        G.writeRegion(source,0,0,size,size,bytes);return bytes;
      };
      const render=settings=>{
        F.render(source,output,{...G.fxDefaults(F),...settings});
        return G.captureRegionNow(output,0,0,size,size).data;
      };
      const compare=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
      const paint=make(false),shaded=render({}),reversed=render({angle:-45}),zero=render({depth:0});
      const flat=make(true),coverage=render({}),brightness=render({source:'light'});
      return {shading:compare(paint,shaded),angle:compare(shaded,reversed),zero:compare(paint,zero),
        coverage:compare(flat,coverage),brightness:compare(flat,brightness),alpha:shaded.every((v,i)=>i%4!==3||v===paint[i]),
        flatCentre:shaded.slice((32*size+32)*4,(32*size+32)*4+4).every((v,i)=>v===[140,60,35,255][i])};
    });
    assert.ok(emboss.shading>500&&emboss.angle>500&&emboss.brightness>500,JSON.stringify(emboss));
    assert.ok(emboss.alpha&&emboss.flatCentre&&emboss.zero===0&&emboss.coverage===0,JSON.stringify(emboss));
    await page.evaluate(()=>{__gs.cmdAddLayer();__gs.act('paintEmboss');});
    await page.getByRole('radiogroup',{name:'Relief source'}).getByRole('button',{name:'Brightness'}).click();
    await page.locator('#dlgCancel').click();
    console.log('PASS Paint Emboss shades raised edges and preserves colour and transparency away from the bevel');

    await page.evaluate(()=>__gs.dlgP3Bake());
    assert.equal(await page.locator('#p3bkLightLayer').isChecked(),false);
    await page.locator('#dlgCancel').click();
    const baked=await page.evaluate(async()=>{
      const G=__gs;
      G.bakeCfg.p3Layers=true;
      const rig=G.lightRig();
      rig.lights=[G.lightNew('sun',{el:60,int:1,shadow:false})];
      await G.p3Bake(['light'],64,G.p3.sets.filter(s=>!s.missing).map(s=>s.name));
      return {map:!!G.doc.meshMaps?.light,layers:G.allLayers().filter(l=>l.meshMap==='light').length};
    });
    assert.deepEqual(baked,{map:true,layers:0});
    await page.evaluate(()=>{__gs.setMode('bake',true);__gs.showPanel('bake');__gs.buildBakePanel();});
    assert.equal(await page.locator('#bkLightLayer').isChecked(),false);
    assert.equal(await page.locator('#bks_light').isChecked(),true);
    assert.equal(await page.locator('#bkSend').isDisabled(),true);
    assert.equal(await page.locator('#bkSendP3').isDisabled(),false);
    assert.equal(await page.locator('#bkExport').isDisabled(),false);
    await page.locator('#bkLightLayer').check();
    await page.locator('#bkSend').click();
    const painting=await page.evaluate(()=>__gs.inPaint(()=>__gs.allLayers().some(l=>l.name==='Baked lighting'&&__gs.MODES[l.mode]==='Multiply')));
    assert.equal(painting,true);
    await page.locator('#bkSendP3').click();
    const p3=await page.evaluate(()=>__gs.allLayers().filter(l=>l.meshMap==='light').map(l=>__gs.MODES[l.mode]));
    assert.deepEqual(p3,['Multiply']);
    assert.deepEqual(errors,[]);
    console.log('PASS baked Lighting stays a mesh map and becomes a Multiply layer in Paint or 3D Paint when selected');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
