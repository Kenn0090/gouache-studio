/* ================= 3D Paint projects (.gouache3d) =================
   The 3D Paint tab's own file, like a Substance Painter project: the model (with its materials) and every
   texture set, each stored as a complete .gouache document, plus the camera and view settings.
   Layout: "GOUACHE3", u32 version, u32 header length, header JSON, then the blobs. */
const G3_MAGIC=[71,79,85,65,67,72,69,51],G3_VERSION=1;
const isP3Proj=buf=>{const u=new Uint8Array(buf,0,Math.min(8,buf.byteLength));return u.length===8&&G3_MAGIC.every((v,i)=>u[i]===v);};
/* every set as a .gouache blob (the others are stepped into for a moment; the screen holds still meanwhile) */
async function encodeP3Project(){if(ui.mode!=='p3d')throw new Error('Open the 3D Paint tab first.');const blobs=[];let off=0;const put=b=>{blobs.push(b);const r={o:off,n:b.length};off+=b.length;return r;};
  const sets=[];tabDocs.hold=true;
  try{for(let i=0;i<p3.sets.length;i++){const S=p3.sets[i];let bytes;
      if(i===p3.cur)bytes=new Uint8Array(await (await encodeGouacheNow({lean:true})).arrayBuffer());
      else if(S.state){const mine=docState();setDocState(S.state);try{bytes=new Uint8Array(await (await encodeGouacheNow({lean:true})).arrayBuffer());}finally{S.state=docState();setDocState(mine);}}
      sets.push(Object.assign({name:S.name},bytes?put(bytes):{empty:true}));}}
  finally{tabDocs.hold=false;requestRender(true);}
  let mesh=null;if(v3s().model==='imported'&&v3.imported){const c=await streamThrough(meshPack(v3.imported),'deflate-raw');mesh=Object.assign({name:v3.imported.name},put(c));}
  const head={app:'Gouache Studio',v:G3_VERSION,name:p3.name||'3D Paint',size:p3.size,cur:p3.cur,sets,mesh,v3d:doc.v3d,cam:Object.assign({},v3.cam),mir3:Object.assign({},mir3)};
  const hj=new TextEncoder().encode(JSON.stringify(head)),pre=new Uint8Array(16);pre.set(G3_MAGIC,0);const dv=new DataView(pre.buffer);dv.setUint32(8,G3_VERSION,true);dv.setUint32(12,hj.length,true);
  return new Blob([pre,hj,...blobs],{type:'application/octet-stream'});}
async function saveP3Project(forceAsk){if(stroke)return;toast('Saving the 3D Paint project…');
  try{await tick();const blob=await encodeP3Project(),bytes=new Uint8Array(await blob.arrayBuffer()),nm=slug(p3.name||'3D Paint')+'.gouache3d';
    if(platform.isDesktop&&p3.path&&!forceAsk){await platform.writeFile(p3.path,bytes);p3.savedAt=p3Sig();toast('Saved '+p3.path);return;}
    if(platform.isDesktop){const path=await platform.saveAs(nm,bytes,'Gouache Studio 3D Paint project');if(!path){toast('Save cancelled.');return;}
      p3.path=path;p3.name=baseName(fileNameOf(path));platform.recentAdd(path);p3.savedAt=p3Sig();toast('Saved '+path);return;}
    const r=await deliver(nm,blob);toast(deliveredText(r,'Project'));if(r.ok)p3.savedAt=p3Sig();}
  catch(e){console.error(e);toast('The project could not be saved: '+(e.message||e));}}
/* something to tell whether there is unsaved work */
const p3Sig=()=>p3.sets.map((S,i)=>{const u=i===p3.cur?hist.undo:(S.state?S.state.undo:[]);return u.length+':'+(u[u.length-1]||{}).label;}).join('|');
function p3AskReplace(){if(!p3.started||p3Sig()===p3.savedAt||p3.sets.every((S,i)=>!(i===p3.cur?hist.undo.length:(S.state&&S.state.undo.length))))return Promise.resolve(true);
  return new Promise(res=>openDialog({title:'Replace the 3D Paint project?',body:el('p',{class:'note',text:'Opening a project replaces the model and texture sets in 3D Paint. Save first (Ctrl+S in the 3D Paint tab) if you want to keep them.'}),okLabel:'Open anyway',onOk(){res(true);},onCancel(){res(false);}}));}
async function openP3Project(buf,name,path){if(!isP3Proj(buf))throw new Error('This is not a Gouache Studio 3D Paint project.');const dv=new DataView(buf),ver=dv.getUint32(8,true),hl=dv.getUint32(12,true);
  if(ver>G3_VERSION)throw new Error('This project was saved by a newer Gouache Studio. Update the app to open it.');
  const head=JSON.parse(new TextDecoder().decode(new Uint8Array(buf,16,hl))),data=16+hl;
  if(ui.mode!=='p3d'&&!setMode('p3d',true))return;if(!(await p3AskReplace()))return;
  /* put away what is there now */
  const old=docState();for(const S of p3.sets){if(S.state)disposeDocState(S.state);if(S.tex)for(const k in S.tex)disposeTarget(S.tex[k]);}for(const k in v3.tex)disposeTarget(v3.tex[k]);v3.tex={};
  p3.sets=[];p3.size=head.size||p3.size;
  const states=[];
  for(const rec of head.sets||[]){let st=null;
    if(!rec.empty){const b=buf.slice(data+rec.o,data+rec.o+rec.n),{head:h,data:d}=gfHead(b);blankTabDoc(h.w,h.h,rec.name);for(const L of everyNode())disposeLayer(L);doc.root.children=[];doc.count=0;
      await gfReadInto(b,h,d);doc.p3=true;doc.name=rec.name;hist.undo=[];hist.redo=[];st=docState();}
    states.push(st);p3.sets.push({name:rec.name,state:st,tex:null,missing:false});}
  if(!p3.sets.length)throw new Error('This project has no texture sets.');
  disposeDocState(old);
  p3.cur=clamp(head.cur||0,0,p3.sets.length-1);const A=p3.sets[p3.cur];
  if(A.state){setDocState(A.state);A.state=null;}else{blankTabDoc(p3.size,p3.size,A.name);p3Setup(A.name);}
  p3.v3d=doc.v3d=Object.assign({},V3D_DEFAULTS,head.v3d||{});if(head.cam)Object.assign(v3.cam,head.cam);if(head.mir3)Object.assign(mir3,head.mir3);p3.cam=Object.assign({},v3.cam);
  v3.imported=null;if(head.mesh){const raw=await streamThrough(new Uint8Array(buf,data+head.mesh.o,head.mesh.n),'deflate-raw',true);v3.imported=meshUnpack(raw,head.mesh.name||'Model');}
  p3.imported=v3.imported;if(doc.v3d.model==='imported'&&!v3.imported)doc.v3d.model='rcube';
  p3.name=head.name||name;p3.path=path||null;p3.started=true;
  v3.mesh=null;if(v3.on)v3LoadModel(true);v3.mapsDirty=true;v3.dirty=true;
  $('#docName').textContent=doc.name;if(typeof selChanged==='function')selChanged();
  renderLayers();refreshChanUI();refreshMapsUI();buildBrushPanel();changedAll();fit();updateStatus();buildP3Panel();if(v3.on)build3dPane();requestRender(true);
  p3.savedAt=p3Sig();toast('Opened the 3D Paint project “'+p3.name+'”.');}
