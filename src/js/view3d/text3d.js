/* ================= Live text on the model (0.93.4, Kenn) =================
   The Text tool (T) in 3D Paint. Click the model: the words land as a live layer facing the surface, like a decal. The layer is an ordinary fill layer
   (so colour, roughness, metal, height, normal and library materials all work on the letters) whose mask is one Picture row: the text drawn as a
   picture and projected flat onto the model, with the usual move / turn / scale gizmo. Edit the words, font, spacing and outline any time in the Text panel.
   Click the model again to move the selected text; Shift+click or "New text" starts another. The text is fixed to the surface where you put it. */
const t3={style:Object.assign({content:'Text',font:'Sans',size:96,bold:true,italic:false,align:'center',lineHeight:1.15,tracking:0,outline:0,disorder:0,seed:1,wave:0,slant:0,stretch:100,turn:0,turnPct:1,caseMode:'none'},(()=>{try{return JSON.parse(localStorage.getItem('gs.t3')||'{}');}catch(e){return {};}})()),fresh:false,sess:null,timer:0};
const t3Save=()=>{try{localStorage.setItem('gs.t3',JSON.stringify(t3.style));}catch(e){}};
const t3Layer=()=>{const L=doc.active;return L&&L.text3d&&ui.mode==='p3d'?L:null;};
const t3Row=L=>L&&L.mask&&L.mask.stack?L.mask.stack.find(r=>r.p&&r.p.t3)||null:null;
const t3Name=s=>'Text · '+(String(s.content).split('\n')[0].slice(0,24)||'(empty)');
/* the words drawn white on see-through: that picture is the layer's shape */
/* the words as a picture. Beyond Painter's plain text it can break the letters up: Disorder shakes each letter (position, turn, size; Shuffle picks a new roll),
   Wave runs the baseline up and down, Slant leans the letters, Stretch makes them wider or narrower, and Case forces upper or lower case. */
