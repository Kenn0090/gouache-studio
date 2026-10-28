/* 0.80.1: undo inside the layer editors and the Lights window (buttons and Ctrl+Z), a reset button per slider, Gouache Stylize gone from the menus */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}),p=await b.newPage({viewport:{width:1300,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());


 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 ok(!/'newStylize'\]/.test(html)&&/Stylize layer \(strokes, lighting, edges\)/.test(html),'the Gouache Stylize is gone from the menus; the Stylize layer is the Painter-style one');
 await p.evaluate(()=>{const G=__gs;G.newDoc(64,64);G.setDocMaps(['base','rough','metal','normal'],'maps');G.cmdAddLayer();G.composite();});
 await p.evaluate(()=>__gs.cmdNewHandPaintLayer());await p.waitForTimeout(500);
 const v=k=>p.evaluate(k=>__gs.doc.active.fx.stack[0].v[k],k);
 const slide=async(id,val)=>{await p.evaluate(({id,val})=>{const i=document.getElementById(id);i.value=String(val);i.dispatchEvent(new Event('input',{bubbles:true}));},{id,val});await p.waitForTimeout(550);};
 const v0=await v('shAmt');
 await slide('hp_shAmt',.2);await slide('hp_shAmt',.9);ok(await v('shAmt')===.9,'a slider changes the setting');
 ok(await p.locator('#fxUndo').count()===1&&await p.locator('#fxRedo').count()===1,'the editor has Undo and Redo');
 await p.click('#fxUndo');await p.waitForTimeout(200);ok(await v('shAmt')===.2,'Undo steps back one change ('+await v('shAmt')+')');
 await p.click('#fxUndo');await p.waitForTimeout(200);ok(await v('shAmt')===v0,'and again, back to where it started');
 await p.click('#fxRedo');await p.waitForTimeout(200);ok(await v('shAmt')===.2,'Redo goes forward again');
 await p.locator('#hp_shAmt').focus();await p.keyboard.press('Control+z');await p.waitForTimeout(300);ok(await v('shAmt')===v0,'Ctrl+Z in the editor undoes one step there ('+await v('shAmt')+')');
 const docUndo=await p.evaluate(()=>__gs.hist.undo.length);
 /* reset one slider */
 await slide('hp_edgeAmt',.95);ok(await p.locator('#hp_edgeAmt_def').count()===1,'each slider has its own default button');
 await p.evaluate(()=>document.getElementById('hp_edgeAmt_def').click());await p.waitForTimeout(200);ok(await v('edgeAmt')===await p.evaluate(()=>__gs.HP_DEFAULTS.edgeAmt),'it puts just that slider back to its default');
 ok(await p.evaluate(()=>document.getElementById('hp_edgeAmt_def').classList.contains('at')),'and hides itself while the slider is at the default');
 await p.click('#fxUndo');await p.waitForTimeout(200);ok(await v('edgeAmt')===.95,'resetting is an undo step too');
 ok(await p.evaluate(n=>__gs.hist.undo.length===n,docUndo),'while the editor is open, its undo does not touch the document\'s history');
 await p.getByRole('button',{name:'Done',exact:true}).first().click();await p.waitForTimeout(300);
 /* after Done, the document's undo still takes the whole edit back */
 await p.evaluate(()=>{const L=__gs.doc.active;__gs.fxEditor(L);});await p.waitForTimeout(400);await slide('hp_ltAmt',.05);
 await p.getByRole('button',{name:'Done',exact:true}).first().click();await p.waitForTimeout(300);
 ok(await v('ltAmt')===.05,'an edit is kept with Done');await p.evaluate(()=>__gs.undo());await p.waitForTimeout(400);ok(await v('ltAmt')!==.05,'and Edit › Undo takes it back afterwards');
 /* the Stylize (Painter style) editor has the default buttons too */
 await p.evaluate(()=>__gs.cmdNewStylizePLayer());await p.waitForTimeout(500);ok(await p.locator('#pa_strokes_def').count()===1&&await p.locator('#fxUndo').count()===1,'the Stylize editor has default buttons and Undo');
 await p.getByRole('button',{name:'Done',exact:true}).first().click();await p.waitForTimeout(300);
 /* the Lights window */
 await p.evaluate(()=>{__gs.lightRig().lights=[];__gs.lightDialog();});await p.waitForTimeout(400);
 const n0=await p.evaluate(()=>__gs.lightRig().lights.length);await p.click('#lAdd_point');await p.waitForTimeout(500);
 ok(await p.evaluate(()=>__gs.lightRig().lights.length)===n0+1,'adding a light');
 await p.click('#lUndo');await p.waitForTimeout(300);ok(await p.evaluate(()=>__gs.lightRig().lights.length)===n0,'Undo in the Lights window takes it away again');
 await p.keyboard.press('Control+Shift+z');await p.waitForTimeout(300);ok(await p.evaluate(()=>__gs.lightRig().lights.length)===n0+1,'Ctrl+Shift+Z brings it back');
 ok(await p.locator('#l_expo_def').count()===1,'light sliders have default buttons');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors.slice(0,3));
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
