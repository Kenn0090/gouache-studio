/* 0.93: the Texture studio (pattern brushes, salt and speckle) */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();});
 const info=await p.evaluate(()=>{const g=__gs.library.filter(x=>/^texstudio/.test(x.id)),all=__gs.library.flatMap(x=>x.presets.map(q=>q.name)),mine=g.flatMap(x=>x.presets.map(q=>q.name));return {sets:g.length,n:mine.length,dup:mine.filter(n=>all.filter(a=>a===n).length>1)};});
 ok(info.sets===2&&info.n===21,'two groups with 21 brushes ('+info.sets+', '+info.n+')');ok(info.dup.length===0,'brush names are unique '+info.dup.join(','));
 await p.evaluate(()=>__gs.newDoc(600,300,8,[1,1,1],'T',false,'hand'));await p.waitForTimeout(400);await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const drag=async(x0,y0,x1,y1)=>{const a=at(x0,y0),z=at(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:30});await p.mouse.up();await p.waitForTimeout(150);};
 const cover=(x0,x1)=>p.evaluate(([x0,x1])=>{const L=__gs.doc.active;let n=0,t=0;for(let x=x0;x<x1;x+=2)for(let y=100;y<200;y+=2){t++;if(__gs.captureRegionNow(L.target,x,y,1,1).data[3]>40)n++;}return n/t;},[x0,x1]);
 const names=await p.evaluate(()=>__gs.TX_GROUPS.flatMap(g=>g[1].map(x=>x[0])));const dead=[];
 for(const n of names){await p.evaluate(n=>{__gs.setTool('brush');__gs.applyPreset(__gs.library.flatMap(x=>x.presets).find(x=>x.name===n));__gs.ui.fg=[0,0,0];__gs.brush.size=70;},n);
   await p.evaluate(()=>{const L=__gs.doc.active;__gs.clearTarget&&__gs.clearTarget(L.target);});
   await drag(40,150,560,150);const c=await cover(40,560);if(!(c>.004))dead.push(n+' '+c.toFixed(4));}
 console.log('brushes that left nothing:',dead.join(', ')||'none');ok(dead.length===0,'every texture brush leaves marks');
 // the stroke starts sparse and gets denser
 await p.evaluate(()=>{__gs.setTool('brush');__gs.applyPreset(__gs.library.flatMap(x=>x.presets).find(x=>x.name==='Pointillism bold'));__gs.ui.fg=[0,0,0];__gs.brush.size=80;__gs.clearTarget(__gs.doc.active.target);});
 await drag(40,150,560,150);const a=await cover(60,200),z=await cover(420,560);console.log('start',a.toFixed(3),'end',z.toFixed(3));ok(z>a*1.5,'a pattern stroke starts sparse and gets denser');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
