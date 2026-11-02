/* 0.88: the Graffiti set. Spray caps have a solid core and a speckled halo (not an even dot pattern); a normal brush afterwards is unaffected;
   holding the brush still makes paint run down (drips); the splatter brush makes droplets of different sizes; the wall papers exist. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(400,400,8,[1,1,1],'Spray',false,'hand'));await p.waitForTimeout(400);
 await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 const box=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const names=await p.evaluate(()=>__gs.GRAFFITI.map(g=>g.name));
 ok(names.length===21&&await p.evaluate(()=>__gs.GRAFFITI.every(g=>__gs.library.flatMap(x=>x.presets).some(x=>x.name===g.name))),'all 21 graffiti brushes are in the library ('+names.length+')');
 const use=(n,extra)=>p.evaluate(([n,e])=>{const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name===n);__gs.applyPreset(q);Object.assign(__gs.brush,e||{});__gs.ui.fg=[.1,.4,.9];},[n,extra]);
 const alpha=(x,y)=>p.evaluate(([x,y])=>__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3],[x,y]);
 const drag=async(x0,y0,x1,y1,hold)=>{const a=at(x0,y0),z=at(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:20});if(hold)await p.waitForTimeout(hold);await p.mouse.up();await p.waitForTimeout(200);};
 // a spray stroke: solid in the middle, speckled (partly covered) in the halo, empty far away
 await use('Fat cap',{size:80,drip:0,dripAuto:0,sprayFleck:0,pSize:false});await drag(60,100,340,100);
 const core=await alpha(200,100);
 const halo=await p.evaluate(()=>{const o=[];for(let x=100;x<=300;x+=2)for(const dy of [-34,-31,-28,28,31,34])o.push(__gs.captureRegionNow(__gs.doc.active.target,x,100+dy,1,1).data[3]);return o;});
 const covered=halo.filter(a=>a>200).length/halo.length,partial=halo.filter(a=>a>0&&a<=200).length/halo.length,empty=halo.filter(a=>a===0).length/halo.length;
 const far=await alpha(200,100+75);
 console.log('core alpha',core,'halo: solid',(covered*100).toFixed(0)+'%','faint',(partial*100).toFixed(0)+'%','none',(empty*100).toFixed(0)+'%');
 ok(core>240,'the core of the spray is solid ('+core+')');
 ok(partial>.1&&covered<.95&&(covered+partial)>.3,'the halo is a speckle: solid, faint and bare spots mixed (faint '+(partial*100).toFixed(0)+'%)');
 ok(far===0,'there is no paint far from the spray');
 // flecks: single droplets land outside the stroke, only when the brush has them
 const flecks=()=>p.evaluate(()=>{let n=0;for(let y=0;y<=30;y+=1)for(let x=60;x<=340;x+=2)if(__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3]>40)n++;return n;});
 const f0=await flecks();await use('Fat cap',{size:80,drip:0,dripAuto:0,sprayFleck:1,pSize:false});await drag(60,100,340,100);const f1=await flecks();
 console.log('painted samples far above the stroke: before',f0,'after flecks',f1);ok(f0===0&&f1>=3,'flecks land far outside the stroke');
 // a plain brush afterwards is not affected by the spray settings
 await use('Paint marker',{size:30,drip:0});await drag(60,250,340,250);
 ok(await alpha(200,250)>240&&await alpha(200,250+26)===0,'a paint marker after the spray cap is a clean solid line');
 // drips: hold still with the button down and paint runs down below the brush
 await use('Fat cap',{size:60,drip:1.5,pSize:false});await drag(120,300,160,300,3500);
 const below=await p.evaluate(()=>{let n=0;for(let y=335;y<=395;y+=3)for(let x=110;x<=175;x+=2)if(__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3]>150)n++;return n;});
 console.log('painted samples below the held brush:',below);
 ok(below>=3,'holding the brush still makes paint run down (drips)');
 // drips while painting: no stopping needed
 await p.evaluate(()=>{});await use('Fat cap',{size:50,drip:0,dripAuto:2,sprayFleck:0,pSize:false});await drag(60,200,340,200);
 const autoBelow=await p.evaluate(()=>{let n=0;for(let y=232;y<=330;y+=3)for(let x=50;x<=350;x+=2)if(__gs.captureRegionNow(__gs.doc.active.target,x,y,1,1).data[3]>150)n++;return n;});
 console.log('painted samples under a moving stroke with auto drips:',autoBelow);ok(autoBelow>=3,'drips come off the stroke while painting, without holding still');
 // hollow cone: one dab with the ring on is denser at the ring than in the middle; the swirl makes it uneven around the ring
 const dab=async(ring,swirl,x,y)=>{await use('Fat cap',{size:160,drip:0,dripAuto:0,sprayFleck:0,sprayRing:ring,spraySwirl:swirl,spray:.9,sprayDen:1.2,sprayMist:0,simP:'off',pSize:false});const a=at(x,y);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.up();await p.waitForTimeout(250);
  return p.evaluate(([x,y])=>{const L=__gs.doc.active,A=(px,py)=>{let s=0;for(let i=-2;i<=2;i++)for(let j=-2;j<=2;j++)s+=__gs.captureRegionNow(L.target,Math.round(px+i),Math.round(py+j),1,1).data[3];return s/25;};const mid=A(x,y),bins=[];for(let k=0;k<12;k++){const a=k/12*Math.PI*2;bins.push(A(x+Math.cos(a)*66,y+Math.sin(a)*66));}const m=bins.reduce((a,b)=>a+b)/12,sd=Math.sqrt(bins.reduce((a,b)=>a+(b-m)*(b-m),0)/12);return {mid,ring:m,sd};},[x,y]);};
 const plain=await dab(0,0,100,330),ringed=await dab(1,0,300,330),swirled=await dab(1,1,200,330);
 console.log('dab centre / ring / unevenness: plain',JSON.stringify(plain),'ring',JSON.stringify(ringed),'swirl',JSON.stringify(swirled));
 ok(plain.mid>plain.ring+20&&ringed.ring>ringed.mid+40,'with the hollow cone on, the rim ring is denser than the middle (a plain dab is densest in the middle)');
 ok(swirled.sd>ringed.sd+8,'the swirl makes the ring uneven around its circle');
 // spray cap levels: a grainy see-through stipple, not a solid black line, that gets bigger from level 1 to 6
 await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 const widthOf=async(lv,y)=>{await use(lv,{drip:0,dripAuto:0,simP:'fixed',simLevel:.45,sprayFleck:0,pSize:false});await drag(40,y,360,y);return p.evaluate(y=>{let w=0;const L=__gs.doc.active;for(let dy=-190;dy<=190;dy++){if(y+dy<0||y+dy>=400)continue;if(__gs.captureRegionNow(L.target,200,y+dy,1,1).data[3]>60)w++;}return w;},y);};
 const w1=await widthOf('Cap level 1 · Skinny cream',60),w4=await widthOf('Cap level 4 · Fat cream',200);
 const grain=await p.evaluate(()=>{const L=__gs.doc.active,v=[];for(let dx=-20;dx<=20;dx++)for(let dy=-8;dy<=8;dy++)v.push(__gs.captureRegionNow(L.target,200+dx,200+dy,1,1).data[3]);return {mid:v.filter(a=>a>40&&a<225).length/v.length,solid:v.filter(a=>a>=240).length/v.length};});
 console.log('cap level widths',w1,w4,'grain',JSON.stringify(grain));
 ok(w4>w1*2.5,'a higher cap level makes a much wider spray ('+w1+' to '+w4+' px)');
 ok(grain.mid>.4&&grain.solid<.4,'the spray is a grainy see-through stipple, not solid ('+Math.round(grain.mid*100)+'% in between, '+Math.round(grain.solid*100)+'% solid)');
 // splatter: droplets of different sizes
 await p.evaluate(()=>__gs.newDoc(400,400,8,[1,1,1],'Splat',false,'hand'));await p.waitForTimeout(300);await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(150);
 const box2=await p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});
 await use('Splatter flick');{const a=[box2.l+box2.x+120*box2.z,box2.t+box2.y+200*box2.z],z=[box2.l+box2.x+280*box2.z,box2.t+box2.y+200*box2.z];await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(z[0],z[1],{steps:20});await p.mouse.up();await p.waitForTimeout(300);}
 const sizes=await p.evaluate(()=>{const W=400,d=__gs.captureRegionNow(__gs.doc.active.target,0,0,W,W).data,seen=new Uint8Array(W*W),out=[];
  for(let i=0;i<W*W;i++){if(seen[i]||d[i*4+3]<128)continue;let n=0;const st=[i];seen[i]=1;while(st.length){const k=st.pop();n++;const x=k%W,y=(k/W)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(nx<0||ny<0||nx>=W||ny>=W)continue;const j=ny*W+nx;if(!seen[j]&&d[j*4+3]>=128){seen[j]=1;st.push(j);}}}out.push(n);}return out;});
 sizes.sort((a,b)=>a-b);console.log('droplets',sizes.length,'smallest',sizes[0],'largest',sizes[sizes.length-1]);
 ok(sizes.length>=8&&sizes[sizes.length-1]>=6*Math.max(1,sizes[0]),'the splatter is many droplets of very different sizes');
 // wall papers
 ok(await p.evaluate(()=>__gs.PAPER_NAMES.slice(12).join('|')==='Brick wall|Concrete|Rough plaster|Corrugated metal'),'the four wall surfaces are in the Paper list');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
