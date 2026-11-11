/* Height must work on a fill material even when the document starts without a Height map. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=path.resolve(__dirname,'../../dist');
const server=http.createServer((req,res)=>{
  const file=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404).end();return;}
  res.setHeader('Content-Type',path.extname(file)==='.html'?'text/html':'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL||undefined,
      args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      localStorage.setItem('gs.welcome','no');
      localStorage.setItem('gs.p3d',JSON.stringify({size:64,layout:'2d'}));
    });
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.goto(origin+'/index.html?debug');
    await page.waitForFunction(()=>window.__gs?.txToChannel);
    await page.evaluate(()=>{
      const G=__gs;
      G.closeWelcome();
      window.newBumpMaterial=mode=>{
        G.setMode(mode,true);
        if(mode==='paint')G.newDoc(64,64,8,[1,1,1],'Height test',false);
        else G.useModel(G.primMesh('plane',0));
        G.setDocMaps(['base'],'Use Base Color only');
        G.cmdNewFillLayer({name:'Bump detail only',maps:{}});
        G.showPanel('matEd');
        G.renderMatEd(true);
      };
      window.inspectBump=()=>{
        const L=G.doc.active,enabled=G.doc.maps.includes('height');
        if(!enabled)return {enabled};
        const {w,h}=G.doc,target=G.makeTarget(w,h,8,false);
        const range=t=>{
          G.copyScaled(t,target);
          const data=G.captureRegionNow(target,0,0,w,h).data;
          let lo=255,hi=0;
          for(let i=0;i<data.length;i+=4){lo=Math.min(lo,data[i]);hi=Math.max(hi,data[i]);}
          return hi-lo;
        };
        const height=G.compositeMap('height'),normal=G.normalComp();
        const result={enabled,hasColor:L.fill.maps.base.on,heightRange:range(height),normalRange:range(normal)};
        G.release(height);G.release(normal);G.disposeTarget(target);
        return result;
      };
    });
    for(const mode of ['paint','p3d']){
      const result=await page.evaluate(async mode=>{
        newBumpMaterial(mode);
        await __gs.txToChannel({kind:'gen',id:'cells',name:'Cells'},'height');
        return inspectBump();
      },mode);
      assert.ok(result.enabled&&!result.hasColor&&result.heightRange>30&&result.normalRange>10,JSON.stringify({mode,...result}));
    }
    console.log('PASS assigning a shelf texture creates Height and visible bump normals in Paint and 3D Paint');

    await page.evaluate(()=>newBumpMaterial('paint'));
    assert.equal(await page.locator('#fl_on_height').isChecked(),false);
    await page.locator('#fl_on_height').check();
    assert.equal(await page.evaluate(()=>__gs.doc.maps.includes('height')&&__gs.doc.active.fill.maps.height.on),true);
    assert.ok(await page.locator('#fl_v_height').isVisible());
    console.log('PASS the Height toggle adds and enables the channel on a blank material');

    await page.evaluate(async()=>{
      newBumpMaterial('paint');
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
      const ctx=canvas.getContext('2d'),gradient=ctx.createLinearGradient(0,0,64,0);
      gradient.addColorStop(0,'black');gradient.addColorStop(.4,'black');gradient.addColorStop(.6,'white');gradient.addColorStop(1,'white');
      ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
      const dataTransfer=new DataTransfer();
      dataTransfer.items.add(new File([blob],'Height detail.png',{type:'image/png'}));
      document.querySelector('[data-material-channel="height"]').dispatchEvent(
        new DragEvent('drop',{dataTransfer,bubbles:true,cancelable:true}));
    });
    await page.waitForFunction(()=>__gs.doc.active.fill.maps.height.name==='Height detail.png');
    const dropped=await page.evaluate(()=>inspectBump());
    assert.ok(dropped.enabled&&!dropped.hasColor&&dropped.heightRange>150&&dropped.normalRange>10,JSON.stringify(dropped));
    console.log('PASS dropping a Height image onto a blank material adds the map and updates bump normals');

    const additive=await page.evaluate(()=>{
      const G=__gs;
      newBumpMaterial('paint');
      G.cmdNewFillLayer({name:'Underlying height',maps:{height:{v:.55}}});
      const layer=G.matApply({name:'Additive bumps',fill:{maps:{height:{on:true,src:'value',v:.6}},coverH:false},imgs:{}});
      const h=G.compositeMap('height'),byte=G.makeTarget(h.w,h.h,8,false);
      G.copyScaled(h,byte);
      const value=G.captureRegionNow(byte,32,32,1,1).data[0];
      G.release(h);G.disposeTarget(byte);
      return {cover:layer.fill.coverH,height:value};
    });
    assert.ok(additive.cover===false&&Math.abs(additive.height-191)<=2,JSON.stringify(additive));
    assert.deepEqual(errors,[]);
    console.log('PASS applying a saved bump material keeps its additive Height setting');
  }finally{
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
