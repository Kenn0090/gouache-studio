/* 0.95: line correction and smoothing on the main bar; the line is ironed out and still ends where the pen did. */
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
 await p.click('#obp_stroke');await p.waitForTimeout(300);ok(await p.locator('#ob_smoothing').count()===1&&await p.locator('#ob_correction').count()===1,'Smoothing and Correction are in the Stroke pop-up of the options bar');
 /* the function: a zig-zag comes out flatter and the last point is the end */
 const f=await p.evaluate(()=>{const s={};const pts=[];for(let i=0;i<60;i++)pts.push([i*4,(i%2?6:-6)]);let out=[];for(const q of pts)out.push(...__gs.corrFeed(s,q[0],q[1],1,40,false));out.push(...__gs.corrFeed(s,0,0,1,0,true,240,0));
   const mid=out.slice(5,out.length-5),amp=Math.max(...mid.map(q=>Math.abs(q[1])));return {n:out.length,amp,last:out[out.length-1],first:out[0],raw:6};});
 ok(f.amp<2.5,'a zig-zag of ±6 comes out at ±'+f.amp.toFixed(2));ok(f.last[0]===240&&f.last[1]===0,'the line ends where the pen ended '+JSON.stringify(f.last));ok(f.n>=60,'every point is painted in the end '+f.n);
 /* real strokes: a shaky line with and without correction */
 const box=await p.locator('#gl').boundingBox();
 const stroke=async(y0,corr)=>{await p.evaluate(c=>{__gs.brush.correction=c;__gs.brush.smoothing=0;__gs.brush.lazy=0;},corr);
   await p.mouse.move(box.x+120,y0);await p.mouse.down();for(let i=0;i<=80;i++){await p.mouse.move(box.x+120+i*6,y0+(i%2?7:-7));}await p.mouse.up();await p.waitForTimeout(200);};
 await stroke(box.y+200,0);await stroke(box.y+320,1);
 const rough=await p.evaluate(()=>{const L=__gs.doc.active,d=__gs.readRGBA8(__gs.mapT(L,'base')),W=__gs.doc.w,H=__gs.doc.h;
   const rows=[];for(let y=0;y<H;y++){let any=false;for(let x=0;x<W;x+=4)if(d[(y*W+x)*4]<110){any=true;break;}rows.push(any);}
   const groups=[];let st=-1;for(let y=0;y<=H;y++){if(y<H&&rows[y]){if(st<0)st=y;}else if(st>=0){groups.push([st,y]);st=-1;}}
   const merged=[];for(const g of groups){const l=merged[merged.length-1];if(l&&g[0]-l[1]<40)l[1]=g[1];else merged.push(g.slice());}
   const rms=([ya,yb])=>{const ys=[];for(let x=0;x<W;x+=3){let sw=0,sy=0;for(let y=ya;y<yb;y++){const a=255-d[(y*W+x)*4];if(a>145){sw+=a;sy+=a*y;}}if(sw>0)ys.push(sy/sw);}if(ys.length<8)return -1;let s=0,n=0;for(let i=1;i<ys.length-1;i++){const dd=ys[i-1]-2*ys[i]+ys[i+1];s+=dd*dd;n++;}return Math.sqrt(s/n);};
   return {bands:merged.length,groups:groups.slice(0,8),r:merged.map(rms),ink:rows.filter(Boolean).length};});
 console.log('roughness',JSON.stringify(rough));
 ok(rough.bands===2&&rough.r[0]>0&&rough.r[1]>=0&&rough.r[1]<rough.r[0]*0.35,'the corrected stroke is much smoother than the shaky one '+JSON.stringify(rough.r));
 ok(errs.length===0,'no errors '+errs.slice(0,2).join('|'));
 await b.close();process.exit(fails?1:0);})().catch(e=>{console.error(e);process.exit(1);});
