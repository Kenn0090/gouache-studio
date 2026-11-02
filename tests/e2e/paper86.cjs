/* 0.86: paper layers. Every paper type draws; notebooks have printed lines; the paper is its own layer at the bottom and painting goes on a layer above;
   changing the paper keeps one paper layer and undo brings the old one back; the Mixing brushes feel the paper's tooth. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('console',m=>{if(/active/.test(m.text()))console.log('page:',m.text());});p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(320,320,8,[1,1,1],'Paper',false,'hand'));await p.waitForTimeout(400);
 const stat=()=>p.evaluate(()=>{const L=__gs.paperLayer();const d=__gs.captureRegionNow(L.target,0,0,320,320).data;let s=0,s2=0,n=0,blue=0;for(let i=0;i<d.length;i+=4){const g=d[i+1];s+=g;s2+=g*g;n++;if(d[i+2]>d[i]+14)blue++;}const m=s/n;return {m,sd:Math.sqrt(s2/n-m*m),blue:blue/n};});
 const res=[];
 for(let t=0;t<16;t++){await p.evaluate(t=>__gs.paperApply({t,sc:1,relief:.8,lines:true}),t);res.push(await stat());}
 console.log(res.map((r,i)=>i+': mean '+r.m.toFixed(0)+' sd '+r.sd.toFixed(1)+' blue '+(r.blue*100).toFixed(1)+'%').join('\n'));
 ok(res.every(r=>r.sd>0.3&&r.m>60),'all 16 papers draw a surface');
 ok(res[7].m<res[0].m-40,'oak is darker than smooth white paper');
 ok(res[1].blue>.01&&res[2].blue>.01,'lined and grid notebooks have blue printed lines');
 ok(res[0].blue<.002,'smooth white has no lines');
 const kids=await p.evaluate(()=>__gs.doc.root.children.map(c=>c.name));
 ok(kids.filter(n=>/^Paper/.test(n)).length===1,'changing the paper keeps a single paper layer ('+kids.join(', ')+')');
 ok(/^Paper/.test(kids[0]),'the paper is the bottom layer');
 ok(await p.evaluate(()=>!__gs.doc.active.paper),'painting goes on a layer above the paper, not on the paper');
 // undo goes back to the previous paper
 const before=await stat();await p.evaluate(()=>__gs.paperApply({t:0,sc:1,relief:.8}));const oak=await stat();await p.evaluate(()=>__gs.undo());await p.waitForTimeout(200);const back=await stat();
 console.log('undo check',before.m,oak.m,back.m);ok(Math.abs(oak.m-before.m)>20&&Math.abs(back.m-before.m)<2,'undo brings the previous paper back');
 // tooth: a watercolour wash on rough paper has pools and gaps that follow the paper; with tooth 0 it is smoother
 await p.evaluate(()=>{__gs.paperApply({t:6,sc:1,relief:.8});const k=__gs.doc.root.children;__gs.doc.active=k[k.length-1];});
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const wash=async(tooth,y)=>{await p.evaluate(([tooth])=>{const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name==='Watercolour wash');__gs.applyPreset(q);Object.assign(__gs.brush,{size:70,mixTooth:tooth,mixWC:0,mixWCEdge:0,mixWCPools:0,mixWCGran:0,mixLoad:.02,mixEven:false});__gs.ui.fg=[.1,.2,.5];},[tooth]);
  const a=at(40,y),z=at(280,y);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:20});await p.mouse.up();await p.waitForTimeout(200);
  return p.evaluate(y=>{const L=__gs.doc.active;const o=[];for(let x=70;x<=250;x+=3)for(let dy=-8;dy<=8;dy+=3)o.push(__gs.captureRegionNow(L.target,x,y+dy,1,1).data[3]);const m=o.reduce((a,b)=>a+b)/o.length;console.log('  active',__gs.doc.active.name,'mean alpha',m.toFixed(1));return Math.sqrt(o.reduce((a,b)=>a+(b-m)*(b-m),0)/o.length);},y);};
 const flat=await wash(0,90),toothy=await wash(.9,220);
 console.log('paint variation without tooth',flat.toFixed(1),'with tooth',toothy.toFixed(1));
 ok(toothy>flat+3,'the Mixing brush feels the paper tooth (paint varies with the grain)');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
