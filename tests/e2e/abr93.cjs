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
 const t=await p.evaluate(()=>{const notes=new Set(),tips=[],pats=new Map([['pid',{id:'pid',name:'Paper',bounds:{x:0,y:0,w:64,h:64},data:new Uint8Array(64*64*4).fill(200)}]]),pt=new Map();
   const q=__gs.presetFromAbr({name:'Tx',shape:{type:'computed',size:30,hardness:1,spacing:.2,angle:0,roundness:1},texture:{id:'pid',scale:50,depth:70,invert:true}},new Map(),notes,tips,pats,pt);
   const set={id:'t2',name:'T2',presets:[q],tips:tips.slice()},ser=__gs.serializeSet(set);
   return {key:q.texKey,depth:q.texDepth,scale:q.texScale,inv:q.texInvert,grain:q.grain,tips:tips.length,serTips:ser.tips.length,ok:ser.presets[0].texKey===q.texKey};});
 console.log(JSON.stringify(t));
 ok(t.key&&t.depth===.7&&t.scale===32&&t.inv===true&&!t.grain&&t.tips===1&&t.serTips===1&&t.ok,'a Photoshop texture picture becomes the brush texture and is saved with the set');
 console.log(JSON.stringify(r));
 ok(r.hue===.2&&r.sat===.1&&r.val===.3&&r.perStroke===true,'colour dynamics become hue, saturation and brightness jitter');
 ok(r.dual&&r.dual.size===50&&r.dual.count===2&&r.dual.spacing===50&&r.dual.scatter===100&&r.dual.mode===0,'the dual brush keeps its size, spacing, count and scatter');
 ok(r.tips===1&&r.serTips===1,'the dual brush tip is saved with the set');
 ok(Math.abs(r.grain-.54)<.01,'texture depth becomes grain');
 ok(r.notes.length===3&&!r.notes.some(n=>/not applied/.test(n)),'the message says what was applied');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 // 0.95: a bristle (dynamic) tip becomes the Mixing brush with bristles
 {const r=await p.evaluate(()=>{const notes=new Set(),q=__gs.presetFromAbr({name:'Bristle',shape:{type:'dynamic',size:40,angle:0,shape:'flat blunt',density:.5,length:1,clumping:0,thickness:.5,stiffness:.5,physics:false,spacing:.1,spacingOn:true,flipX:false,flipY:false}},new Map(),notes,[],[],[]);return {mix:q.mix,b:q.mixBristles,round:q.roundness,notes:[...notes]};});
  ok(r.mix===true&&r.b>=6&&r.b<=40&&r.round<=.4,'a Photoshop bristle tip becomes the Mixing brush with bristles ('+JSON.stringify(r)+')');}
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
