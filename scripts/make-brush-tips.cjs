/* Makes the bundled "texture brush" tips: drips, worn and torn edges, cracks, scratches, splatter, chips, dry-brush streaks, blotches.
   Original shapes drawn from noise, so there is nothing to credit. Run: node scripts/make-brush-tips.cjs
   Writes 512x512 grey PNGs (white = paint) to assets/brushes/user/ and prints the preset list for src/js/paint/brush-library.js. */
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const OUT=path.resolve(__dirname,'../assets/brushes/user'),N=512;
/* seeded random numbers and smooth value noise */
function rng(seed){let s=seed>>>0||1;return()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};}
function noiser(seed){const R=rng(seed),T=new Float32Array(256*256);for(let i=0;i<T.length;i++)T[i]=R();const at=(x,y)=>T[((y&255)<<8)|(x&255)];
  const n2=(x,y)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);return at(ix,iy)*(1-u)*(1-v)+at(ix+1,iy)*u*(1-v)+at(ix,iy+1)*(1-u)*v+at(ix+1,iy+1)*u*v;};
  const fbm=(x,y,o=5)=>{let a=.5,s=0,t=0;for(let i=0;i<o;i++){s+=a*n2(x,y);t+=a;x*=2.03;y*=2.03;a*=.5;}return s/t;};return {n2,fbm};}
