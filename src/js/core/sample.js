/* ================= Sample painting ================= */
function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
function scriptStroke(L,pts,o){const opts=Object.assign({},brush,{tool:'brush',opacity:1,flow:1,spacing:.06,grain:0,pSize:false,pOpacity:false,buildup:false,minSize:.2,hardness:.8,curve:0,strength:.5,charge:0},o);
  opts.color=Array.isArray(o.color)?o.color:fromHex(o.color);beginStroke(L,pts[0][0],pts[0][1],pts[0][2]==null?1:pts[0][2],opts);
  for(let i=1;i<pts.length;i++)addPoint(pts[i][0],pts[i][1],pts[i][2]==null?1:pts[i][2]);endStroke(false);}
function ell(cx,cy,rx,ry,rot,a0,a1,n,pf,wob){const out=[],cr=Math.cos(rot),sr=Math.sin(rot);for(let i=0;i<=n;i++){const u=i/n,t=a0+(a1-a0)*u;const w=wob?1+wob[0]*Math.sin(3*t+wob[1])+wob[2]*Math.sin(5*t+wob[3]):1;
  const ex=Math.cos(t)*rx*w,ey=Math.sin(t)*ry*w;out.push([cx+ex*cr-ey*sr,cy+ex*sr+ey*cr,pf?pf(u):1]);}return out;}
function shade(hex,f){const c=fromHex(hex);return c.map(v=>clamp(v*f,0,1));}
function buildSample(){
  const R=rng(11),PI=Math.PI,taper=u=>Math.sin(u*PI);
  const mortar=newDoc(1024,1024,8,fromHex('#3b332f'),'Cobblestone tile',true);mortar.name='Mortar';
  for(let i=0;i<34;i++){const x=R()*1024,y=R()*1024,pts=[];let a=R()*6.3;for(let j=0;j<9;j++){a+=(R()-.5)*1.2;pts.push([x+Math.cos(a)*j*26,y+Math.sin(a)*j*26,taper(j/8)]);}
    scriptStroke(mortar,pts,{size:70+R()*90,hardness:0,flow:.12,buildup:true,pOpacity:true,grain:.7,color:R()<.5?'#51463f':'#2a2320'});}
  const stones=newLayerObj('Stones');insertNode(stones,doc.root);
  const pal=['#80898f','#8b8e84','#75818c','#968b77','#858b91','#7b7f86'];const S=[];
  for(let gy=0;gy<4;gy++)for(let gx=0;gx<4;gx++){S.push({cx:gx*256+128+(gy%2)*128+(R()-.5)*34,cy:gy*256+128+(R()-.5)*30,rx:112+R()*12,ry:100+R()*14,rot:(R()-.5)*.5,col:pal[Math.floor(R()*pal.length)],wob:[.035+R()*.03,R()*6,.025,R()*6]});}
  for(const s of S){let pts=[];for(const k of [1,.78,.56,.34,.12])pts=pts.concat(ell(s.cx,s.cy,(s.rx-32)*k,(s.ry-32)*k,s.rot,0,2*PI,56,null,s.wob));
    scriptStroke(stones,pts,{size:64,hardness:.9,color:s.col});}
  const shadow=newLayerObj('Shadow');Object.assign(shadow,{mode:1,clip:true,opacity:.85});insertNode(shadow,doc.root);
  const light=newLayerObj('Light');Object.assign(light,{mode:3,clip:true,opacity:.9});insertNode(light,doc.root);
  const detail=newLayerObj('Details');Object.assign(detail,{clip:true});insertNode(detail,doc.root);
  for(const s of S){
    scriptStroke(shadow,ell(s.cx+8,s.cy+10,(s.rx-44),(s.ry-44),s.rot,-.1*PI,.9*PI,34,taper,s.wob),{size:92,hardness:.05,flow:.55,pOpacity:true,grain:.35,color:'#5a4a6b'});
    scriptStroke(shadow,ell(s.cx,s.cy,(s.rx-10),(s.ry-10),s.rot,0,.8*PI,34,taper,s.wob),{size:30,hardness:.3,flow:.7,pOpacity:true,color:'#4a3c58'});
    scriptStroke(light,ell(s.cx-10,s.cy-12,(s.rx-50)*.8,(s.ry-50)*.8,s.rot,.95*PI,1.6*PI,26,taper,s.wob),{size:74,hardness:.1,flow:.65,pOpacity:true,grain:.55,color:'#ffd9a6'});
    scriptStroke(detail,ell(s.cx,s.cy,(s.rx-22),(s.ry-22),s.rot,1.02*PI,1.42*PI,22,taper,s.wob),{size:13,hardness:.7,pSize:true,minSize:.15,flow:.8,pOpacity:true,color:shade(s.col,1.35)});
    if(R()<.45){let x=s.cx+(R()-.5)*50,y=s.cy+(R()-.5)*40,a=R()*6.3;const pts=[];for(let j=0;j<7;j++){pts.push([x,y,taper(j/6)*.9+.1]);a+=(R()-.5)*1.4;x+=Math.cos(a)*14;y+=Math.sin(a)*14;}
      scriptStroke(detail,pts,{size:6,hardness:.95,pSize:true,minSize:.1,color:'#2d2628'});}
  }
  const G=newGroupObj('Cobbles');insertNode(G,doc.root);for(const n of [stones,shadow,light,detail]){detachNode(n);insertNode(n,G);}
  const mine=newLayerObj('Your strokes');insertNode(mine,doc.root);
  doc.count=5;selectOnly(mine);changedAll();
}
