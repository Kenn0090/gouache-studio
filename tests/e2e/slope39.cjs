/* Slope Blur keeps its guide and can use a separate image to limit the effect. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');

const root=path.resolve(__dirname,'../../dist');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const errors=[];
  let browser;
  try{
    browser=await chromium.launch({
      channel:process.env.GS_BROWSER_CHANNEL||undefined,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
    });
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('gs.welcome','no');
      localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'2d'}));
    });
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.goto(origin+'/index.html?debug');
    await page.waitForFunction(()=>window.__gs?.fxdGuideRow);
    const results=await page.evaluate(async()=>{
      const G=__gs,F=G.FX.slopeBlur;
      G.closeWelcome();
      G.newDoc(128,128,8,null,'Slope test',false);
      const make=(w,h,value)=>{
        const t=G.makeTarget(w,h,8,false),pixels=new Uint8Array(w*h*4);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const i=(y*w+x)*4;
          pixels[i]=pixels[i+1]=pixels[i+2]=value(x,y);
          pixels[i+3]=255;
        }
        G.writeRegion(t,0,0,w,h,pixels);
        return t;
      };
      const input=make(96,16,x=>x<32?0:x<64?128:255);
      const rec=await G.txAddTarget(input,'Influence fixture');
      const ref=window.slopeInfluenceFixture={kind:'mine',id:rec.id,name:rec.name};
      const generated=G.fxdAllTex().find(item=>item.kind==='gen');
      await G.txTarget(generated);
      const guide={kind:generated.kind,id:generated.id,name:generated.name};
      const sample=(src,settings)=>{
        const dst=G.makeTarget(src.w,src.h,8,false);
        try{
          F.render(src,dst,{...G.fxDefaults(F),amt:22,size:24,...settings});
          return G.captureRegionNow(dst,0,0,src.w,src.h).data;
        }finally{G.disposeTarget(dst);}
      };
      const diff=(a,b)=>a.reduce((sum,value,i)=>sum+Math.abs(value-b[i]),0);
      const paint=make(128,128,(x,y)=>((x>>3)+(y>>3))%2?240:16);
      const self=sample(paint,{guide:'self'}),picture=sample(paint,{guide:'image',gimg:guide});
      const flipped=sample(paint,{guide:'image',gimg:guide,ginv:true});
      const stats=[];
      for(const mode of ['paint','p3d']){
        G.setMode(mode,true);
        if(mode==='p3d')G.useModel(G.primMesh('plane',0));
        const {w,h}=G.doc;
        const src=make(w,h,(x,y)=>((x>>3)+(y>>3))%2?240:16);
        const original=G.captureRegionNow(src,0,0,w,h).data;
        const full=sample(src,{guide:'noise'});
        const weighted=sample(src,{guide:'noise',influence:ref});
        const inverted=sample(src,{guide:'noise',influence:ref,invertInfluence:true});
        const noSeams=mode==='p3d'?sample(src,{guide:'noise',meshSeams:false}):null;
        const checks={mode,applied:[0,0,0],error:0,invertedError:0,seams:noSeams?diff(full,noSeams):0};
        for(let y=12;y<h-12;y++)for(let x=12;x<w-12;x++){
          if(Math.abs(x-w/3)<3||Math.abs(x-2*w/3)<3)continue;
          const i=(y*w+x)*4,zone=Math.floor(x*3/w),weight=[0,128/255,1][zone];
          checks.applied[zone]+=Math.abs(original[i]-full[i]);
          checks.error=Math.max(checks.error,Math.abs(weighted[i]-(original[i]*(1-weight)+full[i]*weight)));
          checks.invertedError=Math.max(checks.invertedError,Math.abs(inverted[i]-(original[i]*weight+full[i]*(1-weight))));
        }
        stats.push(checks);
        G.disposeTarget(src);
      }
      G.disposeTarget(paint);
      G.setMode('paint',true);
      G.newDoc(128,128,8,null,'Slope controls',false);
      G.fxMenu('slopeBlur');
      return {guide:diff(self,picture),flip:diff(picture,flipped),stats};
    });
    assert.ok(results.guide>1000&&results.flip>1000,JSON.stringify(results));
    for(const r of results.stats){
      assert.ok(r.applied.every(n=>n>1000),JSON.stringify(r));
      assert.ok(r.error<=1&&r.invertedError<=1,JSON.stringify(r));
    }
    assert.ok(results.stats[1].seams>1000,JSON.stringify(results.stats[1]));
    console.log('PASS independent picture guide and black, gray, white and inverted influence in 2D and seam-aware 3D');

    const dialog=page.locator('#dlgBody');
    await dialog.getByRole('button',{name:'A picture',exact:true}).click();
    await dialog.locator('#fxdDrop').evaluate(async drop=>{
      const canvas=document.createElement('canvas');
      canvas.width=canvas.height=16;
      const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,16,16);
      gradient.addColorStop(0,'black');
      gradient.addColorStop(1,'white');
      ctx.fillStyle=gradient;
      ctx.fillRect(0,0,16,16);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve));
      const dataTransfer=new DataTransfer();
      dataTransfer.items.add(new File([blob],'Slope guide fixture.png',{type:'image/png'}));
      drop.dispatchEvent(new DragEvent('drop',{dataTransfer,bubbles:true,cancelable:true}));
    });
    await dialog.locator('#fxdGuide').getByText('Slope guide fixture',{exact:true}).waitFor();
    await dialog.getByText('Influence image',{exact:true}).click();
    await dialog.locator('#fxdInfluenceLib').click();
    await dialog.locator('#fxdInfluence .fxdpick').getByRole('button',{name:'Influence fixture',exact:true}).click();
    await dialog.locator('#fxdInfluence').getByText('Influence fixture',{exact:true}).waitFor();
    const preset=dialog.getByRole('combobox',{name:'Slope blur preset'});
    await preset.selectOption({label:'Chipped edges'});
    assert.equal(await dialog.getByRole('button',{name:'Min',exact:true}).getAttribute('aria-pressed'),'true');
    assert.equal(await dialog.getByRole('button',{name:'Noise',exact:true}).getAttribute('aria-pressed'),'true');
    await dialog.locator('#fxdInfluence').getByText('Influence fixture',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Blur',exact:true}).click();
    assert.equal(await preset.inputValue(),'');
    await dialog.locator('#fxdInfluence').getByRole('button',{name:'Clear picture',exact:true}).click();
    await dialog.locator('#fxdInfluence').getByText('No picture yet',{exact:true}).waitFor();
    await page.locator('#dlgCancel').click();
    console.log('PASS presets update the controls and keep an influence picture picked inside the dialog');

    const before=await page.evaluate(()=>{
      const G=__gs,L=G.doc.active;
      const r=G.msAdd(L,'filter',{own:'slope',p:{r:6,scale:6,seed:1}});
      return !!r.p.slope;
    });
    assert.equal(before,false);
    const properties=page.locator('#matEdBody');
    await properties.getByRole('combobox',{name:'Slope blur preset'}).selectOption({label:'Edge spread'});
    await properties.getByText('Influence image',{exact:true}).click();
    await properties.locator('#fxdInfluenceDrop').evaluate((drop)=>drop._texDrop(window.slopeInfluenceFixture));
    const settings=await page.evaluate(async()=>{
      const G=__gs,get=()=>G.doc.active.mask.stack.at(-1).p.slope;
      G.msCommit();
      const set=get();
      await G.undo();
      const undone=!get();
      await G.redo();
      const redone=get();
      const saved=await G.encodeGouache();
      await G.openGouache(await saved.arrayBuffer(),'Slope controls.gouache');
      const restored=G.allLayers().find(n=>n.mask?.stack?.some(r=>r.own==='slope')).mask.stack.at(-1).p.slope;
      return {set,undone,redone,restored};
    });
    assert.equal(settings.set.mode,'max');
    assert.equal(settings.set.amt,18);
    assert.equal(settings.set.influence.name,'Influence fixture');
    assert.equal(settings.undone,true);
    assert.deepEqual(settings.redone,settings.set);
    assert.deepEqual(settings.restored,settings.set);
    assert.deepEqual(errors,[]);
    console.log('PASS existing mask rows can use presets and pictures, undo them, and reopen with the settings saved');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
