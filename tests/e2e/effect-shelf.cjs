const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {chromium}=require('playwright');

async function drag(page,from,to,y=.5){
  await from.scrollIntoViewIfNeeded();
  const a=await from.boundingBox(),b=await to.boundingBox();
  assert(a&&b,'Drag endpoints are visible');
  await page.mouse.move(a.x+a.width*.45,a.y+a.height*.55);
  await page.mouse.down();
  await page.mouse.move(b.x+b.width*.65,b.y+b.height*y,{steps:12});
  await page.mouse.up();
}

async function main(){
  const browser=await chromium.launch({
    channel:process.env.GOUACHE_TEST_BROWSER||(process.platform==='win32'?'msedge':undefined),
    args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  try{
    const page=await browser.newPage({viewport:{width:1280,height:740}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      localStorage.setItem('gs.welcome','no');
      localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));
    });
    await page.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../dist/index.html')).href+'?debug');
    await page.waitForFunction(()=>window.__gs);
    await page.evaluate(()=>{
      const g=__gs;g.closeWelcome();g.setMode('p3d');g.setTool('brush');
      g.doc.active.name='Target paint';g.cmdAddLayer();g.doc.active.name='Other paint';g.changedAll();
      g.dkMove('tool',{edge:'left'});
    });
    const shelf=page.locator('#dkShelf');
    const target=()=>page.locator('#layerList .lrow').filter({has:page.getByText('Target paint',{exact:true})});
    const tab=name=>shelf.getByRole('tab',{name,exact:true});
    await page.waitForFunction(()=>{
      const search=document.querySelector('#toolSec #brSearch'),dock=document.querySelector('#dockL'),shelf=document.querySelector('#dkShelf');
      if(!search||!dock||!shelf)return false;
      const r=search.getBoundingClientRect();
      return r.height>0&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===search
        &&dock.getBoundingClientRect().bottom>=shelf.getBoundingClientRect().bottom-1;
    });
    await page.locator('#toolSec #brSearch').fill('spacing');
    await page.locator('#toolSec #bSpace').waitFor();
    await page.locator('#toolSec #brSearch').fill('');

    await tab('Filters').click();
    const search=page.getByRole('searchbox',{name:'Search filters',exact:true});
    await page.waitForFunction(()=>document.querySelectorAll('#shFiltersBody .mattile').length>0);
    assert(await page.locator('#shFiltersBody .mattile').evaluateAll(tiles=>tiles.every(tile=>tile.querySelector('img[src^="data:image/webp;"]'))));
    await search.fill('that filter does not exist');
    await shelf.getByText('No filters match.').waitFor();
    await search.fill('gaussian');
    const blur=shelf.getByRole('button',{name:'Gaussian blur',exact:true});
    await blur.locator('img').evaluate(img=>img.decode());
    const blurImage=await blur.locator('img').getAttribute('src');
    const layerState=()=>page.evaluate(()=>({active:__gs.doc.active?.id,
      layers:__gs.allLayers().map(layer=>[layer.id,layer.cfx?.length,layer.fx?.stack.length]),
      undo:__gs.hist.undo.length}));
    const beforeClick=await layerState();
    await blur.click();
    await blur.dblclick();
    await blur.press('Enter');
    assert.deepEqual(await layerState(),beforeClick);
    const recentlyUsed=key=>page.evaluate(k=>JSON.parse(localStorage.getItem('gs.shRecent')||'[]').includes(k),key);
    assert.equal(await recentlyUsed('filter:blur'),false);
    await drag(page,blur,target());
    assert(await page.evaluate(()=>__gs.layerByName('Target paint').cfx?.[0].fx==='blur'));
    assert(await page.evaluate(()=>!__gs.layerByName('Other paint').cfx?.length));
    assert.equal(await recentlyUsed('filter:blur'),true);
    await drag(page,blur,target(),.14);
    assert(await page.evaluate(()=>{
      const layers=__gs.doc.root.children,at=layers.indexOf(__gs.layerByName('Target paint'));
      return layers[at+1]?.fx?.stack[0].id==='blur'&&!layers[at+1].clip;
    }));
    await search.fill('arcane');
    const arcane=shelf.getByRole('button',{name:'Arcane-inspired paint',exact:true});
    await arcane.locator('img').evaluate(img=>img.decode());
    assert.notEqual(await arcane.locator('img').getAttribute('src'),blurImage);
    await drag(page,arcane,target(),.14);
    assert(await page.evaluate(()=>__gs.layerByName('Arcane-inspired paint')?.fx.stack[0].v.preset==='Arcane-inspired'));
    await page.evaluate(()=>__gs.undo());

    await tab('Layer Styles').click();
    const bevel=shelf.getByRole('button',{name:'Bevel & emboss',exact:true});
    await bevel.click();
    await bevel.dblclick();
    await bevel.press('Space');
    assert.equal(await page.locator('#modal').isVisible(),false);
    assert(await page.evaluate(()=>!__gs.layerByName('Target paint').styles?.bevel?.on));
    assert.equal(await recentlyUsed('style:bevel'),false);
    await bevel.locator('.shstar').click();
    assert.equal(await bevel.locator('.shstar').getAttribute('aria-pressed'),'true');
    await drag(page,bevel,target());
    await page.locator('#dlgTitle').getByText('Layer style: Target paint').waitFor();
    assert(await page.locator('#ls_bevel').isChecked());
    await page.locator('#dlgOk').click();
    assert(await page.evaluate(()=>__gs.layerByName('Target paint').styles.bevel.on));
    assert.equal(await recentlyUsed('style:bevel'),true);

    await target().click({button:'right'});
    const context=page.locator('#menuPop');
    assert.equal(await context.getByRole('menuitem',{name:'Filters and effects',exact:true}).count(),0);
    await context.getByRole('menuitem',{name:'Effects…',exact:true}).click();
    await page.getByRole('button',{name:'Its mask',exact:true}).click();
    const find=page.getByRole('searchbox',{name:'Search filters and effects'});
    await find.fill('high pass');
    await find.press('Enter');
    assert(await page.evaluate(()=>__gs.layerByName('Target paint').mask?.stack.some(r=>r.fx==='highPass')));
    await page.evaluate(()=>__gs.undo());
    assert(await page.evaluate(()=>!__gs.layerByName('Target paint').mask));

    const worldBrush=async()=>{
      await page.locator('#menus').getByRole('button',{name:'Layer',exact:true}).click();
      await context.getByRole('menuitem',{name:'World Space Normal Brush',exact:true}).click();
    };
    await page.evaluate(()=>__gs.setTool('smudge'));
    await worldBrush();
    await page.locator('#np_worldStrength').waitFor();
    assert(await page.evaluate(()=>__gs.doc.active.nrm&&__gs.doc.map==='normal'&&__gs.np.mode==='world'&&__gs.ui.tool==='brush'));
    const layerCount=await page.evaluate(()=>__gs.doc.root.children.length);
    await worldBrush();
    assert.equal(await page.evaluate(()=>__gs.doc.root.children.length),layerCount);
    await page.evaluate(()=>__gs.setMode('paint'));
    await tab('Filters').waitFor();
    await tab('Layer Styles').waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS shelf tabs, drag targets, effect search, brush layout, and World Space Normal Brush');
  }finally{await browser.close();}
}

main().catch(error=>{console.error(error);process.exitCode=1;});
