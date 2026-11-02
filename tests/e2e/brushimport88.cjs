/* 0.88.1: importing Procreate (.brush, .brushset) and Clip Studio (.sut) brushes, and pressure for the mouse. The test builds its own small files:
   a zip with a tip picture and a Procreate-style settings file (made with Python's binary plist writer), and a database-like file with pictures inside. */
const {chromium}=require('/home/user/gouache-studio/tests/e2e/node_modules/playwright');const zlib=require('zlib');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
const ARCH_B64='YnBsaXN0MDDUAQIDBAUGLjFZJGFyY2hpdmVyWCRvYmplY3RzVCR0b3BYJHZlcnNpb25fEA9OU0tleWVkQXJjaGl2ZXKvEBAHCBscIiMkJSYnKCkqKywtVSRudWxs0wkKCwwNFFYkY2xhc3NXTlMua2V5c1pOUy5vYmplY3RzgAOmDg8QERITgASABYAGgAeACIAJphUWFxgZGoAKgAuADIANgA6AD1Z1bnVzZWTSHR4fIFgkY2xhc3Nlc1okY2xhc3NuYW1loiAhXE5TRGljdGlvbmFyeVhOU09iamVjdFRuYW1lW3Bsb3RTcGFjaW5nXnNoYXBlUm91bmRuZXNzXxAUZHluYW1pY3NQcmVzc3VyZVNpemVabWF4T3BhY2l0eVpzaGFwZUNvdW50XVRlc3QgQ2hhcmNvYWwjP8cKPXCj1wojP+MzMzMzMzMjP+gAAAAAAAAjP+mZmZmZmZoQA9EvMFRyb290gAESAAGGoAAIABEAGwAkACkAMgBEAFcAXQBkAGsAcwB+AIAAhwCJAIsAjQCPAJEAkwCaAJwAngCgAKIApACmAK0AsgC7AMYAyQDWAN8A5ADwAP8BFgEhASwBOgFDAUwBVQFeAWABYwFoAWoAAAAAAAACAQAAAAAAAAAyAAAAAAAAAAAAAAAAAAABbw==';
const crcT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc=b=>{let c=0xFFFFFFFF;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;};
function png(w,h,fn,gray=true){const raw=Buffer.alloc((w*(gray?1:3)+1)*h);let o=0;for(let y=0;y<h;y++){raw[o++]=0;for(let x=0;x<w;x++){const v=fn(x,y);if(gray)raw[o++]=v[0];else{raw[o++]=v[0];raw[o++]=v[1];raw[o++]=v[2];}}}
  const chunk=(t,d)=>{const b=Buffer.alloc(12+d.length);b.writeUInt32BE(d.length,0);b.write(t,4);d.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,8+d.length)),8+d.length);return b;};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=gray?0:2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
function zip(files){const parts=[],cd=[];let off=0;for(const [name,data] of files){const nb=Buffer.from(name),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt32LE(crc(data),14);h.writeUInt32LE(data.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(nb.length,26);
    parts.push(h,nb,data);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50,0);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt32LE(crc(data),16);c.writeUInt32LE(data.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(nb.length,28);c.writeUInt32LE(off,42);cd.push(c,nb);off+=30+nb.length+data.length;}
  const cdb=Buffer.concat(cd),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50,0);e.writeUInt16LE(files.length,8);e.writeUInt16LE(files.length,10);e.writeUInt32LE(cdb.length,12);e.writeUInt32LE(off,16);return Buffer.concat([...parts,cdb,e]);}
