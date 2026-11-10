/* ================= Bake groups like Marmoset (0.96.9, Kenn: "just like in Marmoset, it's okay to move the baking screen around") =================
   A tree in the Bake tab: Bake group › Low / High, each with the model parts in it. Parts are dragged between groups; groups are added,
   renamed and deleted; each group has an eye (hide it in the view), a "bake it" tick (leave it out) and its own colour (Group colours
   shows the low-poly painted in them). When models load, parts whose names match on both sides (crate_low / crate_high) get a group of
   their own; everything else goes in the first group ("Default"). A Quick loader (Low and High slots: drop, pick, reload) sits above it.
   Underneath, the tree is the bake-group mode 'tree' of bake-groups.js: each triangle gets its group's number, and rays only find the
   high-poly parts of their own group. Part 2 (to come): each group's own cage distance and skew painting. */
const BT_COLS=['#e5533d','#4d8fe8','#5fbf45','#e8b04d','#b05fe8','#45bfb5','#e85fa0','#a3b35f','#5f7fe8','#e8834d','#7fd0f0','#d0c070'];
const btg={drag:null,colours:false,open:{},tex:null,texKey:null};
function btTree(){const C=bgCfg();if(!C.tree)C.tree={groups:[],low:{},high:{},seq:0};const T=C.tree;if(!T.groups.length)T.groups.push(btNew(T,'Default'));return T;}
function btNew(T,name){const id=++T.seq;return {id,name:name||'Bake group '+id,col:BT_COLS[(id-1)%BT_COLS.length],hide:false,skip:false};}
const btModel=side=>side==='low'?bkLow():bakeCfg.high;
/* the parts that have triangles (OBJ files often name an empty "default" part first) */
const btPartsC=new WeakMap();
const btParts=side=>{const m=btModel(side);if(!m)return [];if(!(m.partNames&&m.partNames.length))return ['default'];let r=btPartsC.get(m);if(r)return r;
  const used=new Uint8Array(m.partNames.length);if(m.triPart)for(let t=0;t<m.triPart.length;t++)used[m.triPart[t]]=1;else used[0]=1;r=m.partNames.filter((p,i)=>used[i]);btPartsC.set(m,r);return r;};
const btGroup=(T,id)=>T.groups.find(g=>g.id===id)||T.groups[0];
/* every part in a group: new parts by name (a group of their own when the same name is on both sides), the rest in the first group */
function btSync(redo){const T=btTree(),lp=btParts('low'),hp=btParts('high');if(redo){T.low={};T.high={};}
  /* new models: parts that are gone are forgotten, and parts still in the first group get another chance to pair up by name
     (the low-poly usually loads before the high-poly); parts you moved to a group of your own stay there */
  const sig=lp.join('|')+'#'+hp.join('|');if(T.sig!==sig){T.sig=sig;const first=T.groups[0].id;
    for(const [side,ps] of [['low',lp],['high',hp]]){const keep=new Set(ps);for(const p in T[side])if(!keep.has(p)||T[side][p]===first)delete T[side][p];}}
  const known=new Set(T.groups.map(g=>g.id)),lb=new Map(),hb=new Set(hp.map(bgBase));lp.forEach(p=>lb.set(bgBase(p),p));
  const byName=n=>{let g=T.groups.find(x=>x.name===n);if(!g){g=btNew(T,n);T.groups.push(g);}return g.id;};
  for(const p of lp)if(!known.has(T.low[p])){const b=bgBase(p);T.low[p]=hp.length&&hb.has(b)&&lp.length>1?byName(b):T.groups[0].id;}
  for(const p of hp)if(!known.has(T.high[p])){const b=bgBase(p);T.high[p]=lb.has(b)&&lp.length>1?T.low[lb.get(b)]:T.groups[0].id;}
  return T;}
/* auto groups again from the names (Auto button) */
function btAuto(){const T=btTree();T.groups=[T.groups[0]];T.groups[0].name='Default';T.seq=Math.max(T.seq,T.groups[0].id);btSync(true);btChanged();}
function btChanged(){btg.texKey=null;bgChanged();bk.dirty=true;if(typeof buildBakePanel==='function'&&ui.mode==='bake')buildBakePanel();}
/* the group number of each triangle: a left-out group's low-poly gets 0 (no ray finds anything), its high-poly 9999 */
function btLowIds(L){const T=btSync(),parts=L.partNames&&L.partNames.length?L.partNames:['default'],per=parts.map(p=>{const g=btGroup(T,T.low[p]);return g.skip?0:g.id;});
  const n=L.idx.length/3,tri=new Uint32Array(n);for(let t=0;t<n;t++)tri[t]=per[L.triPart?L.triPart[t]:0]||0;return tri;}
