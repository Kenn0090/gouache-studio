/* ================= Brush tab =================
   A workspace for drawing brush tips on a canvas of its own. Entering the tab sets the painting document aside
   (its layers, undo steps, selection, working images and view) and brings in the sketch; leaving swaps them back,
   so both keep everything while you switch. */
const bt={paint:null,sketch:null,size:512,guides:true,editing:null,name:'',v3was:false,col:null,paintCol:null,
  set:{spacing:.2,sizeJitter:0,angleJitter:0,scatter:0,hueJitter:0,satJitter:0,valJitter:0,pSize:true,followDir:false},
  tip:null,sig:null,timer:0,prev:null};
/* everything that belongs to one document */
function docState(){if(typeof pathFlush==='function')pathFlush();return {doc:Object.assign({},doc),view:Object.assign({},view),undo:hist.undo,redo:hist.redo,sel:Object.assign({},sel),aux:Object.assign({},aux),
  compOut,empties:Object.assign({},emptyTs),groupCount};}
function setDocState(s){for(const k of Object.keys(doc))delete doc[k];Object.assign(doc,s.doc);Object.assign(view,s.view);hist.undo=s.undo;hist.redo=s.redo;Object.assign(sel,s.sel);
  for(const k of Object.keys(aux))delete aux[k];Object.assign(aux,s.aux);compOut=s.compOut;for(const k of Object.keys(emptyTs))delete emptyTs[k];Object.assign(emptyTs,s.empties);
  groupCount=s.groupCount;useAux(mapDepth(doc.map||'base'),true);syncTargets();}
/* a new white sketch (the painting document must already be set aside: nothing of it is disposed here) */
function freshSketch(size){for(const k of Object.keys(aux))delete aux[k];for(const k of Object.keys(emptyTs))delete emptyTs[k];sel.t=null;hist.undo=[];hist.redo=[];
  for(const k of Object.keys(doc))delete doc[k];
  Object.assign(doc,{w:size,h:size,depth:8,wrap:false,name:'Brush sketch',root:{type:'group',children:[],isRoot:true,visible:true,opacity:1,mode:-1},active:null,sel:new Set(),count:0,
    maps:['base'],map:'base',view:'base',mapDef:{},nrmStr:8,light:{az:135,el:40},v3d:null,anim:null,cage:null,brushTpl:true,workflow:'metal'});
  allocAux();groupCount=0;const L=newLayerObj('Sketch');insertNode(L,doc.root);selectOnly(L);clearTarget(L.target,[1,1,1,1]);}
function brushTabEnter(){bt.v3was=v3.on;if(v3.on)toggle3D(false);bt.paintCol=[ui.fg.slice(),ui.bg.slice()];
  bt.paint=docState();if(bt.sketch)setDocState(bt.sketch);else freshSketch(bt.size);bt.sketch=null;
  const c=bt.col||[[0,0,0],[1,1,1]];ui.bg=c[1].slice();setFG(c[0].slice());if(!['brush','erase','smudge','picker','hand','marquee','lasso','wand','gradient','bucket','move'].includes(ui.tool))setTool('brush');
  $('#docName').textContent='Brush sketch';if(typeof selChanged==='function')selChanged();fit();updateStatus();buildBrushTab();btWatch(true);drawXfOverlay();}
function brushTabExit(){btWatch(false);bt.col=[ui.fg.slice(),ui.bg.slice()];bt.sketch=docState();setDocState(bt.paint);bt.paint=null;
  ui.bg=bt.paintCol[1];setFG(bt.paintCol[0]);$('#docName').textContent=doc.name;if(typeof selChanged==='function')selChanged();updateStatus();if(bt.v3was)toggle3D(true);}
/* the test stroke follows the sketch: checked a few times a second while the tab is open */
function btWatch(on){clearInterval(bt.timer);bt.timer=0;if(on){bt.sig=null;bt.timer=setInterval(()=>{if(ui.mode!=='brush'||stroke)return;const s=hist.undo.length+':'+hist.redo.length+':'+(hist.undo[hist.undo.length-1]||{}).label;
  if(s!==bt.sig||bt.dirty){bt.sig=s;bt.dirty=false;btUpdateTip();}},350);}}
