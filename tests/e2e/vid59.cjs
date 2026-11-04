/* Video export: frames with their holds become MP4 / WebM files (checked with VP9 and AV1, which every browser can encode). */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1400,height:900}})).newPage();
 await p.route('**/*',r=>r.request().url().startsWith('file:')?r.continue():r.abort());
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');
 await p.waitForFunction(()=>{const s=document.getElementById('splash');return !s||s.hidden||getComputedStyle(s).display==='none'||getComputedStyle(s).visibility==='hidden'||+getComputedStyle(s).opacity===0;},null,{timeout:60000});
 await p.waitForTimeout(800);
 const r=await p.evaluate(async()=>{const G=__gs;document.querySelector('.welcome')?.remove();G.newDoc(96,64,8,[1,1,1],'V',false,'hand');G.setMode('anim',true);await new Promise(r=>setTimeout(r,500));
  for(let i=1;i<5;i++)G.addFrame();G.anim.frames.forEach((F,i)=>{G.clearTarget(G.frameLayer(F).target,[i/4,1-i/4,.5,1]);F.hold=i===2?3:1;});G.anim.fps=10;
  const out={};for(const fmt of ['mp4-vp9','webm-vp9','webm-av1']){const res=await G.vidEncode({fmt,scale:.5,quality:'med',tag:-1,loops:2,bg:'#ffffff'}),buf=new Uint8Array(await res.blob.arrayBuffer());
   out[fmt]={n:res.frames,w:res.w,h:res.h,head:[...buf.slice(0,12)],size:buf.length};
   if(fmt==='mp4-vp9'){const dv=new DataView(buf.buffer);let off=0,boxes=[];while(off<buf.length){const sz=dv.getUint32(off),t=String.fromCharCode(...buf.slice(off+4,off+8));boxes.push(t);off+=sz||buf.length;}out[fmt].boxes=boxes;}}
  return out;});
 ok(r['mp4-vp9'].n===10&&r['mp4-vp9'].w===48&&r['mp4-vp9'].h===32,'2 loops of 5 frames, half size ('+r['mp4-vp9'].n+')');
 ok(JSON.stringify(r['mp4-vp9'].boxes)==='["ftyp","moov","mdat"]','the MP4 has ftyp, moov, mdat in that order '+JSON.stringify(r['mp4-vp9'].boxes));
 ok(r['webm-vp9'].head[0]===0x1a&&r['webm-vp9'].head[1]===0x45&&r['webm-vp9'].head[2]===0xdf&&r['webm-vp9'].head[3]===0xa3,'the WebM starts with the EBML header');
 ok(r['webm-av1'].size>200,'AV1 WebM is made too ('+r['webm-av1'].size+' bytes)');
 await p.evaluate(()=>__gs.act('expVideo'));await p.waitForTimeout(500);
 ok(await p.evaluate(()=>document.querySelector('#dlgTitle').textContent)==='Export video'&&!!(await p.$('#vidFmt')),'File › Export animation video opens the window');
 ok(errs.length===0,'no page errors '+errs.slice(0,2).join('|'));
 await b.close();console.log(fails?'FAILED':'ALL PASS');process.exit(fails?1:0);
})();
