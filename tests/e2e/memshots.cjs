/* Preferences › Memory and disk as the desktop app shows it (the desktop bridge is stubbed with a
   32 GB machine), for the guide; also checks that section's desktop parts work. */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=require('path').resolve(__dirname,'../../docs/wiki/images')+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:')||u.startsWith('blob:'))return r.continue();return r.abort();});
 await p.addInitScript(()=>{const GB=1073741824;window.__calls=[];let dir=null;
   window.__TAURI__={core:{invoke:async(cmd,args)=>{window.__calls.push([cmd,args&&args.dir!==undefined?args.dir:null]);
     if(cmd==='cache_info')return {dir:dir?dir+'\\Gouache Studio cache':'C:\\Users\\Kenn\\AppData\\Local\\com.gouache.studio',custom:!!dir,spill_bytes:1.4*GB,tree_bytes:.6*GB,free_bytes:412*GB,ram_total:32*GB,ram_avail:19.3*GB};
     if(cmd==='cache_set_dir'){dir=args.dir;return dir;}if(cmd==='tree_prune')return 0;if(cmd==='plugin:dialog|open')return 'D:\\Scratch';if(cmd==='recent_list')return [];return null;}},event:{listen:async()=>()=>{}}};});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(512,512,8,[1,1,1],'Mem',false));
 await p.keyboard.press('Control+k');await p.waitForTimeout(600);
 const t=await p.textContent('#modal .dialog');
 ok(t.includes('This computer has 32 GB'),'shows the computer’s memory');
 ok(await p.inputValue('#pMem')==='16384','memory limit starts at half (16 GB)');
 ok(t.includes('Disk cache')&&/In use: 2\.0 GB/.test(t),'disk cache folder and use shown');
 await p.click('#pCacheChange');await p.waitForTimeout(200);ok((await p.textContent('#pCacheDir')).includes('D:\\Scratch'),'Change… picks a folder');
 await p.locator('#pDisk').scrollIntoViewIfNeeded();await p.waitForTimeout(300);
 await p.locator('#modal .dialog').screenshot({path:OUT+'preferences-memory.png'});
 await p.click('#dlgOk');await p.waitForTimeout(400);
 const calls=await p.evaluate(()=>window.__calls.filter(c=>c[0]==='cache_set_dir'));ok(calls.some(c=>c[1]==='D:\\Scratch'),'Save moves the cache');
 ok(JSON.parse(await p.evaluate(()=>localStorage.getItem('gs.mem'))).dir==='D:\\Scratch','folder remembered');
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
