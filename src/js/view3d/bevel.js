/* Rounded-edge shading shared by the Bake viewport and the normal-map baker.
   Only adjacent faces of the same imported object contribute; triangulation diagonals stay flat. */
const BEVEL_GLSL=`
float bvDistance(vec3 p,vec3 a,vec3 b){vec3 e=b-a;return length(p-(a+e*clamp(dot(p-a,e)/max(dot(e,e),1e-20),0.0,1.0)));}
vec3 bvRound(vec3 p,vec3 n,vec3 a,vec3 b,vec3 c,vec4 na,vec4 nb,vec4 nc,float width){
  if(width<=0.0)return n;vec3 sum=n;
  float d0=clamp(bvDistance(p,a,b)/width,0.0,1.0),d1=clamp(bvDistance(p,b,c)/width,0.0,1.0),d2=clamp(bvDistance(p,c,a)/width,0.0,1.0);
  /* A circular falloff reaches the average of both face normals exactly at the join. */
  vec3 w=1.0-sqrt(max(vec3(0.0),2.0*vec3(d0,d1,d2)-vec3(d0,d1,d2)*vec3(d0,d1,d2)));
  sum+=na.xyz*w.x*na.w+nb.xyz*w.y*nb.w+nc.xyz*w.z*nc.w;return normalize(sum+vec3(1e-20));}`;
const bvSettings=()=>bakeCfg.bevel||(bakeCfg.bevel={on:false,preview:true,width:.5,angle:30});
const bevelPreviewOn=()=>ui.mode==='bake'&&bvSettings().on&&bvSettings().preview;
const bvWidth=o=>o&&o.on?Math.max(0,+o.width||0)*.02:0;
function bevelNormals(m,angle){const cached=m._bevelN;if(cached&&cached.idx===m.idx&&cached.angle===angle)return cached.data;
  const T=m.idx.length/3,I=m.idx,P=m.pos,normals=new Float32Array(T*3),out=new Float32Array(T*12),edges=new Map(),key=i=>Math.round(P[i*3]*1e5)+','+Math.round(P[i*3+1]*1e5)+','+Math.round(P[i*3+2]*1e5);
  for(let t=0;t<T;t++){const ids=[I[t*3],I[t*3+1],I[t*3+2]],a=ids[0]*3,b=ids[1]*3,c=ids[2]*3;
    let n=norm3(cross3([P[b]-P[a],P[b+1]-P[a+1],P[b+2]-P[a+2]],[P[c]-P[a],P[c+1]-P[a+1],P[c+2]-P[a+2]]));
    if(m.nrm&&dot3(n,[m.nrm[a],m.nrm[a+1],m.nrm[a+2]])<0)n=n.map(x=>-x);normals.set(n,t*3);
    const part=m.triPart?m.triPart[t]:0;
    for(let e=0;e<3;e++){const x=key(ids[e]),y=key(ids[(e+1)%3]),k=part+'|'+(x<y?x+'|'+y:y+'|'+x),list=edges.get(k);if(list)list.push([t,e]);else edges.set(k,[[t,e]]);}}
  const cutoff=Math.cos(Math.max(0,Math.min(180,+angle||0))*Math.PI/180);
  for(const list of edges.values()){if(list.length!==2)continue;const [a,b]=list,N0=normals.subarray(a[0]*3,a[0]*3+3),N1=normals.subarray(b[0]*3,b[0]*3+3),d=dot3(N0,N1);
    if(d>=cutoff-1e-6||d<-.9999)continue;for(const [own,other] of [[a,b],[b,a]]){const p=own[0]*12+own[1]*4;out.set(normals.subarray(other[0]*3,other[0]*3+3),p);out[p+3]=1;}}
  m._bevelN={idx:m.idx,angle,data:out};return out;}