function btHighIds(H){const T=btSync(),parts=H.partNames&&H.partNames.length?H.partNames:['default'],per=parts.map(p=>{const g=btGroup(T,T.high[p]);return g.skip?9999:g.id;});
  const n=H.idx.length/3,out=new Float32Array(n);for(let t=0;t<n;t++)out[t]=per[H.triPart?H.triPart[t]:0];return out;}
/* hidden groups: their triangles are left out of what the view draws */
function btHidden(){const T=btTree();return new Set(T.groups.filter(g=>g.hide).map(g=>g.id));}
function btDropTris(m,ids,hid){const keep=[];for(let t=0;t<ids.length;t++)if(!hid.has(ids[t]))keep.push(t);if(keep.length===ids.length)return m;
  const idx=new Uint32Array(keep.length*3);keep.forEach((t,i)=>{idx[i*3]=m.idx[t*3];idx[i*3+1]=m.idx[t*3+1];idx[i*3+2]=m.idx[t*3+2];});
  const o=Object.assign({},m,{idx});for(const k in o)if(k[0]==='_')delete o[k];if(m.triPart)o.triPart=Uint32Array.from(keep,t=>m.triPart[t]);if(m.triMat)o.triMat=Uint32Array.from(keep,t=>m.triMat[t]);o.setRanges=null;o.tris=keep.length;o.btKeep=keep;return o;}
/* the tree drives bake-groups.js when its mode is 'tree' (the default from now on) */
{const cfg0=bgCfg;bgCfg=function(){const C=bakeCfg;if(!C.treeV){C.treeV=1;C.groupMode='tree';}return cfg0();};}
{const f=bgLowGroups;bgLowGroups=function(L){if(bgCfg().groupMode!=='tree')return f(L);const T=btTree();return {tri:btLowIds(L),names:T.groups.map(g=>g.name)};};}
{const f=bgHighGroups;bgHighGroups=function(H,L){if(bgCfg().groupMode!=='tree')return f(H,L);return btHighIds(H);};}
{const f=bgSig;bgSig=function(){const C=bgCfg();return f()+(C.groupMode==='tree'?JSON.stringify(C.tree||0)+(btg.colours?'c':''):'');};}
{const f=bgLowShown;const cache={src:null,sig:null,m:null};bgLowShown=function(L){const m=f(L);if(!L||bgCfg().groupMode!=='tree')return m;const hid=btHidden(),col=btColourOn();if(!hid.size&&!col)return m;
  const sig=bgSig();if(cache.src===m&&cache.sig===sig)return cache.m;let o=hid.size?btDropTris(m,btLowIds(L),hid):Object.assign({},m);o.bgOf=L;if(col&&L.uv)o=btColourUV(o,L);cache.src=m;cache.sig=sig;cache.m=o;return o;};}
{const f=bgPlaceHigh;bgPlaceHigh=function(H,L,view){const m=f(H,L,view);if(!view||bgCfg().groupMode!=='tree')return m;const hid=btHidden();if(!hid.size)return m;return btDropTris(m,btHighIds(H),hid);};}

/* Group colours: the shown copy of the low-poly gets texture positions that point at its group's colour in a small strip of colours
   (so parts that share UV space still each show their own colour; the bake uses the real UVs) */
const BT_PAL=64;
function btColourTex(){const T=btTree(),key=T.groups.map(g=>g.id+g.col).join();if(btg.tex&&btg.texKey===key)return btg.tex;const px=new Uint8Array(BT_PAL*4);
  for(let i=0;i<BT_PAL;i++){px[i*4]=px[i*4+1]=px[i*4+2]=90;px[i*4+3]=255;}
  for(const g of T.groups){const c=bgtHex(g.col),o=(g.id%BT_PAL)*4;px[o]=Math.round(c[0]*255);px[o+1]=Math.round(c[1]*255);px[o+2]=Math.round(c[2]*255);}
  if(btg.tex)disposeTarget(btg.tex);const t=makeTarget(BT_PAL,1,8,false);writeRegion(t,0,0,BT_PAL,1,px);btg.tex=t;btg.texKey=key;return t;}
function btColourUV(m,L){const ids=btLowIds(L),T=btTree(),gid=new Map(T.groups.map(g=>[g.id,g.id]));const uv=new Float32Array((m.pos.length/3)*2);
  /* triangle t of the shown copy is triangle t of L unless hidden groups were dropped: map back through the kept list */
  const keep=m.btKeep||null;for(let t=0;t<m.idx.length/3;t++){const src=keep?keep[t]:t,lowT=ids[src],g=lowT===0?0:lowT;for(let k=0;k<3;k++){const v=m.idx[t*3+k];uv[v*2]=((g%BT_PAL)+.5)/BT_PAL;uv[v*2+1]=.5;}}
  const o=Object.assign({},m,{uv,bgOf:L});for(const k in o)if(k[0]==='_')delete o[k];return o;}
