/* Exercises the weathering entry points and inspects the rendered masks and maps. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const root=path.resolve(__dirname,'../../dist');

async function main(){
  const server=http.createServer((req,res)=>{
    const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
    res.setHeader('Content-Type',file.endsWith('.html')?'text/html':'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const url='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1500,height:1000}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error'&&/shader|WebGL/i.test(message.text()))errors.push(message.text());});
    await page.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
    await page.route('**/*',route=>route.request().url().startsWith(url)?route.continue():route.abort());
    await page.goto(url+'/index.html?debug');
    await page.waitForFunction(()=>window.__gs);
    const flat=await page.evaluate(async()=>{
      const g=__gs;
      g.closeWelcome();g.prefs.level='full';g.setMode('paint');
      g.newDoc(128,128,8,null,'Weathering mask',false);
      const layer=g.doc.active;
      const paint=g.msAdd(layer,'paint');
      g.gl.enable(g.gl.SCISSOR_TEST);g.gl.scissor(50,22,20,14);
      g.clearTarget(paint.t,[1,1,1,1]);g.gl.disable(g.gl.SCISSOR_TEST);
      const rust=g.msAdd(layer,'gen',{p:{...g.msGenDefaults('rustRunoff'),source:'below',output:'runoff',dripLength:.62,breakup:0}});
      const sample=(x,y)=>g.captureRegionNow(layer.mask.target,x,y,1,1).data[0];
      const refresh=()=>{layer.mask._key=null;g.msUpdate(layer);};
      refresh();
      const down=[sample(60,42),sample(60,12)];
      rust.p.direction='up';refresh();
      const up=[sample(60,42),sample(60,12)];
      rust.p.dripLength=0;refresh();
      const dry=sample(60,12)+sample(60,42);
      rust.p.g='mineralBuildup';Object.assign(rust.p,g.msGenDefaults('mineralBuildup'),{amount:1,breakup:0,waterline:.5});
      refresh();
      const bands=g.captureRegionNow(layer.mask.target,64,37,1,55).data.filter((_,i)=>i%4===0);
      rust.p.bands=0;refresh();
      const plain=g.captureRegionNow(layer.mask.target,64,37,1,55).data.filter((_,i)=>i%4===0);
      const box=document.createElement('div');g.msRowEditor(box,layer,'m',rust);
      const filename=(await g.encodeGouache()).arrayBuffer();
      await g.openGouache(await filename);
      const saved=g.doc.active.mask.stack.at(-1).p;
      return {down,up,dry,mineral:bands.some((v,i)=>Math.abs(v-plain[i])>30),
        controls:!!box.querySelector('#ms_mineralBands'),removed:!g.MS_GENS.some(([id])=>id==='fabricWear'),
        saved:saved.g==='mineralBuildup'&&saved.source==='waterline'&&saved.bands===0};
    });
    console.log('Flat weathering',flat);
    assert(flat.down[0]>10&&flat.down[1]<3&&flat.up[1]>10&&flat.up[0]<3);
    assert.equal(flat.dry,0);
    assert(flat.mineral&&flat.controls&&flat.removed&&flat.saved);

    const anchor=await page.evaluate(()=>{
      const g=__gs;g.newDoc(96,96,8,null,'Anchored rust',false);
      const origin=g.doc.active;
      g.gl.enable(g.gl.SCISSOR_TEST);g.gl.scissor(44,21,12,12);
      g.clearTarget(origin.target,[1,1,1,1]);g.gl.disable(g.gl.SCISSOR_TEST);
      const anchor=g.cfxAddAnchor(origin);
      g.cmdAddLayer();
      const rustLayer=g.doc.active;
      g.msAdd(rustLayer,'gen',{p:{...g.msGenDefaults('rustRunoff'),source:'anchor',anchor:anchor.p.name,
        amount:1,output:'runoff',dripLength:.65,spread:0,breakup:0}});
      const sample=()=>{g.msUpdate(rustLayer);return g.captureRegionNow(rustLayer.mask.target,48,39,1,1).data[0];};
      const before=sample();
      g.clearTarget(origin.target);origin.lookVer=(origin.lookVer||0)+1;
      return {before,after:sample()};
    });
    assert(anchor.before>15&&anchor.after===0);
    const decals=await page.evaluate(()=>{
      const g=__gs,F=g.FX.ghostDecal;
      g.newDoc(128,128,8,null,'Ghost decal',false);
      const a=g.makeTarget(128,128,8,false),b=g.makeTarget(128,128,8,false);
      g.gl.enable(g.gl.SCISSOR_TEST);g.gl.scissor(30,30,68,68);
      g.clearTarget(a,[.1,.5,.85,1]);g.gl.disable(g.gl.SCISSOR_TEST);
      const v=g.fxDefaults(F),alpha=()=>g.captureRegionNow(b,0,0,128,128).data.filter((_,i)=>i%4===3);
      const output=name=>{F.render(a,b,{...v,output:name},{k:'base'});return alpha();};
      const paper=output('paper'),glue=output('glue'),ghost=output('ghost');
      return {registered:g.MENUS.Filter.flat(Infinity).includes('ghostDecal'),outside:paper[0]+glue[0]+ghost[0],
        paper:paper.some(x=>x===255)&&paper.some((x,i)=>x===0&&ghost[i]>0),glue:glue.some(x=>x>35),ghost:ghost[64*128+64]};
    });
    console.log('Ghost decal',decals);
    assert(decals.registered&&decals.outside===0&&decals.paper&&decals.glue&&decals.ghost>20);

    await page.evaluate(async()=>{
      const g=__gs;
      const mesh=g.parseOBJ([
        'v -1 -1 0','v 1 -1 0','v 1 1 0','v -1 1 0',
        'vt .10 .10','vt .43 .10','vt .43 .43','vt .57 .57','vt .90 .90','vt .57 .90',
        'f 1/1 2/2 3/3','f 1/4 3/5 4/6'
      ].join('\n'),'Split UV test plane');
      await g.p3NewProject(128,{modelKey:'imported',imported:mesh});
      g.v3s().paintAlign='camera';
      g.showPanel('surfacedetails');
    });
    const flow=await page.evaluate(()=>{
      const g=__gs,L=g.doc.active;
      const paint=g.msAdd(L,'paint');
      g.gl.enable(g.gl.SCISSOR_TEST);g.gl.scissor(93,23,5,5);
      g.clearTarget(paint.t,[1,1,1,1]);g.gl.disable(g.gl.SCISSOR_TEST);
      const rust=g.msAdd(L,'gen',{p:{...g.msGenDefaults('rustRunoff'),source:'below',output:'runoff',dripLength:.9,amount:1,breakup:0,spread:0}});
      g.msUpdate(L);
      const data=g.captureRegionNow(L.mask.target,0,72,56,56).data;
      const origin=g.captureRegionNow(L.mask.target,73,0,54,55).data;
      return {crossed:data.some((v,i)=>i%4===0&&v>12),sourceSide:origin.some((v,i)=>i%4===0&&v>12),
        model:g.v3.mesh.name,projection:rust.p.proj||'world',uvScale:g.v3s().uvs};
    });
    console.log('Runoff across split UVs',flow);
    assert(flow.crossed&&flow.projection==='world');

    const shelf=page.locator('#surfaceDetailsBody');
    assert.equal(await shelf.getByRole('button',{name:'Grime Wipe',exact:true}).count(),0);
    assert.equal(await shelf.getByRole('button',{name:'Crack Path',exact:true}).count(),0);
    assert.equal(await page.evaluate(()=>__gs.library.some(set=>set.id==='grime-wipe')),false);

    const pathPoint=async(x,y)=>{
      const hit=page.locator('#v3Hit'),rect=await hit.boundingBox();
      await page.mouse.click(rect.x+rect.width*x,rect.y+rect.height*y);
    };
    await shelf.getByRole('button',{name:'Sealant Bead',exact:true}).click();
    await pathPoint(.43,.52);await pathPoint(.53,.47);await pathPoint(.58,.47);
    await page.keyboard.press('Enter');
    const result=await page.evaluate(()=>{
      const g=__gs,L=g.doc.active,t=g.mapT(L,'height');
      const bytes=g.captureRegionNow(t,0,0,g.doc.w,g.doc.h).data;
      const sample=value=>{
        if(t.depth===8)return value/255;
        if(t.depth===32)return value;
        const exponent=(value>>10)&31,mantissa=value&1023;
        return exponent?(1+mantissa/1024)*2**(exponent-15):mantissa*2**-24;
      };
      let pixels=0,relief=0;
      for(let i=0;i<bytes.length;i+=4){
        const alpha=sample(bytes[i+3]);
        if(alpha<.03)continue;
        pixels++;
        if(sample(bytes[i])/alpha-.5>.08)relief++;
      }
      return {kind:L.path?.weather?.kind,points:L.path?.points.length,pixels,relief};
    });
    console.log('Sealant Bead',result);
    assert.equal(result.kind,'sealant');
    assert(result.points>=2&&result.pixels>10&&result.relief>5);
    const savedPath=await page.evaluate(async()=>{
      const blob=await __gs.encodeP3Project();return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    const reopened=await page.evaluate(async bytes=>{
      const opening=__gs.openP3Project(Uint8Array.from(bytes).buffer,'Weathering');
      await new Promise(resolve=>requestAnimationFrame(resolve));
      const accept=[...document.querySelectorAll('button')].find(b=>b.textContent==='Open anyway');
      if(accept)accept.click();
      await opening;
      return __gs.allLayers().filter(L=>L.path?.weather).map(L=>[L.path.weather.kind,L.path.points.length]);
    },savedPath);
    assert(reopened.some(([kind,n])=>kind==='sealant'&&n>=2));
    assert.deepEqual(errors,[]);
    console.log('PASS all four creative tools, including editable path and mask round trips');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
