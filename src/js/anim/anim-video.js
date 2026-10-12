/* ================= Video export (0.59, Kenn): MP4 (H.264, H.265), MOV, WebM =================
   The browser's own video encoder (WebCodecs) makes the pictures; the little writers below put them in a file. Every frame keeps its
   own length (holds), so the timing is exact and nothing is played back in real time. */
const VID_FORMATS=[
  ['mp4-h264','MP4 · H.264','mp4','mp4',['avc1.640033','avc1.640028','avc1.4D4028','avc1.42E01E']],
  ['mp4-hevc','MP4 · H.265 (HEVC)','mp4','mp4',['hvc1.1.6.L153.B0','hvc1.1.6.L120.B0','hvc1.1.6.L93.B0']],
  ['mov-h264','MOV · H.264 (QuickTime)','mov','mov',['avc1.640033','avc1.640028','avc1.4D4028','avc1.42E01E']],
  ['webm-vp9','WebM · VP9','webm','webm',['vp09.00.40.08','vp09.00.30.08','vp09.00.10.08']],
  ['webm-av1','WebM · AV1','webm','webm',['av01.0.08M.08','av01.0.05M.08','av01.0.04M.08']],
  ['mp4-vp9','MP4 · VP9','mp4','mp4',['vp09.00.40.08','vp09.00.30.08','vp09.00.10.08'],true]];/* the last one is not offered in the window (few editors read it); it is used to check the MP4 writer */
const VID_QUALITY=[['low','Small file',.05],['med','Good',.1],['high','High',.2],['max','Best',.4]];
/* ---- bytes ---- */
const vb={u8:n=>[n&255],u16:n=>[n>>8&255,n&255],u32:n=>[n>>>24&255,n>>>16&255,n>>>8&255,n&255],str:s=>[...s].map(c=>c.charCodeAt(0)&255)};
function vcat(parts){let n=0;for(const p of parts)n+=p.length;const o=new Uint8Array(n);let k=0;for(const p of parts){o.set(p,k);k+=p.length;}return o;}
const vbox=(type,...parts)=>{const body=vcat(parts.map(p=>p instanceof Uint8Array?p:Uint8Array.from(p)));return vcat([Uint8Array.from(vb.u32(body.length+8)),Uint8Array.from(vb.str(type)),body]);};
const vfull=(type,ver,flags,...parts)=>vbox(type,[ver,flags>>16&255,flags>>8&255,flags&255],...parts);
const vmat=()=>[...vb.u32(0x10000),...vb.u32(0),...vb.u32(0),...vb.u32(0),...vb.u32(0x10000),...vb.u32(0),...vb.u32(0),...vb.u32(0),...vb.u32(0x40000000)];
/* the codec's own setup record, as the file wants it */
function vidConfigBox(codec,desc){const d=desc?new Uint8Array(desc.buffer?desc.buffer.slice(desc.byteOffset,desc.byteOffset+desc.byteLength):desc):new Uint8Array(0);
  if(codec.startsWith('avc1'))return ['avc1',vbox('avcC',d)];
  if(codec.startsWith('hvc1')||codec.startsWith('hev1'))return ['hvc1',vbox('hvcC',d)];
  if(codec.startsWith('av01'))return ['av01',vbox('av1C',d)];
  if(codec.startsWith('vp09')){const [,pp,ll,bb]=codec.split('.').map(Number);return ['vp09',vfull('vpcC',1,0,[pp||0,ll||10,((bb||8)<<4)|(1<<1)|0,1,1,1],vb.u16(0))];}
  throw new Error('Unknown codec '+codec);}
