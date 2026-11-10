/* Shared set-up for wikishots2.cjs: opens the web build in Chromium (software GPU) and gives small helpers. */
const {chromium}=require('playwright');const path=require('path');
const OUT=path.resolve(__dirname,'../../docs/wiki/images')+'/';
async function open(opts={}){
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:opts.w||1440,height:opts.h||900}});const p=await ctx.newPage();p.setDefaultTimeout(90000);
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:__dirname+'/node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:__dirname+'/node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
 await p.addInitScript(()=>{try{localStorage.setItem('gs.matOpen','all');}catch(e){}});
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||300);
 const click=(s,o)=>p.locator(s).first().click(Object.assign({force:true},o));
 const el=async(n,sel)=>{await W(500);await p.locator(sel).first().screenshot({path:OUT+n+'.png'});console.log('shot',n);};
 const shot=async n=>{await W(500);await p.screenshot({path:OUT+n+'.png'});console.log('shot',n);};
 const setFG=hx=>p.evaluate(h=>__gs.setFG([1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)),hx);
 return {b,p,W,click,el,shot,setFG,errs,OUT};
}
module.exports={open,OUT};