const T3_FX=s=>(s.disorder||0)>0||(s.wave||0)>0||(s.slant||0)!==0||(s.stretch||100)!==100||((s.turn||0)!==0&&(s.turnPct==null?1:s.turnPct)>0);
async function t3Bitmap(spec,mirror=true){let content=String(spec.content||'');if(spec.caseMode==='upper')content=content.toUpperCase();else if(spec.caseMode==='lower')content=content.toLowerCase();
  const t={content,font:spec.font,size:spec.size,bold:spec.bold,italic:spec.italic,align:'left',lineHeight:spec.lineHeight,tracking:spec.tracking,outline:spec.outline,outlineColor:[1,1,1],color:[1,1,1],x:0,y:0};
  try{await ensureFont(t);}catch(e){}
  if(!t.content.trim()){const T=makeTarget(8,8,8,true);clearTarget(T);return {T,bw:8,bh:8};}
  const lay=layoutText(t),fx=T3_FX(spec),st=Math.max(.2,(spec.stretch||100)/100),slant=Math.tan((spec.slant||0)*Math.PI/180),dis=Math.max(0,Math.min(1,spec.disorder||0)),wave=Math.max(0,Math.min(1,spec.wave||0));
  const turnA=(spec.turn||0)*Math.PI/180,turnShare=Math.max(0,Math.min(1,spec.turnPct==null?1:spec.turnPct)),extra=fx?Math.ceil(spec.size*(.55*dis+.5*wave)+spec.size*Math.abs(slant)*.9+(turnShare>0?spec.size*.55*Math.abs(Math.sin(turnA)):0)):0,W=lay.W*st,bw=Math.max(8,Math.min(Math.ceil(W)+(lay.pad+extra)*2+2,4096)),bh=Math.max(8,Math.min(lay.H+(lay.pad+extra)*2,4096)),c=document.createElement('canvas');c.width=bw;c.height=bh;const x=c.getContext('2d');
  if(mirror){x.translate(bw,0);x.scale(-1,1);}/* the planar projection reads the picture mirrored when seen from outside, so draw it mirrored */
  x.font=textFont(t);try{x.letterSpacing=(t.tracking||0)+'px';}catch(e){}x.textBaseline='alphabetic';x.lineJoin='round';x.miterLimit=2;
  const at=i=>{const w=lay.widths[i]*st;return [lay.pad+extra+(spec.align==='left'?0:spec.align==='center'?(W-w)/2:W-w),lay.pad+extra+lay.asc+i*lay.lh];};
  const R=rng(spec.seed||1),rolls=[];/* one roll per letter, the same for the outline and the fill */
  const draw=(stroke)=>lay.lines.forEach((ln,i)=>{const [ox,oy]=at(i);
    if(!fx){stroke?x.strokeText(ln,ox,oy):x.fillText(ln,ox,oy);return;}
    const chars=Array.from(ln);let k=0;for(let ci=0;ci<chars.length;ci++){const ch=chars[ci];if(ch===' '){k++;continue;}
      const pre=x.measureText(chars.slice(0,ci).join('')).width*st,key=i+':'+ci;let r=rolls[key];if(!r)r=rolls[key]=[R()*2-1,R()*2-1,R()*2-1,R()*2-1,R()];
      const jx=r[0]*dis*spec.size*.22,jy=r[1]*dis*spec.size*.28,rot=r[2]*dis*.45,sc=1+r[3]*dis*.35,wy=Math.sin(ci/Math.max(1,(spec.waveLen||7))*Math.PI*2)*wave*spec.size*.35;
      const cw=x.measureText(ch).width,turned=r[4]<turnShare;/* Letter turn: the chosen share of the letters (Letters affected) each turn by the same angle round their own middle */
      x.save();x.translate(ox+pre+jx,oy+jy+wy);x.rotate(rot);if(turned&&turnA){const mx=cw*.5,my=-spec.size*.3;x.translate(mx,my);x.rotate(turnA);x.translate(-mx,-my);}x.transform(1,0,-slant,1,0,0);x.scale(st*sc,sc);stroke?x.strokeText(ch,0,0):x.fillText(ch,0,0);x.restore();k++;}});
  if(t.outline>0){x.lineWidth=t.outline*2;x.strokeStyle='#fff';draw(true);}
  x.fillStyle='#fff';draw(false);
  const d=x.getImageData(0,0,bw,bh),tex=uploadStraight({w:bw,h:bh,data:d.data,bits:8}),T=makeTarget(bw,bh,8,true);premultInto(T,tex,[0,0],null);gl.deleteTexture(tex);return {T,bw,bh};}
async function t3Create(p){const spec=Object.assign({},t3.style),B=await t3Bitmap(spec);
  const n=dcNormalAt(p)||[-p.dir[0],-p.dir[1],-p.dir[2]],S=pxfModel().S,xf=dcXf(p.pos,n,.3,B.bh/B.bw);
  const L=cmdNewFillLayer();if(!L){disposeTarget(B.T);return null;}L.name=t3Name(spec);const m=L.fill.maps;if(m.base)Object.assign(m.base,{on:true,src:'value',c:ui.fg.slice()});fillRender(L);L.text3d={spec,bw:B.bw,bh:B.bh};
  const r=msAdd(L,'image',{t:B.T,p:Object.assign(MS_KINDS.image.p(),{name:'Text',proj:'planar',front:true,rep:false,decal:true,t3:true,xf})},'Add text');
  if(!r){disposeTarget(B.T);return null;}t3.fresh=false;selectOnly(L);ui.msSel=null;L.editMask=false;renderLayers();if(typeof renderMatEd==='function')renderMatEd(true);buildBrushPanel();v3.dirty=true;requestRender(true);return L;}
/* click the model again: the selected text moves there, facing the surface */
function t3Move(L,p){const r=t3Row(L);if(!r)return;const n=dcNormalAt(p)||[-p.dir[0],-p.dir[1],-p.dir[2]],b=r.p.xf,X=dcXf(p.pos,n,Math.max(b.s[0],b.s[1]),b.s[1]/b.s[0]);
  msEdit(L,r,x=>{x.p.xf=X;},'Move text');msCommit();v3.dirty=true;requestRender(true);}
