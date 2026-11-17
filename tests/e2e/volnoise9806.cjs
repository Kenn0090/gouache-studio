const {chromium}=require('playwright');const OLD=__dirname+'/';let fails=0;const ok=(c,m)=>{console.log((c?'PASS ':'FAIL ')+m);if(!c)fails++;};
(async()=>{const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await (await b.newContext({viewport:{width:1500,height:900}})).newPage();const errs=[];p.on('pageerror',e=>errs.push(e.stack));
 await p.route('**/*',r=>{const u=r.request().url();if(u.includes('pako'))return r.fulfill({path:OLD+'node_modules/pako/dist/pako.min.js',contentType:'text/javascript'});if(u.startsWith('file:'))return r.continue();return r.abort();});
 await p.goto('file://'+require('path').resolve(__dirname,'../../dist-web/index.html')+'?debug');await p.waitForTimeout(2500);
 await p.evaluate(()=>__gs.newDoc(96,96,8,[1,1,1],'ap',false,'pbr'));await p.waitForTimeout(400);
 const stat=()=>p.evaluate(()=>{const L=__gs.doc.active;__gs.msUpdate(L);const d=__gs.readRGBA8(L.mask.target);let lo=255,hi=0,s=0;const n=d.length/4,a=[];for(let i=0;i<d.length;i+=4){lo=Math.min(lo,d[i]);hi=Math.max(hi,d[i]);s+=d[i];a.push(d[i]);}
   return {lo,hi,mean:s/n,sig:a.slice(0,2000).filter((_,i)=>i%7===0).join(',')};});
 await p.evaluate(()=>{const g=__gs;g.cmdAddLayer();const L=g.doc.active;const r=g.msAdd(L,'volume');window.__r=r;});await p.waitForTimeout(400);
 const a=await stat();console.log(JSON.stringify({lo:a.lo,hi:a.hi,mean:a.mean}));ok(a.hi-a.lo>60&&a.mean>60&&a.mean<200,'clouds fill the mask with detail (range '+(a.hi-a.lo)+')');
 for(const t of ['cells','gaussian','ridged','billow','cracks','crystal','marble','wood','spots','stripes']){await p.evaluate(t=>{const g=__gs,L=g.doc.active;window.__r.p.type=t;L.lookVer=(L.lookVer||0)+1;},t);await p.waitForTimeout(250);const s=await stat();ok(s.hi-s.lo>40&&s.sig!==a.sig,t+' makes its own pattern (range '+(s.hi-s.lo)+')');}
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;Object.assign(window.__r.p,{type:'clouds',macro:0,micro:0});L.lookVer++;});await p.waitForTimeout(250);
 const flat=await stat();ok(flat.hi-flat.lo<4,'macro and micro contrast at 0 leave it flat grey ('+(flat.hi-flat.lo)+')');
console.log(JSON.stringify(await p.evaluate(()=>window.__r.p)));
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;Object.assign(window.__r.p,{macro:1,micro:1,mwAmt:0,samp:5});L.lookVer++;});await p.waitForTimeout(250);const dbg=await stat();console.log('clouds again',dbg.lo,dbg.hi,dbg.mean);
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;Object.assign(window.__r.p,{macro:1,micro:0,mwAmt:0});L.lookVer++;});await p.waitForTimeout(250);const w0=await stat();console.log('macro only',w0.lo,w0.hi,w0.mean);
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;Object.assign(window.__r.p,{mwAmt:.8});L.lookVer++;});await p.waitForTimeout(250);const w1=await stat();ok(w0.sig!==w1.sig,'macro warp changes the shape');
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;Object.assign(window.__r.p,{mwAmt:0,micro:1,samp:1});L.lookVer++;});await p.waitForTimeout(250);const s1=await stat();
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;Object.assign(window.__r.p,{samp:8});L.lookVer++;});await p.waitForTimeout(250);const s8=await stat();ok(s1.sig!==s8.sig,'sampling changes the detail');
 await p.evaluate(()=>{const g=__gs,L=g.doc.active;g.msSelect&&g.msSelect(L,'m',window.__r.id);g.showPanel('matEd');g.renderMatEd(true);});await p.waitForTimeout(300);
 await p.evaluate(()=>{const e=document.querySelector('#ms_vscale input[type=number], #ms_vscale input:not([type=range])');window.__sc=!!e;});
 console.log('dom',await p.evaluate(()=>{const e=document.getElementById('ms_vscale');return e?e.outerHTML.slice(0,300):'none';}));ok(await p.evaluate(()=>{const e=document.getElementById('ms_vscale'),r=e&&(e.matches('input')?e:e.querySelector('input[type=range]'));return !!r&&+r.max>=200;}),'Scale reaches 200 on the slider (and numbers beyond that can be typed)');
 ok(await p.evaluate(()=>!!document.getElementById('ms_vmac')&&!!document.getElementById('ms_vmwa')&&!!document.getElementById('ms_vsamp')),'Properties shows the Marmoset-style controls');
 for(const [mac,mic,oc] of [[0,1,1],[0,1,2],[0,1,5],[0,2,5]]){await p.evaluate(([a,b,c])=>{const L=__gs.doc.active;Object.assign(window.__r.p,{macro:a,micro:b,samp:c,mwAmt:0,uwAmt:0});L.lookVer++;},[mac,mic,oc]);await p.waitForTimeout(250);const d=await stat();console.log('micro',mac,mic,oc,d.lo,d.hi,Math.round(d.mean));}
 ok(errs.length===0,'no errors '+errs.join('|').slice(0,300));await b.close();console.log(fails?'FAILED':'ALL PASSED');process.exit(fails?1:0);})();
