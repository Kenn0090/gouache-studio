/* 0.98.18 (Kenn: every viewer shader in the ray-traced view, skin first; "real light under the skin"): a Skin set is traced with a random
   walk under the surface. A sphere lit only from behind stays dark from the front with Standard; with Skin and a deep scatter depth the
   light comes through, reddish. */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:900,height:640}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(async()=>{const g=__gs;g.setMode('paint');g.p3.started=false;await g.p3NewProject(128,{modelKey:'sphere'});const L=g.paintLayers().find(x=>x.fill);
   L.fill.maps.base.c=[.8,.6,.5];if(L.fill.maps.rough){L.fill.maps.rough.on=true;L.fill.maps.rough.v=.6;}g.fillRender(L);
   const s=g.v3s();s.env='none';s.sunI=30;s.sunAz=180;s.sunEl=0;s.envBg=false;s.rtSamples=24;
   Object.assign(g.v3.cam,{yaw:0,pitch:0,dist:3,tx:0,ty:0,tz:0});g.v3.rt=true;g.v3.mapsDirty=true;g.v3.dirty=true;g.requestRender(true);});
 const render=async(kind,depth)=>{await p.evaluate(([k,d])=>{const g=__gs;g.shadeEdit(x=>{x.kind=k;x.p=x.p||{};x.p.skin=Object.assign({},x.p.skin||{},{depth:d,scatter:1});});g.v3.dirty=true;g.requestRender(true);},[kind,depth]);await p.waitForTimeout(2500);
   for(let i=0;i<240;i++){await p.waitForTimeout(500);const n=await p.evaluate(()=>{__gs.v3.dirty=true;__gs.requestRender(true);return __gs.rt.view?__gs.rt.view.n:0;});if(n>=24)break;}
   return await p.evaluate(()=>{const g=__gs,S=g.rt.view,d=g.rtPixels(S,true),w=S.w,h=S.h;let r=0,gg=0,bb=0,n=0;
     for(let y=Math.round(h*.4);y<h*.6;y++)for(let x=Math.round(w/2-h*.08);x<w/2+h*.08;x++){const i=(y*w+x)*4;r+=d[i];gg+=d[i+1];bb+=d[i+2];n++;}
     return {r:r/n,g:gg/n,b:bb/n,n:S.n,sk:Array.from(g.rtSkinUniform(g.rtShadeList()).slice(0,4))};});};
 await render('std',1);const std=await render('std',1),skin=await render('skin',3000);
 console.log('std',JSON.stringify(std));console.log('skin',JSON.stringify(skin));
 ok(skin.sk[0]===1&&skin.sk[2]>0,'the tracer gets the Skin set and its scatter depth');
 ok(skin.r>std.r+8&&std.n>=24&&skin.n>=24,'backlit Skin lets light through ('+std.r.toFixed(1)+' → '+skin.r.toFixed(1)+')');
 ok(skin.r>skin.b,'the light through the skin is warm');
 ok(!errs.length,'no page errors '+[...new Set(errs)].slice(0,3).join(' | '));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