/* an MP4 (or MOV) with the video track; samples: [{data,dur(ms),key}] */
function mp4Write(samples,w,h,codec,desc,mov){const TS=90000,dur=s=>Math.max(1,Math.round(s.dur*TS/1000)),total=samples.reduce((a,s)=>a+dur(s),0),[entry,cfg]=vidConfigBox(codec,desc);
  const stts=[];for(const s of samples){const d=dur(s),l=stts[stts.length-1];if(l&&l[1]===d)l[0]++;else stts.push([1,d]);}
  const keys=[];samples.forEach((s,i)=>{if(s.key)keys.push(i+1);});
  const sample=vbox(entry,new Array(6).fill(0),vb.u16(1),vb.u16(0),vb.u16(0),new Array(12).fill(0),vb.u16(w),vb.u16(h),vb.u32(0x480000),vb.u32(0x480000),vb.u32(0),vb.u16(1),new Array(32).fill(0),vb.u16(0x18),[0xff,0xff],cfg);
  const moov=off=>vbox('moov',vfull('mvhd',0,0,vb.u32(0),vb.u32(0),vb.u32(TS),vb.u32(total),vb.u32(0x10000),vb.u16(0x100),new Array(10).fill(0),vmat(),new Array(24).fill(0),vb.u32(2)),
    vbox('trak',vfull('tkhd',0,3,vb.u32(0),vb.u32(0),vb.u32(1),vb.u32(0),vb.u32(total),new Array(8).fill(0),vb.u16(0),vb.u16(0),vb.u16(0),vb.u16(0),vmat(),vb.u32(w<<16),vb.u32(h<<16)),
      vbox('mdia',vfull('mdhd',0,0,vb.u32(0),vb.u32(0),vb.u32(TS),vb.u32(total),vb.u16(0x55c4),vb.u16(0)),vfull('hdlr',0,0,vb.u32(0),vb.str('vide'),new Array(12).fill(0),vb.str('VideoHandler'),[0]),
        vbox('minf',vfull('vmhd',0,1,vb.u16(0),vb.u16(0),vb.u16(0),vb.u16(0)),vbox('dinf',vfull('dref',0,0,vb.u32(1),vfull('url ',0,1))),
          vbox('stbl',vfull('stsd',0,0,vb.u32(1),sample),vfull('stts',0,0,vb.u32(stts.length),...stts.map(([c,d])=>[...vb.u32(c),...vb.u32(d)])),
            ...(keys.length<samples.length?[vfull('stss',0,0,vb.u32(keys.length),...keys.map(k=>vb.u32(k)))]:[]),
            vfull('stsc',0,0,vb.u32(1),vb.u32(1),vb.u32(samples.length),vb.u32(1)),vfull('stsz',0,0,vb.u32(0),vb.u32(samples.length),...samples.map(s=>vb.u32(s.data.length))),vfull('stco',0,0,vb.u32(1),vb.u32(off)))))));
  const ftyp=vbox('ftyp',vb.str(mov?'qt  ':'isom'),vb.u32(512),vb.str(mov?'qt  ':'isom'),vb.str(mov?'':'iso2avc1mp41'));
  const m0=moov(0),off=ftyp.length+m0.length+8,mdatSize=samples.reduce((a,s)=>a+s.data.length,0);
  return new Blob([ftyp,moov(off),Uint8Array.from([...vb.u32(mdatSize+8),...vb.str('mdat')]),...samples.map(s=>s.data)],{type:mov?'video/quicktime':'video/mp4'});}
/* a WebM (Matroska) with the video track */
function webmWrite(samples,w,h,codec,desc){const id=n=>{const o=[];while(n>0){o.unshift(n&255);n=Math.floor(n/256);}return o;},
    size=n=>{if(n<127)return [n|128];const b=[];let v=n;for(let i=0;i<7;i++){b.unshift(v&255);v=Math.floor(v/256);}return [0x01,...b];},
    el=(idb,body)=>{const bd=body instanceof Uint8Array?body:Uint8Array.from(body);return vcat([Uint8Array.from(idb),Uint8Array.from(size(bd.length)),bd]);},
    uint=n=>{const o=[];let v=n;do{o.unshift(v&255);v=Math.floor(v/256);}while(v>0);return o;},
    f64=x=>{const b=new DataView(new ArrayBuffer(8));b.setFloat64(0,x);return [...new Uint8Array(b.buffer)];},
    vp9=codec.startsWith('vp09'),cid=vp9?'V_VP9':'V_AV1';
  const total=samples.reduce((a,s)=>a+s.dur,0),ebml=el([0x1a,0x45,0xdf,0xa3],[...el([0x42,0x86],[1]),...el([0x42,0xf7],[1]),...el([0x42,0xf2],[4]),...el([0x42,0xf3],[8]),...el([0x42,0x82],vb.str('webm')),...el([0x42,0x87],[4]),...el([0x42,0x85],[2])]);
  const track=el([0xae],[...el([0xd7],[1]),...el([0x73,0xc5],[1]),...el([0x83],[1]),...el([0x86],vb.str(cid)),
    ...(!vp9&&desc?el([0x63,0xa2],new Uint8Array(desc.buffer?desc.buffer.slice(desc.byteOffset,desc.byteOffset+desc.byteLength):desc)):[]),...el([0xe0],[...el([0xb0],uint(w)),...el([0xba],uint(h))])]);
  const info=el([0x15,0x49,0xa9,0x66],[...el([0x2a,0xd7,0xb1],uint(1000000)),...el([0x44,0x89],f64(total)),...el([0x4d,0x80],vb.str('Gouache Studio')),...el([0x57,0x41],vb.str('Gouache Studio'))]);
  /* clusters: a new one at each key frame once 2 seconds have passed */
  const clusters=[];let t=0,cur=null;const flush=()=>{if(cur)clusters.push(el([0x1f,0x43,0xb6,0x75],cur.parts));cur=null;};
  for(const s of samples){if(!cur||(s.key&&t-cur.t0>=2000)||t-cur.t0>30000){flush();cur={t0:t,parts:[...el([0xe7],uint(Math.round(t)))]};}
    const rel=Math.round(t-cur.t0),blk=vcat([Uint8Array.from([0x81,rel>>8&255,rel&255,s.key?0x80:0]),s.data]);cur.parts.push(...el([0xa3],blk));t+=s.dur;}
  flush();
  const segBody=vcat([info,el([0x16,0x54,0xae,0x6b],track),...clusters]),seg=vcat([Uint8Array.from([0x18,0x53,0x80,0x67]),Uint8Array.from(size(segBody.length)),segBody]);
  return new Blob([ebml,seg],{type:'video/webm'});}
