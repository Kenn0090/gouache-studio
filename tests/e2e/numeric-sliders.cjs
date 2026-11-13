/* Precise slider entry and Mask Builder input controls. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',f.endsWith('.html')?'text/html':'application/octet-stream');fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1500,height:1000}}),errors=[];
 p.setDefaultTimeout(60000);p.on('pageerror',e=>errors.push(e.stack));
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));localStorage.setItem('gs.welcome','no');});
 await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);
 await p.evaluate(()=>{__gs.closeWelcome();__gs.prefs.level='full';document.body.classList.remove('lv-beginner');});


 await p.evaluate(()=>{const g=__gs;g.setMode('paint');g.setWorkspace('painting');g.newDoc(128,128,8,null,'Numeric values',false);g.brush.tip=null;g.setTool('brush');g.buildOptBar();g.showPanel('tool');});
 const type=async(id,value,key='Enter')=>{await p.locator('#'+id+' + output').click();await p.locator('#'+id+'_value').fill(value);await p.locator('#'+id+'_value').press(key);};
 await type('bSpace','200');const spacing=await p.evaluate(()=>({value:__gs.brush.spacing,text:document.querySelector('#bSpace + output').textContent,thumb:document.getElementById('bSpace').value,max:document.getElementById('bSpace').max}));ok(spacing.value===2&&spacing.text==='200%'&&spacing.thumb===spacing.max&&spacing.max==='1.5','typed 200% spacing retains its value while the thumb stays at its normal endpoint');
 const strokes=await p.evaluate(()=>{const g=__gs,paint=spacing=>{g.cmdAddLayer();const L=g.doc.active,o=g.paintOpts(g.editTarget());Object.assign(o,{size:6,pSize:false,pOpacity:false,opacity:1,flow:1,hardness:1,tip:null,smoothing:0,spacing,sym:null});g.beginStroke(L,10,32,1,o);g.addPoint(118,32,1);g.endStroke(false);return g.readRGBA8(L.target).reduce((n,v,i)=>n+(i%4===3&&v>128?1:0),0);};return {entered:paint(g.brush.spacing),endpoint:paint(1.5)};});ok(strokes.entered>0&&strokes.entered<strokes.endpoint,'painting actually uses the typed spacing beyond the slider endpoint');
 await type('bSpace','350','Escape');ok(await p.evaluate(()=>__gs.brush.spacing===2),'Escape retains the previous extended value');
 await p.locator('#bSpace + output').click();const reopened=await p.locator('#bSpace_value').inputValue();await p.locator('#bSpace_value').fill('');await p.locator('#bSpace_value').press('Enter');ok(reopened==='200'&&await p.evaluate(()=>__gs.brush.spacing===2),'reopening shows the actual extended value and empty entry does not change it');
 await type('bHard','200');ok(await p.evaluate(()=>__gs.brush.hardness===1),'hardness keeps its valid 100% limit');
 await type('bSpace','1200');ok(await p.evaluate(()=>__gs.brush.spacing===10),'extended settings retain their explicit upper limits');
 await p.evaluate(()=>{document.getElementById('bSpace').value='0.5';document.getElementById('bSpace').dispatchEvent(new Event('input',{bubbles:true}));});ok(await p.evaluate(()=>__gs.brush.spacing===.5),'dragging the slider returns to its normal range');
 await p.click('#obp_stroke');await type('ob_spacing','250');await p.locator('#bSpace + output').click();ok(await p.locator('#bSpace_value').inputValue()==='250','top bar updates the panel numeric editor without a stale value');await p.locator('#bSpace_value').press('Escape');
 await p.evaluate(()=>{const g=__gs,sl=g.makeSlider({id:'mappedNumeric',label:'Mapped',min:0,max:10,step:1,value:4,map:{to:v=>Math.sqrt(v),from:v=>v*v},numericMax:400,onInput:v=>window.mappedValue=v});document.body.append(sl.el);});await type('mappedNumeric','225');ok(await p.evaluate(()=>mappedValue===225&&document.getElementById('mappedNumeric').value==='10'),'mapped slider keeps a typed value beyond its drag endpoint');
 await p.evaluate(()=>{const g=__gs,sl=g.makeSlider({id:'scaledNumeric',label:'Scaled',min:0,max:1,step:.01,value:.5,numericMax:2,numericScale:255,onInput:v=>window.scaledValue=v});document.body.append(sl.el);});await type('scaledNumeric','510');ok(await p.evaluate(()=>scaledValue===2),'custom display units apply the numeric limits in value units');
 await p.evaluate(()=>__gs.fxMenu('slopeBlur'));
 await type('fx_amt','350.25');
 ok(await p.evaluate(()=>document.querySelector('#fx_amt + output').textContent==='350.25px'&&document.getElementById('fx_amt').value==='200'),'Slope Blur keeps a typed intensity beyond its drag range');
 await type('fx_steps','100');
 ok(await p.evaluate(()=>document.querySelector('#fx_steps + output').textContent==='64'),'Slope Blur samples respect the shader limit');
 await p.locator('#dlgCancel').click();

 await p.evaluate(()=>{
   const g=__gs;
   g.setMode('p3d',true);
   const L=window.testBuilderLayer=g.cmdNewFillLayer({name:'Mask Builder test',maps:{base:{on:true,c:[.6,.5,.4]}}});
   const map=value=>{
     const t=g.makeTarget(g.doc.w,g.doc.h,8,false);
     g.clearTarget(t,[value,value,value,1]);
     return t;
   };
   g.doc.meshMaps={curv:map(.7),ao:map(.4)};
   window.testBuilder=g.msAdd(L,'gen',{p:{...g.msGenDefaults('builder'),aoWeight:1,breakup:0}});
   window.readBuilder=()=>{
     g.msUpdate(L);
     return g.captureRegionNow(L.mask.target,0,0,1,1).data[0];
   };
 });
 const read=()=>p.evaluate(()=>readBuilder());
 const near=(value,expected)=>Math.abs(value-expected)<=3;
 ok(near(await read(),255),'existing Mask Builder rows still add their weighted inputs');
 await p.locator('#ms_builderCombine').selectOption('lightest');
 ok(near(await read(),153),'Lightest keeps the strongest input');
 await p.locator('#ms_builderCombine').selectOption('intersect');
 ok(near(await read(),61),'Intersect keeps the overlap between inputs');
 await p.locator('#ms_builderInput').selectOption('aoWeight');
 await p.locator('#ms_builderInvert').check();
 ok(near(await read(),41),'inverting AO changes only its contribution');
 await p.locator('#ms_builderInput').selectOption('edgeWeight');
 await type('ms_builderBalance','10');
 await type('ms_builderContrast','50');
 ok(near(await read(),31),'balance and contrast tune the selected input before combining');
 await type('ms_edgeWeight','250');
 ok(await p.evaluate(()=>testBuilder.p.edgeWeight===2.5&&document.getElementById('ms_edgeWeight').value==='1')&&near(await read(),77),'Mask Builder uses the typed strength above 100% while keeping its drag range');
 await p.locator('#ms_gradAxis').selectOption('down');
 ok(await p.evaluate(()=>testBuilder.p.gradAxis==='down'&&testBuilder.p.directionAxis==='up'),'position and facing use independent axes');
 await p.locator('#ms_builderPreset').selectOption({label:'Cavity dirt'});
 ok(await p.evaluate(()=>testBuilder.p.edgeWeight===0&&testBuilder.p.cavityWeight===.45&&testBuilder.p.aoWeight===.8&&testBuilder.p.inputTone.aoWeight.invert),'a preset changes the starting mix and keeps per-input tuning');
 await p.evaluate(()=>__gs.undo());
 ok(await p.evaluate(()=>testBuilder.p.edgeWeight===2.5&&testBuilder.p.combine==='intersect'),'undo restores the mix before choosing a preset');
 const restored=await p.evaluate(async()=>{
   const g=__gs,tree={t:'G',kids:[g.smSer(testBuilderLayer)]},copy=await g.smApply({name:'Builder copy',tree});
   return copy.children[0].mask.stack.at(-1).p;
 });
 ok(restored.combine==='intersect'&&restored.inputTone.edgeWeight.contrast===.5&&restored.inputTone.aoWeight.invert,'a saved smart material keeps the Mask Builder input settings');
 await p.evaluate(async()=>{__gs.setMode('p3d');await __gs.weldUse(__gs.WELD_STYLES.find(s=>s.id==='standard'));__gs.showPanel('weldtools');});
 await type('weld-width','80');ok(await p.evaluate(()=>__gs.weldOptions.width===80),'weld width accepts a precise value above its slider range');
 ok(errors.length===0,'no application errors');if(errors.length)console.log(errors);await b.close();await new Promise(r=>server.close(r));process.exitCode=fails?1:0;
})().catch(e=>{console.error(e);process.exit(1);});
