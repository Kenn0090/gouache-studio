/* 0.94: painting through the new viewer window: its pointer events paint with the normal brush, the changed maps go back */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='warning'||m.type()==='error')console.log('CON',m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 if(await p.evaluate(()=>!!(window.__gs&&__gs.NV_BANKED))){console.log('SKIPPED: the new viewer is banked for a future update (NV_BANKED)');await b.close();process.exit(0);}
 const W=ms=>p.waitForTimeout(ms||200);
 /* 0.94.3: the window draws the brush mark itself while you paint (Kenn's video: strokes showed up late, in jumps) */
 await p.click('#modeTabs [data-mode=p3d]');await W(2500);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;window.__ups=[];
   P.invoke=async(cmd,body)=>{if(cmd==='viewer_open'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true);window.__ups.push(JSON.parse(new TextDecoder().decode(body.slice(4,4+jl))));return {name:'T',backend:'V',kind:'D',software:false};}
     if(cmd==='viewer_update'){const dv=new DataView(body.buffer,body.byteOffset,body.byteLength),jl=dv.getUint32(0,true);window.__ups.push(JSON.parse(new TextDecoder().decode(body.slice(4,4+jl))));return true;}return true;};});
 await p.evaluate(()=>{__gs.setTool('brush');__gs.setFG([0.8,0.2,0.1]);__gs.brush.opacity=0.6;__gs.brush.hardness=0.4;});
 await p.evaluate(()=>__gs.nvOpen());await W(3000);
 const s1=await p.evaluate(()=>__gs.nvSettings());
 ok(s1.ink&&Math.abs(s1.ink[0]-0.8)<1e-3&&Math.abs(s1.ink[3]-0.6)<1e-3&&Math.abs(s1.ink_hard-0.4)<1e-3,'the window gets the brush colour, opacity and hardness for its own mark '+JSON.stringify(s1.ink));
 ok(await p.evaluate(()=>window.__ups.some(u=>u.settings&&u.settings.ink&&u.settings.ink[3]>0)),'…and they reach the window');
 await p.evaluate(()=>__gs.setTool('erase'));
 ok(await p.evaluate(()=>__gs.nvSettings().ink[3]===0),'the eraser draws no mark (it does not paint a colour)');
 await p.evaluate(()=>{__gs.setTool('brush');__gs.v3s().nvInk=false;});
 ok(await p.evaluate(()=>__gs.nvSettings().ink[3]===0),'the mark can be turned off');
 await p.evaluate(()=>{__gs.v3s().nvInk=true;__gs.nvClose();});
 ok(await p.evaluate(()=>__gs.nvSettings().ink[3]===0),'closed window: no mark');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
