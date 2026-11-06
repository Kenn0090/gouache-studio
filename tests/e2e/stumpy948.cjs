/* 0.94.8 (Kenn): Stumpy G, a gentler Stump blend with a smoother blur (no steps) */
const {chromium}=require('playwright');
const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.closeWelcome());await p.waitForTimeout(300);
 const PASSES=1;const box=await p.locator('#gl').boundingBox();
 ok(await p.evaluate(()=>{const all=__gs.library.flatMap(s=>s.presets||[]);const g=all.find(x=>x.name==='Stumpy G'),s=all.find(x=>x.name==='Stump blend');return !!g&&!!s&&g.blendMode==='soft'&&g.softSmooth===true&&g.strength<s.strength;}),'Stumpy G is in the brushes: a soft blend, gentler than Stump blend, with the smoother blur');
 /* a hard black / white edge across the canvas */
 const setup=async()=>{for(const [x,c] of [[250,[0,0,0]],[390,[1,1,1]]]){await p.evaluate(c=>{__gs.setFG(c);__gs.brush.lineBlend=false;__gs.brush.tip=null;__gs.brush.size=140;__gs.brush.hardness=1;__gs.brush.flow=1;__gs.brush.opacity=1;__gs.brush.smoothing=0;__gs.brush.correction=0;__gs.brush.lazy=0;__gs.setTool('brush');},c);
   await p.mouse.move(box.x+x,box.y+260);await p.mouse.down();await p.mouse.move(box.x+x,box.y+380,{steps:8});await p.mouse.up();await p.waitForTimeout(400);}};
 const hp=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,v=__gs.view,cx=Math.round((320-v.x)/v.zoom),cy=Math.round((320-v.y)/v.zoom),R=Math.round(30/v.zoom);const at=(x,y)=>d[(y*W+x)*4];let e=0,n=0;const vals=new Set();
   for(let y=cy-R;y<=cy+R;y++)for(let x=cx-R;x<=cx+R;x++){let s=0;for(let j=-2;j<=2;j++)for(let i=-2;i<=2;i++)s+=at(x+i,y+j);e+=(at(x,y)-s/25)**2;n++;vals.add(at(x,y));}const u=[...vals].sort((a,b)=>a-b);let gap=0;for(let i=1;i<u.length;i++)gap=Math.max(gap,u[i]-u[i-1]);return {r:Math.sqrt(e/n),distinct:u.length,gap,lo:u[0],hi:u[u.length-1]};});
 const rowOf=()=>p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,v=__gs.view,iy=Math.round((320-v.y)/v.zoom);const r=[];for(let x=0;x<W;x++)r.push(d[(iy*W+x)*4+3]?d[(iy*W+x)*4]:-1);return r;});
 const blendWith=async(name)=>{await p.evaluate(n=>{const all=__gs.library.flatMap(s=>s.presets||[]);__gs.applyPreset(all.find(x=>x.name===n));__gs.brush.strength=.3;__gs.setTool('smudge');__gs.brush.size=window.__SZ||110;__gs.brush.smoothing=0;__gs.brush.correction=0;__gs.brush.lazy=0;},name);
   await p.mouse.move(box.x+320,box.y+280);await p.mouse.down();for(let k=0;k<PASSES;k++){await p.mouse.move(box.x+320+(k%2?12:-12),box.y+360,{steps:10});await p.mouse.move(box.x+320,box.y+280,{steps:10});}await p.mouse.up();await p.waitForTimeout(300);return rowOf();};
 /* how steppy: the bumps in the slope across the blend, against how far it changes */
 const ripples=r=>{const sm=[];for(let x=0;x<r.length;x++){let a=0,n=0;for(let k=-3;k<=3;k++){const v=r[x+k];if(v!=null&&v>=0){a+=v;n++;}}sm.push(n?a/n:-1);}let lo=-1,hi=-1;for(let x=0;x<r.length;x++)if(r[x]>12&&r[x]<243){if(lo<0)lo=x;hi=x;}let back=0;for(let x=lo+4;x<=hi-4;x++){const d=sm[x]-sm[x-1];if(d<0)back-=d;}return +back.toFixed(1);};
 const stairs=r=>{let lo=-1,hi=-1;for(let x=0;x<r.length;x++)if(r[x]>12&&r[x]<243){if(lo<0)lo=x;hi=x;}let flat=0,jump=0,n=0;for(let x=lo+1;x<=hi;x++){const d=Math.abs(r[x]-r[x-1]);if(d===0)flat++;jump=Math.max(jump,d);n++;}const mean=Math.abs(r[hi]-r[lo])/Math.max(1,n);return {flat:+(flat/Math.max(1,n)).toFixed(2),jump,mean:+mean.toFixed(2),ratio:+(jump/Math.max(.5,mean)).toFixed(1)};};
 const steppy=r=>{const xs=[];for(let x=0;x<r.length;x++)if(r[x]>=0)xs.push(x);let lo=-1,hi=-1;for(const x of xs){if(r[x]>8&&r[x]<247){if(lo<0)lo=x;hi=x;}}if(lo<0)return {w:0,s:99};let bump=0;for(let x=lo+1;x<hi;x++)bump+=Math.abs(r[x+1]-2*r[x]+r[x-1]);return {w:hi-lo,s:bump/Math.max(1,Math.abs(r[hi]-r[lo]))};};
 await p.evaluate(()=>{window.__SZ=260;});
 await setup();const r0=await rowOf();
 const ra=await blendWith('Stump blend');if(process.env.SHOT)await p.screenshot({path:process.env.SHOT+'_a.png',clip:{x:box.x+170,y:box.y+250,width:300,height:140}});const a=steppy(ra);a.st=stairs(ra);a.rip=ripples(ra);a.hp=await hp();console.log('RA',ra.filter(v=>v>4&&v<251).join(','));console.log('Stump blend',JSON.stringify(a));
 await p.keyboard.press('Control+z');await p.waitForTimeout(300);const r1=await rowOf();
 ok(r1.join()===r0.join(),'undo puts the hard edge back');
 const rg=await blendWith('Stumpy G');if(process.env.SHOT)await p.screenshot({path:process.env.SHOT+'_g.png',clip:{x:box.x+170,y:box.y+250,width:300,height:140}});const g=steppy(rg);g.st=stairs(rg);g.rip=ripples(rg);g.hp=await hp();console.log('RG',rg.filter(v=>v>4&&v<251).join(','));console.log('Stumpy G',JSON.stringify(g));
 ok(g.w>10,'Stumpy G blends the edge into a gradient ('+g.w+' px wide)');
 ok(g.rip<a.rip*0.6&&g.hp.r<1,'Stumpy G\'s blend is smoother: no ripples with a big brush ('+g.rip+' vs Stump blend '+a.rip+') and no grain ('+g.hp.r.toFixed(2)+')');
 await p.evaluate(()=>{__gs.setTool('smudge');__gs.brush.blendMode='soft';__gs.showPanel('brushes');__gs.buildBrushPanel();});await p.waitForTimeout(300);
 ok(await p.locator('#bSoftSmooth').count()===1,'the Blend panel has the Smoother blur switch for any soft blend');
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?fails+' FAILED':'ALL PASSED');process.exit(fails?1:0);})();
