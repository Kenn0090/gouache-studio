/* 0.22: ID bake colours from separate meshes, materials, vertex colours or ZBrush polypaint. */
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
 const W=ms=>p.waitForTimeout(ms||200);
 const waitIdle=async()=>{for(let i=0;i<900;i++){if(await p.evaluate(()=>!__gs.bk.busy))return;await W(100);}};
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'painting',false));await p.click('#modeTabs [data-mode=bake]');await W(600);
 /* high-poly: two quads (objects A and B, materials Ma and Mb), vertex colours red/blue, polypaint green/yellow */
 await p.evaluate(()=>{const low='v -1 -1 0\nv 1 -1 0\nv 1 1 0\nv -1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n';
   const hi='v -1 -1 0 1 0 0\nv 0 -1 0 1 0 0\nv 0 1 0 1 0 0\nv -1 1 0 1 0 0\nv 0 -1 0 0 0 1\nv 1 -1 0 0 0 1\nv 1 1 0 0 0 1\nv 0 1 0 0 0 1\n#MRGB 0000ff000000ff000000ff000000ff00\n#MRGB 00ffff0000ffff0000ffff0000ffff00\no A\nusemtl Ma\nf 1 2 3 4\no B\nusemtl Mb\nf 5 6 7 8\n';
   const C=__gs.bakeCfg;C.low=__gs.parseOBJ(low,'q_low.obj');C.high=__gs.parseOBJ(hi,'q_high.obj');C.cage=null;C.size=64;C.ss=1;C.pad=2;C.front=20;C.back=20;C.match=false;C.perMat=false;for(const k in C.kinds)C.kinds[k]=k==='id';});
 const h=await p.evaluate(()=>{const H=__gs.bakeCfg.high;return {vc:!!H.vcol,pc:!!H.pcol,parts:H.partNames,mats:H.matNames};});
 ok(h.vc&&h.pc&&h.mats.join()==='Ma,Mb','the OBJ reader keeps vertex colours and polypaint '+JSON.stringify(h));
 const bake=async src=>{await p.evaluate(s=>{__gs.bakeCfg.idSrc=s;},src);await p.evaluate(()=>__gs.act('bake'));await W(200);await p.click('#bkGo');await W(300);await waitIdle();await W(200);
   return p.evaluate(()=>{const d=__gs.readRGBA8(__gs.bk.res.id),W=__gs.doc.w,px=(x,y)=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+3));return [px(16,32),px(48,32)];});};
 let r=await bake('vertex');ok(r[0][0]>200&&r[0][2]<60&&r[1][2]>200&&r[1][0]<60,'Vertex colours: red and blue '+JSON.stringify(r));
 r=await bake('poly');ok(r[0][1]>200&&r[0][0]<60&&r[1][0]>200&&r[1][1]>200&&r[1][2]<60,'Polypaint: green and yellow '+JSON.stringify(r));
 r=await bake('part');const d1=Math.abs(r[0][0]-r[1][0])+Math.abs(r[0][1]-r[1][1])+Math.abs(r[0][2]-r[1][2]);ok(d1>60,'Separate meshes: two different colours '+JSON.stringify(r));
 r=await bake('mat');const d2=Math.abs(r[0][0]-r[1][0])+Math.abs(r[0][1]-r[1][1])+Math.abs(r[0][2]-r[1][2]);ok(d2>60,'Materials: two different colours '+JSON.stringify(r));
 ok(await p.evaluate(()=>{const b=[...document.querySelectorAll('#bakeBody .seg button')].find(b=>b.textContent.startsWith('Other'));if(b)b.click();return !!document.querySelector('#bkIdSrc');}),'the Other tab offers the ID colour sources');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 /* an FBX with vertex colours loads (0.22 read the colour count too early) */
 const fbx=(()=>{const B=[];const u32=v=>{const b=Buffer.alloc(4);b.writeUInt32LE(v>>>0);return b;};
   const P={S:v=>Buffer.concat([Buffer.from('S'),u32(Buffer.byteLength(v)),Buffer.from(v)]),L:v=>{const b=Buffer.alloc(9);b[0]=76;b.writeBigInt64LE(BigInt(v),1);return b;},
     d:a=>{const b=Buffer.alloc(13+a.length*8);b[0]=100;b.writeUInt32LE(a.length,1);b.writeUInt32LE(a.length*8,9);a.forEach((v,i)=>b.writeDoubleLE(v,13+i*8));return b;},
     i:a=>{const b=Buffer.alloc(13+a.length*4);b[0]=105;b.writeUInt32LE(a.length,1);b.writeUInt32LE(a.length*4,9);a.forEach((v,i)=>b.writeInt32LE(v,13+i*4));return b;}};
   const node=(at,name,props,kids)=>{const pb=Buffer.concat(props);let o=at+13+name.length+pb.length;const kb=[];for(const k of kids||[]){const b=k(o);kb.push(b);o+=b.length;}
     if(kids&&kids.length){kb.push(Buffer.alloc(13));o+=13;}return Buffer.concat([u32(o),u32(props.length),u32(pb.length),Buffer.from([name.length]),Buffer.from(name),pb,...kb]);};
   const N=(name,props,kids)=>at=>node(at,name,props,kids);
   const head=Buffer.concat([Buffer.from('Kaydara FBX Binary  \0'),Buffer.from([0x1a,0]),u32(7400)]);
   const top=[N('Objects',[],[N('Geometry',[P.L(10),P.S('q\0\x01Geometry'),P.S('Mesh')],[N('Vertices',[P.d([-1,-1,0,1,-1,0,1,1,0,-1,1,0])]),N('PolygonVertexIndex',[P.i([0,1,2,-4])]),
       N('LayerElementColor',[],[N('MappingInformationType',[P.S('ByPolygonVertex')]),N('ReferenceInformationType',[P.S('Direct')]),N('Colors',[P.d([1,0,0,1,1,0,0,1,1,0,0,1,1,0,0,1])])])]),
     N('Model',[P.L(20),P.S('Quad\0\x01Model'),P.S('Mesh')],[])]),N('Connections',[],[N('C',[P.S('OO'),P.L(10),P.L(20)])])];
   let o=head.length;const parts=[head];for(const t of top){const b=t(o);parts.push(b);o+=b.length;}parts.push(Buffer.alloc(13),Buffer.alloc(200));return Buffer.concat(parts);})();
 const fr=await p.evaluate(async a=>{try{const m=await __gs.parseFBX(new Uint8Array(a).buffer,'vc.fbx');return {tris:m.idx.length/3,red:!!m.vcol&&m.vcol[0]>.9&&m.vcol[1]<.1};}catch(e){return String(e);}},[...fbx]);
 ok(fr&&fr.tris===2&&fr.red,'FBX with vertex colours loads '+JSON.stringify(fr));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
