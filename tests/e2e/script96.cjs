/* 0.96: the gouache command set and the Scripts window (run, one undo step, errors in plain words, Stop, Record) */
const {chromium}=require('playwright'),path=require('path');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1500,height:900}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 /* the command set directly */
 const r1=await p.evaluate(async()=>{const g=window.gouache;await g.doc.new({width:128,height:96,name:'api'});g.layers.add('A');g.paint.colour('#ff0000');g.paint.size(10);
   await g.paint.stroke([[10,48],[118,48]]);const L=g.layers.active();g.layers.set('A',{opacity:.5,blend:'multiply'});
   const T=__gs.mapT(__gs.layerByName('A'),'base'),d=__gs.captureRegionNow(T,0,0,T.w,T.h).data,i=(48*128+64)*4;
   let err='';try{g.layers.select('Nope');}catch(e){err=e.message;}
   return {info:g.doc.info(),L,after:g.layers.active(),px:[d[i],d[i+1],d[i+2],d[i+3]],err,cmds:__gs.apiCommands?__gs.apiCommands().length:0,menus:g.menus().length};});
 ok(r1.info.width===128&&r1.info.height===96,'gouache.doc.new makes the document '+JSON.stringify(r1.info));
 ok(r1.px[0]>200&&r1.px[1]<40&&r1.px[3]>200,'gouache.paint.stroke paints with the colour '+r1.px);
 ok(r1.after.opacity===.5&&r1.after.blend==='multiply','gouache.layers.set changes opacity and blend '+JSON.stringify(r1.after));
 ok(/no layer called/.test(r1.err),'mistakes are explained in plain words: '+r1.err);
 ok(r1.menus>50,'gouache.menus() lists the menu commands ('+r1.menus+')');
 /* the Scripts window */
 await p.evaluate(()=>__gs.act('scripts'));await W(400);
 ok(await p.locator('#scrDlg').count()===1&&await p.locator('#scrList option').count()>=4,'Window › Scripts opens with examples');
 const u0=await p.evaluate(()=>__gs.hist.undo.length);
 await p.fill('#scrCode',"gouache.layers.add('S1');gouache.layers.add('S2');gouache.layers.fill([0,0,1]);gouache.log('made', gouache.layers.list().length);");
 await p.fill('#scrName','Two layers');await p.click('#scrRun');await W(800);
 const s1=await p.evaluate(()=>({names:__gs.allLayers().map(l=>l.name),undo:__gs.hist.undo.length,log:document.getElementById('scrLog').textContent}));
 ok(s1.names.includes('S1')&&s1.names.includes('S2')&&/made/.test(s1.log)&&/Done/.test(s1.log),'Run runs the script and writes the log');
 ok(s1.undo===u0+1,'the whole run is one undo step ('+u0+' → '+s1.undo+')');
 await p.evaluate(()=>__gs.act('undo'));await W(300);ok(await p.evaluate(()=>!__gs.allLayers().some(l=>l.name==='S1'||l.name==='S2')),'one undo removes everything the script did');
 await p.fill('#scrCode',"gouache.layers.add(;");await p.click('#scrRun');await W(300);ok(/typing mistake/.test(await p.textContent('#scrLog')),'a typing mistake is reported');
 await p.fill('#scrCode',"for(let i=0;i<100;i++){gouache.layers.add('L'+i);await gouache.wait(50);}");await p.click('#scrRun');await W(400);await p.click('#scrStop');await W(400);
 const st=await p.evaluate(()=>({n:__gs.allLayers().filter(l=>/^L\d+$/.test(l.name)).length,log:document.getElementById('scrLog').textContent}));
 ok(st.n>0&&st.n<100&&/Stopped/.test(st.log),'Stop stops a running script ('+st.n+' layers made)');
 await p.click('#scrSave');await W(200);ok(await p.evaluate(()=>JSON.parse(localStorage.getItem('gs.scripts')||'[]').some(s=>s.name==='Two layers')),'Save keeps the script');
 /* Record */
 await p.fill('#scrCode','');await p.click('#scrRec');await W(200);
 await p.evaluate(()=>__gs.showPanel('layers'));await p.click('#lAdd');await W(200);
 await p.evaluate(()=>__gs.showPanel('color'));await p.fill('#hex','#00ff00');await p.press('#hex','Enter');await p.fill('#hex','#008000');await p.press('#hex','Enter');await W(200);
 await p.evaluate(()=>__gs.act('scripts'));await W(300);
 await p.evaluate(()=>window.gouache.filters.apply?null:null);
 await p.evaluate(()=>{const o=__gs.FX.blur;});
 await p.click('#scrRec');await W(200);
 const code=await p.inputValue('#scrCode');
 ok(/gouache\.layers\.add\(/.test(code)&&(code.match(/paint\.colour/g)||[]).length===1,'Record turns actions into script lines:\n'+code);
 /* replay the recording */
 const n0=await p.evaluate(()=>__gs.allLayers().length);
 await p.click('#scrRun');await W(600);const rp=await p.evaluate(()=>({n:__gs.allLayers().length,fg:__gs.ui.fg.slice()}));ok(rp.n===n0+1&&rp.fg[1]>.4&&rp.fg[0]<.1,'the recorded script replays '+JSON.stringify(rp));
 ok(!errs.length,'no errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
