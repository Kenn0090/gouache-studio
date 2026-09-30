/* 0.28: Decals: click a decal, click the model; a movable sticker layer with colour, height, roughness, metal */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.addInitScript(()=>{try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'ob',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 /* ONE named object holding two pieces that do not touch: the left one has UVs on the left half, the right one on the right half */
 await p.evaluate(()=>{let o='o Both\n';
   o+='v -1.5 -0.5 0\nv -0.5 -0.5 0\nv -0.5 0.5 0\nv -1.5 0.5 0\nvt 0 0\nvt 0.45 0\nvt 0.45 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n';
   o+='v 0.5 -0.5 0\nv 1.5 -0.5 0\nv 1.5 0.5 0\nv 0.5 0.5 0\nvt 0.55 0\nvt 1 0\nvt 1 1\nvt 0.55 1\nf 5/5 6/6 7/7 8/8\n';
   __gs.useModel(__gs.parseOBJ(o,'two.obj'));});await W(800);
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;});await W(300);
 await p.selectOption('#sel3Kind','object');await W();
 const pts=await p.evaluate(()=>{const hit=document.querySelector('#v3Hit'),r=hit.getBoundingClientRect(),out=[];for(let x=r.left+5;x<r.right;x+=6){const y=r.top+r.height/2,q=__gs.v3PickAt(hit,{clientX:x,clientY:y});if(q)out.push({x,y,u:q.uv[0]});}return out;});
 const onA=pts.find(q=>q.u<.4),onB=pts.find(q=>q.u>.6);
 ok(onA&&onB,'found points on both pieces');
 const selCount=()=>p.evaluate(()=>{const d=__gs.selPixels(),W=__gs.doc.w;let L=0,R=0;for(let i=0;i<d.length;i++)if(d[i]>128){if(i%W<W/2)L++;else R++;}return {L,R};});
 await p.mouse.dblclick(onA.x,onA.y);await W(400);const sc=await selCount();
 ok(sc.L>256*256*.3&&sc.R===0,'double-click selects only the piece that is not connected to the other '+JSON.stringify(sc));
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
