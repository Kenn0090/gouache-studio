/* (0.95.1, Kenn) which way is up.
   Import: prefs.upAxis 'auto' | 'y' | 'z' (New 3D Paint Project window and the Bake tab's model loading; remembered).
   Auto = the file's own up axis (FBX GlobalSettings; glTF is always Y up), else Y up. A Z-up model is turned -90° about X so it stands in our Y-up view.
   m.upTurns counts those turns, so changing the choice on a staged model can turn it back.
   Turn buttons: 90° about X/Y/Z for the model (3D Paint) or both bake models (Bake tab), in the 3D view's ⋯ menu and under the Model list.
   Export: texCfg.up 'engine' | 'y' | 'z'; engine = Unreal/Blender Z up, Unity/Godot/none Y up; OBJ and FBX are turned, .glb stays Y up (glTF's rule). */
function meshTurn(m,axis,deg){if(!m||!m.pos)return m;const a=deg*Math.PI/180,c=Math.round(Math.cos(a)*1e9)/1e9,s=Math.round(Math.sin(a)*1e9)/1e9;
  const R=axis==='x'?[1,0,0, 0,c,s, 0,-s,c]:axis==='y'?[c,0,-s, 0,1,0, s,0,c]:[c,s,0, -s,c,0, 0,0,1];/* column-major: v' = R·v */
  const turn=(A,w)=>{if(!A)return A;const o=new A.constructor(A.length);for(let i=0;i<A.length;i+=w){const x=A[i],y=A[i+1],z=A[i+2];o[i]=R[0]*x+R[3]*y+R[6]*z;o[i+1]=R[1]*x+R[4]*y+R[7]*z;o[i+2]=R[2]*x+R[5]*y+R[8]*z;for(let k=3;k<w;k++)o[i+k]=A[i+k];}return o;};
  const r=Object.assign({},m,{pos:turn(m.pos,3),nrm:turn(m.nrm,3),tan:m.tan&&m.tan.length===m.pos.length/3*4?turn(m.tan,4):m.tan});
  for(const k of Object.keys(r))if(k[0]==='_')delete r[k];if(m.whole)r.whole=null;return r;}
/* a Z-up model stands up in our Y-up world: -90° about X */
const upZtoY=m=>meshTurn(m,'x',-90),upYtoZ=m=>meshTurn(m,'x',90);
function upWanted(m,choice){choice=choice||prefs.upAxis||'auto';if(choice==='z')return 1;if(choice==='y')return 0;return m&&m.fileUp==='z'?1:0;}
/* bring a freshly parsed model to the chosen up axis (or re-do it for a staged one) */
function upApply(m,choice){if(!m)return m;const want=upWanted(m,choice),have=m.upTurns||0;if(want===have)return m;let r=m;
  for(let i=have;i<want;i++)r=upZtoY(r);for(let i=want;i<have;i++)r=upYtoZ(r);r.upTurns=want;return r;}
const UP_CHOICES=[['auto','Auto (from the file, else Y up)'],['y','Y up'],['z','Z up']];
function upSelect(id,onChange){const s=el('select',{id,'aria-label':'Up axis'},...UP_CHOICES.map(([v,l])=>el('option',{value:v,text:l})));s.value=prefs.upAxis||'auto';
  s.onchange=()=>{prefs.upAxis=s.value==='auto'?undefined:s.value;savePrefs();if(onChange)onChange(s.value);};return el('div',{class:'frow'},el('label',{for:id,text:'Up axis'}),s);}
/* the turn buttons: turn the model on screen by 90° */
function upTurnModel(axis,deg){deg=deg||90;if(stroke){toast('Finish the stroke first.');return;}
  if(ui.mode==='bake'){const C=bakeCfg;let n=0;for(const k of ['low','high']){const m=C[k];if(!m)continue;bakeSetModel(k,meshTurn(m,axis,deg));n++;}if(!n){toast('Load a model first.');return;}toast('Turned the bake models '+deg+'° around '+axis.toUpperCase()+'.');return;}
  const m=v3.imported;if(!m||v3s().model!=='imported'){toast('Import a model first: the built-in shapes stay as they are.');return;}
  const r=meshTurn(m,axis,deg);v3.imported=r;if(ui.mode==='p3d')p3.imported=r;v3.mesh=null;v3LoadModel(true);v3Frame();v3.dirty=true;requestRender(true);
  toast('Turned the model '+deg+'° around '+axis.toUpperCase()+'. Painted textures stay on it.');}
function upTurnRow(pre){pre=pre||'upTurn_';return el('div',{class:'chips upturn'},el('span',{class:'dim',text:'Turn 90°'}),...['x','y','z'].map(a=>el('button',{class:'btn sm',id:pre+a,text:a.toUpperCase(),title:'Turn the model 90° around '+a.toUpperCase()+' (Shift: the other way)',onclick:e=>upTurnModel(a,e.shiftKey?-90:90)})));}
/* export */
const upEngine=()=>{const t=typeof es!=='undefined'&&esActive()?es.to:null;return t==='unreal'||t==='blender'?'z':'y';};
const upExportAxis=()=>{const v=texCfg.up||'engine';return v==='engine'?upEngine():v;};