/* the tip as it is now, for the test stroke */
function btUpdateTip(){const v=tipAlpha('canvas');if(!v)return;const W=doc.w,H=doc.h;let x0=W,y0=H,x1=-1,y1=-1;
  for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(v[y*W+x]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(bt.tip){disposeTip(bt.tip);bt.tip=null;}
  if(x1>=0){const w=x1-x0+1,h=y1-y0+1,a=new Uint8Array(w*h);for(let y=0;y<h;y++)a.set(v.subarray((y0+y)*W+x0,(y0+y)*W+x0+w),y*w);bt.tip=makeTip('sketch',w,h,a);}
  btDrawTest();}
function btDrawTest(){btDrawTip();const c=$('#btTest');if(!c)return;const d=Math.min(window.devicePixelRatio||1,2),W=Math.round(c.clientWidth*d),H=Math.round(c.clientHeight*d);if(W<20||H<20)return;
  const x2=c.getContext('2d');c.width=W;c.height=H;
  if(!bt.tip){x2.clearRect(0,0,W,H);$('#btTestNote').textContent='Paint in black to preview your new brush.';return;}
  $('#btTestNote').textContent='';
  let P2=bt.prev;if(!P2||P2.w!==W||P2.h!==H){if(P2)[P2.t,P2.s,P2.b,P2.c].forEach(disposeTarget);P2=bt.prev={w:W,h:H,t:makeTarget(W,H,8,false),s:makeTarget(W,H,8,false),b:makeTarget(W,H,8,false),c:makeTarget(W,H,8,false)};}
  const cs=getComputedStyle(document.documentElement),col=hexRGB((cs.getPropertyValue('--text').trim())||'#e1e3e7');
  const saved={w:doc.w,h:doc.h,wrap:doc.wrap,strokeT,beforeT,scratchT,map:doc.map};doc.w=W;doc.h=H;doc.wrap=false;doc.map='base';strokeT=P2.s;beforeT=P2.b;scratchT=P2.c;
  try{clearTarget(P2.t);const o=Object.assign({},BRUSH_DEFAULTS,bt.set,{tool:'brush',tip:bt.tip,color:col,size:H*.42,smoothing:0,opacity:1,flow:1,hardness:1,sym:null,minSize:.3});
    const L={target:P2.t,lockAlpha:false},pad=H*.3,N=120,pt=i=>{const t=i/N;return [pad+(W-2*pad)*t,H/2+Math.sin(t*Math.PI*2)*H*.14,Math.max(.05,Math.pow(Math.sin(t*Math.PI),.7))];};
    const p0=pt(0);beginStroke(L,p0[0],p0[1],p0[2],o);for(let i=1;i<=N;i++){const q=pt(i);addPoint(q[0],q[1],q[2]);}endStroke(false);}
  finally{Object.assign(doc,{w:saved.w,h:saved.h,wrap:saved.wrap,map:saved.map});strokeT=saved.strokeT;beforeT=saved.beforeT;scratchT=saved.scratchT;}
  const st=toStraight(readPremult(P2.t),8),id=x2.createImageData(W,H);id.data.set(st);x2.putImageData(id,0,0);}
function btDrawTip(){const c=$('#btTip');if(!c)return;const x=c.getContext('2d');c.width=c.height=160;x.clearRect(0,0,160,160);
  if(bt.tip){const k=144/Math.max(bt.tip.w,bt.tip.h),w=bt.tip.w*k,h=bt.tip.h*k;x.drawImage(bt.tip.canvas,(160-w)/2,(160-h)/2,w,h);}}
function btCustomSet(){return library.find(s=>s.id==='custom');}
/* a new, empty sketch of the given size (Undo can't bring the old one back, so ask when there is something on it) */
function btNewCanvas(size){const go=()=>{for(const L of everyNode())disposeLayer(L);auxTargets().forEach(disposeTarget);resetEmpties();disposeTarget(sel.t);dropRecords([...hist.undo,...hist.redo]);
    bt.size=size;freshSketch(size);bt.editing=null;fit();changedAll();renderLayers();buildBrushTab();bt.dirty=true;};
  if(bt.tip)confirmDlg('New canvas','Start a new '+size+' × '+size+' canvas? The current sketch is cleared.','New canvas',go);else go();}
function confirmDlg(title,text,ok,fn){openDialog({title,body:el('p',{class:'note',text}),okLabel:ok,onOk(){fn();}});}
function btClear(){const L=paintLayers()[0];if(!L)return;selectOnly(L);renderLayers();if(sel.active)actions.deselect();fullRecord(L,'Clear sketch',()=>clearTarget(L.target,[1,1,1,1]));changedAll();bt.dirty=true;}
/* an existing tip back onto the canvas, black on white, to change it */
function btEdit(p){const t=p.tip;if(!t)return;const S=doc.w,c=document.createElement('canvas');c.width=c.height=S;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,S,S);
  const k=Math.min(1,S*.86/Math.max(t.w,t.h)),w=t.w*k,h=t.h*k,b=document.createElement('canvas');b.width=t.w;b.height=t.h;const bx=b.getContext('2d');bx.fillStyle='#000';bx.fillRect(0,0,t.w,t.h);bx.globalCompositeOperation='destination-in';bx.drawImage(t.canvas,0,0);
  x.drawImage(b,(S-w)/2,(S-h)/2,w,h);const L=paintLayers()[0];if(!L)return;const tex=uploadStraight({el:c,w:S,h:S});
  fullRecord(L,'Edit tip',()=>{clearTarget(L.target);premultInto(L.target,tex,[0,0],null);});gl.deleteTexture(tex);
  bt.editing=p;bt.name=p.name;for(const k2 of Object.keys(bt.set))if(k2 in p)bt.set[k2]=p[k2];changedAll();buildBrushTab();bt.dirty=true;toast('“'+p.name+'” is on the canvas. Change it, then press Update.');}