function bgtHex(h){const n=parseInt(String(h).replace('#',''),16);return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
const btColourOn=()=>btg.colours&&ui.mode==='bake'&&bgCfg().groupMode==='tree';
{const f=bakeV3Refresh;bakeV3Refresh=function(){f();if(btColourOn()&&v3.btex){const t=btColourTex();if(t){v3.btex=Object.assign({},v3.btex,{base:t,nfinal:null,ao:null});v3.bunlit=true;}}};}

/* ---- Quick loader: a Low and a High slot (drop a file, pick one, or load it again from disk) ---- */
async function btReload(key){const C=bakeCfg,m=C[key];if(!m)return;if(!(platform.isDesktop&&m.srcPath&&typeof mwLoad==='function')){toast('Reloading needs the desktop app (the browser cannot read the file again). Use Load… instead.');return;}
  try{let n=await mwTag(await mwLoad(m.srcPath),m.srcPath);if(key==='low'&&typeof uvImportCheck==='function')n=await uvImportCheck(n);bakeSetModel(key,n);toast('Reloaded “'+n.name+'”.');}catch(e){toast('Could not reload: '+(e.message||e));}}
function btSlot(key,label){const C=bakeCfg,m=C[key],name=m?m.name+' · '+m.tris.toLocaleString()+' tris':key==='low'?'The model in the 3D view ('+bakeViewModel().name+')':'None: drop or load a high-poly';
  const load=async()=>{try{const n=await bakePickModel(key==='low'?{uv:true}:{});if(n)bakeSetModel(key,n);}catch(e){if(e.message==='Import cancelled.')toast('Import cancelled.');else toast('This model could not be loaded: '+(e.message||e));}};
  const box=el('div',{class:'btslot',id:'btSlot_'+key,title:'Drop a model file here'},el('span',{class:'btslotk',text:label}),el('span',{class:'btslotn',text:name,title:name}),
    el('button',{class:'btn sm',id:'btLoad_'+key,text:'Load…',onclick:load}),
    m?el('button',{class:'btn sm',id:'btReload_'+key,text:'↻',title:'Load the file again (after changing it elsewhere)','aria-label':'Reload the '+label.toLowerCase(),onclick:()=>btReload(key)}):'',
    m?el('button',{class:'btn sm',id:'btClear_'+key,text:'×',title:key==='low'?'Use the model in the 3D view instead':'No high-poly','aria-label':'Clear the '+label.toLowerCase(),onclick:()=>{C[key]=null;if(key==='high')C.highMeshes=[];bk.hgKey=null;if(typeof bkHighViewFree==='function')bkHighViewFree();bakeSyncMesh();bakeRefresh();}}):'');
  bakeDropZone(box,key);return box;}

/* ---- the tree ---- */
function btPartChip(side,p,g){const c=el('div',{class:'btpart',draggable:'true',tabindex:'0',text:p,title:'Drag onto another group’s '+(side==='low'?'Low':'High')+' to move it','data-side':side,'data-part':p});
  c.addEventListener('dragstart',e=>{btg.drag={side,p};e.dataTransfer.effectAllowed='move';try{e.dataTransfer.setData('text/plain','gs-part:'+side+':'+p);}catch(x){}c.classList.add('dragging');});
  c.addEventListener('dragend',()=>{btg.drag=null;c.classList.remove('dragging');});
  /* keyboard: Alt + Up / Down moves the part to the group above / below */
  c.addEventListener('keydown',e=>{if(!e.altKey||!['ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const T=btTree(),i=T.groups.indexOf(g),j=i+(e.key==='ArrowUp'?-1:1);if(T.groups[j])btMove(side,p,T.groups[j].id);});return c;}
function btMove(side,p,id){const T=btTree();if(T[side][p]===id)return;T[side][p]=id;btChanged();}
function btDropOn(box,side,g){box.addEventListener('dragover',e=>{if(btg.drag&&btg.drag.side===side){e.preventDefault();box.classList.add('dropon');}});box.addEventListener('dragleave',()=>box.classList.remove('dropon'));
  box.addEventListener('drop',e=>{box.classList.remove('dropon');if(!btg.drag||btg.drag.side!==side)return;e.preventDefault();e.stopPropagation();const d=btg.drag;btg.drag=null;btMove(side,d.p,g.id);});}
function bgtRename(g,span){const inp=el('input',{type:'text',class:'btname-in',value:g.name,'aria-label':'Group name'});span.replaceWith(inp);inp.focus();inp.select();
  const done=ok=>{if(ok&&inp.value.trim())g.name=inp.value.trim();btChanged();};inp.addEventListener('keydown',e=>{if(e.key==='Enter')done(true);if(e.key==='Escape')done(false);e.stopPropagation();});inp.addEventListener('blur',()=>done(true));}
function bgtDelete(g){const T=btTree();if(T.groups.length<2){toast('A bake needs at least one group.');return;}const to=T.groups.find(x=>x!==g);
  for(const side of ['low','high'])for(const p in T[side])if(T[side][p]===g.id)T[side][p]=to.id;T.groups.splice(T.groups.indexOf(g),1);toast('Deleted “'+g.name+'”: its parts went to “'+to.name+'”.');btChanged();}
function btPanel(){const C=bgCfg();if(C.groupMode!=='tree')C.groupMode='tree';C.match=true;const T=btSync(),hasHigh=!!bakeCfg.high;
  const head=el('div',{class:'bthead'},el('div',{class:'sub',text:'Bake groups',title:'Like Marmoset: each group’s low-poly is only baked from the high-poly parts in the same group'}),
    el('button',{class:'btn sm',id:'btAdd',text:'+ Group',title:'A new, empty bake group: drag parts into it',onclick:()=>{const g=btNew(T);T.groups.push(g);btg.open[g.id]=true;btChanged();}}),
    el('button',{class:'btn sm',id:'btAuto',text:'Auto',title:'Group the parts again by their names (crate_low with crate_high); the rest goes in the first group',onclick:btAuto}),
    el('button',{class:'btn sm'+(btg.colours?' on':''),id:'btColours','aria-pressed':String(btg.colours),text:'Group colours',title:'Show the low-poly in its groups’ colours',onclick:()=>{btg.colours=!btg.colours;btChanged();}}));
  const list=el('div',{class:'bttree',id:'btTree',role:'tree','aria-label':'Bake groups'});
  for(const g of T.groups){const lowP=btParts('low').filter(p=>T.low[p]===g.id),highP=btParts('high').filter(p=>T.high[p]===g.id),open=btg.open[g.id]!==false;
    const name=el('span',{class:'btname',text:g.name,title:'Double-click to rename'});name.addEventListener('dblclick',()=>bgtRename(g,name));
    const sw=el('input',{type:'color',class:'btcol',value:g.col,'aria-label':'Colour of '+g.name,title:'This group’s colour (Group colours)'});sw.addEventListener('input',()=>{g.col=sw.value;btg.texKey=null;bk.dirty=true;requestRender(true);});
    const row=el('div',{class:'btgroup'+(g.skip?' skip':'')+(g.hide?' hid':''),role:'treeitem','aria-expanded':String(open),'data-id':g.id},
      el('div',{class:'btgh'},el('button',{class:'btfold',text:open?'▾':'▸','aria-label':(open?'Fold ':'Unfold ')+g.name,onclick:()=>{btg.open[g.id]=!open;buildBakePanel();}}),sw,name,
        el('span',{class:'btcount',text:lowP.length+' / '+highP.length,title:lowP.length+' low-poly parts, '+highP.length+' high-poly parts'}),
        el('button',{class:'btn sm bteye'+(g.hide?'':' on'),text:g.hide?'◌':'👁','aria-pressed':String(!g.hide),title:g.hide?'Hidden in the view: click to show':'Shown in the view: click to hide','aria-label':(g.hide?'Show ':'Hide ')+g.name,onclick:()=>{g.hide=!g.hide;btChanged();}}),
        chk('btSkip_'+g.id,'Bake',!g.skip,v=>{g.skip=!v;btChanged();}),
        el('button',{class:'btn sm',text:'×',title:'Delete this group (its parts go to another group)','aria-label':'Delete '+g.name,onclick:()=>bgtDelete(g)})));
    if(open){const side=(s,parts,lab)=>{const b=el('div',{class:'btside','data-side':s},el('div',{class:'btsidek',text:lab}),...parts.map(p=>btPartChip(s,p,g)),parts.length?'':el('span',{class:'note',text:'Drag parts here'}));btDropOn(b,s,g);return b;};
      row.append(side('low',lowP,'Low'),hasHigh?side('high',highP,'High'):'');}
    list.append(row);}
  return [el('div',{class:'btload',id:'btLoader'},el('div',{class:'sub',text:'Quick loader',title:'Drop model files here: names ending in _low, _high and _cage go to the right place'}),btSlot('low','Low'),btSlot('high','High'),bakeHighList()),head,list];}
/* the old drop-down of group modes gives way to the tree; Explode, Match size and Move stay */
{const f=bgControls;bgControls=function(redraw){const out=f(redraw);return bgCfg().groupMode==='tree'?out.slice(1):out;};}
