/* also finds panels moved into their own windows (ui/dock.js) */
const $=s=>document.querySelector(s)||(typeof dkPopQuery==='function'?dkPopQuery(s):null);
function el(tag,attrs,...kids){const e=document.createElement(tag);if(attrs)for(const k in attrs){const v=attrs[k];if(k==='class')e.className=v;else if(k==='text')e.textContent=v;else if(k[0]==='_')e[k]=v;else if(k.startsWith('on')&&typeof v==='function')e.addEventListener(k.slice(2),v);else if(v===true)e.setAttribute(k,'');else if(v!==false&&v!=null)e.setAttribute(k,v);}for(const c of kids)if(c!=null&&c!==false)e.append(c);return e;}
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const mod=(a,n)=>((a%n)+n)%n;

const cv=$('#gl'), stage=$('#stage');
let toastTimer=0;
function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},2800);}

const gl=cv.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,premultipliedAlpha:false});
if(!gl){stage.append(el('div',{class:'fatal',text:'This editor needs WebGL2, which this browser or device does not provide. Try a current version of Chrome, Edge or Firefox with hardware acceleration turned on.'}));return;}
const canFloat=!!gl.getExtension('EXT_color_buffer_float');
/* largest canvas side: 4096 in the browser; 8192 in the desktop app, 16384 on GPUs that support it */
const MAX_DIM=window.__TAURI__?(gl.getParameter(gl.MAX_TEXTURE_SIZE)>=16384?16384:8192):4096;