function btMake(update){const name=($('#btName').value||'').trim()||'Brush tip';const v=tipAlpha('canvas');
  if(!v||!bt.tip){toast('There are no dark pixels yet. Paint the tip in black.');return;}
  if(update&&bt.editing){const p=bt.editing,set=btCustomSet(),W=doc.w,H=doc.h;let x0=W,y0=H,x1=-1,y1=-1;for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(v[y*W+x]>8){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    const w=x1-x0+1,h=y1-y0+1,a=new Uint8Array(w*h);for(let y=0;y<h;y++)a.set(v.subarray((y0+y)*W+x0,(y0+y)*W+x0+w),y*w);
    const old=p.tip,t=makeTip(name,w,h,a);if(set){const i=set.tips.indexOf(old);if(i>=0)set.tips[i]=t;else set.tips.push(t);}
    Object.assign(p,bt.set,{name,tip:t});p._thumb=null;if(brush.tip===old)brush.tip=t;disposeTip(old);if(set)saveSet(set);renderLibrary();buildBrushTab();toast('Updated “'+name+'”.');return;}
  const p=addCustomTip(name,doc.w,doc.h,v,bt.set,true);if(!p)return;bt.editing=p;renderLibrary();buildBrushTab();toast('Saved the brush “'+name+'” (Custom tips). It is ready in Paint.');}
function btRename(p){const inp=el('input',{type:'text',value:p.name,'aria-label':'Name'});openDialog({title:'Rename brush',body:el('div',{class:'dlg-grid'},inp),okLabel:'Rename',onOk(){const v=inp.value.trim();if(!v)return false;p.name=v;if(p.tip)p.tip.name=v;const s=btCustomSet();if(s)saveSet(s);renderLibrary();buildBrushTab();}});setTimeout(()=>{inp.focus();inp.select();},0);}
function btDelete(p){confirmDlg('Delete brush','Delete “'+p.name+'”? This can’t be undone.','Delete',()=>{const s=btCustomSet();if(!s)return;const i=s.presets.indexOf(p);if(i>=0)s.presets.splice(i,1);
  const j=s.tips.indexOf(p.tip);if(j>=0)s.tips.splice(j,1);if(!s.presets.some(q=>q.tip===p.tip)&&brush.tip!==p.tip)disposeTip(p.tip);if(bt.editing===p)bt.editing=null;saveSet(s);renderLibrary();buildBrushTab();});}
function buildBrushTab(){const box=$('#btBody');if(!box)return;box.replaceChildren();
  const seg=el('div',{class:'seg'},...[256,512,1024].map(n=>el('button',{class:'segb','aria-pressed':String(doc.w===n&&doc.h===n),text:String(n),title:'A new '+n+' × '+n+' canvas',onclick:()=>{if(doc.w!==n)btNewCanvas(n);}})));
  box.append(el('div',{class:'btpreview'},el('div',{},el('div',{class:'sub',text:'Brush tip'}),el('canvas',{id:'btTip','aria-label':'Live brush tip',class:'bttip'})),el('div',{},el('div',{class:'sub',text:'Test stroke'}),el('canvas',{id:'btTest',class:'bttest','aria-label':'Live test stroke'}))),el('p',{class:'note',id:'btTestNote'}));
  box.append(el('div',{class:'sub',text:'Canvas'}),seg,
    el('div',{class:'chips'},el('button',{class:'btn sm',text:'Clear',onclick:btClear}),chk('btGuides','Centre guides',bt.guides,v=>{bt.guides=v;drawXfOverlay();})));
  const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:bt.set[key],fmt,onInput:v=>{bt.set[key]=v;btDrawTest();}}).el;
  const C=(id,label,key)=>chk(id,label,!!bt.set[key],v=>{bt.set[key]=v;btDrawTest();});
  box.append(el('div',{class:'sub',text:'The new brush'}),el('div',{class:'btsettings'},S('btSp','Spacing','spacing',.01,1.5,.01,pct),S('btSJ','Size jitter','sizeJitter',0,1,.01,pct),S('btAJ','Angle jitter','angleJitter',0,1,.01,pct),
    S('btSc','Scatter','scatter',0,4,.05,pct),S('btHJ','Hue jitter','hueJitter',0,1,.01,pct),S('btVJ','Brightness jitter','valJitter',0,1,.01,pct)),
    el('div',{class:'chips'},C('btPS','Pressure: size','pSize'),C('btFD','Follow stroke','followDir')));
  const name=el('input',{type:'text',id:'btName',value:bt.name||'','placeholder':'Name','aria-label':'Brush name'});name.addEventListener('input',()=>{bt.name=name.value;});
  const btns=el('div',{class:'chips'},bt.editing?el('button',{class:'btn primary',text:'Update “'+bt.editing.name+'”',onclick:()=>btMake(true)}):null,
    el('button',{class:'btn'+(bt.editing?'':' primary'),id:'btMake',text:bt.editing?'Save as new':'Make brush',onclick:()=>btMake(false)}),
    bt.editing?el('button',{class:'btn sm',text:'Stop editing',onclick:()=>{bt.editing=null;buildBrushTab();}}):null);
  const save=el('div',{class:'btsave'},el('div',{class:'frow'},name),btns);box.insertBefore(save,box.children[1]);
  const set=btCustomSet(),list=el('div',{class:'btlist'});
  if(set&&set.presets.length)for(const p of set.presets){const th=p._thumb||(p._thumb=tileCanvas(p));const t2=th.cloneNode();t2.getContext('2d').drawImage(th,0,0);
    list.append(el('div',{class:'btrow'+(bt.editing===p?' on':'')},t2,el('span',{class:'btname',text:p.name}),el('span',{class:'kbbtns'},
      el('button',{class:'btn sm',text:'Edit',onclick:()=>btEdit(p)}),el('button',{class:'btn sm',text:'Rename',onclick:()=>btRename(p)}),el('button',{class:'btn sm',text:'×',title:'Delete','aria-label':'Delete '+p.name,onclick:()=>btDelete(p)}))));}
  else list.append(el('p',{class:'note',text:'Brushes you make appear here.'}));
  box.append(el('details',{class:'btsaved'},el('summary',{text:'Your saved tips'}),list));if(typeof brushMergeSync==='function'&&dk.L)brushMergeSync();requestAnimationFrame(btDrawTest);}
