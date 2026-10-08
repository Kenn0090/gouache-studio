/* Symmetry alignment, reflected views, pointer dragging and radial guides. */
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
 await p.click('#obMore');await type('ob_spacing','250');await p.locator('#bSpace + output').click();ok(await p.locator('#bSpace_value').inputValue()==='250','top bar updates the panel numeric editor without a stale value');await p.locator('#bSpace_value').press('Escape');
 await p.evaluate(()=>{const g=__gs,sl=g.makeSlider({id:'mappedNumeric',label:'Mapped',min:0,max:10,step:1,value:4,map:{to:v=>Math.sqrt(v),from:v=>v*v},numericMax:400,onInput:v=>window.mappedValue=v});document.body.append(sl.el);});await type('mappedNumeric','225');ok(await p.evaluate(()=>mappedValue===225&&document.getElementById('mappedNumeric').value==='10'),'mapped slider keeps a typed value beyond its drag endpoint');
 await p.evaluate(()=>{const g=__gs,sl=g.makeSlider({id:'scaledNumeric',label:'Scaled',min:0,max:1,step:.01,value:.5,numericMax:2,numericScale:255,onInput:v=>window.scaledValue=v});document.body.append(sl.el);});await type('scaledNumeric','510');ok(await p.evaluate(()=>scaledValue===2),'custom display units apply the numeric limits in value units');
 await p.evaluate(async()=>{__gs.setMode('p3d');await __gs.weldUse(__gs.WELD_STYLES[0]);__gs.showPanel('weldtools');});
 await type('weld-width','80');ok(await p.evaluate(()=>__gs.weldOptions.width===80),'weld width accepts a precise value above its slider range');
 ok(errors.length===0,'no application errors');if(errors.length)console.log(errors);await b.close();await new Promise(r=>server.close(r));process.exitCode=fails?1:0;
})().catch(e=>{console.error(e);process.exit(1);});

