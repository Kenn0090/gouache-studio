/* 0.62: Relight with several lights, point / spot / sun, shadows, shine, rim light, coloured ambient and ready-made lightings */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:950}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 await p.click('#modeTabs [data-mode="photo"]');await p.waitForTimeout(600);
 await p.evaluate(async()=>{const W=640,H=480,c=new OffscreenCanvas(W,H),x=c.getContext('2d');x.fillStyle='#808080';x.fillRect(0,0,W,H);
   await __gs.phAddFiles([new File([await c.convertToBlob({type:'image/png'})],'b.png',{type:'image/png'})]);});await p.waitForTimeout(1000);
 // depth: a floor with a tall block in the middle (near = high)
 await p.evaluate(()=>{const w=160,h=120,f=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const u=x/w,v=y/h,e=Math.max(Math.abs(u-.5)-.1,Math.abs(v-.5)-.15),k=Math.max(0,Math.min(1,.5-e*40));f[y*w+x]=.15+.7*k;}
   const u8=new Uint8Array(w*h);for(let i=0;i<w*h;i++)u8[i]=Math.round(f[i]*255);__gs.phP().depth={w,h,data:u8,f,v:1};});
 const setR=fn=>p.evaluate(fn=>{const S=__gs.phClone(__gs.phS());const R=S.relight;R.on=true;eval('('+fn+')')(R);__gs.phApply(S,'relight');},fn.toString()).then(()=>p.waitForTimeout(700));
 const px=(u,v)=>p.evaluate(([u,v])=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out),W=__gs.ph.out.w,H=__gs.ph.out.h,i=((Math.round(v*H))*W+Math.round(u*W))*4;return [d[i],d[i+1],d[i+2]];},[u,v]);
 const lum=c=>.2126*c[0]+.7152*c[1]+.0722*c[2];
 const base=R=>{Object.assign(R,{x:.1,y:.5,z:.4,int:90,rad:80,hue:40,sat:0,amb:30,dep:60,type:0,shad:0,shine:0,rim:0,ambS:0,more:[]});};
 await setR(R=>{Object.assign(R,{x:.1,y:.5,z:.4,int:90,rad:80,hue:40,sat:0,amb:30,dep:60,type:0,shad:0,shine:0,rim:0,ambS:0,more:[]});});
 const one=await px(.9,.8);
 // a second light on the right brightens the right side
 await setR(R=>{R.more=[{on:true,type:0,x:.9,y:.5,z:.4,int:90,rad:80,hue:40,sat:0,ax:.5,ay:.5,cone:45,soft:40}];});
 const two=await px(.9,.8);ok(lum(two)>lum(one)+8,'a second light brightens its side ('+lum(one).toFixed(0)+' → '+lum(two).toFixed(0)+')');
 await setR(R=>{R.more[0].on=false;});const off=await px(.9,.8);ok(Math.abs(lum(off)-lum(one))<4,'turning that light off brings the first look back');
 await setR(R=>{R.more=[];});
 // sun: even light from one side, no falloff (far points about as bright as near ones)
 await setR(R=>{Object.assign(R,{type:2,x:.05,y:.5,ax:.5,ay:.5,z:.5,int:100});});
 const sNear=await px(.15,.85),sFar=await px(.85,.85);ok(Math.abs(lum(sNear)-lum(sFar))<10,'the sun lights near and far alike ('+lum(sNear).toFixed(0)+' / '+lum(sFar).toFixed(0)+')');
 // shadows: low sun from the left, the floor behind the block turns dark
 await setR(R=>{Object.assign(R,{type:2,x:.02,y:.5,ax:.5,ay:.5,z:.05,int:110,shad:0});});
 const noSh=await px(.66,.5);await setR(R=>{R.shad=100;});const sh=await px(.66,.5),shLit=await px(.34,.5);
 ok(lum(sh)<lum(noSh)-15,'shadows darken the floor behind the block ('+lum(noSh).toFixed(0)+' → '+lum(sh).toFixed(0)+')');
 ok(lum(shLit)>lum(sh)+8,'and the lit side stays brighter than the shadow side ('+lum(shLit).toFixed(0)+' vs '+lum(sh).toFixed(0)+')');
 // spotlight: bright inside the cone, dark outside
 await setR(R=>{Object.assign(R,{type:1,x:.5,y:.05,ax:.2,ay:.8,z:.6,int:140,rad:200,cone:14,soft:20,shad:0,amb:50});});
 const inC=await px(.2,.8),outC=await px(.85,.8);ok(lum(inC)>lum(outC)+25,'a spotlight lights its cone and not the rest ('+lum(inC).toFixed(0)+' vs '+lum(outC).toFixed(0)+')');
 // shine adds a highlight
 await setR(R=>{Object.assign(R,{type:0,x:.5,y:.2,z:.5,int:25,rad:100,amb:30,shine:0,shad:0});});
 let mx0=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out);let m=0;for(let i=0;i<d.length;i+=4)m=Math.max(m,d[i]);return m;});
 await setR(R=>{R.shine=100;R.gloss=20;});
 let mx1=await p.evaluate(()=>{__gs.phViewTex();const d=__gs.readRGBA8(__gs.ph.out);let m=0;for(let i=0;i<d.length;i+=4)m=Math.max(m,d[i]);return m;});
 ok(mx1>mx0+10,'shine adds a highlight ('+mx0+' → '+mx1+')');
 // rim light lights the block's edge
 await setR(R=>{Object.assign(R,{shine:0,rim:0,type:0,x:.08,y:.5,z:.6,int:40,rad:150,amb:30});});
 const edge=async()=>{let m=0;for(const u of [.385,.395,.405,.415])m=Math.max(m,lum(await px(u,.5)));return m;};
 const noRim=await edge();await setR(R=>{R.rim=100;});const rim=await edge();ok(rim>noRim+6,'rim light brightens the block\'s edge that faces the light ('+noRim.toFixed(0)+' → '+rim.toFixed(0)+')');
 // coloured dark side
 await setR(R=>{Object.assign(R,{rim:0,type:2,x:.02,y:.5,ax:.5,ay:.5,z:.3,int:60,amb:60,ambH:220,ambS:100,sat:0});});
 const dk=await px(.9,.85);ok(dk[2]>dk[0]+10,'the dark side takes the chosen colour (blue: '+dk.join(',')+')');
 // ready-made lightings
 await p.evaluate(()=>__gs.phRelightPreset('Studio (two lights)'));await p.waitForTimeout(700);
 ok(await p.evaluate(()=>__gs.phS().relight.more.length===1&&__gs.phS().relight.on),'Studio makes two lights');
 await p.evaluate(()=>__gs.phRelightPreset('Neon'));await p.waitForTimeout(700);
 const nl=await px(.1,.8),nr=await px(.9,.8);ok(nl[0]>nl[1]+10&&nr[2]>nr[0]+10,'Neon: pink on the left, cyan on the right ('+nl.join(',')+' / '+nr.join(',')+')');
 await p.evaluate(()=>__gs.phRelightPreset('Golden hour'));await p.waitForTimeout(500);
 ok(await p.evaluate(()=>{const R=__gs.phS().relight;return R.type===2&&R.more.length===0&&R.shad>0;}),'Golden hour is one sun with shadows');
 // the panel: pick a light, add one, remove it
 await p.evaluate(()=>__gs.showPanel&&__gs.showPanel('photo'));await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('phLightPre')&&!!document.getElementById('phLightType')&&!!document.getElementById('phLightAdd')),'the panel has the ready-made list, the kind and Add a light');
 await p.evaluate(()=>document.getElementById('phLightAdd').click());await p.waitForTimeout(300);
 ok(await p.evaluate(()=>__gs.phS().relight.more.length===1&&!!document.getElementById('phLight1')&&!!document.getElementById('phLightDel')),'Add a light adds Light 2');
 await p.evaluate(()=>document.getElementById('phLightDel').click());await p.waitForTimeout(300);ok(await p.evaluate(()=>__gs.phS().relight.more.length===0),'Remove this light removes it');
 // the spotlight's aim square is drawn
 await p.evaluate(()=>{const S=__gs.phClone(__gs.phS());S.relight.type=1;__gs.phApply(S,'spot');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>/phlma/.test(document.getElementById('xfOv').innerHTML)),'a spotlight shows its aim square');
 // old files: height saved on the old 0–100 scale still works
 await p.evaluate(()=>{const S=__gs.phClone(__gs.phS());S.relight.z=35;S.relight.type=0;__gs.phApply(S,'old');});await p.waitForTimeout(500);
 ok(await p.evaluate(()=>{__gs.phViewTex();return __gs.readRGBA8(__gs.ph.out).length>0;}),'an old file with height 35 still renders');
 ok(!errs.length,'no page errors '+errs.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