/* draw the words again (after an edit, undo or redo), keeping the size the letters have on the model */
async function t3Rebuild(L,spec,xfSnap){const r=t3Row(L);if(!r)return;const B=await t3Bitmap(spec),k=xfSnap?xfSnap.s[0]/(xfSnap.bw||L.text3d.bw):r.p.xf.s[0]/L.text3d.bw,old=r.t;
  r.t=B.T;if(xfSnap){r.p.xf=JSON.parse(JSON.stringify(xfSnap.xf));}r.p.xf.s=[k*B.bw,k*B.bh,r.p.xf.s[2]];r.p.rev=(r.p.rev||0)+1;L.text3d={spec:Object.assign({},spec),bw:B.bw,bh:B.bh};L.name=t3Name(spec);
  if(old)disposeTarget(old);changed(L);renderLayers();v3.dirty=true;requestRender(true);}
function t3Snap(L){return {spec:Object.assign({},L.text3d.spec),xf:{xf:JSON.parse(JSON.stringify(t3Row(L).p.xf)),s:t3Row(L).p.xf.s.slice(),bw:L.text3d.bw}};}
function t3Commit(){const s=t3.sess;if(!s)return;t3.sess=null;clearTimeout(t3.timer);const L=s.L,r=t3Row(L);if(!r||JSON.stringify(s.before.spec)===JSON.stringify(L.text3d.spec))return;const after=t3Snap(L),before=s.before;
  pushUndo({label:'Edit text',refs:[L],undo(){t3Rebuild(L,before.spec,before.xf);},redo(){t3Rebuild(L,after.spec,after.xf);}});}
function t3Prop(k,v){const val=Array.isArray(v)?v.slice():v;t3.style[k]=val;t3Save();const L=t3Layer();if(!L||!t3Row(L))return;
  if(!t3.sess||t3.sess.L!==L)t3.sess={L,before:t3Snap(L)};clearTimeout(t3.timer);t3.timer=setTimeout(t3Commit,700);
  const spec=Object.assign({},L.text3d.spec,{[k]:val});L.text3d.spec=spec;/* now, so an edit is recorded even if drawing the new picture takes a moment */t3Rebuild(L,spec,null);}
/* the Text panel */
function t3Panel(box){const L=t3Layer(),spec=L?L.text3d.spec:t3.style;$('#brushTitle').textContent='Text';
  box.append(el('div',{class:'sub',text:L?'Editing “'+L.name+'”':'Click the model to put text on it'}),
    el('p',{class:'note',text:L?'Click the model to move this text. Use the arrows, rings and boxes to move, turn and scale it. Change its colour or material in the Material panel. Shift+click or New text adds another.':'The text lands facing the surface, like a decal. Edit it any time.'}));
  const ta=el('textarea',{id:'t3Text',rows:3,'aria-label':'Text',spellcheck:'false',style:'width:100%'});ta.value=spec.content||'';ta.oninput=()=>t3Prop('content',ta.value);box.append(ta);
  const fonts=[...Object.keys(typeof FONT_STACKS!=='undefined'?FONT_STACKS:{}),...GFONTS,...userFonts.map(f=>f.name||f)].filter((f,i,a)=>a.indexOf(f)===i);
  const sel=el('select',{id:'t3Font','aria-label':'Font'},...fonts.map(f=>el('option',{value:f,text:f,style:'font-family:'+fontCss(f)})));sel.value=spec.font;if(typeof loadGFonts==='function')loadGFonts();sel.onchange=()=>t3Prop('font',sel.value);
  const S=(id,label,key,min,max,step,fmt)=>makeSlider({id,label,min,max,step,value:spec[key],fmt,onInput:v=>t3Prop(key,v)}).el;
  box.append(sel,el('div',{class:'chips'},chk('t3Bold','Bold',!!spec.bold,v=>t3Prop('bold',v)),chk('t3Ital','Italic',!!spec.italic,v=>t3Prop('italic',v))),
    segChips([['left','Left'],['center','Center'],['right','Right']],()=>(t3Layer()?t3Layer().text3d.spec:t3.style).align,v=>t3Prop('align',v)),
    S('t3Lh','Line height','lineHeight',.7,3,.05,v=>v.toFixed(2)),S('t3Tr','Letter spacing','tracking',-20,100,1,v=>v+'px'),S('t3Out','Outline','outline',0,40,1,v=>v+'px'),...t3Extras(spec,(k,v)=>t3Prop(k,v),'t3'),
    el('div',{class:'chips'},el('button',{class:'btn sm',id:'t3New',text:'New text',title:'The next click on the model adds another text',onclick:()=>{t3.fresh=true;selectOnly(null);buildBrushPanel();toast('Click the model to add new text.');}}),
      el('button',{class:'btn sm',id:'t3Path',text:'Put on a path',title:'Bend these words along a surface path (a Ribbon path)',onclick:t3PutOnPath})));}
