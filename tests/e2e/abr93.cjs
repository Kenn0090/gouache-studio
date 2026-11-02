/* 0.93.2: Photoshop brush settings that used to be ignored (Color dynamics, Dual brush, Texture) now come across */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{document.querySelector('.welcome')?.remove();__gs.newDoc(300,300,8,[1,1,1],'D',false,'hand');});
 const r=await p.evaluate(()=>{const notes=new Set(),tips=[];
   const br={name:'Test',shape:{type:'computed',size:30,hardness:.5,spacing:.2,angle:0,roundness:1,spacingOn:true},
     colorDynamics:{hue:.2,saturation:.1,brightness:.3,perTip:false,purity:0,foregroundBackground:{control:'off',jitter:0}},
     dualBrush:{shape:{type:'computed',size:50,hardness:.3,spacing:.5},spacing:.5,count:2,blendMode:'multiply',useScatter:true,scatterDynamics:{jitter:1}},
     texture:{depth:.6}};
   const q=__gs.presetFromAbr(br,new Map(),notes,tips);q.dual.tipKey='u:'+q._dualTip.name;delete q._dualTip;
   const set={id:'t1',name:'T',presets:[q],tips:tips.slice()},ser=__gs.serializeSet(set);
   return {hue:q.hueJitter,sat:q.satJitter,val:q.valJitter,perStroke:q.jitterPerStroke,dual:q.dual,grain:q.grain,tips:tips.length,serTips:ser.tips.length,notes:[...notes]};});
 console.log(JSON.stringify(r));
 ok(r.hue===.2&&r.sat===.1&&r.val===.3&&r.perStroke===true,'colour dynamics become hue, saturation and brightness jitter');
 ok(r.dual&&r.dual.size===50&&r.dual.count===2&&r.dual.spacing===50&&r.dual.scatter===100&&r.dual.mode===0,'the dual brush keeps its size, spacing, count and scatter');
 ok(r.tips===1&&r.serTips===1,'the dual brush tip is saved with the set');
 ok(Math.abs(r.grain-.54)<.01,'texture depth becomes grain');
 ok(r.notes.length===3&&!r.notes.some(n=>/not applied/.test(n)),'the message says what was applied');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
