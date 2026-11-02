/* 0.91: the Sketch studio (47 brushes in 7 groups) and the Paper tooth of the normal brushes. Pencils only mark the peaks of the paper; markers are
   see-through (a later stroke darkens an earlier one, a stroke never darkens itself) and run dry; pen pressure shapes the ballpoint. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1500,height:1000}}),p=await ctx.newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1800);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 const fresh=async()=>{await p.evaluate(()=>__gs.newDoc(400,400,8,[1,1,1],'Sketch',false,'hand'));await p.waitForTimeout(300);await p.evaluate(()=>document.querySelector('#lAdd')?.click());await p.waitForTimeout(120);
   return p.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect();return {l:r.left,t:r.top,x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom};});};
 let box=await fresh();const at=(x,y)=>[box.l+box.x+x*box.z,box.t+box.y+y*box.z];
 const cdp=await ctx.newCDPSession(p);
 const use=(n,e)=>p.evaluate(([n,e])=>{__gs.setTool('brush');const q=__gs.library.flatMap(x=>x.presets).find(x=>x.name===n);__gs.applyPreset(q);Object.assign(__gs.brush,e||{});__gs.ui.fg=[.15,.2,.5];},[n,e]);
 const drag=async(pts)=>{let a=at(...pts[0]);await p.mouse.move(a[0],a[1]);await p.mouse.down();for(const q of pts.slice(1)){const z=at(...q);await p.mouse.move(z[0],z[1],{steps:16});}await p.mouse.up();await p.waitForTimeout(200);};
 const pen=async(pts,pr)=>{const n=40;const segs=[];for(let i=0;i<pts.length-1;i++)segs.push([pts[i],pts[i+1]]);
   for(let k=0;k<=n;k++){const t=k/n,si=Math.min(segs.length-1,Math.floor(t*segs.length)),u=t*segs.length-si,[a,z]=segs[si],q=at(a[0]+(z[0]-a[0])*u,a[1]+(z[1]-a[1])*u);
     await cdp.send('Input.dispatchMouseEvent',{type:k===0?'mousePressed':k===n?'mouseReleased':'mouseMoved',x:q[0],y:q[1],button:'left',buttons:k===n?0:1,clickCount:k===0||k===n?1:0,pointerType:'pen',force:pr});}
   await p.waitForTimeout(200);};
 const sample=(x0,x1,y0,y1,st=2)=>p.evaluate(([x0,x1,y0,y1,st])=>{const L=__gs.doc.active,o=[];for(let x=x0;x<=x1;x+=st)for(let y=y0;y<=y1;y+=st)o.push(__gs.captureRegionNow(L.target,x,y,1,1).data[3]);const m=o.reduce((a,b)=>a+b)/o.length;return {m,sd:Math.sqrt(o.reduce((a,b)=>a+(b-m)*(b-m),0)/o.length),mid:o.filter(a=>a>20&&a<235).length/o.length};},[x0,x1,y0,y1,st]);
 // counts
 const cnt=await p.evaluate(()=>{const s=__gs.library.filter(x=>/^sketch/.test(x.id));return {sets:s.length,n:s.reduce((a,x)=>a+x.presets.length,0)};});
 ok(cnt.sets===7&&cnt.n===47,'the Sketch studio has 7 groups and 47 brushes ('+cnt.sets+', '+cnt.n+')');
 // every brush does something
 const all=await p.evaluate(()=>__gs.library.filter(x=>/^sketch/.test(x.id)).flatMap(x=>x.presets.map(q=>({n:q.name,tool:q.tool}))));
 const failed=[];
 for(const q of all){box=await fresh();
   if(q.tool==='erase'||q.tool==='smudge'){await use('Paint marker',{size:60,drip:0,dripAuto:0});await drag([[60,200],[340,200]]);}
   await use(q.n,{drip:0,dripAuto:0});const before=await sample(40,360,120,280,4);await drag([[60,190],[340,215]]);await drag([[60,215],[340,190]]);const after=await sample(40,360,120,280,4);
   const changed=q.tool==='erase'?after.m<before.m-.5:q.tool==='smudge'?(Math.abs(after.m-before.m)>.01||Math.abs(after.sd-before.sd)>.01):after.m>before.m+.5;if(!changed)failed.push(q.n+' ('+before.m.toFixed(1)+'→'+after.m.toFixed(1)+')');}
 console.log('brushes that did nothing:',failed.join(', ')||'none');ok(failed.length===0,'every one of the 47 brushes changes the picture ('+failed.length+' did not)');
 // paper tooth: a pencil with tooth is grainy (many in-between values), without it the line is smooth and solid
 box=await fresh();await use('HB pencil',{size:14,flow:1,tooth:.95,simP:'off',pOpacity:false});await drag([[40,100],[360,100]]);const g1=await sample(60,340,94,106);
 await use('HB pencil',{size:14,flow:1,tooth:0,simP:'off',pOpacity:false});await drag([[40,250],[360,250]]);const g2=await sample(60,340,244,256);
 console.log('pencil with tooth: mean',g1.m.toFixed(0),'in-between',(g1.mid*100).toFixed(0)+'%','; without: mean',g2.m.toFixed(0),'in-between',(g2.mid*100).toFixed(0)+'%');
 ok(g1.m<g2.m-25&&g1.sd>g2.sd+15,'paper tooth makes the pencil catch only on the peaks (grainy, lighter) while tooth 0 is solid');
 // markers: see-through
 box=await fresh();await use('Alcohol marker',{size:40,roundness:1,angle:0,mixUse:0,mixBristles:0,mixTooth:0,mixWCGran:0,mixWCEdge:0});
 await drag([[60,100],[340,100]]);await drag([[60,250],[340,250],[60,250]]);await drag([[200,60],[200,160]]);
 const single=await sample(80,120,95,105),dbl=await sample(80,120,245,255),cross=await sample(195,205,95,105);
 console.log('marker coverage: single',single.m.toFixed(0),'doubling back',dbl.m.toFixed(0),'crossing',cross.m.toFixed(0));
 ok(Math.abs(dbl.m-single.m)<12,'a marker stroke does not darken itself when it doubles back over itself');
 ok(cross.m>single.m+15,'a second marker stroke over the first darkens it (see-through marker)');
 // a dry marker runs out of ink along the stroke
 box=await fresh();await use('Marker fade streak',{size:34,roundness:1,angle:0,mixUse:.8,mixTooth:0});await drag([[30,200],[370,200]]);
 const start=await sample(40,100,190,210),end=await sample(300,360,190,210);console.log('dry marker: start',start.m.toFixed(0),'end',end.m.toFixed(0));ok(start.m>end.m+20,'a dry marker streaks out and fades toward the end of the stroke');
 // ballpoint: pen pressure
 box=await fresh();await use('Ballpoint pen',{size:6,simP:'off'});await pen([[40,100],[360,100]],.25);await pen([[40,250],[360,250]],.95);
 const lo=await sample(60,340,90,110,2),hi=await sample(60,340,240,260,2);console.log('ballpoint: light',lo.m.toFixed(1),'heavy',hi.m.toFixed(1));ok(hi.m>lo.m*1.4,'pressing harder makes the ballpoint line thicker and darker');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
