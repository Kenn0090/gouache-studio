const {chromium}=require('playwright');
const OLD=__dirname+'/';
const OUT=__dirname+'/out/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLWARN '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const box=await p.locator('#gl').boundingBox();
 const scr=async(x,y)=>{const v=await p.evaluate(()=>({x:__gs.view.x,y:__gs.view.y,z:__gs.view.zoom}));return [box.x+v.x+x*v.z,box.y+v.y+y*v.z];};
 const drag=async(x0,y0,x1,y1,opts={})=>{const a=await scr(x0,y0),c=await scr(x1,y1);await p.mouse.move(a[0],a[1]);await p.mouse.down();await p.mouse.move(c[0],c[1],{steps:opts.steps||8});await p.mouse.up();await p.waitForTimeout(120);};
 const mpx=(name,k,pts)=>p.evaluate(([name,k,pts])=>{const L=__gs.layerByName(name),t=__gs.mapT(L,k);if(!t||t.empty)return null;const d=__gs.readRGBA8(t),W=__gs.doc.w;return pts.map(([x,y])=>Array.from(d.slice((y*W+x)*4,(y*W+x)*4+4)));},[name,k,pts]);
 const setFG=async hx=>{await p.fill('#hex',hx);await p.press('#hex','Enter');};

 const S=__dirname+'/';
 await p.keyboard.press('Control+Alt+n');await p.waitForTimeout(200);
 await p.fill('#dW','512');await p.fill('#dH','512');await p.click('button.chip:has-text("PBR")');await p.click('#dlgOk');await p.waitForTimeout(400);
 await p.evaluate(()=>{__gs.act('clouds');});await p.waitForTimeout(200);await p.click('#dlgOk');await p.waitForTimeout(200);
 await p.keyboard.press('b');await p.evaluate(()=>__gs.showPanel('tool'));await p.check('#mb_height');await p.check('#mb_rough');await p.check('#mb_metal');
 await p.evaluate(()=>{const m=__gs.ui.mapBrush;m.height.v=1;m.rough.v=.2;m.metal.v=1;__gs.brush.size=60;__gs.brush.hardness=.7;});
 await setFG('#d0a040');await drag(80,256,430,256,{steps:12});await drag(256,80,256,430,{steps:12});
 await p.keyboard.press('F3');await p.waitForTimeout(700);
 ok(await p.evaluate(()=>!document.querySelector('#pane3d').hidden),'3D pane open');
 await p.screenshot({path:OUT+'v3-plane.png'});
 await p.selectOption('#v3Model','rcube');await p.waitForTimeout(500);
 const pb=await p.locator('#v3Hit').boundingBox();await p.mouse.move(pb.x+pb.width/2,pb.y+pb.height/2);await p.mouse.down();await p.mouse.move(pb.x+pb.width/2+120,pb.y+pb.height/2+60,{steps:5});await p.mouse.up();await p.waitForTimeout(300);
 await p.screenshot({path:OUT+'v3-cube.png'});
 await p.selectOption('#v3Model','sphere');await p.click('#v3Wire');await p.waitForTimeout(400);await p.screenshot({path:OUT+'v3-sphere.png'});await p.click('#v3Wire');
 await p.click('#v3UV');await p.waitForTimeout(300);await p.screenshot({path:OUT+'v3-uv.png'});await p.click('#v3UV');
 // paint while 3D open → updates
 await drag(100,100,150,150);await p.waitForTimeout(300);
 await p.selectOption('#v3Model','plane');await p.click('#v3Gear');await p.evaluate(()=>{const s=document.querySelector('#v3Disp');s.value=.6;s.dispatchEvent(new Event('input'));const d=document.querySelector('#v3Det');d.value='5';d.dispatchEvent(new Event('change'));});await p.waitForTimeout(500);await p.waitForTimeout(400);
 const pb2=await p.locator('#v3Hit').boundingBox();await p.mouse.move(pb2.x+pb2.width/2,pb2.y+pb2.height/2);await p.mouse.down();await p.mouse.move(pb2.x+pb2.width/2+30,pb2.y+pb2.height/2+90,{steps:5});await p.mouse.up();await p.waitForTimeout(300);
 await p.screenshot({path:OUT+'v3-disp.png'});console.log('INFO',await p.textContent('#v3Info'));console.log('GEAR',await p.evaluate(()=>{const g=document.querySelector('#v3Gear');const r=g.getBoundingClientRect();return 1;}));await p.click('#v3Gear',{force:true});
 // imports via file chooser
 for(const f of ['samba.fbx','pyr.glb','box.obj'].filter(f=>require('fs').existsSync(S+'fixtures/'+f))){const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.selectOption('#v3Model','__import')]);await fc.setFiles(S+'fixtures/'+f);await p.waitForTimeout(600);
   const inf=await p.textContent('#v3Info');ok(/triangles/.test(inf),'imported '+f+': '+inf);if(f==='samba.fbx')await p.screenshot({path:OUT+'v3-fbx.png'});}
 await p.screenshot({path:OUT+'v3-obj.png'});
 await p.evaluate(async()=>{__gs.doc.v3d.uvs=3;const b=await __gs.encodeGouache();window.__gbuf=await b.arrayBuffer();});
 await p.evaluate(()=>__gs.newDoc(64,64,8,[1,1,1],'x',false));await p.evaluate(async()=>{await __gs.openGouache(window.__gbuf,'t');});await p.waitForTimeout(600);
 const rt=await p.evaluate(()=>[__gs.doc.v3d&&__gs.doc.v3d.uvs,document.querySelector('#v3Model').value,document.querySelector('#v3Info').textContent]);ok(rt[0]===3&&rt[1]==='imported'&&/box/.test(rt[2]),'3D settings and model saved in .gouache '+JSON.stringify(rt));
 // 2D still paints where expected (stage narrower)
 const w=await p.evaluate(()=>[document.querySelector('#stage').clientWidth,document.querySelector('#work').clientWidth]);ok(w[0]<w[1],'stage narrower than work '+w);
 const [pop]=await Promise.all([p.waitForEvent('popup'),p.click('#v3Pop')]);await p.waitForTimeout(1200);
 ok(await p.evaluate(()=>document.querySelector('#pane3d').hidden),'pane hidden while popped out');
 let pix;for(let i=0;i<20;i++){pix=await pop.evaluate(()=>{const c=document.querySelector('canvas');const d=c.getContext('2d').getImageData(c.width/2,c.height/2,1,1).data;return [c.width,c.height,...d];});if(pix[5]===255)break;await p.waitForTimeout(500);}
 ok(pix[0]>100&&pix[5]===255&&(pix[2]+pix[3]+pix[4])>30,'popup shows the model '+JSON.stringify(pix));
 await pop.screenshot({path:OUT+'v3-pop.png'});
 await pop.click('#v3Pop');await p.waitForTimeout(500);ok(await p.evaluate(()=>!document.querySelector('#pane3d').hidden),'docked back');
 await p.keyboard.press('F3');await p.waitForTimeout(300);ok(await p.evaluate(()=>document.querySelector('#pane3d').hidden),'closed');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join('\n'));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();})();
