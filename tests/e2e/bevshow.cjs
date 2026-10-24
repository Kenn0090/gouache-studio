/* Renders a steel cube and two intersecting boxes with the Bevel shader off and on, into out/bevel-sheet-*.png */
const {chromium}=require('playwright');const OLD=__dirname+'/';
const only=process.argv[2];
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1100,height:760}})).newPage();
 await p.addInitScript(()=>{localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));});
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.addStyleTag({content:'#pane3d .v3bar,#pane3d .v3info,#pane3d .v3set,#pane3d .v3mir,.vpstrip,#pane3d .v3xtra{display:none!important}'});
 const boxes=(list)=>{let v=[],vt=['vt 0 0','vt 1 0','vt 1 1','vt 0 1'],vn=[],f=[],n=0,fn=0;
  list.forEach((B,bi)=>{const [cx,cy,cz,hx,hy,hz,ang]=B,c=Math.cos(ang),s=Math.sin(ang);const P=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([x,y,z])=>{const X=x*hx,Z=z*hz;return [cx+X*c+Z*s,cy+y*hy,cz-X*s+Z*c];});
   const base=n;P.forEach(q=>{v.push('v '+q.join(' '));n++;});f.push('o box'+bi);
   const faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]];
   for(const q of faces){const a=P[q[0]],b2=P[q[1]],d=P[q[3]];const e1=b2.map((x,i)=>x-a[i]),e2=d.map((x,i)=>x-a[i]);let nn=[e1[1]*e2[2]-e1[2]*e2[1],e1[2]*e2[0]-e1[0]*e2[2],e1[0]*e2[1]-e1[1]*e2[0]];const l=Math.hypot(...nn);nn=nn.map(x=>x/l);
     const mid=[0,1,2].map(i=>(q.reduce((t,k)=>t+P[k][i],0)/4)-[cx,cy,cz][i]);if(nn[0]*mid[0]+nn[1]*mid[1]+nn[2]*mid[2]<0){q.reverse();nn=nn.map(x=>-x);}
     vn.push('vn '+nn.join(' '));fn++;const i=q.map(k=>base+k+1);f.push('f '+i[0]+'/1/'+fn+' '+i[1]+'/2/'+fn+' '+i[2]+'/3/'+fn,'f '+i[0]+'/1/'+fn+' '+i[2]+'/3/'+fn+' '+i[3]+'/4/'+fn);}});
  return [...v,...vt,...vn,...f].join('\n');};
 const scenes={cube:()=>'cube',cross:()=>boxes([[0,0,0,1,1,1,0],[0.5,0.2,0.2,.55,1.5,.55,.7]])};
 const cfgs={cube:[['off',null],['round',{profile:'round',width:3}],['smooth-soft',{profile:'smooth',soft:.6,width:3}],['chamfer',{profile:'chamfer',width:3}]],
   cross:[['off',null],['meets',{profile:'round',width:3,isect:1}],['no-meets',{profile:'round',width:3,isect:0}],['strong-inner',{profile:'round',width:3,isect:1,concave:1.5}]]};
 for(const sc of ['cube','cross']){if(only&&only!==sc)continue;
  await p.evaluate(({sc,obj})=>{const G=__gs;G.closeWelcome();if(G.mode!=='p3d')G.setMode('p3d',true);if(sc==='cube')G.useModel(G.primMesh('cube',1));else G.useModel(G.parseOBJ(obj,'Intersect'));
   if(!G.doc.active||!G.doc.active.fill)G.cmdNewFillLayer({name:'Steel',maps:{base:{c:[.78,.8,.84]},metal:{v:1},rough:{v:.22}}});
   Object.assign(G.v3s(),{unlit:false,wire:false,spin:false,bg:'dark'});Object.assign(G.v3.cam,{yaw:.75,pitch:.5,dist:7});G.mir3.show=false;G.bvSettings().on=false;G.composite();G.v3Refresh();},{sc,obj:sc==='cross'?boxes([[0,0,0,1,1,1,0],[0.5,0.2,0.2,.55,1.5,.55,.7]]):''});
  await p.waitForTimeout(1500);
  const clip=await p.evaluate(()=>{const r=document.querySelector('#v3Hit').getBoundingClientRect();const s=Math.min(r.width,r.height,560);return {x:r.x+(r.width-s)/2,y:r.y+(r.height-s)/2,width:s,height:s};});
  for(const [name,o] of cfgs[sc]){
   await p.evaluate(o=>{const B=__gs.bvSettings();if(!o){B.on=false;__gs.bvChanged();return;}Object.assign(B,{on:true,preview:true,angle:30,samples:48,soft:0,convex:1,concave:1,isect:1,profile:'round'},o);__gs.bvChanged();},o);
   if(o)for(let i=0;i<150;i++){await p.waitForTimeout(1500);const t=await p.evaluate(()=>__gs.bvStatusText());console.log(sc,name,t);if(/ready/i.test(t))break;}
   await p.waitForTimeout(1500);await p.screenshot({path:'out/bevel-'+sc+'-'+name+'.png',clip});}}
 await b.close();})();
