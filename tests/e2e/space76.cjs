/* 0.76.2: "What's taking space" measures each picture as it would be saved, and the report says how big the model is */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http');
const root=path.resolve(__dirname,'../../dist');let fails=0;
const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}fs.createReadStream(f).pipe(res);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-precise-memory-info']}),p=await b.newPage({viewport:{width:1300,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(()=>{localStorage.setItem('gs.welcome','no');});await p.route('**/*',r=>r.request().url().startsWith(url)?r.continue():r.abort());
 await p.goto(url+'/index.html?debug');await p.waitForFunction(()=>window.__gs);await p.evaluate(()=>__gs.closeWelcome());
 const r=await p.evaluate(async()=>{const G=__gs;G.newDoc(96,96);G.cmdAddLayer();const A=G.doc.active;A.name='Noisy layer';const t=G.mapT(A,'base'),d=new Uint8Array(96*96*4);let s=7;for(let i=0;i<d.length;i+=4){s=(Math.imul(s,1664525)+1013904223)|0;d[i]=(s>>>24)&255;d[i+1]=(s>>>16)&255;d[i+2]=(s>>>8)&255;d[i+3]=255;}G.writeRegion(t,0,0,96,96,d);
  G.cmdAddMask(1);G.cmdAddLayer();G.doc.active.name='Empty layer';
  let wrote=0;const P=G.platform,old=P.writeFile;P.writeFile=async()=>{wrote++;};
  const list=await G.ghSpaceScan();P.writeFile=old;return {list,text:G.ghSpaceText(list),wrote};});
 ok(r.list.length>=2,'the scan lists the pictures ('+r.list.length+')');
 const noisy=r.list.find(x=>/Noisy layer · base/.test(x.label));ok(noisy&&noisy.bytes>4000,'the noisy layer colour picture is measured as big ('+(noisy&&noisy.bytes)+' bytes)');
 ok(r.list.some(x=>/Noisy layer · mask$/.test(x.label)),'its mask is listed');
 const empty=r.list.filter(x=>/Empty layer/.test(x.label));ok(!empty.length||empty.every(x=>x.bytes<2000),'an empty layer costs almost nothing');
 ok(/By kind:/.test(r.text)&&/Biggest pictures:/.test(r.text)&&/Noisy layer · base/.test(r.text),'the text groups by kind and names the biggest');
 ok(r.wrote===0,'nothing is written to disk by the scan');
 /* a 3D Paint project */
 const q=await p.evaluate(async()=>{const G=__gs;G.setMode('p3d',true);G.p3.savedAt=G.p3Sig();await G.p3NewProject(128,{modelKey:'plane'});G.useModel(G.primMesh('plane',1));const l=await G.ghSpaceScan();const rep=G.ghReportText(null);return {n:l.length,rep:rep.split('\n').filter(x=>/^Model:|^Page memory/.test(x))};});
 ok(q.n>=3,'a 3D Paint project is measured too ('+q.n+' pictures)');
 ok(q.rep.some(x=>/^Model: .* triangles/.test(x)),'the report says how big the model is ('+q.rep[0]+')');ok(q.rep.some(x=>/^Page memory now:/.test(x)),'and how much memory the page uses');
 /* the dialog */
 await p.evaluate(()=>__gs.dlgSpace());await p.waitForFunction(()=>/By kind/.test(document.querySelector('#modal pre')?.textContent||''),null,{timeout:60000});ok(true,'the space window shows the result');
 ok(!errors.length,'no application errors');if(errors.length)console.log(errors);
 await b.close();await new Promise(r=>server.close(r));process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
