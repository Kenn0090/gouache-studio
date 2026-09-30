/* ================= Environments in the shelf (0.36.3) =================
   The HDRIs as thumbnails: click one to light the model with it. Thumbnails are drawn once, from the
   bundled files, one at a time in the background. "Your own…" reads a .hdr or .exr, "Simple sky" turns the HDRI off. */
const envThumbs={};let envThumbBusy=false;
function envThumbNext(){if(envThumbBusy)return;const it=ENV_LIST.find(e=>!envThumbs[e[0]]);if(!it)return;envThumbBusy=true;
  envBundled(it[2]).then(u=>{const img=parseHDR(u),W=96,H=48,c=document.createElement('canvas');c.width=W;c.height=H;const g=c.getContext('2d'),d=g.createImageData(W,H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=Math.floor((x+.5)/W*img.w),sy=Math.floor((y+.5)/H*img.h),o=(sy*img.w+sx)*3;
      for(let k=0;k<3;k++){const v=img.rgb[o+k],t=v/(1+v);d.data[(y*W+x)*4+k]=Math.round(255*Math.pow(Math.min(1,t*1.6),1/2.2));}d.data[(y*W+x)*4+3]=255;}
    g.putImageData(d,0,0);envThumbs[it[0]]=c.toDataURL('image/jpeg',.8);}).catch(()=>{envThumbs[it[0]]='';}).finally(()=>{envThumbBusy=false;renderEnvs();});}
function envPick(k){const s=v3s();s.env=k;envEnsure();v3.dirty=true;requestRender();renderEnvs();
  if(typeof renderShading==='function')try{renderShading();}catch(e){}}
function renderEnvs(){const box=$('#envBody');if(!box)return;const cur=envOf(v3s());
  const tile=(k,label,img,title)=>{const b=el('button',{class:'mattile envtile'+(cur===k?' sel':''),title:title||label,'aria-label':label,'aria-pressed':cur===k?'true':'false',onclick:()=>envPick(k)},
      img?el('img',{src:img,alt:'',draggable:'false',style:'width:100%;aspect-ratio:2/1;object-fit:cover;border-radius:4px'}):el('div',{style:'width:100%;aspect-ratio:2/1;border-radius:4px;background:var(--ground)'}),el('span',{class:'mtname',text:label}));return b;};
  const mine=env.custom?[tile('custom',env.custom.name,'','Your own environment')]:[];
  box.replaceChildren(el('div',{class:'chips'},el('button',{class:'btn sm',id:'envLoad',text:'Load your own…',title:'Read a .hdr or .exr file',onclick:()=>envLoadFile().then(renderEnvs)})),
    el('div',{class:'matgrid',id:'envGrid'},...ENV_LIST.map(([id,l,f,by])=>tile(id,l,envThumbs[id],l+' by '+by+' (Poly Haven, CC0)')),...mine,tile('none','Simple sky','','A plain sky with a sun, no HDRI')));
  envThumbNext();}
