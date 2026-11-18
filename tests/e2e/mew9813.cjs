/* 0.23: Mesh maps from a material (curvature, AO, edges, roughness, metallic from its height) and the Converted source. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text())&&!/GPU stall due to ReadPixels/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||150);
 const box=await p.locator('#gl').boundingBox();
 await p.evaluate(()=>{__gs.setMode('p3d');});await W(3500);
 const r=await p.evaluate(()=>{const g=__gs;g.cmdNewFillLayer();const L=g.doc.active;const row=g.msAdd(L,'gen',{p:g.msGenDefaults('edge')});g.msSelect(L,'m',(row||L.mask.stack[L.mask.stack.length-1]).id);
  return {card:!!document.getElementById('msC_mew')||!!document.getElementById('mew_amount'),sl:['mew_amount','mew_contrast','mew_breakup','mew_scale','mew_grow','mew_ao','mew_curv','mew_micro','mew_defaults'].filter(k=>!document.getElementById(k))};});
 ok(r.card&&r.sl.length===0,'the Metal edge wear card has Painter\'s controls '+JSON.stringify(r));
 await p.evaluate(()=>document.getElementById('mew_defaults').click());await W(800);
 const v=await p.evaluate(()=>{const L=__gs.doc.active,row=L.mask.stack[L.mask.stack.length-1];return {a:row.p.amount,b:row.p.breakup,s:row.p.scale};});
 ok(v.a===.75&&v.b===.3&&v.s===4,'Painter defaults set Wear 75%, grunge 30%, scale 4 '+JSON.stringify(v));
 await p.evaluate(()=>{const i=document.getElementById('mew_micro');i.value='1';i.dispatchEvent(new Event('input',{bubbles:true}));});await W(800);
 ok(await p.evaluate(()=>{const L=__gs.doc.active,row=L.mask.stack[L.mask.stack.length-1];return row.p.cb&&row.p.cb.sharp>1.5;}),'Micro Details boosts the sharp curvature band');
 ok(!errs.length,'no errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
