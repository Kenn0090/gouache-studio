const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
let fails=0;const ok=(v,m)=>{console.log((v?'PASS ':'FAIL ')+m);if(!v)fails++;};
(async()=>{
 const b=await chromium.launch({channel:process.env.GS_BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined),headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:1280,height:900}}),errs=[];
 p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&/shader|compile|link/i.test(m.text()))errs.push(m.text());});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.fulfill({body:'',contentType:'text/javascript'}));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>{__gs.closeWelcome();__gs.newDoc(256,256,8,[1,1,1],'Muzzle flash',false);__gs.setMode('anim');});
 const data=await p.evaluate(async()=>{
  const G=__gs,o=G.vfxOpts(18),T=G.makeTarget(256,256,8),times=[0,.08,.18,.32,.5,.75,1];
  const frames=times.map(t=>{G.vfxGenInto(T,o,t,null);return Array.from(G.readRGBA8(T));});
  const sum=d=>d.reduce((s,v,i)=>s+(i%4===3?v:0),0);
  const changed=frames[0].reduce((s,v,i)=>s+Math.abs(v-frames[2][i]),0);
  const c=document.createElement('canvas');c.id='muzzleContact';c.width=256*4;c.height=284*2;const x=c.getContext('2d');
  x.fillStyle='#14171a';x.fillRect(0,0,c.width,c.height);
  frames.forEach((d,n)=>{const a=new ImageData(256,256);for(let i=0;i<d.length;i+=4){const al=d[i+3];a.data[i]=al?Math.min(255,d[i]*255/al):0;a.data[i+1]=al?Math.min(255,d[i+1]*255/al):0;a.data[i+2]=al?Math.min(255,d[i+2]*255/al):0;a.data[i+3]=al;}const f=document.createElement('canvas');f.width=f.height=256;f.getContext('2d').putImageData(a,0,0);const xx=n%4*256,yy=Math.floor(n/4)*284;x.drawImage(f,xx,yy);x.fillStyle='#ddd';x.font='14px sans-serif';x.fillText('Cycle '+times[n],xx+12,yy+274);});
  document.body.append(c);c.style='position:fixed;left:0;top:0;z-index:99999';
  const repeat=(()=>{G.vfxGenInto(T,o,.18,null);return G.readRGBA8(T).every((v,i)=>v===frames[2][i]);})();
  o.seed+=11;G.vfxGenInto(T,o,0,null);const seedDiff=G.readRGBA8(T).some((v,i)=>v!==frames[0][i]);
  o.replace=true;o.n=8;G.vfxGenerate(o);const generated=G.anim.frames.length;
  await G.undo();const undone=G.anim.frames.length;await G.redo();const redone=G.anim.frames.length;
  return {sums:frames.map(sum),changed,repeat,seedDiff,generated,undone,redone,premult:frames.every(d=>d.every((v,i)=>i%4===3||v<=d[i-i%4+3]))};
 });
 ok(data.sums[0]>20000,'visible initial burst');ok(data.sums[2]<data.sums[0]&&data.sums[4]<data.sums[2],'flash rapidly decays');ok(data.sums[6]===0,'last frame fully transparent');ok(data.changed>10000,'shape evolves over time');ok(data.repeat&&data.seedDiff,'repeatable seed and distinct variations');ok(data.premult,'valid premultiplied transparency');ok(data.generated===8&&data.undone===1&&data.redone===8,'frame generation supports undo and redo');
 const styles=await p.evaluate(()=>{
  const G=__gs,T=G.makeTarget(256,256,8),o=G.vfxOpts(18);
  const render=(burst,t,smoke=0)=>{o.burst=burst;o.smoke=smoke;G.vfxGenInto(T,o,t,null);return G.readRGBA8(T);};
  const stats=d=>{let left=0,right=0,up=0,down=0,total=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++){const a=d[(y*256+x)*4+3];total+=a;if(x<110)left+=a;if(x>146)right+=a;if(y<110)up+=a;if(y>146)down+=a;}return {left,right,up,down,total};};
  const directional=stats(render(0,.08)),outward=stats(render(1,.08)),front=stats(render(2,.08));
  const dry=stats(render(0,.6)),smoky=stats(render(0,.6,.8)),end=stats(render(1,1,.8));
  o.flashTime=.2;const short=stats(render(0,.3));o.flashTime=1;const long=stats(render(0,.3));
  return {directional,outward,front,dry,smoky,end,short,long};
 });
 ok(styles.directional.right>styles.directional.left*4,'directional flash extends forward');
 ok(['left','right','up','down'].every(k=>styles.outward[k]>1000),'outward burst radiates in all directions');
 ok(styles.front.total>1000&&styles.front.total<styles.outward.total,'front-facing flash is compact');
 ok(styles.smoky.total>styles.dry.total*2&&styles.end.total===0,'optional smoke lingers and ends transparent');
 ok(styles.short.total<styles.long.total*.1,'flash duration shortens the burst');
 await p.locator('#muzzleContact').screenshot({path:path.resolve(__dirname,'out/muzzle-flash-contact.png')});
 await p.evaluate(()=>document.querySelector('#muzzleContact').remove());await p.evaluate(()=>__gs.dlgGenerate(18));
 ok(await p.getByText('Flame breakup',{exact:true}).isVisible(),'muzzle-specific controls');await p.selectOption('#vgBurst','1');ok(await p.getByText('Burst radius',{exact:true}).isVisible(),'outward controls update');
 await p.selectOption('#vgMuzzlePreset','4');ok(Number(await p.locator('#vgSmoke').inputValue())>.5,'smoky preset enables smoke');
 await p.locator('#modal').screenshot({path:path.resolve(__dirname,'out/muzzle-controls.png')});
 ok(await p.evaluate(()=>{const r=document.querySelector('#dlgOk').getBoundingClientRect();return r.bottom<=innerHeight;}),'Make frames fits on screen');await p.click('#dlgCancel');
 ok(!errs.length,'no application or shader errors '+errs.join(' | '));console.log(JSON.stringify(data));await b.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});


