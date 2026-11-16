/* 0.98.1: the rebuilt Export window (two columns, Game engine tab, UV tiles as a grid with their own export sizes) */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* material Body: tiles 1001, 1002 and 1011; material Head: one tile */
const OBJ=['v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0','v -1 -2.2 0','v 1 -2.2 0','v 1 -1.2 0','v -1 -1.2 0','v -1 1.2 0','v 1 1.2 0','v 1 2.2 0','v -1 2.2 0',
 'vt 0 0','vt 1 0','vt 1 1','vt 0 1','vt 1 0','vt 2 0','vt 2 1','vt 1 1','vt 0.05 1.05','vt 0.95 1.05','vt 0.95 1.95','vt 0.05 1.95','vt 0.1 1.1','vt 0.9 1.1','vt 0.9 1.9','vt 0.1 1.9',
 'usemtl Body','f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 2/5 5/6 6/7','f 2/5 6/7 3/8','f 11/13 12/14 13/15','f 11/13 13/15 14/16','usemtl Head','f 7/9 8/10 9/11','f 7/9 9/11 10/12'].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:860}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForFunction(()=>!!window.__gs,null,{timeout:120000});await p.waitForTimeout(2000);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(async obj=>{const g=__gs;const w=document.getElementById('welcome');if(w)w.remove();g.setMode('paint');g.p3.started=false;g.p3.imported=null;g.v3.imported=null;g.v3.mesh=null;
  const mesh=g.parseOBJ(obj,'udim.obj');await g.p3NewProject(128,{modelKey:'imported',imported:mesh,udim:true});g.texCfg.name='Dragon';g.texCfg.size=0;g.texCfg.model='none';g.texCfg.fmt='png';g.es.to='none';},OBJ);
 await W(2500);
 await p.evaluate(()=>__gs.dlgExportTextures());await W(600);
 const v=await p.evaluate(()=>{const q=s=>document.querySelector(s),d=q('#modal .dialog');return {w:d.offsetWidth,h:d.offsetHeight,vh:innerHeight,tabs:!!q('#xwTab_tex')&&!!q('#xwTab_eng'),left:['#txPreset','#txName','#txSize','#txFmt','#txModel'].every(s=>q(s)&&q(s).offsetParent),
   more:q('#xwMore')&&!q('#xwMore').open,hidden:['#txNrm','#txPad','#txH16','#txPsd'].every(s=>q(s)&&!q(s).checkVisibility({contentVisibilityAuto:true,visibilityProperty:true})),cards:document.querySelectorAll('.xwset').length,badge:(q('.xwbadge')||{}).textContent,tiles:[...document.querySelectorAll('.xwtile')].map(e=>e.id),
   foot:q('#xwFoot').textContent,note:(q('.xwtilesall .note')||{}).textContent,chips:[...document.querySelectorAll('#xwFiles_0 .xwfile code')].map(c=>c.textContent)};});
 ok(v.w>700&&v.h<v.vh*.8&&v.tabs,'the window is wide, not tall ('+v.w+' × '+v.h+' in a '+v.vh+' px window), with Textures and Game engine tabs');
 ok(v.left,'preset, name, size, format and model are in view');
 ok(v.more&&v.hidden,'normal map, padding, 16-bit height and PSD are folded under More options');
 ok(v.cards===2&&/UV tiles: 3 · 3 files per map/.test(v.badge||''),'each texture set is a card, and the set with tiles says so ('+v.badge+')');
 ok(v.tiles.length===3&&/\.1001\.png/.test(v.note||''),'its tiles are shown one by one, with an example of a tile’s file name ('+v.note+')');
 /* the grid puts tiles in their real places: 1002 right of 1001, 1011 above 1001 */
 const pos=await p.evaluate(()=>{const r=id=>document.querySelector('[id$="_'+id+'"].xwtile').getBoundingClientRect();const a=r(1001),c=r(1002),u=r(1011);return {right:c.left>a.right-2&&Math.abs(c.top-a.top)<3,above:u.bottom<=a.top+2&&Math.abs(u.left-a.left)<3};});
 ok(pos.right&&pos.above,'the tile grid follows the UV layout (1002 to the right of 1001, 1011 above it)');
 const n0=+/^(\d+) file/.exec(v.foot)[1];
 ok(n0===v.chips.length*4&&/about [\d.]+ MB/.test(v.foot),'the foot line counts the files: '+v.foot);
 /* a tile's own size, a tile left out, a set's own size */
 await p.selectOption('[id^="xwTile_"][id$="_1002"]','512');await W(300);
 await p.evaluate(()=>document.querySelector('[id^="xwTileOn_"][id$="_1011"]').click());await W(300);
 await p.selectOption('#xwSetSz_1','256');await W(300);
 const v2=await p.evaluate(()=>({foot:document.querySelector('#xwFoot').textContent,badge:document.querySelector('.xwbadge').textContent,cfg:JSON.parse(JSON.stringify({t:__gs.texCfg.tileSz,o:__gs.texCfg.tileOff,s:__gs.texCfg.setSz})),px:document.querySelector('#xwCard_1 .xwpx').textContent}));
 ok(+/^(\d+) file/.exec(v2.foot)[1]===v.chips.length*3&&/2 files per map/.test(v2.badge),'leaving a tile out drops its files from the count ('+v2.foot+')');
 ok(v2.cfg.t.Body['1002']===512&&v2.cfg.o.Body['1011']===true&&v2.cfg.s.Head===256&&v2.px==='256','the choices are kept for the export '+JSON.stringify(v2.cfg));
 /* the export follows them: read the picture sizes out of the PNG headers */
 await p.click('#dlgCancel');await W(200);
 const ex=await p.evaluate(async()=>{const g=__gs,files=await g.exportTextures();const dim=f=>{const d=f.data,dv=new DataView(d.buffer,d.byteOffset);return [dv.getUint32(16),dv.getUint32(20)];};
  return (files||[]).filter(f=>/\.png$/.test(f.name)).map(f=>({n:f.name,d:dim(f)}));});
 const by=re=>ex.filter(f=>re.test(f.n));
 ok(by(/Body.*\.1001\.png$/).length>0&&by(/Body.*\.1001\.png$/).every(f=>f.d[0]===128),'tile 1001 is written as painted ('+JSON.stringify(by(/Body.*\.1001\.png$/)[0])+')');
 ok(by(/Body.*\.1002\.png$/).length>0&&by(/Body.*\.1002\.png$/).every(f=>f.d[0]===512&&f.d[1]===512),'tile 1002 is written at its own 512 px ('+JSON.stringify(by(/Body.*\.1002\.png$/)[0])+')');
 ok(by(/Body.*\.1011\.png$/).length===0,'the tile that was left out is not written');
 ok(by(/Head/).length>0&&by(/Head/).every(f=>f.d[0]===256),'the other set is written at its own 256 px ('+JSON.stringify(by(/Head/)[0])+')');
 ok(ex.length===+/^(\d+) file/.exec(v2.foot)[1],'the number of files matches what the window said ('+ex.length+')');
 /* a set left out */
 await p.evaluate(()=>__gs.dlgExportTextures());await W(500);
 await p.click('#xwSet_1');await W(300);
 ok(await p.evaluate(()=>document.querySelector('#xwCard_1').classList.contains('off')&&__gs.texCfg.setOff.Head===true),'unticking a set greys its card');
 await p.click('#dlgCancel');await W(200);
 const ex2=await p.evaluate(async()=>((await __gs.exportTextures())||[]).map(f=>f.name));
 ok(ex2.length>0&&!ex2.some(n=>/Head/.test(n)),'and that set is not exported ('+ex2.length+' files)');
 /* Game engine tab (the browser version explains; the desktop one has the big buttons) */
 await p.evaluate(()=>{__gs.texCfg.setOff={};__gs.dlgExportTextures();});await W(400);await p.click('#xwTab_eng');await W(300);
 ok(await p.evaluate(()=>!!document.querySelector('#xwEngWeb')&&!!document.querySelector('.xwset')),'the Game engine tab keeps the texture sets beside it; in the browser it says sending needs the desktop app');
 await p.click('#dlgCancel');await W(200);
 await p.evaluate(()=>{const P=__gs.platform;P.isDesktop=true;P.invoke=async(cmd,a)=>cmd==='dir_files'?[[a.dir+'/My.uproject',0,0]]:null;P.pickFolder=async()=>'C:/Games/Unreal';__gs.es.dirs={};__gs.es.to='none';__gs.dlgExportTextures();});await W(400);
 ok(await p.evaluate(()=>!!document.querySelector('#xwFolder')&&document.querySelector('#dlgOk').textContent==='Export'),'the desktop app shows the folder on the Textures tab');
 await p.click('#xwTab_eng');await W(300);
 ok(await p.evaluate(()=>['none','blender','unity','godot','unreal','roblox'].every(k=>document.querySelector('#xwEng_'+k))&&document.querySelector('#xwEng_none').classList.contains('on')),'the Game engine tab has a button for each engine');
 await p.click('#xwEng_unreal');await W(400);
 const e=await p.evaluate(()=>({on:document.querySelector('#xwEng_unreal').classList.contains('on'),tab:document.querySelector('#xwTab_eng').textContent,ok:document.querySelector('#dlgOk').textContent,proj:!!document.querySelector('#esProject'),preset:__gs.texCfg.preset,nul:/null|undefined/.test(document.querySelector('#dlgBody').textContent)}));
 ok(e.on&&/Unreal/.test(e.tab)&&e.ok==='Export and send'&&e.proj&&e.preset==='unreal'&&!e.nul,'choosing Unreal shows its project setting, names the tab and turns the button into Export and send '+JSON.stringify(e));
 await p.click('#xwEng_none');await W(300);
 ok(await p.evaluate(()=>document.querySelector('#dlgOk').textContent==='Export'&&__gs.es.to==='none'),'Just save to a folder goes back to a plain export');
 await p.click('#dlgCancel');await W(200);
 /* drop-down lists are readable (Kenn's screenshot: pale text on a white list) */
 const col=await p.evaluate(()=>{const s=document.createElement('select');s.style.background='transparent';s.innerHTML='<option>a</option>';document.body.append(s);const c=getComputedStyle(s.options[0]);const r={bg:c.backgroundColor,fg:c.color};s.remove();return r;});
 ok(col.bg!=='rgba(0, 0, 0, 0)'&&col.bg!==col.fg,'a drop-down’s list has its own dark background and light text ('+col.bg+' / '+col.fg+')');
 ok(!errs.length,'no errors on the page '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
