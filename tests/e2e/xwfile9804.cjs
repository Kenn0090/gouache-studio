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
 const files=()=>p.evaluate(()=>+((document.querySelector('#xwFoot').textContent.match(/(\d+) file/)||[])[1]||0));
 const f0=await files();
 const ticks=await p.evaluate(()=>[...document.querySelectorAll('#xwFiles_0 .xwfile input')].map(c=>c.id));
 ok(ticks.length>=3,'the map chips are tick boxes ('+ticks.length+')');
 await p.evaluate(id=>document.getElementById(id).click(),ticks[1]);await W(300);
 const f1=await files();ok(f1<f0,'unticking a map lowers the file count ('+f0+' to '+f1+')');
 ok(await p.evaluate(id=>!document.getElementById(id).checked,ticks[1]),'and the box stays unticked');
 await p.evaluate(()=>{window.__names=null;});
 const outs=await p.evaluate(()=>{const pr=__gs.TEX_PRESETS[__gs.texCfg.preset];return __gs.texOutputs(pr).map(o=>o.s);});
 ok(outs.length>0&&!outs.includes(ticks[1].replace(/^xwFile_0_/,'')),'the export itself leaves that map out ('+outs.join(',')+')');
 ok(errs.length===0,'no page errors '+errs.join('|').slice(0,200));
 await b.close();process.exit(fails?1:0);})();
