/* Static FBX 7.4 binary geometry, UVs, normals, material slots and external texture links.
   The scene stores the same mesh coordinates as OBJ/glTF exports; no animation is invented. */
function mxFBX(m,groups,filesBySet,name,pr){const E=new TextEncoder(),node=(name,props=[],kids=[])=>({name,props,kids});
  const str=v=>({type:'S',v:String(v)}),int=v=>({type:'I',v}),long=v=>({type:'L',v}),real=v=>({type:'D',v}),arr=(type,v)=>({type,v});
  const prop=p=>{if(typeof p==='string')p=str(p);if(typeof p==='number')p=int(p);let b,head;
    if(p.type==='S'){b=E.encode(p.v);head=new Uint8Array(5);head[0]=83;new DataView(head.buffer).setUint32(1,b.length,true);return [head,b];}
    if(['d','i'].includes(p.type)){const C=p.type==='d'?Float64Array:Int32Array,data=new C(p.v);b=new Uint8Array(data.buffer);head=new Uint8Array(13);head[0]=p.type.charCodeAt(0);const d=new DataView(head.buffer);d.setUint32(1,data.length,true);d.setUint32(5,0,true);d.setUint32(9,b.length,true);return [head,b];}
    b=new Uint8Array(p.type==='I'?5:9);b[0]=p.type.charCodeAt(0);const d=new DataView(b.buffer);if(p.type==='I')d.setInt32(1,p.v,true);else if(p.type==='L')d.setBigInt64(1,BigInt(p.v),true);else d.setFloat64(1,p.v,true);return [b];};
  const P=(key,type,v)=>node('P',[key,type,'','',typeof v==='string'?str(v):type==='int'?int(v):real(v)]);
  const objects=[],links=[],gid=1000;let next=gid;
  for(let gi=0;gi<groups.length;gi++){const g=groups[gi],geo=next++,mdl=next++,mat=next++,map=new Map(),vertices=[],normals=[],uv=[],indices=[];
    for(const old of g.idx){let i=map.get(old);if(i===undefined){i=map.size;map.set(old,i);vertices.push(...m.pos.subarray(old*3,old*3+3));normals.push(...m.nrm.subarray(old*3,old*3+3));uv.push(m.uv[old*2],1-m.uv[old*2+1]);}indices.push(i);}for(let i=2;i<indices.length;i+=3)indices[i]=-indices[i]-1;
    const layer=name=>node('LayerElement',[],[node('Type',[name]),node('TypedIndex',[0])]);
    objects.push(node('Geometry',[long(geo),g.name+'\x00\x01Geometry','Mesh'],[node('GeometryVersion',[124]),node('Vertices',[arr('d',vertices)]),node('PolygonVertexIndex',[arr('i',indices)]),
      node('LayerElementNormal',[0],[node('Version',[101]),node('Name',['']),node('MappingInformationType',['ByVertice']),node('ReferenceInformationType',['Direct']),node('Normals',[arr('d',normals)])]),
      node('LayerElementUV',[0],[node('Version',[101]),node('Name',['UVMap']),node('MappingInformationType',['ByVertice']),node('ReferenceInformationType',['Direct']),node('UV',[arr('d',uv)])]),
      node('LayerElementMaterial',[0],[node('Version',[101]),node('Name',['']),node('MappingInformationType',['AllSame']),node('ReferenceInformationType',['IndexToDirect']),node('Materials',[arr('i',[0])])]),
      node('Layer',[0],[node('Version',[100]),layer('LayerElementNormal'),layer('LayerElementUV'),layer('LayerElementMaterial')])]));
    objects.push(node('Model',[long(mdl),g.name+'\x00\x01Model','Mesh'],[node('Version',[232]),node('Properties70',[],[P('RotationOrder','int',0),P('DefaultAttributeIndex','int',0)]),node('Shading',[1]),node('Culling',['CullingOff'])]));
    objects.push(node('Material',[long(mat),g.name+'\x00\x01Material',''],[node('Version',[102]),node('ShadingModel',['phong']),node('MultiLayer',[0]),node('Properties70',[],[node('P',['DiffuseColor','Color','','A',real(1),real(1),real(1)])])]));
    links.push(node('C',['OO',long(geo),long(mdl)]),node('C',['OO',long(mat),long(mdl)]),node('C',['OO',long(mdl),long(0)]));
    const names={base:'DiffuseColor',normal:'NormalMap',emis:'EmissiveColor',height:'DisplacementColor',rough:'Roughness',metal:'Metalness',opac:'TransparentColor'};
    for(const f of filesBySet[g.name]||[]){const o=pr.outs.find(o=>o.s===f.suffix),channel=o&&(names[o.rgb]||names[o.grey]);if(!channel)continue;const tx=next++,vd=next++;
      objects.push(node('Video',[long(vd),f.name+'\x00\x01Video','Clip'],[node('Type',['Clip']),node('UseMipMap',[0]),node('Filename',[f.name]),node('RelativeFilename',[f.name])]),
        node('Texture',[long(tx),f.name+'\x00\x01Texture',''],[node('Type',['TextureVideoClip']),node('Version',[202]),node('TextureName',[f.name+'\x00\x01Texture']),node('Media',[f.name+'\x00\x01Video']),node('FileName',[f.name]),node('RelativeFilename',[f.name]),node('ModelUVTranslation',[real(0),real(0)]),node('ModelUVScaling',[real(1),real(1)]),node('Texture_Alpha_Source',['None']),node('Cropping',[0,0,0,0])]));
      links.push(node('C',['OO',long(vd),long(tx)]),node('C',['OP',long(tx),long(mat),channel]));}}
  const counts={};for(const o of objects)counts[o.name]=(counts[o.name]||0)+1;
  const top=[node('FBXHeaderExtension',[],[node('FBXHeaderVersion',[1003]),node('FBXVersion',[7400]),node('Creator',['Gouache Studio'])]),
    node('GlobalSettings',[],[node('Version',[1000]),node('Properties70',[],[P('UpAxis','int',1),P('UpAxisSign','int',1),P('FrontAxis','int',2),P('FrontAxisSign','int',-1),P('CoordAxis','int',0),P('CoordAxisSign','int',1),P('UnitScaleFactor','double',100)])]),
    node('Documents',[],[node('Count',[1]),node('Document',[long(1),name,'Scene'],[node('Properties70',[],[]),node('RootNode',[long(0)])])]),node('References'),
    node('Definitions',[],[node('Version',[100]),node('Count',[objects.length]),...Object.entries(counts).map(([k,v])=>node('ObjectType',[k],[node('Count',[v])]))]),node('Objects',[],objects),node('Connections',[],links),node('Takes',[],[node('Current',[''])])];
  const size=n=>{n.bytes=n.props.flatMap(prop);n.nlen=E.encode(n.name);n.plen=n.bytes.reduce((a,b)=>a+b.length,0);n.length=13+n.nlen.length+n.plen+n.kids.reduce((a,k)=>a+size(k),0)+(n.kids.length?13:0);return n.length;};
  const len=27+top.reduce((a,n)=>a+size(n),0)+13,pad=(16-(len+20)%16)||16,out=new Uint8Array(len+16+4+pad+4+120+16),d=new DataView(out.buffer);out.set(E.encode('Kaydara FBX Binary  \x00\x1a\x00'));d.setUint32(23,7400,true);let off=27;
  const write=n=>{const start=off;d.setUint32(off,start+n.length,true);d.setUint32(off+4,n.props.length,true);d.setUint32(off+8,n.plen,true);out[off+12]=n.nlen.length;off+=13;out.set(n.nlen,off);off+=n.nlen.length;for(const b of n.bytes){out.set(b,off);off+=b.length;}for(const k of n.kids)write(k);if(n.kids.length)off+=13;};top.forEach(write);off+=13;
  out.set([0xfa,0xbc,0xab,0x09,0xd0,0xc8,0xd4,0x66,0xb1,0x76,0xfb,0x83,0x1c,0xf7,0x26,0x7e],off);off+=20+pad;d.setUint32(off,7400,true);off+=124;out.set([0xf8,0x5a,0x8c,0x6a,0xde,0xf5,0xd9,0x7e,0xec,0xe9,0x0c,0xe3,0x75,0x8f,0x29,0x0b],off);return out;}
