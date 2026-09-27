/* ================= Channels panel ================= */
const chan={edit:[1,1,1,1],show:[1,1,1,0]};
const CHS=[{name:'RGB',i:-1,k:'2'},{name:'Red',i:0,k:'3'},{name:'Green',i:1,k:'4'},{name:'Blue',i:2,k:'5'},{name:'Alpha',i:3,k:'6'}];
const chanCanvases=CHS.map(()=>{const c=el('canvas',{width:40,height:40});return c;});
function chanRestricted(){return chan.edit.some(v=>!v);}
function chanLabel(){return ['R','G','B','A'].filter((_,i)=>chan.edit[i]).join('+')||'none';}
function selectChannel(i,additive){
  if(i<0){chan.edit=[1,1,1,1];chan.show=[1,1,1,0];}
  else if(additive&&chanRestricted()){chan.edit[i]=chan.edit[i]?0:1;chan.show[i]=chan.edit[i];if(!chan.edit.some(Boolean)){chan.edit=[1,1,1,1];chan.show=[1,1,1,0];}}
  else{chan.edit=[0,0,0,0];chan.show=[0,0,0,0];chan.edit[i]=1;chan.show[i]=1;}
  refreshChanUI();requestRender();schedulePreview();}
function refreshChanUI(){const list=$('#chanList');list.replaceChildren();const all=!chanRestricted();
  CHS.forEach((c,k)=>{const on=c.i<0?all:(!all&&!!chan.edit[c.i]);const shown=c.i<0?chan.show[0]&&chan.show[1]&&chan.show[2]:!!chan.show[c.i];
    const eye=el('button',{class:'eye','aria-label':(shown?'Hide ':'Show ')+c.name,title:shown?'Hide in view':'Show in view'});eye.innerHTML=shown?eyeOn:eyeOff;
    eye.addEventListener('click',e=>{e.stopPropagation();if(c.i<0){const v=shown?0:1;chan.show[0]=chan.show[1]=chan.show[2]=v;}else chan.show[c.i]=chan.show[c.i]?0:1;refreshChanUI();requestRender();});
    const row=el('div',{class:'crow2'+(on?' on':''),role:'option','aria-selected':String(on),tabindex:'0'},eye,chanCanvases[k],el('div',{class:'lname',text:c.name}),el('kbd',{text:'Alt+'+c.k}));
    row.addEventListener('click',e=>selectChannel(c.i,e.ctrlKey||e.metaKey||e.shiftKey));
    row.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectChannel(c.i,false);}});
    list.append(row);});
  const st=$('#stChan');st.hidden=all;st.textContent='Channels: '+chanLabel();$('#chanState').textContent=all?'':'editing '+chanLabel();
  $('#brushTitle').dataset.chan=all?'':chanLabel();}
$('#stChan').addEventListener('click',()=>selectChannel(-1));
function drawChannelThumbs(){renderThumb(compOut,buf=>{
  CHS.forEach((c,k)=>{const x=chanCanvases[k].getContext('2d'),img=x.createImageData(40,40),d=img.data;
    for(let i=0;i<d.length;i+=4){const a=buf[i+3];
      if(c.i<0){const bg=((((i/4)%40)>>2)+(((i/4)/40|0)>>2))&1?58:47;d[i]=buf[i]+bg*(255-a)/255;d[i+1]=buf[i+1]+bg*(255-a)/255;d[i+2]=buf[i+2]+bg*(255-a)/255;}
      else{const v=c.i===3?a:buf[i+c.i];d[i]=d[i+1]=d[i+2]=v;}d[i+3]=255;}
    x.putImageData(img,0,0);});});}