const sm=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};
/* a picture is a Float32Array of coverage 0..1 */
const blank=()=>new Float32Array(N*N);
function stamp(img,cx,cy,r,v=1){const x0=Math.max(0,Math.floor(cx-r-1)),x1=Math.min(N-1,Math.ceil(cx+r+1)),y0=Math.max(0,Math.floor(cy-r-1)),y1=Math.min(N-1,Math.ceil(cy+r+1));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const d=Math.hypot(x+.5-cx,y+.5-cy),a=Math.min(1,Math.max(0,r-d+.5))*v;if(a>img[y*N+x])img[y*N+x]=a;}}
function line(img,x0,y0,x1,y1,r0,r1,v=1){const L=Math.hypot(x1-x0,y1-y0),n=Math.max(1,Math.ceil(L/.6));for(let i=0;i<=n;i++){const t=i/n;stamp(img,x0+(x1-x0)*t,y0+(y1-y0)*t,r0+(r1-r0)*t,v);}}
function polygon(img,pts,v=1){let x0=N,x1=0,y0=N,y1=0;for(const [x,y] of pts){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  for(let y=Math.max(0,Math.floor(y0));y<=Math.min(N-1,Math.ceil(y1));y++)for(let x=Math.max(0,Math.floor(x0));x<=Math.min(N-1,Math.ceil(x1));x++){
    const px=x+.5,py=y+.5;let inside=false,dmin=1e9;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const [xi,yi]=pts[i],[xj,yj]=pts[j];
      if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)inside=!inside;
      const dx=xj-xi,dy=yj-yi,t=Math.max(0,Math.min(1,((px-xi)*dx+(py-yi)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(px-xi-dx*t,py-yi-dy*t);if(d<dmin)dmin=d;}
    const a=Math.min(1,Math.max(0,(inside?1:-1)*dmin+.5))*v;if(a>img[y*N+x])img[y*N+x]=a;}}
/* ---- the shapes: angular and abstract (straight edges, sharp corners, broken pieces) ---- */
function erasePoly(img,pts){const t=blank();polygon(t,pts);for(let i=0;i<img.length;i++)img[i]=Math.min(img[i],1-t[i]);}
const jit=(R,a)=>(R()-.5)*2*a;
/* drips as tapering shards hanging from a jagged top band, with broken-off bits below */
function drips(seed,o={}){const R=rng(seed),img=blank(),n=o.n||7,band=N*(o.band||.1),top=[];
  for(let x=0;x<=N+20;x+=N/(14+R()*5))top.push([x,band*(.6+R()*.9)]);polygon(img,[[-5,-5],[N+5,-5],...top.reverse().map(p=>[p[0],p[1]]),[-5,band]]);
  for(let i=0;i<n;i++){const x=(i+.5+jit(R,.3))/n*N,w=N*(.014+R()*.03)*(o.thick||1),L=N*(.2+R()*.65)*(o.long||1),sk=jit(R,w*1.4),sk2=jit(R,w*1.8),mid=.45+R()*.3;
    const pts=[[x-w,band*.5],[x+w,band*.5],[x+w*.8+sk*.4,L*mid],[x+sk+w*.25,L],[x+sk2-w*.5,L*(mid+.12)],[x-w*.8+sk*.3,L*mid*.9]];polygon(img,pts);
    if(R()<.6){const by=L+N*(.03+R()*.08),bx=x+sk+jit(R,w),r=w*(.5+R()*.7);polygon(img,[[bx,by-r*1.4],[bx+r,by],[bx,by+r*1.4],[bx-r*.8,by+r*.3]]);}}
  return img;}
/* a worn edge: straight facets along the top, angular chips taken out of it, loose slivers above */
function wear(seed,o={}){const R=rng(seed),img=blank(),base=N*(1-(o.base||.45)),amp=N*(o.amp||.28),step=N/(o.f||9),ridge=[];
  for(let x=-step;x<=N+step;x+=step*(.5+R()*1.0))ridge.push([x,base+jit(R,amp)*(R()<.2?1.5:1)]);
  polygon(img,[[-10,N+10],...ridge,[N+10,N+10]]);
  const cn=Math.round((o.chips||14)*(o.band?o.band/.16:1));
  for(let i=0;i<cn;i++){const cx=R()*N,ry=ridge.reduce((m,p)=>Math.abs(p[0]-cx)<Math.abs(m[0]-cx)?p:m)[1],cy=ry+R()*N*(o.band||.16),r=N*(.01+R()*.035),k=3+((R()*2)|0),rot=R()*6.28,pts=[];
    for(let j=0;j<k;j++){const a=rot+j/k*6.2832+jit(R,.5),rr=r*(.6+R()*.7);pts.push([cx+Math.cos(a)*rr*1.4,cy+Math.sin(a)*rr]);}erasePoly(img,pts);}
  for(let i=0;i<(o.spike||0)*30;i++){const x=R()*N,y=base+jit(R,amp)-N*.02,r=N*(.006+R()*.014);polygon(img,[[x,y-r*2],[x+r,y+r],[x-r*1.2,y+r*.6]]);}
  return img;}
/* torn: a hard zigzag, then a fringe of splinters */
function torn(seed,o={}){const R=rng(seed),img=blank(),base=N*(1-(o.base||.5)),amp=N*(o.amp||.3)*.5,step=N/(o.f||12),ridge=[];let y=base;
  for(let x=-step;x<=N+step;x+=step*(.4+R()*.9)){y=Math.max(base-amp*1.6,Math.min(base+amp*1.6,y+jit(R,amp)));ridge.push([x,y]);}
  polygon(img,[[-10,N+10],...ridge,[N+10,N+10]]);
  for(let i=0;i<46;i++){const k=(R()*(ridge.length-1))|0,p=ridge[k],q=ridge[k+1],t=R(),x=p[0]+(q[0]-p[0])*t,yy=p[1]+(q[1]-p[1])*t,L=N*(.02+R()*.07),a=-Math.PI/2+jit(R,.9),w=N*(.002+R()*.005);
    polygon(img,[[x-w,yy+2],[x+w,yy+2],[x+Math.cos(a)*L,yy+Math.sin(a)*L]]);}
  return img;}
/* fractures: straight runs that bend at hard angles and fork */
function cracks(seed,o={}){const R=rng(seed),img=blank();
  function walk(x,y,ang,len,r,depth){let px=x,py=y,done=0;while(done<len){const seg=N*(.03+R()*.07),nx=px+Math.cos(ang)*seg,ny=py+Math.sin(ang)*seg,rr=Math.max(.6,r*(1-done/len*.85));line(img,px,py,nx,ny,rr,Math.max(.5,rr*.8),1);
      px=nx;py=ny;done+=seg;ang+=(R()<.5?-1:1)*(.25+R()*(o.bend||.9));
      if(depth<(o.depth||3)&&R()<(o.branch||.3))walk(px,py,ang+(R()<.5?-1:1)*(.6+R()*.8),len*(.3+R()*.35)-done*.2,r*.7,depth+1);
      if(R()<.12){px+=Math.cos(ang)*seg*.5;py+=Math.sin(ang)*seg*.5;}if(px<-30||px>N+30||py<-30||py>N+30)break;}}
  const roots=o.roots||1;for(let i=0;i<roots;i++)walk(o.fromTop?N*(.2+R()*.6):N*(.15+R()*.7),o.fromTop?0:N*(.15+R()*.7),o.fromTop?Math.PI/2+jit(R,.5):R()*6.28,N*(o.len||.9),o.r||2.2,0);
  return img;}
/* grungy scratches: bundles of uneven, broken gouges with grit, scuffed smears and dust along them */
function scratches(seed,o={}){const R=rng(seed),{fbm,n2}=noiser(seed),img=blank(),base=o.ang==null?Math.PI/2:o.ang,ca=Math.cos(base),sa=Math.sin(base),n=o.n||14;
  /* scuff: streaky clouds stretched along the scratch direction */
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const u=x*ca+y*sa,v=-x*sa+y*ca,c=fbm(u/(o.long||70)+seed,v/(o.wide||5),4),m=fbm(x/90,y/90+3,3);img[y*N+x]=Math.max(0,sm(.56,.78,c)*sm(.35,.65,m)*.5*(o.scuff==null?1:o.scuff));}
  for(let i=0;i<n;i++){const cx=N*(.1+R()*.8),cy=N*(.1+R()*.8),len=N*(.25+R()*.7),ang=base+jit(R,o.spread||.4),w=.6+R()*(o.thick||2.2);let px=cx-Math.cos(ang)*len/2,py=cy-Math.sin(ang)*len/2;const k=Math.ceil(len/6);
    for(let s=0;s<k;s++){const t=(s+1)/k,nx=cx-Math.cos(ang)*len/2+Math.cos(ang)*len*t+jit(R,1.6),ny=cy-Math.sin(ang)*len/2+Math.sin(ang)*len*t+jit(R,1.6),gap=n2(i*7.1+t*14,3.3)<.3,fade=Math.pow(Math.sin(Math.PI*t),.5);
      if(!gap)line(img,px,py,nx,ny,(w*(.5+n2(i+t*20,8.8)))*fade+.3,(w*(.5+n2(i+t*20+.5,8.8)))*fade+.3,.5+.5*R());px=nx;py=ny;
      if(R()<.1)for(let g=0;g<4;g++)stamp(img,nx+jit(R,9),ny+jit(R,9),.6+R()*1.6,.5+R()*.5);}
    if(R()<.55){const gx=cx+jit(R,len*.3)*Math.cos(ang),gy=cy+jit(R,len*.3)*Math.sin(ang),gl=N*(.04+R()*.07),gw=w*2.4;polygon(img,[[gx-Math.cos(ang)*gl,gy-Math.sin(ang)*gl],[gx-sa*gw,gy+ca*gw],[gx+Math.cos(ang)*gl*.6,gy+Math.sin(ang)*gl*.6],[gx+sa*gw,gy-ca*gw]]);}}
  for(let i=0;i<(o.dust||120);i++)stamp(img,R()*N,R()*N,.5+R()*1.4,.35+.65*R());
  return img;}
/* a spray of angular splinters flying out from the middle */
function splatter(seed,o={}){const R=rng(seed),img=blank(),n=o.n||40;
  for(let i=0;i<n;i++){const a=R()*6.2832,d=Math.pow(R(),.7)*N*(o.spread||.4),x=N/2+Math.cos(a)*d,y=N/2+Math.sin(a)*d,L=N*(.012+Math.pow(R(),2.2)*(o.big||.09)),w=L*(.18+R()*.45),ar=a+jit(R,.5);
    const ux=Math.cos(ar),uy=Math.sin(ar),vx=-uy,vy=ux;polygon(img,[[x+ux*L,y+uy*L],[x+vx*w+ux*L*.1,y+vy*w+uy*L*.1],[x-ux*L*.5+jit(R,w),y-uy*L*.5+jit(R,w)],[x-vx*w*.8,y-vy*w*.8]]);}
  return img;}
/* angular shards: few corners, stretched */
function chips(seed,o={}){const R=rng(seed),img=blank(),n=o.n||16;
  for(let i=0;i<n;i++){const cx=N*(.08+R()*.84),cy=N*(.08+R()*.84),r=N*(.015+Math.pow(R(),1.8)*(o.big||.1)),k=3+((R()*2)|0),rot=R()*6.28,st=.35+R()*1.1,pts=[];
    for(let j=0;j<k;j++){const a=rot+j/k*6.2832+jit(R,.55),rr=r*(.5+R()*.8);pts.push([cx+Math.cos(a)*rr*(1+st),cy+Math.sin(a)*rr*(1-st*.3)]);}polygon(img,pts);}
  return img;}
/* dry streaks cut on the slant, with a grainy fill */
function dry(seed,o={}){const R=rng(seed),{n2,fbm}=noiser(seed),img=blank(),streaks=o.streaks||15;
  for(let i=0;i<streaks;i++){const y=N*(.12+i/streaks*.76)+jit(R,6),t=N*(.008+R()*.028),x0=N*(.08+R()*.25),x1=N*(.62+R()*.32),sk=N*(.02+R()*.07)*(R()<.5?-1:1);
    const tmp=blank();polygon(tmp,[[x0,y-t],[x1+sk,y-t],[x1,y+t],[x0-sk,y+t]]);
    for(let yy=Math.max(0,Math.floor(y-t-2));yy<Math.min(N,Math.ceil(y+t+2));yy++)for(let x=0;x<N;x++){const g=fbm(x/(o.g||18)+i*3.1,yy/2.5,3);const a=tmp[yy*N+x]*sm(.32,.5,g);if(a>img[yy*N+x])img[yy*N+x]=a;}}
  return img;}
/* abstract faceted blobs with bites taken out and stray pieces */
function blotch(seed,o={}){const R=rng(seed),img=blank(),k=o.k||11,cx=N/2,cy=N/2,pts=[],rot=R()*6.28;
  for(let j=0;j<k;j++){const a=rot+j/k*6.2832+jit(R,.25),r=N*(o.r||.3)*(.45+R()*.75)*(j%2?.8:1.15);pts.push([cx+Math.cos(a)*r*(o.sq||1.15),cy+Math.sin(a)*r]);}polygon(img,pts);
  for(let i=0;i<(o.bites||4);i++){const a=R()*6.28,d=N*(.1+R()*.2),x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d,r=N*(.02+R()*.05);erasePoly(img,[[x-r,y-r*.4],[x+r*1.2,y-r*.8],[x+r*.5,y+r]]);}
  for(let i=0;i<(o.bits||6);i++){const a=R()*6.28,d=N*(.3+R()*.15),x=cx+Math.cos(a)*d,y=cy+Math.sin(a)*d,r=N*(.01+R()*.035);polygon(img,[[x-r,y],[x+r*.3,y-r*1.2],[x+r*1.1,y+r*.5]]);}
  return img;}
function shatter(seed){const R=rng(seed),img=blank(),pts=[];for(let i=0;i<46;i++)pts.push([R()*N,R()*N,R()]);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){let d1=1e9,d2=1e9,id=0;for(let i=0;i<pts.length;i++){const d=Math.hypot(x-pts[i][0],y-pts[i][1]);if(d<d1){d2=d1;d1=d;id=i;}else if(d<d2)d2=d;}
    const r=Math.hypot(x-N/2,y-N/2)/N,keep=pts[id][2]>.25+r*.75;img[y*N+x]=keep?sm(1.5,5,d2-d1):0;}
  return img;}