/* ---- the dialog and the encoding ---- */
async function vidSupport(fmt,w,h,fps,bitrate){const F=VID_FORMATS.find(f=>f[0]===fmt);if(typeof VideoEncoder==='undefined')return null;
  for(const codec of F[4]){try{const r=await VideoEncoder.isConfigSupported({codec,width:w,height:h,bitrate,framerate:fps});if(r&&r.supported)return codec;}catch(e){}}return null;}
/* every frame, in play order, with its length in milliseconds */
function vidSequence(A,tag,loops){let a=0,b=A.frames.length-1,mode='loop';if(tag>=0&&A.tags[tag]){[a,b]=tagRange(A.tags[tag],A);mode=A.tags[tag].mode;}
  const idx=[];for(let i=a;i<=b;i++)idx.push(i);if(mode==='pingpong')for(let i=b-1;i>a;i--)idx.push(i);const out=[];for(let k=0;k<loops;k++)for(const i of idx)out.push({i,ms:A.frames[i].hold*1000/A.fps});return out;}
/* the picture of every frame (effects included), drawn on a background */
async function vidEncode(o,progress){const A=A_(),W=Math.max(2,Math.round(doc.w*o.scale)&~1),H=Math.max(2,Math.round(doc.h*o.scale)&~1),fps=Math.max(1,A.fps),bpp=VID_QUALITY.find(q=>q[0]===o.quality)[2],bitrate=Math.round(W*H*fps*bpp);
  const codec=await vidSupport(o.fmt,W,H,fps,bitrate);if(!codec)throw new Error('This computer cannot make '+VID_FORMATS.find(f=>f[0]===o.fmt)[1]+' video at '+W+' × '+H+'. Try a smaller size or another format.');
  const full=afxRenderAll(A),seq=vidSequence(A,o.tag,o.loops),cv=document.createElement('canvas');cv.width=W;cv.height=H;const x=cv.getContext('2d');
  const chunks=[];let desc=null,err=null;
  const enc=new VideoEncoder({output:(c,meta)=>{const d=new Uint8Array(c.byteLength);c.copyTo(d);if(meta&&meta.decoderConfig&&meta.decoderConfig.description&&!desc)desc=meta.decoderConfig.description;chunks.push({data:d,key:c.type==='key',ts:c.timestamp,dur:(c.duration||0)/1000});},error:e=>{err=e;}});
  enc.configure(Object.assign({codec,width:W,height:H,bitrate,framerate:fps,latencyMode:'quality'},codec.startsWith('avc1')?{avc:{format:'avc'}}:codec.startsWith('hvc1')?{hevc:{format:'hevc'}}:{}));
  let ts=0;const gop=Math.max(1,Math.round(fps*2));
  for(let k=0;k<seq.length;k++){if(err)throw err;x.fillStyle=o.bg;x.fillRect(0,0,W,H);x.imageSmoothingQuality='high';x.drawImage(full[seq[k].i],0,0,W,H);
    const vf=new VideoFrame(cv,{timestamp:Math.round(ts*1000),duration:Math.round(seq[k].ms*1000)});enc.encode(vf,{keyFrame:k%gop===0});vf.close();ts+=seq[k].ms;
    while(enc.encodeQueueSize>6)await new Promise(r=>setTimeout(r,4));if(progress&&k%4===0){progress(k/seq.length);await new Promise(r=>setTimeout(r,0));}}
  await enc.flush();enc.close();if(err)throw err;if(!chunks.length)throw new Error('The encoder made no frames.');
  chunks.sort((a,b)=>a.ts-b.ts);const samples=chunks.map((c,i)=>({data:c.data,key:c.key,dur:c.dur||seq[i].ms}));
  const F=VID_FORMATS.find(f=>f[0]===o.fmt);return {blob:F[2]==='webm'?webmWrite(samples,W,H,codec,desc):mp4Write(samples,W,H,codec,desc,F[2]==='mov'),ext:F[3],w:W,h:H,frames:seq.length,codec};}
