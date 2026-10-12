/* regenerates the Photo tab wiki screenshots (needs a sample RAW: RAW_FILE=/path/to/file.cr2) */
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const raw=process.env.RAW_FILE||'/tmp/rawsamples/eosm.cr2',out=path.resolve(__dirname,'../../docs/wiki/images');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')||r.request().url().startsWith('blob:')||r.request().url().startsWith('data:')?r.continue():r.abort());
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 const b64=fs.readFileSync(raw).toString('base64');
 await p.evaluate(async([b64,name])=>{const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);await __gs.phAddFiles([new File([u],name)]);},[b64,path.basename(raw)]);
 await p.waitForFunction(()=>__gs.ph.cur===0&&!!__gs.phP().psrc,null,{timeout:120000});await p.waitForTimeout(600);
 await p.evaluate(()=>{__gs.phAutoTone();});await p.waitForTimeout(500);
 await p.evaluate(()=>{const G=__gs;G.ph.open.light=true;});await p.waitForTimeout(300);
 await p.screenshot({path:out+'/photo-develop.png'});
 await p.evaluate(()=>{const G=__gs;G.ph.open.light=false;G.ph.open.local=true;G.phNewMask('lin');const m=G.phSelMask();m.a=[.5,.05];m.b=[.5,.5];m.adj={exp:-.8,sat:20};G.phApply(G.phClone(G.phS()),'Add mask');});await p.waitForTimeout(600);
 await p.screenshot({path:out+'/photo-masks.png'});
 await b.close();console.log('done');
})();
