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
/* Asking the graphics card for a texture setting (getTexParameter) makes the page wait for everything queued before it. We note what
   we set ourselves instead, and read that back (texParam). */
const glTP={unit:0,bound:[],m:new WeakMap()};
{const bt=gl.bindTexture.bind(gl),tp=gl.texParameteri.bind(gl),at=gl.activeTexture.bind(gl);
 gl.activeTexture=function(u){glTP.unit=u-gl.TEXTURE0;return at(u);};
 gl.bindTexture=function(tg,t){if(tg===gl.TEXTURE_2D)glTP.bound[glTP.unit]=t;return bt(tg,t);};
 gl.texParameteri=function(tg,pn,v){if(tg===gl.TEXTURE_2D&&(pn===gl.TEXTURE_MIN_FILTER||pn===gl.TEXTURE_WRAP_S||pn===gl.TEXTURE_WRAP_T)){const b=glTP.bound[glTP.unit];if(b){let r=glTP.m.get(b);if(!r){r={};glTP.m.set(b,r);}r[pn]=v;}}return tp(tg,pn,v);};}
/* the setting of the bound texture: what we set last, else the GL default */
function texParam(pn){const b=glTP.bound[glTP.unit],r=b&&glTP.m.get(b);if(r&&r[pn]!==undefined)return r[pn];return pn===gl.TEXTURE_MIN_FILTER?gl.NEAREST_MIPMAP_LINEAR:gl.REPEAT;}
const canFloat=!!gl.getExtension('EXT_color_buffer_float');
/* largest canvas side: 4096 in the browser; 8192 in the desktop app, 16384 on GPUs that support it */
const MAX_DIM=window.__TAURI__?(gl.getParameter(gl.MAX_TEXTURE_SIZE)>=16384?16384:8192):4096;
