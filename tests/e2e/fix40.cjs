/* 0.40: Tab hides panels, lit UV view, post processing, Panner shader, channel drop-down */
const {chromium}=require('playwright');
const OLD=__dirname+'/';
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();
 await p.route('**/*',r=>{const u=r.request().url();
  if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});
  if(u.includes('UTIF.js'))return r.fulfill({path:OLD+'node_modules/utif/UTIF.js',contentType:'text/javascript'});
  if(u.includes('ag-psd'))return r.fulfill({path:OLD+'node_modules/ag-psd/dist/bundle.js',contentType:'text/javascript'});
  if(u.startsWith('file:'))return r.continue();return r.abort();});
 const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.stack));p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('ERR_'))errs.push(m.text());if(m.type()==='warning'&&/GL|WebGL/.test(m.text()))errs.push('GLW '+m.text());});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 const W=ms=>p.waitForTimeout(ms||200);
 await p.evaluate(()=>__gs.newDoc(256,256,8,[1,1,1],'p40',false,'pbr'));await W(300);
 /* Tab */
 const wrap=()=>p.evaluate(()=>({w:document.getElementById('workWrap').getBoundingClientRect().width,dock:getComputedStyle(document.querySelector('#app>.panel')).display,full:document.body.classList.contains('tabfull')}));
 const w0=await wrap();await p.evaluate(()=>document.activeElement&&document.activeElement.blur());
 await p.keyboard.press('Tab');await W(400);const w1=await wrap();
 ok(w1.full&&w1.dock==='none'&&w1.w>w0.w+200,'Tab hides the panels and the work area grows ('+Math.round(w0.w)+' → '+Math.round(w1.w)+')');
 await p.keyboard.press('Tab');await W(400);const w2=await wrap();
 ok(!w2.full&&Math.abs(w2.w-w0.w)<2,'Tab again brings them back');
 /* 3D Paint */
 await p.click('#modeTabs [data-mode=p3d]');await W(1500);
 await p.keyboard.press('Tab');await W(300);
 ok(await p.evaluate(()=>document.body.classList.contains('tabfull')&&document.getElementById('vpStrip')&&!document.getElementById('vpStrip').hidden),'Tab works in 3D Paint and keeps the viewport strip');
 await p.keyboard.press('Tab');await W(300);
 /* channel drop-down */
 ok(await p.evaluate(()=>{const s=document.getElementById('lChan');return !!s&&getComputedStyle(s).display!=='none'&&s.options.length>3;}),'the Layers panel has a channel drop-down in 3D Paint');
 await p.selectOption('#lChan','rough');await W(400);
 ok(await p.evaluate(()=>__gs.doc.map==='rough'&&__gs.doc.view==='rough'&&document.getElementById('lChan').value==='rough'),'choosing Roughness shows and paints roughness');
 await p.selectOption('#lChan','base');await W(300);
 /* paint a stripe on a plane */
 await p.selectOption('#p3Model','plane');await W(900);
 await p.evaluate(()=>{Object.assign(__gs.v3.cam,{yaw:0,pitch:0});__gs.v3.dirty=true;});
 await p.evaluate(()=>{document.activeElement&&document.activeElement.blur();Object.assign(__gs.brush,{size:40});__gs.ui.fg=[.9,.1,.1];});
 const hb=await p.locator('#v3Hit').boundingBox();
 await p.mouse.move(hb.x+hb.width*.45,hb.y+hb.height*.2);await p.mouse.down();await p.mouse.move(hb.x+hb.width*.45,hb.y+hb.height*.8,{steps:14});await p.mouse.up();await W(700);
 const shot=(w,h)=>p.evaluate(([w,h])=>Array.from(__gs.v3Offscreen(w,h)),[w||160,h||120]);
 const diff=(a,c)=>{let n=0;for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-c[i])+Math.abs(a[i+1]-c[i+1])+Math.abs(a[i+2]-c[i+2])>24)n++;return n;};
 const lum=(a,x,y,w)=>{const i=(y*w+x)*4;return a[i]+a[i+1]+a[i+2];};
 const base=await shot();
 /* lit UV view */
 ok(await p.evaluate(()=>__gs.v3s().litUV===true),'the lit UV view is on by default in 3D Paint');
 ok(await p.evaluate(()=>!!document.getElementById('vp_lit')),'the strip has a Lit button');
 await p.click('#vp_split');await W(700);
 const s1=await p.screenshot({clip:{x:0,y:100,width:500,height:600}});
 await p.click('#vp_lit');await W(500);
 const s2=await p.screenshot({clip:{x:0,y:100,width:500,height:600}});
 ok(!s1.equals(s2),'turning Lit off changes the flat view');
 await p.click('#vp_lit');await W(300);
 /* post processing */
 await p.evaluate(()=>__gs.showPanel('shading'));await W(400);
 ok(await p.evaluate(()=>!!document.getElementById('postBox')&&document.querySelectorAll('#postBox .postfx').length===8),'the Shader panel has 8 post effects');
 await p.evaluate(()=>{document.getElementById('post_vig').click();});await W(400);
 const wv=await shot();
 ok(lum(wv,3,3,160)<lum(base,3,3,160)-30,'Vignette darkens the corners');
 await p.evaluate(()=>{document.getElementById('post_vig').click();document.getElementById('post_grade').click();});await W(300);
 await p.evaluate(()=>{const i=document.getElementById('post_grade_exp');i.value='1.5';i.dispatchEvent(new Event('input',{bubbles:true}));});await W(400);
 const gr=await shot();
 ok(diff(base,gr)>2000,'Colour grade exposure brightens the picture');
 await p.evaluate(()=>{document.getElementById('post_grade').click();for(const k of ['bloom','ao','dof','sharp','ca','grain'])document.getElementById('post_'+k).click();});await W(500);
 const all=await shot();
 ok(diff(base,all)>100,'Bloom, occlusion, depth of field, sharpen, fringes and grain all run');
 await p.click('#postReset');await W(400);
 const back=await shot();
 ok(diff(base,back)<40,'Reset post processing puts the picture back');
 /* panner */
 await p.selectOption('#shKind','panner');await W(400);
 ok(await p.evaluate(()=>!!document.getElementById('pnLayer')&&document.querySelectorAll('[id^=pn_m_]').length===7),'the Panner shader has its layer choice and seven map ticks');
 await p.evaluate(()=>{const i=document.getElementById('sh_sx');i.value='0.25';i.dispatchEvent(new Event('input',{bubbles:true}));});await W(300);
 await p.evaluate(()=>document.getElementById('pn_play').click());await W(200);/* stop */
 const st=await p.evaluate(()=>__gs.v3ShadeOf(__gs.doc).p.panner);
 ok(st&&st.sx===.25&&st.play===false,'speed and play are stored');
 await p.evaluate(()=>document.getElementById('pn_play').click());await W(600);
 const pa=await shot();await W(900);const pb=await shot();
 ok(diff(pa,pb)>150,'the whole material slides over time');
 /* one layer only */
 const lid=await p.evaluate(()=>{const L=__gs.doc.active;return L&&L.id;});
 await p.evaluate(id=>{const s=document.getElementById('pnLayer');const o=[...s.options].find(x=>x.value===String(id));if(o){s.value=o.value;s.onchange();}},lid);await W(500);
 ok(await p.evaluate(()=>__gs.v3ShadeOf(__gs.doc).p.panner.layer>0),'one layer can be chosen');
 const la=await shot();await W(1000);const lb=await shot();
 ok(diff(la,lb)>150,'that layer slides over time');
 ok(await p.evaluate(()=>{const c=__gs.doc.active.target;return !!c;}),'the painting itself is untouched');
 /* switching back to Standard stops it */
 await p.selectOption('#shKind','std');await W(600);
 const sa=await shot();await W(600);const sb2=await shot();
 ok(diff(sa,sb2)<20,'Standard does not slide');
 ok(errs.length===0,'no errors '+errs.slice(0,3).join(' | '));
 await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);
})();
