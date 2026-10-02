/* Preserve data-map samples that the browser's image decoder reduces to eight bits.
   PNG byte filters and Adam7 passes follow https://www.w3.org/TR/png-3/. */
async function decodePNG16(buf){const bytes=new Uint8Array(buf),dv=new DataView(buf);if(bytes.length<33||![137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v))throw new Error('Invalid PNG header.');
 const W=dv.getUint32(16),H=dv.getUint32(20),kind=bytes[25],C={0:1,2:3,4:2,6:4}[kind];
 if(bytes[24]!==16||!C||bytes[26]||bytes[27]||bytes[28]>1)throw new Error('Unsupported 16-bit PNG format.');
 if(!W||!H||W>GL_MAX||H>GL_MAX||W*H>=268435456)throw new Error('Use an 8-bit PNG or a smaller source for this 16K mesh map.');
 const parts=[];let transparent=null,ended=false;
 for(let p=8;p+12<=bytes.length;){const n=dv.getUint32(p),end=p+12+n;if(end>bytes.length)throw new Error('Truncated PNG chunk.');const type=String.fromCharCode(...bytes.subarray(p+4,p+8));
  if(crc32(bytes.subarray(p+4,p+8+n))!==dv.getUint32(p+8+n))throw new Error('PNG checksum mismatch.');
  if(type==='IDAT')parts.push(bytes.subarray(p+8,p+8+n));else if(type==='tRNS'){transparent=[];for(let i=0;i<n;i+=2)transparent.push(dv.getUint16(p+8+i));}else if(type==='IEND'){ended=true;break;}p=end;}
 if(!parts.length||!ended)throw new Error('Incomplete PNG data.');
 const passes=bytes[28]?[[0,0,8,8],[4,0,8,8],[0,4,4,8],[2,0,4,4],[0,2,2,4],[1,0,2,2],[0,1,1,2]]:[[0,0,1,1]],shape=passes.map(([x,y,dx,dy])=>({x,y,dx,dy,w:Math.max(0,Math.ceil((W-x)/dx)),h:Math.max(0,Math.ceil((H-y)/dy))}));
 const expected=shape.reduce((n,p)=>n+(p.w&&p.h?(1+p.w*C*2)*p.h:0),0),raw=new Uint8Array(expected),reader=new Blob(parts).stream().pipeThrough(new DecompressionStream('deflate')).getReader();let offset=0;
 try{for(;;){const {value,done}=await reader.read();if(done)break;if(offset+value.length>expected)throw new Error('PNG scanline size mismatch.');raw.set(value,offset);offset+=value.length;}}catch(e){await reader.cancel().catch(()=>{});throw e;}if(offset!==expected)throw new Error('Truncated PNG scanlines.');
 const out=new Uint16Array(W*H*4),paeth=(a,b,c)=>{const p=a+b-c,A=Math.abs(p-a),B=Math.abs(p-b),D=Math.abs(p-c);return A<=B&&A<=D?a:B<=D?b:c;};let p=0;
 for(const pass of shape){if(!pass.w||!pass.h)continue;const bpp=C*2,N=pass.w*bpp;let previous=new Uint8Array(N),row=new Uint8Array(N);
  for(let y=0;y<pass.h;y++){const filter=raw[p++];if(filter>4)throw new Error('Invalid PNG filter.');for(let x=0;x<N;x++){const a=x>=bpp?row[x-bpp]:0,b=previous[x],c=x>=bpp?previous[x-bpp]:0,pred=filter===1?a:filter===2?b:filter===3?(a+b)>>1:filter===4?paeth(a,b,c):0;row[x]=(raw[p++]+pred)&255;}
   for(let x=0;x<pass.w;x++){const at=x*bpp,q=((pass.y+y*pass.dy)*W+pass.x+x*pass.dx)*4,samples=[];for(let c=0;c<C;c++)samples.push(row[at+c*2]*256+row[at+c*2+1]);
    if(kind===0||kind===4){out[q]=out[q+1]=out[q+2]=samples[0];out[q+3]=kind===4?samples[1]:transparent&&samples[0]===transparent[0]?0:65535;}
    else{out[q]=samples[0];out[q+1]=samples[1];out[q+2]=samples[2];out[q+3]=kind===6?samples[3]:transparent&&samples.slice(0,3).every((v,i)=>v===transparent[i])?0:65535;}}
   [previous,row]=[row,previous];}}
 return {w:W,h:H,bits:16,data:out};}