document.addEventListener('pointerdown',async e=>{if(ui.mode!=='p3d'||ui.tool!=='text'||e.button!==0||e.altKey||!e.target||e.target.id!=='v3Hit')return;
  if(typeof wpjUI!=='undefined'&&wpjUI.edit)return;/* editing Warp points owns the viewport */
  const p=v3PickAt(e.target,e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();t3Commit();const L=t3Layer();if(L&&t3Row(L)&&!e.shiftKey&&!t3.fresh)t3Move(L,p);else await t3Create(p);},true);

/* "Put on a path": the words become the picture of a Ribbon path, so they bend along its curve (a path layer is selected, or the newest one is used) */
async function t3PutOnPath(){const spec=Object.assign({},t3Layer()?t3Layer().text3d.spec:t3.style,{align:'left'});
  const cur=doc.active,L=cur&&cur.path&&cur.path.kind==='3d'?cur:allLayers().filter(n=>n.path&&n.path.kind==='3d'&&!n.path.weld).pop();
  if(!L){toast('Draw a path first (Path tool, P), then put the text on it.');return;}
  selectOnly(L);pathEnsure(L);const P=L.path;pathChange(q=>{q.mode='ribbon';q.ribbon=Object.assign({},RB_DEFAULT,q.ribbon);},'Put text on a path',P);
  await rbUseText(L,P,spec);setTool('path');buildBrushPanel();toast('The text is on the path. Change how it stretches and tiles in the Path panel.');}

/* the effects that make letters behave differently, shared by the Text tool and the Ribbon text */
function t3Extras(spec,set,id){const S=(key,label,min,max,step,fmt)=>makeSlider({id:id+'_'+key,label,min,max,step,value:spec[key]==null?(key==='stretch'?100:key==='turnPct'?1:0):spec[key],fmt,onInput:v=>set(key,v)}).el;
  const cs=el('select',{id:id+'_case','aria-label':'Letter case',title:'Letter case'},...[['none','Case: as typed'],['upper','Case: UPPERCASE'],['lower','Case: lowercase']].map(([v,t])=>el('option',{value:v,text:t})));cs.value=spec.caseMode||'none';cs.onchange=()=>set('caseMode',cs.value);
  return [el('div',{class:'sub',text:'Letter behaviour'}),S('disorder','Disorder',0,1,.01,pct),el('div',{class:'chips'},el('button',{class:'btn sm',id:id+'_shuffle',text:'Shuffle',title:'Roll the disorder again',onclick:()=>set('seed',Math.floor(Math.random()*99999)+1)})),
    S('wave','Wave',0,1,.01,pct),S('slant','Slant',-45,45,1,v=>v+'°'),S('turn','Letter turn',-180,180,1,v=>v+'°'),S('turnPct','Letters turned',0,1,.01,pct),S('stretch','Stretch',50,200,1,v=>v+'%'),cs];}