const bvGPU={low:null,high:null};let P_BV3=null,P_BVHIGH=null;
function bevelFreeGPU(g){if(!g)return;gl.deleteVertexArray(g.vao);gl.deleteBuffer(g.vb);}
function bevelPreviewGPU(m,slot='low'){const o=bvSettings(),old=bvGPU[slot];if(old&&old.mesh===m&&old.angle===o.angle)return old;
  bevelFreeGPU(old);const ns=bevelNormals(m,o.angle),T=m.idx.length/3,d=new Float32Array(T*3*36);
  for(let t=0;t<T;t++)for(let c=0;c<3;c++){const i=m.idx[t*3+c],q=(t*3+c)*36;
    d.set(m.pos.subarray(i*3,i*3+3),q);d.set(m.nrm.subarray(i*3,i*3+3),q+3);d.set(m.uv.subarray(i*2,i*2+2),q+6);d.set(m.tan.subarray(i*4,i*4+4),q+8);d.set(m.nrm.subarray(i*3,i*3+3),q+12);
    for(let e=0;e<3;e++)d.set(m.pos.subarray(m.idx[t*3+e]*3,m.idx[t*3+e]*3+3),q+15+e*3);
    d.set(ns.subarray(t*12,t*12+12),q+24);}
  const va=gl.createVertexArray(),vb=gl.createBuffer();gl.bindVertexArray(va);gl.bindBuffer(gl.ARRAY_BUFFER,vb);gl.bufferData(gl.ARRAY_BUFFER,d,gl.STATIC_DRAW);
  for(const [loc,size,off] of [[0,3,0],[1,3,3],[2,2,6],[3,4,8],[4,3,12],[5,3,15],[6,3,18],[7,3,21],[8,4,24],[9,4,28],[10,4,32]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,144,off*4);}
  gl.bindVertexArray(vao);return bvGPU[slot]={mesh:m,angle:o.angle,vao:va,vb,count:T*3};}
function bvVertexShader(){return VS_3D.replace('void main(){',`layout(location=5) in vec3 aBV0;layout(location=6) in vec3 aBV1;layout(location=7) in vec3 aBV2;
layout(location=8) in vec4 aBN0;layout(location=9) in vec4 aBN1;layout(location=10) in vec4 aBN2;
flat out vec3 vb0;flat out vec3 vb1;flat out vec3 vb2;flat out vec4 vbn0;flat out vec4 vbn1;flat out vec4 vbn2;
void main(){vb0=aBV0;vb1=aBV1;vb2=aBV2;vbn0=aBN0;vbn1=aBN1;vbn2=aBN2;`);}
function bvFragmentShader(fs){return `flat in vec3 vb0;flat in vec3 vb1;flat in vec3 vb2;flat in vec4 vbn0;flat in vec4 vbn1;flat in vec4 vbn2;uniform float uBevelWidth;\n`+BEVEL_GLSL+fs.replace('normalize(vN)','bvRound(vP,normalize(vN),vb0,vb1,vb2,vbn0,vbn1,vbn2,uBevelWidth)');}
function bevelPreviewProgram(high=false){if(high)return P_BVHIGH||(P_BVHIGH=prog3(bvVertexShader(),bvFragmentShader(FS_BKHIGH)));
  return P_BV3||(P_BV3=Object.assign(prog3(bvVertexShader(),bvFragmentShader(FS_3D)),{decodeOnly:true}));}
function bevelBakeTex(hg,o){if(!bvWidth(o))return null;if(hg.bevel&&hg.bevel.angle===o.angle)return hg.bevel.tex;
  if(hg.bevel)gl.deleteTexture(hg.bevel.tex);const ns=bevelNormals(hg.source,o.angle),order=hg.order;
  const tex=bkBandTex(hg.count*3,false,(b,t0,t1)=>{for(let q=t0;q<t1;q++){const t=order[Math.floor(q/3)],e=q%3;b.set(ns.subarray(t*12+e*4,t*12+e*4+4),(q-t0)*4);}});
  hg.bevel={tex,angle:o.angle};return tex;}
function bvChanged(){bvSettings().preview=true;v3.dirty=true;requestRender(true);}
function bevelBakeControls(){const o=bvSettings();return el('div',{class:'dlg-grid',id:'bkBevelControls'},
  el('div',{class:'sub',text:'Bevel shader'}),
  chk('bkBevelOn','Enable bevel',!!o.on,v=>{o.on=v;bvChanged();}),
  chk('bkBevelPreview','Preview before baking',o.preview!==false,v=>{o.preview=v;v3.dirty=true;requestRender(true);}),
  makeSlider({id:'bkBevelWidth',label:'Width (% of model)',min:0,max:5,step:.05,value:o.width,fmt:v=>v.toFixed(2)+'%',onInput:v=>{o.width=v;bvChanged();}}).el,
  makeSlider({id:'bkBevelAngle',label:'Minimum edge angle',min:0,max:180,step:1,value:o.angle,fmt:v=>Math.round(v)+'°',onInput:v=>{o.angle=v;bvChanged();}}).el,
  el('p',{class:'note',text:'Rounds connected hard edges in shading and bakes them into Normal. The silhouette stays unchanged. For a high-poly, use Show high-poly to preview its edges.'}),
  el('button',{class:'btn',id:'bkBakeBevel',text:'Bake bevel normal',disabled:!!bk.busy,onclick:()=>{o.on=true;runBakeSets(bkLow(),['normal']);}}));}
