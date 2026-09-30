/* 0.28: Decals: click a decal, click the model; a movable sticker layer with colour, height, roughness, metal */
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
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'vp',false,'pbr'));await W(300);
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 ok(await p.evaluate(()=>{const e=document.getElementById('vpStrip');return !!e&&!e.hidden;}),'the viewport strip shows in 3D Paint');
 const paneW=()=>p.evaluate(()=>({p:document.getElementById('pane3d').getBoundingClientRect().width,w:document.getElementById('work').getBoundingClientRect().width,hid:document.getElementById('pane3d').hidden}));
 await p.click('#vp_split');await W(700);let a=await paneW();
 ok(!a.hid&&Math.abs(a.p/a.w-.5)<.06,'Split starts with the two views about the same size ('+Math.round(a.p)+' of '+Math.round(a.w)+')');
 ok(await p.evaluate(()=>document.getElementById('vp_split').getAttribute('aria-pressed')==='true'),'the Split button is lit');
 ok(await p.evaluate(()=>__gs.v3s().showUV===true),'the UV layout is on by default');
 // drag the divider
 const sb=await p.locator('#split3d').boundingBox();await p.mouse.move(sb.x+3,sb.y+sb.height/2);await p.mouse.down();await p.mouse.move(sb.x+160,sb.y+sb.height/2,{steps:6});await p.mouse.up();await W(400);
 let b2=await paneW();ok(b2.p>a.p+100,'dragging the divider makes the 3D view bigger ('+Math.round(a.p)+' → '+Math.round(b2.p)+')');
 await p.click('#vp_2d');await W(600);let c=await paneW();ok(c.hid||c.p<5,'2D hides the 3D view');
 await p.click('#vp_3d');await W(600);c=await paneW();ok(!c.hid&&c.p>c.w-5,'3D fills the area');
 await p.click('#vp_uv');await W(300);ok(await p.evaluate(()=>__gs.v3s().showUV===false),'the UV button turns the layout off');
 // eyeball on texture sets
 await p.evaluate(()=>{const o='v -2 -1 0\nv -0.1 -1 0\nv -0.1 1 0\nv -2 1 0\nv 0.1 -1 0\nv 2 -1 0\nv 2 1 0\nv 0.1 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Left\nf 1/1 2/2 3/3 4/4\nusemtl Right\nf 5/1 6/2 7/3 8/4\n';
   __gs.useModel(__gs.parseOBJ(o,'two.obj'));});await W(900);
 await p.evaluate(()=>__gs.showPanel('p3d'));await W(400);
 ok(await p.evaluate(()=>document.querySelectorAll('.p3set .p3eye').length)===2,'each texture set has an eyeball');
 ok(await p.evaluate(()=>__gs.p3DrawList().length)===2,'both sets are drawn');
 await p.locator('.p3set').nth(1).locator('.p3eye').click();await W(400);
 ok(await p.evaluate(()=>__gs.p3DrawList().length===1&&__gs.p3.sets[1].hidden===true),'hiding the second set leaves one to draw');
 await p.locator('.p3set').nth(1).locator('.p3eye').click();await W(300);
 ok(await p.evaluate(()=>__gs.p3DrawList().length)===2,'showing it brings it back');
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));
 console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();process.exit(fails?1:0);})();
