/* ================= Loading bar =================
   Shown while files come in: a real bar while bytes are read (big files are read in pieces),
   then a moving bar while the file is turned into layers or a model. The moving bar is a CSS
   animation, so it keeps moving even while the app is busy reading the file. */
let loadBox=null,loadDepth=0;
function loadEls(){if(!loadBox){loadBox=el('div',{id:'loadBox',role:'status','aria-live':'polite',hidden:true},el('div',{class:'lb-name'}),el('div',{class:'lb-msg'}),el('div',{class:'lb-bar'},el('div')));document.body.append(loadBox);}return loadBox;}
function loadStart(name){const b=loadEls();loadDepth++;b.hidden=false;b.querySelector('.lb-name').textContent=name||'';loadSet(0,'Reading…');}
function loadSet(f,msg){const b=loadEls();b.hidden=false;const bar=b.querySelector('.lb-bar');bar.classList.remove('busy');bar.firstChild.style.width=(clamp(f,0,1)*100).toFixed(1)+'%';if(msg)b.querySelector('.lb-msg').textContent=msg;}
function loadBusy(msg){const b=loadEls();b.hidden=false;b.querySelector('.lb-bar').classList.add('busy');if(msg)b.querySelector('.lb-msg').textContent=msg;}
function loadEnd(){loadDepth=Math.max(0,loadDepth-1);if(!loadDepth&&loadBox)loadBox.hidden=true;}
/* let the bar show before a long, blocking step */
const loadPaint=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));
/* read a dropped or picked File with progress */
async function readFileObj(file){const size=file.size||0;if(size<16*1024*1024||!file.stream)return new Uint8Array(await file.arrayBuffer());
  const out=new Uint8Array(size),rd=file.stream().getReader();let o=0,last=0;
  for(;;){const {done,value}=await rd.read();if(done)break;out.set(value,o);o+=value.length;if(o-last>4*1024*1024){last=o;loadSet(o/size,'Reading '+file.name+' · '+Math.round(o/1048576)+' of '+Math.round(size/1048576)+' MB');}}
  return out;}