/* ---- png ---- */
const crcT=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc=b=>{let c=0xffffffff;for(const v of b)c=crcT[(c^v)&255]^(c>>>8);return (c^0xffffffff)>>>0;};
function png(img){const raw=Buffer.alloc((N+1)*N);for(let y=0;y<N;y++){raw[y*(N+1)]=0;for(let x=0;x<N;x++)raw[y*(N+1)+1+x]=Math.round(Math.min(1,Math.max(0,img[y*N+x]))*255);}
  const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
  const ih=Buffer.alloc(13);ih.writeUInt32BE(N,0);ih.writeUInt32BE(N,4);ih[8]=8;ih[9]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw,{level:9})),ch('IEND',Buffer.alloc(0))]);}
/* ---- the set: [file, name, make, preset settings] ---- */
const D={drip:{size:90,spacing:.9,followDir:false},edge:{size:120,spacing:.5,followDir:true},tear:{size:120,spacing:.5,followDir:true},crack:{size:100,spacing:.85,angleJitter:1},scr:{size:110,spacing:.55,followDir:true},spl:{size:110,spacing:.9,angleJitter:1,sizeJitter:.25},chip:{size:90,spacing:.8,angleJitter:1,sizeJitter:.3},dry:{size:100,spacing:.35,followDir:true},blot:{size:80,spacing:.6,angleJitter:1,sizeJitter:.2},shat:{size:100,spacing:.9,angleJitter:1}};
const SET=[];const add=(file,name,make,d)=>SET.push({file,name,make,d});
[[11,{n:6}],[12,{n:9,thick:.7}],[13,{n:5,thick:1.5,long:.7}],[14,{n:12,thick:.5,long:1.2}],[15,{n:4,thick:2,long:.6,band:.16}],[16,{n:8,band:.05}]].forEach(([s,o],i)=>add('TEX_Drip_0'+(i+1)+'.png','Shard drips '+(i+1),()=>drips(s,o),D.drip));
[[21,{}],[22,{amp:.18,f:12}],[23,{amp:.36,f:6,spike:.3}],[24,{base:.35,amp:.22,f:8,chips:22}],[25,{amp:.3,f:16,spike:.5}],[26,{base:.55,amp:.2,f:5,chips:10,band:.22}]].forEach(([s,o],i)=>add('TEX_Edge_0'+(i+1)+'.png','Jagged edge '+(i+1),()=>wear(s,o),D.edge));
[[31,{}],[32,{amp:.5,f:8}],[33,{amp:.2,f:18}],[34,{amp:.4,f:10,base:.4}]].forEach(([s,o],i)=>add('TEX_Torn_0'+(i+1)+'.png','Torn zigzag '+(i+1),()=>torn(s,o),D.tear));
[[41,{r:3}],[42,{roots:2,branch:.35,depth:3,len:.8,r:2.6}],[43,{fromTop:true,len:1.3,branch:.35,r:3.2}],[44,{bend:1.3,branch:.25,len:1.4,roots:2,r:2.6}],[45,{roots:4,branch:.4,len:.6,r:2.4}]].forEach(([s,o],i)=>add('TEX_Crack_0'+(i+1)+'.png','Fracture '+(i+1),()=>cracks(s,o),D.crack));
[[51,{}],[52,{n:9,thick:3,spread:.22,scuff:1.2}],[53,{n:24,thick:1.6,spread:.7,dust:260}],[54,{n:12,ang:.45,spread:.3,long:110}],[55,{n:18,thick:2.6,spread:.5,dust:200,scuff:.7}],[56,{n:30,thick:1.2,spread:1.0,dust:340,scuff:1.4,long:50}]].forEach(([s,o],i)=>add('TEX_Scratch_0'+(i+1)+'.png','Grunge scratches '+(i+1),()=>scratches(s,o),D.scr));
[[61,{}],[62,{n:80,big:.04,spread:.46}],[63,{n:26,big:.14,spread:.32}],[64,{n:120,big:.025,spread:.48}]].forEach(([s,o],i)=>add('TEX_Splatter_0'+(i+1)+'.png','Shard spray '+(i+1),()=>splatter(s,o),D.spl));
[[71,{}],[72,{n:30,big:.05}],[73,{n:9,big:.16}],[74,{n:22,big:.07}]].forEach(([s,o],i)=>add('TEX_Chips_0'+(i+1)+'.png','Shards '+(i+1),()=>chips(s,o),D.chip));
[[81,{}],[82,{streaks:24,g:10}],[83,{streaks:9,g:30}]].forEach(([s,o],i)=>add('TEX_Dry_0'+(i+1)+'.png','Cut streaks '+(i+1),()=>dry(s,o),D.dry));
[[91,{}],[92,{k:14,r:.34,bites:7,bits:10}],[93,{k:8,r:.28,bites:2,bits:4,sq:1.4}]].forEach(([s,o],i)=>add('TEX_Blotch_0'+(i+1)+'.png','Faceted blob '+(i+1),()=>blotch(s,o),D.blot));
add('TEX_Shatter_01.png','Shattered glass',()=>shatter(101),D.shat);
if(require.main===module){fs.mkdirSync(OUT,{recursive:true});const sheetOnly=process.argv[2]==='sheet',all=[];
  for(const s of SET){const img=s.make();all.push(img);if(!sheetOnly)fs.writeFileSync(path.join(OUT,s.file),png(img));}
  if(sheetOnly){const C=9,S=128,rows=Math.ceil(SET.length/C),sheet=new Float32Array(C*S*rows*S);
    all.forEach((img,k)=>{const ox=(k%C)*S,oy=Math.floor(k/C)*S;for(let y=0;y<S;y++)for(let x=0;x<S;x++){let a=0;for(let j=0;j<4;j++)for(let i=0;i<4;i++)a+=img[(y*4+j)*N+x*4+i];sheet[(oy+y)*C*S+ox+x]=a/16;}});
    const W=C*S,H=rows*S,raw=Buffer.alloc((W+1)*H);for(let y=0;y<H;y++)for(let x=0;x<W;x++)raw[y*(W+1)+1+x]=Math.round(sheet[y*W+x]*255);
    const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]),c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);},ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;
    fs.writeFileSync(process.argv[3],Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ih),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));}
  else console.log(SET.map(s=>"  {file:'"+s.file+"',name:'"+s.name+"',"+Object.entries(s.d).map(([k,v])=>k+':'+v).join(',')+"},").join('\n'));}
module.exports={SET};
