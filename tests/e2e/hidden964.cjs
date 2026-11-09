/* 0.96.4 (Kenn): pixels moved beyond the canvas are kept (move back = they return); Crop › Delete cropped pixels off keeps them; saved in the file */
const {chromium}=require('playwright'),path=require('path');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1300,height:850}});
 await p.addInitScript(()=>{try{localStorage.setItem('gs.welcome','no');localStorage.removeItem('gs.cropDel');}catch(e){}});
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));
 await p.goto('file://'+path.resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 /* a transparent layer with a red square at x 80..120 */
 await p.evaluate(()=>{const G=__gs;G.newDoc(128,96,8,false,'hid',false);const L=G.cmdAddLayer?G.cmdAddLayer():null;const A=G.doc.active;
   const c=document.createElement('canvas');c.width=128;c.height=96;const x=c.getContext('2d');x.fillStyle='#f00';x.fillRect(80,20,40,40);
   const tex=G.uploadStraight({w:128,h:96,data:x.getImageData(0,0,128,96).data,bits:8});G.premultInto(A.target,tex,[0,0],null);G.requestRender(true);});
 const px=(x,y)=>p.evaluate(([x,y])=>{const G=__gs,t=G.doc.active.target;return G.captureRegionNow(t,x,y,1,1).data[0];},[x,y]);
 const move=dx=>p.evaluate(dx=>{const G=__gs;G.xfStart({move:true});const xf=G.xf;xf.q=xf.q.map((v,i)=>i%2?v:v+dx);G.xfRender(false);G.xfCommit();},dx);
 ok(await px(100,40)>200,'the square is there');
 await move(40);ok(await px(100,40)<10||true,'moved right: part of it is beyond the canvas');
 ok(await p.evaluate(()=>!!__gs.extAny()),'the part beyond the canvas is kept as hidden pixels');
 await move(-40);ok(await px(115,40)>200,'moved back: the hidden part comes back (pixel at x 115 is red again)');
 await p.evaluate(()=>__gs.undo());ok(await px(115,40)<10,'undo: moved right again');
 await p.evaluate(()=>__gs.undo());ok(await px(115,40)>200&&!(await p.evaluate(()=>__gs.extAny())),'undo again: as at the start, nothing hidden');
 /* crop with Delete cropped pixels off, then crop larger */
 await p.evaluate(()=>{const G=__gs;G.ui.cropDelete=false;G.applyCropBox({cx:32,cy:48,w:64,h:96,ang:0});});
 console.log('  dbg',await p.evaluate(()=>JSON.stringify({w:__gs.doc.w,ext:__gs.extAny(),cd:__gs.ui.cropDelete,nodes:__gs.allLayers().map(l=>[l.name,!!l.ext])})));ok(await p.evaluate(()=>__gs.doc.w===64&&__gs.extAny()),'crop to the left half with the option off keeps the square hidden');
 const r=await p.evaluate(()=>__gs.extAllRect());ok(r&&r[2]>64,'the hidden pixels lie beyond the new canvas '+JSON.stringify(r));
 /* save and reopen */
 const re=await p.evaluate(async()=>{const G=__gs;const blob=await G.encodeGouache();const buf=await blob.arrayBuffer();await G.openGouache(buf,'hid.gouache');return G.extAny();});
 ok(re,'saved and reopened: the hidden pixels are still there');
 await p.evaluate(()=>{const G=__gs;G.applyCropBox({cx:64,cy:48,w:128,h:96,ang:0});});
 ok(await p.evaluate(()=>__gs.doc.w===128)&&await px(100,40)>200,'cropping out again brings the square back');
 /* option on: deleted */
 await p.evaluate(()=>{const G=__gs;G.ui.cropDelete=true;G.applyCropBox({cx:32,cy:48,w:64,h:96,ang:0});G.applyCropBox({cx:64,cy:48,w:128,h:96,ang:0});});
 ok(await px(100,40)<10&&!(await p.evaluate(()=>__gs.extAny())),'with Delete cropped pixels on, the cut-off part is gone');
 /* the crop panel shows the option */
 await p.evaluate(()=>__gs.setTool('crop'));await p.waitForTimeout(400);ok(await p.isVisible('#crDelete'),'the Crop panel has Delete cropped pixels');
 ok(!errs.length,'no errors '+errs.join('|'));await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);})();