function dlgExportVideo(){if(!doc.anim){toast('Switch to Animation mode (top right) and make some frames first.');return;}if(!ensureAnimMode())return;stopPlay();
  const A=A_(),o={fmt:'mp4-h264',scale:1,quality:'high',tag:-1,loops:1,bg:'#ffffff'},note=el('p',{class:'note',id:'vidNote'});
  const sel=(id,label,opts,get,set)=>{const s=el('select',{id,'aria-label':label},...opts.map(([v,t])=>el('option',{value:String(v),text:t})));s.value=String(get());s.onchange=()=>{set(s.value);upd();};return el('div',{class:'frow'},el('label',{for:id,text:label}),s);};
  const secs=()=>{const seq=vidSequence(A,o.tag,o.loops),ms=seq.reduce((a,s)=>a+s.ms,0);return {n:seq.length,s:ms/1000};};
  const upd=async()=>{const W=Math.max(2,Math.round(doc.w*o.scale)&~1),H=Math.max(2,Math.round(doc.h*o.scale)&~1),q=secs(),bpp=VID_QUALITY.find(x=>x[0]===o.quality)[2],bitrate=Math.round(W*H*Math.max(1,A.fps)*bpp);
    note.textContent=W+' × '+H+' · '+A.fps+' frames a second · '+q.n+' frames · '+q.s.toFixed(1)+' seconds · about '+(bitrate*q.s/8/1e6).toFixed(1)+' MB';
    const okc=await vidSupport(o.fmt,W,H,A.fps,bitrate);if(!okc)note.textContent+=' — this computer cannot make this format at this size.';};
  const fmtRow=sel('vidFmt','Format',VID_FORMATS.filter(f=>!f[5]).map(f=>[f[0],f[1]]),()=>o.fmt,v=>{o.fmt=v;});
  const body=el('div',{class:'dlg-grid vidDlg'},fmtRow,
    sel('vidScale','Size',[[1,'Full size'],[.75,'75%'],[.5,'Half'],[.25,'Quarter']],()=>o.scale,v=>{o.scale=+v;}),
    sel('vidQ','Quality',VID_QUALITY.map(q=>[q[0],q[1]]),()=>o.quality,v=>{o.quality=v;}),
    sel('vidTag','Play',[[-1,'All frames'],...A.tags.map((t,i)=>[i,'Tag: '+t.name])],()=>o.tag,v=>{o.tag=+v;}),
    sel('vidLoops','Repeat',[[1,'Once'],[2,'2 times'],[3,'3 times'],[5,'5 times'],[10,'10 times']],()=>o.loops,v=>{o.loops=+v;}),
    el('div',{class:'frow'},el('label',{for:'vidBg',text:'Background'}),el('input',{id:'vidBg',type:'color',value:o.bg,'aria-label':'Background colour',oninput(){o.bg=this.value;}}),el('span',{class:'dim',text:'video cannot be see-through'})),
    note,el('p',{class:'note',text:'Every frame keeps its own length. H.265 and some sizes depend on this computer’s graphics card.'}));
  upd();openDialog({title:'Export video',body,okLabel:'Export',onOk(){setTimeout(vidRun.bind(null,o),0);}});}
async function vidRun(o){loadStart('Making the video');try{const r=await vidEncode(o,f=>loadSet(f*.95,'Encoding frame '+Math.round(f*100)+'%…'));loadSet(.97,'Saving…');
    const d=await deliver(slug(doc.name)+'.'+r.ext,r.blob);toast(deliveredText(d,'Video')+' ('+r.w+' × '+r.h+', '+r.frames+' frames, '+r.codec.split('.')[0]+')');}
  catch(e){console.error(e);toast('The video could not be made: '+(e.message||e));}finally{loadEnd();}}
