/* wiki screenshots for 0.97: the Bake panel without tabs (group tree, sections, map rows, bake log) */
const {chromium}=require('playwright'),path=require('path');
const OUT=path.resolve(__dirname,'../../docs/wiki/images')+'/';
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:1000}})).newPage();p.setDefaultTimeout(120000);
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.removeItem('gs.bkSec');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:__dirname+'/node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||250);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'Crate',false));await W(300);
 await p.click('#modeTabs [data-mode=bake]');await W(1200);
 /* two round parts (body, cap) side by side in UV space; the high-poly has bumps, plus a "bolts" part with no low-poly partner */
 await p.evaluate(async()=>{const G=__gs;
   const part=(m,name,sx,sy,sz,ox,oy,u0,bump)=>({m,name,sx,sy,sz,ox,oy,u0,bump});
   const obj=parts=>{let t='',vb=1;for(const P of parts){const m=P.m,n=m.pos.length/3;t+='o '+P.name+'\n';
       for(let i=0;i<n;i++){let x=m.pos[i*3],y=m.pos[i*3+1],z=m.pos[i*3+2];if(P.bump){const k=1+P.bump*(Math.sin(y*14)*.5+Math.sin(Math.atan2(z,x)*10)*.5);x*=k;z*=k;}t+='v '+(x*P.sx+P.ox)+' '+(y*P.sy+P.oy)+' '+(z*P.sz)+'\n';}
       for(let i=0;i<n;i++)t+='vt '+(P.u0+m.uv[i*2]*.48)+' '+(m.uv[i*2+1]*.96+.02)+'\n';
       for(let i=0;i<m.idx.length;i+=3){const a=m.idx[i]+vb,b=m.idx[i+1]+vb,c=m.idx[i+2]+vb;t+='f '+a+'/'+a+' '+b+'/'+b+' '+c+'/'+c+'\n';}vb+=n;}
     return new TextEncoder().encode(t);};
   const lo=G.primMesh('sphere',0),hi=G.primMesh('sphere',2);
   G.bakeSetModel('low',await G.parseModelBytes('crate_low.obj',obj([part(lo,'body_low',1,1.2,1,-1.2,0,0,0),part(lo,'cap_low',.7,.5,.7,1.2,.4,.5,0)])));
   G.bakeSetModel('high',await G.parseModelBytes('crate_high.obj',obj([part(hi,'body_high',1,1.2,1,-1.2,0,0,.035),part(hi,'cap_high',.7,.5,.7,1.2,.4,.5,.05),part(lo,'bolts_high',.12,.12,.12,1.2,-.4,0,0)])));
   const C=G.bakeCfg;C.kinds={normal:true,ao:true,curv:true};C.ss=1;C.rays=16;C.front=6;C.back=6;C.perMat=false;G.buildBakePanel();});await W(4000);
 await p.evaluate(async()=>{const G=__gs;await G.runBake(G.bkLow(),['normal','ao','curv']);});for(let i=0;i<240&&await p.evaluate(()=>__gs.bk.busy);i++)await W(500);await W(800);
 await p.evaluate(()=>{const G=__gs,v=G.v3;Object.assign(v.cam,{yaw:.5,pitch:.3});G.v3Frame();v.dirty=true;G.requestRender(true);});await W(6000);
 await p.evaluate(()=>{const m=document.querySelector('.lb-msg');if(m&&m.parentElement){let b=m;while(b.parentElement&&!b.parentElement.querySelector(':scope>.lb-msg')&&b.parentElement.tagName!=='BODY')b=b.parentElement;const box=m.closest('.loadbox,.loadbar,#loadBox,#loadbar')||b.parentElement;box.hidden=true;}});
 await p.screenshot({path:OUT+'bake-tab.png'});
 /* the group tree, with the barrel group clicked and Group colours on */
 await p.evaluate(()=>{const T=__gs.btTree(),g=T.groups.find(g=>g.name==='body');__gs.btg.sel=g.id;__gs.buildBakePanel();});await W(300);
 await p.click('#btColours');await W(1500);
 await p.locator('#btWide').screenshot({path:OUT+'bake-groups.png'});
 await p.evaluate(()=>{const m=document.querySelector('.lb-msg');if(m&&m.parentElement){let b=m;while(b.parentElement&&!b.parentElement.querySelector(':scope>.lb-msg')&&b.parentElement.tagName!=='BODY')b=b.parentElement;const box=m.closest('.loadbox,.loadbar,#loadBox,#loadbar')||b.parentElement;box.hidden=true;}});
 await p.screenshot({path:OUT+'bake-group-colours.png'});
 await p.click('#btColours');await W(800);
 /* the Maps section with AO's settings open */
 await p.click('#bkGear_ao');await W(300);
 await p.locator('#bkS_maps').screenshot({path:OUT+'bake-maps.png'});
 await p.locator('#bkS_geo').screenshot({path:OUT+'bake-geometry.png'});
 await p.locator('#bkS_log').screenshot({path:OUT+'bake-log.png'});
 console.log(errs.length?'page errors: '+errs.join(' | '):'done');await b.close();})();
