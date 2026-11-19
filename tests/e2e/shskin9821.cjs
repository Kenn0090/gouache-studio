/* 0.98.21 (Georgian: "once he adjusts scatter depth it breaks", the lit shaders look unlit, toon still works): with one-channel grey maps (4096 px
   and up; __v3MonoPx forces them here) the Skin blur passes ran on the packed copy of the model's program and only the plain copy was set back,
   so every lit shader kept drawing the bare colour. Standard must look the same before and after Skin's Scatter Depth moves. */
const {chromium}=require('playwright');let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};const R={};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.text().slice(0,200));});
 await p.addInitScript(()=>{window.__v3MonoPx=1;try{localStorage.setItem('gs.p3d',JSON.stringify({size:256,layout:'3d'}));localStorage.setItem('gs.welcome','no');}catch(e){}});
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(300,200,8,[1,1,1],'painting',false));await p.waitForTimeout(300);
 await p.click('#modeTabs [data-mode=p3d]');await p.waitForTimeout(2500);const hb=await p.locator('#v3Hit').boundingBox();
 await p.evaluate(()=>{const g=__gs,s=g.v3s();s.model='sphere';g.v3.mesh=null;Object.assign(s,{envSun:1.3,envI:.6,sunAz:70,sunEl:35});Object.assign(g.v3.cam,{yaw:0,pitch:.15,dist:7,tx:0,ty:0,tz:0});g.v3.mapsDirty=true;g.v3.dirty=true;g.requestRender(true);});
 await p.waitForTimeout(3000);
 const shot=async n=>{await p.waitForTimeout(2500);const buf=await p.screenshot({clip:{x:hb.x+hb.width*.3,y:hb.y+hb.height*.12,width:hb.width*.4,height:hb.height*.76}});
   const st=await p.evaluate(b64=>new Promise(r=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const d=x.getImageData(0,0,c.width,c.height).data;let mn=999,mx=0;for(let i=0;i<d.length;i+=16){const l=(d[i]+d[i+1]+d[i+2])/3;if(l<25)continue;mn=Math.min(mn,l);mx=Math.max(mx,l);}r({min:Math.round(mn),max:Math.round(mx)});};im.src='data:image/png;base64,'+b64;}),buf.toString('base64'));console.log(n,JSON.stringify(st));R[n]=st;};
 const kind=async k=>{await p.evaluate(k=>{const s=document.getElementById('shKind');s.value=k;s.dispatchEvent(new Event('change'));},k);};
 await kind('std');await shot('std_before');
 await kind('skin');await shot('skin_before');
 /* move the Scatter Depth slider like a user */
 const ids=await p.evaluate(()=>[...document.querySelectorAll('[id^=sh_]')].map(e=>e.id+':'+e.tagName).slice(0,40));console.log(ids.join(' '));
 const r=await p.evaluate(()=>{const w=document.getElementById('sh_scatDepth');if(!w)return 'no slider';const inp=w.querySelector('input[type=range]')||w;inp.value='6';inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}));return JSON.stringify(__gs.v3ShadeOf?__gs.v3ShadeOf(__gs.doc):__gs.doc.v3shade);});console.log('after slider',r&&r.slice(0,600));
 await shot('skin_after');await kind('std');await shot('std_after');
 ok(R.std_before.max-R.std_before.min>120,'Standard is lit before ('+R.std_before.min+'–'+R.std_before.max+')');
 ok(Math.abs(R.std_after.max-R.std_before.max)<6&&Math.abs(R.std_after.min-R.std_before.min)<6,'Standard is still lit after moving Skin’s Scatter Depth ('+R.std_after.min+'–'+R.std_after.max+')');
 const bad=errs.filter(e=>!/ERR_FAILED|GPU stall|GL Driver Message/.test(e));ok(!bad.length,'no page errors '+bad.slice(0,3).join(' | '));await b.close();console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);})();
