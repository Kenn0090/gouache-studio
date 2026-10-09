/* Makes the Specular/Glossiness materials of the Library (assets/materials/sg-*.gmat).
   They are plain values (Diffuse, Specular colour, Glossiness), so each file is tiny. Run after `npm run build`:
   node scripts/make-sg-materials.cjs
   Spec colours are the usual real-world reflectances (gold, copper...) written the way the app stores colours (sRGB). */
const path=require('path'),fs=require('fs'),zlib=require('zlib'),{createRequire}=require('module');
const {chromium}=createRequire(path.resolve(__dirname,'../tests/e2e/package.json'))('playwright');
const OUT=path.resolve(__dirname,'../assets/materials');
const sr=l=>l.map(x=>Math.round(Math.pow(x,1/2.2)*1000)/1000);
/* name, category, diffuse (sRGB), specular (linear reflectance), glossiness */
/* the old way, before PBR: a plain colour for the body and a different colour for the shine (gold = dark brown + yellow) */
const LIST=[
  ['Gold','Metal',[.3,.19,.04],[.95,.65,.12],.8],
  ['Rose gold','Metal',[.35,.17,.14],[.9,.5,.4],.75],
  ['Copper','Metal',[.3,.12,.06],[.9,.45,.2],.75],
  ['Bronze','Metal',[.2,.13,.06],[.6,.4,.15],.62],
  ['Jade with blue shine','Other',[.2,.5,.3],[.06,.14,.4],.8],
  ['Purple lacquer','Paint & ceramic',[.3,.08,.4],[.32,.15,.05],.85],
  ['Pearl car paint','Paint & ceramic',[.05,.15,.55],[.22,.17,.05],.9],
  ['Red velvet','Fabric',[.5,.03,.05],[.14,.07,.04],.25],
  ['Teal satin','Fabric',[.06,.4,.45],[.2,.15,.05],.6],
  ['Beetle shell','Other',[.03,.3,.12],[.35,.05,.2],.9]
];
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1200,height:800}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+path.resolve(__dirname,'../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 /* the thumbnails are drawn by the real viewer (the Spec/Gloss shader on a sphere, with the studio light), so they look like the material does on a model */
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'SG',false,'pbrsg'));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(1500);
 await p.evaluate(()=>{__gs.p3NewProject(256,{setup:'spec',workflow:'spec',startMaterial:'neutral'});});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const o=document.querySelector('.dlg .btn.primary, #dlgOk, .dlg button.ok');if(o)o.click();});await p.waitForTimeout(800);
 await p.evaluate(()=>{const s=__gs.v3s();s.model='sphere';__gs.useModel&&0;});
 await p.evaluate(()=>{const sel=document.getElementById('v3Model');if(sel){sel.value='sphere';sel.dispatchEvent(new Event('change',{bubbles:true}));}});await p.waitForTimeout(1200);
 await p.evaluate(()=>{const s=__gs.v3s();s.env='studio';s.envBg='off';s.envI=1.2;__gs.v3.dirty=true;});await p.waitForTimeout(1500);
 for(const [name,cat,dif,spec,gloss] of LIST){
  const r=await p.evaluate(async([name,dif,spec,gloss])=>{const L=__gs.allLayers().find(l=>l.name==='Base material'),m=L.fill.maps;
    m.base.c=dif;m.spec.on=true;m.spec.c=spec;m.gloss.on=true;m.gloss.v=gloss;__gs.fillRender(L);__gs.changedAll();
    await new Promise(r=>setTimeout(r,900));
    const f=JSON.parse(JSON.stringify(L.fill)),S=256,px=__gs.v3Offscreen(S,S,{transparent:true}),c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d'),im=x.createImageData(S,S);
    for(let y=0;y<S;y++)for(let xx=0;xx<S;xx++){const sI=((S-1-y)*S+xx)*4,t=(y*S+xx)*4;const a=px[sI+3]||0;im.data[t]=a?Math.min(255,px[sI]*255/a):0;im.data[t+1]=a?Math.min(255,px[sI+1]*255/a):0;im.data[t+2]=a?Math.min(255,px[sI+2]*255/a):0;im.data[t+3]=a;}
    x.putImageData(im,0,0);const o=document.createElement('canvas');o.width=o.height=192;o.getContext('2d').drawImage(c,0,0,192,192);
    return {fill:f,thumb:o.toDataURL('image/webp',.9)};},[name,dif,sr(spec),gloss]);
  const j={app:'Gouache Studio',kind:'material',v:1,name,wf:'spec',fill:r.fill,imgs:{},thumb:r.thumb,credit:'',cat};
  fs.writeFileSync(path.join(OUT,'sg-'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.gmat'),zlib.gzipSync(Buffer.from(JSON.stringify(j))));
  console.log('made',name);}
 await b.close();})();
