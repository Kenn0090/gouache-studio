/* ================= Files: shared helpers ================= */
const extOf=n=>((n||'').split('.').pop()||'').toLowerCase();
const baseName=n=>(n||'Untitled').replace(/\.[^.]+$/,'')||'Untitled';
const slug=s=>(String(s||'untitled').replace(/[^\w\- ]+/g,'').trim().replace(/\s+/g,'-').toLowerCase())||'untitled';
const GL_MAX=gl.getParameter(gl.MAX_TEXTURE_SIZE);
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function crc32(buf){let c=0xffffffff;for(let i=0;i<buf.length;i++)c=CRC[(c^buf[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;}
async function streamThrough(bytes,fmt,decompress){const cs=decompress?new DecompressionStream(fmt):new CompressionStream(fmt);return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(cs)).arrayBuffer());}
const zlib=b=>streamThrough(b,'deflate');
const tick=()=>new Promise(r=>setTimeout(r,16));
const srgb2lin=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);
const lin2srgb=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;
function needLib(g,what){if(!window[g])throw new Error(what+' support is still loading. Check your connection and try again in a moment.');}