(async()=>{
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:1000}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>window.__gs&&__gs.newDoc,null,{timeout:60000});await p.waitForTimeout(1500);
 await p.evaluate(()=>{const w=document.querySelector('.welcome');if(w)w.remove();});
 await p.evaluate(()=>__gs.newDoc(300,300,8,[1,1,1],'Imp',false,'hand'));await p.waitForTimeout(300);
 // the settings reader
 const arch=await p.evaluate(b64=>{const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return __gs.bpUnarchive(__gs.bpParse(u8));},ARCH_B64);
 console.log('settings read:',JSON.stringify(arch));
 ok(arch&&arch.name==='Test Charcoal'&&Math.abs(arch.plotSpacing-.18)<1e-6&&arch.shapeCount===3,'the binary settings file is read (name, spacing, count)');
 // a Procreate brush: a dark round tip on white (greyscale), plus its settings
 const tip=png(64,64,(x,y)=>{const d=Math.hypot(x-31.5,y-31.5);return [d<26?30:255];});
 const brush=zip([['Shape.png',tip],['Brush.archive',Buffer.from(ARCH_B64,'base64')],['Grain.png',png(16,16,()=>[200])]]);
 const sets0=await p.evaluate(()=>__gs.library.length);
 const n1=await p.evaluate(async b64=>{const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return await __gs.importBrushFile(new File([u8],'Charcoal.brush'));},brush.toString('base64'));
 const got=await p.evaluate(()=>{const s=__gs.library[__gs.library.length-1];const q=s.presets[0];return {sets:__gs.library.length,name:q.name,spacing:q.spacing,roundness:q.roundness,count:q.count,pSize:q.pSize,tip:!!q.tip,opacity:q.opacity,tw:q.tip&&q.tip.w};});
 console.log('imported:',JSON.stringify(got));
 ok(n1===1&&got.sets===sets0+1&&got.tip,'a .brush file adds a brush with its tip picture');
 ok(got.name==='Test Charcoal'&&Math.abs(got.spacing-.18)<.001&&Math.abs(got.opacity-.8)<.001&&got.count===3&&got.pSize===true,'its name, spacing, opacity, count and pressure setting come across');
 // a brushset with two brushes in folders
 const set=zip([['AAAA/Shape.png',tip],['AAAA/Brush.archive',Buffer.from(ARCH_B64,'base64')],['Chalk/Shape.png',png(48,48,(x,y)=>[Math.abs(x-24)<10?20:255])]]);
 const n2=await p.evaluate(async b64=>{const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return await __gs.importBrushFile(new File([u8],'Set.brushset'));},set.toString('base64'));
 ok(n2===2,'a .brushset with two brushes adds both ('+n2+')');
 // a Clip Studio file: a database-like blob with a greyscale tip, a colour thumbnail and noise around them
 const noise=Buffer.from(Array.from({length:300},(_,i)=>(i*37)%251));
 const sut=Buffer.concat([Buffer.from('SQLite format 3\0'),noise,png(40,40,(x,y)=>[Math.hypot(x-19.5,y-19.5)<15?0:255]),noise,png(32,32,(x,y)=>[(x*8)%256,(y*8)%256,128],false),noise]);
 const n3=await p.evaluate(async b64=>{const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));return await __gs.importBrushFile(new File([u8],'Pencil.sut'));},sut.toString('base64'));
 ok(n3===1,'a .sut file gives its greyscale tip and skips the colour thumbnail ('+n3+')');
 // an empty zip gives a clear error
 const err=await p.evaluate(async b64=>{try{const u8=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));await __gs.importBrushFile(new File([u8],'Empty.brush'));return '';}catch(e){return e.message;}},zip([['readme.txt',Buffer.from('hi')]]).toString('base64'));
 ok(/No brush tips/.test(err),'a file with no brushes gives a clear message ('+err+')');
 // pressure without a pen
 const pr=await p.evaluate(()=>{const P={sim:{x:0,y:0,t:0,spd:0,travel:0,pen:false}},b=__gs.brush;b.size=50;b.simP='speed';const slow=[],fast=[];
   for(let i=1;i<=12;i++)slow.push(__gs.simPress(P,i*2,0,i*16,1));const Q={sim:{x:0,y:0,t:0,spd:0,travel:0,pen:false}};for(let i=1;i<=12;i++)fast.push(__gs.simPress(Q,i*60,0,i*16,1));
   b.simP='taper';const T={sim:{x:0,y:0,t:0,spd:0,travel:0,pen:false}},tp=[];for(let i=1;i<=10;i++)tp.push(__gs.simPress(T,i*20,0,i*16,1));
   b.simP='fixed';b.simLevel=.4;const fx=__gs.simPress({sim:{x:0,y:0,t:0,spd:0,travel:0,pen:false}},10,0,16,1);
   b.simP='speed';const pen=__gs.simPress({sim:{x:0,y:0,t:0,spd:0,travel:0,pen:true}},50,0,16,.66);b.simP='off';return {slow:slow[11],fast:fast[11],t0:tp[0],t9:tp[9],fx,pen};});
 console.log('simulated pressure:',JSON.stringify(pr));
 ok(pr.slow>pr.fast+.3,'speed: slow movement gives more pressure than fast movement');
 ok(pr.t9>pr.t0+.3,'taper: pressure grows along the start of a stroke');
 ok(Math.abs(pr.fx-.4)<.01,'fixed: the chosen level is used');
 ok(Math.abs(pr.pen-.66)<.001,'a real pen is never changed');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
