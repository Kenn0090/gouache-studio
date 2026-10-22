/* 0.65.1: Window scale (desktop zoom, stubbed here), Preferences choice and View menu */
const {chromium}=require('playwright');
let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1440,height:900}})).newPage();
 const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(3500);await p.evaluate(()=>document.querySelector('.welcome')?.remove());
 ok(await p.evaluate(()=>typeof __gs.uiScaleSet==='function'||true),'loaded');
 // a pretend desktop window that records the zoom it is given
 await p.evaluate(()=>{window.__zoom=[];window.__TAURI__={webview:{getCurrentWebview:()=>({setZoom:async f=>{window.__zoom.push(f);}})},core:{invoke:async()=>{}}};});
 ok(await p.evaluate(()=>typeof __gs.uiScaleApply==='function'),'the window scale code is there');
 await p.evaluate(()=>{__gs.platform.isDesktop=true;});
 await p.evaluate(()=>__gs.uiScaleSet(1.25,true));ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===1.25&&__gs.prefs.uiScale===1.25),'125% sets the window zoom and is remembered');
 await p.evaluate(()=>__gs.uiScaleStep(1));ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===1.5),'Larger steps up to 150%');
 await p.evaluate(()=>__gs.uiScaleStep(-1));await p.evaluate(()=>__gs.uiScaleStep(-1));ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===1.1),'Smaller steps down');
 await p.evaluate(()=>__gs.uiScaleSet(1,true));ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===1&&__gs.prefs.uiScale===undefined),'100% puts it back (nothing stored)');
 // the View menu and Preferences
 ok(await p.evaluate(()=>__gs.MENUS.View.some(m=>Array.isArray(m)&&m[0]==='Window scale')),'View › Window scale is in the menu');
 await p.evaluate(()=>__gs.dlgPrefs('look'));await p.waitForTimeout(300);
 ok(await p.evaluate(()=>[...document.querySelectorAll('.prefpanel .sub')].some(e=>e.textContent==='Window scale')&&[...document.querySelectorAll('.prefpanel .segb')].some(e=>e.textContent==='150%')),'Preferences › Look has a Window scale choice');
 await p.evaluate(()=>{[...document.querySelectorAll('.prefpanel .segb')].find(e=>e.textContent==='150%').click();});await p.click('#dlgOk');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===1.5),'choosing 150% in Preferences and saving applies it');
 // exact percentage
 await p.evaluate(()=>__gs.dlgPrefs('look'));await p.waitForTimeout(300);
 ok(await p.evaluate(()=>!!document.getElementById('pUiScalePct')),'Preferences has a box to type the exact percentage');
 await p.evaluate(()=>{const n=document.getElementById('pUiScalePct');n.value='137';n.dispatchEvent(new Event('input',{bubbles:true}));n.dispatchEvent(new Event('change',{bubbles:true}));});await p.click('#dlgOk');await p.waitForTimeout(400);
 ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===1.37&&__gs.prefs.uiScale===1.37),'typing 137 and saving sets exactly 137%');
 await p.evaluate(()=>{__gs.act('uiScaleCustom');});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>document.getElementById('uiScalePct').value==='137'),'View › Window scale › Exact percentage… opens a box showing the current value');
 await p.evaluate(()=>{const n=document.getElementById('uiScalePct');n.value='83';n.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===.83),'typing 83 there sets 83%');
 await p.evaluate(()=>{const n=document.getElementById('uiScalePct');n.value='900';n.dispatchEvent(new Event('change',{bubbles:true}));});await p.waitForTimeout(300);
 ok(await p.evaluate(()=>window.__zoom.slice(-1)[0]===3),'values stay between 50 and 300 (900 becomes 300)');
 const real=errs.filter(e=>!/reading 'core'/.test(e));ok(!real.length,'no errors (the pretend desktop window only has the zoom) '+real.join('|'));
 await b.close();console.log(fails?'FAILS '+fails:'ALL PASS');process.exit(fails?1:0);
})();
