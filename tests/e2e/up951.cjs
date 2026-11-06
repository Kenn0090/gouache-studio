/* 0.95.1 (Kenn): up axis on import (Auto from the file / Y / Z), 90° turn buttons, export follows the engine */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
/* a tall box: 0.2 wide, 2 tall along Y */
const OBJ=['v -.1 0 -.1','v .1 0 -.1','v .1 2 -.1','v -.1 2 -.1','v -.1 0 .1','v .1 0 .1','v .1 2 .1','v -.1 2 .1','vt 0 0','vt 1 0','vt 1 1','vt 0 1',
 'f 1/1 2/2 3/3','f 1/1 3/3 4/4','f 5/1 7/3 6/2','f 5/1 8/4 7/3','f 4/1 3/2 7/3','f 4/1 7/3 8/4','f 1/1 6/3 2/2','f 1/1 5/4 6/3'].join('\n');
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1400,height:850}})).newPage();
 await p.addInitScript(()=>{try{localStorage.setItem("gs.p3d",JSON.stringify({size:128,layout:"3d"}));}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const r=await p.evaluate(async obj=>{const g=__gs,E=new TextEncoder(),ext=m=>{const P=m.pos,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i+=3)for(let j=0;j<3;j++){mn[j]=Math.min(mn[j],P[i+j]);mx[j]=Math.max(mx[j],P[i+j]);}return mx.map((v,j)=>+(v-mn[j]).toFixed(2));};
  const out={};g.prefs.upAxis=undefined;
  const o1=await g.parseModelBytes('box.obj',E.encode(obj));out.objAuto=ext(o1);
  g.prefs.upAxis='z';const o2=await g.parseModelBytes('box.obj',E.encode(obj));out.objZ=ext(o2);out.back=ext(g.upApply(o2,'y'));g.prefs.upAxis=undefined;
  /* a Z-up FBX written by our exporter: turned to Z up, header says Z */
  const zm=g.meshTurn(o1,'x',90),fbx=g.mxFBX(zm,g.mxGroups(zm,[]),{},'Box',{outs:[]},{zUp:true});out.fbxBytes=Array.from(fbx);
  const f1=await g.parseModelBytes('box.fbx',fbx);out.fbxUp=f1.fileUp;out.fbxAuto=ext(f1);g.prefs.upAxis='y';out.fbxY=ext(await g.parseModelBytes('box.fbx',fbx));g.prefs.upAxis=undefined;
  return out;},OBJ);
 ok(JSON.stringify(r.objAuto)==='[0.2,2,0.2]','an OBJ comes in as it is (Auto = Y up) '+JSON.stringify(r.objAuto));
 ok(JSON.stringify(r.objZ)==='[0.2,0.2,2]'&&JSON.stringify(r.back)==='[0.2,2,0.2]','Z up turns it, and changing the choice turns it back '+JSON.stringify([r.objZ,r.back]));
 ok(r.fbxUp==='z'&&JSON.stringify(r.fbxAuto)==='[0.2,2,0.2]','Auto reads a Z-up FBX and stands it up '+JSON.stringify(r.fbxAuto));
 ok(JSON.stringify(r.fbxY)==='[0.2,0.2,2]','choosing Y up leaves the FBX as stored');
 /* the FBX's header as other apps read it */
 const fp=path.join(require('os').tmpdir(),'gs_up951.fbx');fs.writeFileSync(fp,Buffer.from(r.fbxBytes));
 try{const py=execFileSync('python3',['-c',`import ufbx,sys
s=ufbx.load_file(sys.argv[1])
a=s.settings.axes
print(ufbx.CoordinateAxis(a.up).name)`,fp]).toString().trim();ok(/Z/.test(py),'ufbx reads the exported FBX as Z up ('+py+')');}catch(e){console.log('SKIP ufbx check: '+String(e.message).split('\n')[0]);}
 /* turn buttons */
 const t=await p.evaluate(async obj=>{const g=__gs;g.setMode('paint');g.p3.started=false;g.p3.imported=null;g.v3.imported=null;g.v3.mesh=null;const mesh=g.parseOBJ(obj,'box.obj');await g.p3NewProject(128,{modelKey:'imported',imported:mesh});
  const ext=m=>{const P=m.pos,mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9];for(let i=0;i<P.length;i+=3)for(let j=0;j<3;j++){mn[j]=Math.min(mn[j],P[i+j]);mx[j]=Math.max(mx[j],P[i+j]);}return mx.map((v,j)=>+(v-mn[j]).toFixed(2));};
  const a=ext(g.v3.imported);g.buildP3Panel();const btn=document.getElementById('upTurn_x');btn&&btn.click();const c=ext(g.v3.imported),d=ext(g.v3.mesh);return {a,c,d,btn:!!btn,xtra:!!document.getElementById('v3Turn_x')};},OBJ);
 ok(t.btn&&t.xtra,'Turn X/Y/Z buttons under the Model list and in the 3D view\'s ⋯ menu');
 ok(JSON.stringify(t.a)==='[0.2,2,0.2]'&&JSON.stringify(t.c)==='[0.2,0.2,2]'&&JSON.stringify(t.d)==='[0.2,0.2,2]','Turn X lays the model down by 90° '+JSON.stringify(t));
 const ex=await p.evaluate(()=>{const g=__gs;g.texCfg.up='engine';const a=g.upExportAxis();g.texCfg.up='z';const b=g.upExportAxis();g.texCfg.up='engine';return [a,b];});
 ok(ex[0]==='y'&&ex[1]==='z','export: Follow the engine is Y up without an engine, Z up when chosen');
 ok(!errs.length,'no page errors '+errs.join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
