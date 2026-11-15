const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch({
    channel: process.env.GOUACHE_TEST_BROWSER || (process.platform === 'win32' ? 'msedge' : undefined),
    args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']
  });
  try {
    const page = await browser.newPage({viewport:{width:1400,height:900}});
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(/shader compile|shader link|WebGL: INVALID/i.test(m.text()))errors.push(m.text());});
    await page.addInitScript(()=>{
      localStorage.setItem('gs.welcome','no');
      localStorage.setItem('gs.p3d',JSON.stringify({size:128,layout:'3d'}));
    });
    await page.route('**/*',route=>route.request().url().startsWith('file:')?route.continue():route.abort());
    await page.goto(pathToFileURL(path.resolve(__dirname,'../../dist/index.html')).href+'?debug');
    await page.waitForFunction(()=>window.__gs);
    const result=await page.evaluate(()=>{
      const g=__gs;
      g.closeWelcome();g.setMode('p3d');g.useModel(g.primMesh('rcube',1));
      const {w,h}=g.doc;
      const maps={base:{on:true,c:[.25,.3,.35]},rough:{on:true,v:.62},height:{on:true,v:.5}};
      g.cmdNewFillLayer({name:'Base finish',maps});
      const makeImage=rgba=>{
        const t=g.makeTarget(8,8,8,true);
        g.clearTarget(t,rgba);
        return t;
      };
      const src=makeImage([.5,.5,1,1]);
      const rough=makeImage([.32,.32,.32,1]);
      const bump=makeImage([.73,.73,.73,1]);
      const L=g.cmdNewFillLayer({name:'Surface material',coverH:true,maps:{
        normal:{src:'image'},rough:{src:'image'},height:{src:'image'}},imgs:{normal:src,rough,height:bump}});
      for(const t of [src,rough,bump])g.disposeTarget(t);
      const baked=g.makeTarget(w,h,8,false);
      g.clearTarget(baked,[.38,.57,.98,1]);g.doc.meshMaps={normal:baked};
      const fullNormal=()=>{const t=g.normalComp(),p=g.readMapF(t,4);g.release(t);return p;};
      const map=k=>{const t=g.compositeMap(k),p=g.readMapF(t,4);g.release(t);return p;};
      const project=(mode,xf)=>{L.fill.proj=mode;L.fill.xf=xf;g.fillRender(L);};
      const uv=g.pxfDef();
      L.fill.maps.height.on=false;
      project('uv',uv);
      const uvNormal=fullNormal();
      project('tri',{...uv,r:[23,42,11],s:[1.3,-.75,.91]});
      const triNormal=fullNormal(),layerNormal=g.readMapF(g.mapT(L,'normal'),4);
      let maxNormalDelta=0,coverage=0;
      for(let i=0;i<layerNormal.length;i+=4){
        if(layerNormal[i+3]<.9)continue;
        coverage++;
        for(let c=0;c<3;c++)maxNormalDelta=Math.max(maxNormalDelta,Math.abs(uvNormal[i+c]-triNormal[i+c]));
      }

      // Separate UV islands for the cylindrical wall and its two caps.
      const cylinder=g.primMesh('cylinder',0);
      for(let i=0;i<cylinder.uv.length/2;i++){
        const cap=cylinder.nrm[i*3+1],uvX=cylinder.uv[i*2],uvY=cylinder.uv[i*2+1];
        cylinder.uv[i*2]=Math.abs(cap)>.5?.62+.34*uvX:.02+.55*uvX;
        cylinder.uv[i*2+1]=cap>.5?.04+.36*uvY:cap<-.5?.56+.36*uvY:.06+.88*uvY;
      }
      cylinder.tan=g.tangentsOf(cylinder.pos,cylinder.nrm,cylinder.uv,cylinder.idx);
      g.useModel(cylinder);
      // A tilted material normal has a visible effect on the wall only.
      L.fill.maps.height.on=true;
      g.clearTarget(L._fillImg.normal,[.66,.44,.968,1]);
      project('cyl',{...uv,cull:true});
      const sample=(p,x,y)=>Array.from(p.subarray((Math.floor(y*h)*w+Math.floor(x*w))*4,(Math.floor(y*h)*w+Math.floor(x*w))*4+4));
      const top=p=>sample(p,.79,.22),wall=p=>sample(p,.22,.49);
      const roughness=map('rough'),height=map('height'),normal=map('normal');
      const culled={topRough:top(roughness)[0],wallRough:wall(roughness)[0],topHeight:top(height)[0],wallHeight:wall(height)[0],
        topNormal:top(normal),wallNormal:wall(normal),topLayerAlpha:top(g.readMapF(g.mapT(L,'normal'),4))[3]};
      project('cyl',{...uv,cull:false});
      const unculled=top(map('rough'))[0];

      // Identical geometry on mirrored and ordinary islands must have opposite
      // tangent signs, with valid padding on either side.
      const mirrored=g.parseOBJ([
        'v -1 -1 0','v 0 -1 0','v 0 1 0','v -1 1 0','v 1 -1 0','v 1 1 0',
        'vt .10 .2','vt .38 .2','vt .38 .8','vt .10 .8','vt .88 .2','vt .60 .2','vt .60 .8','vt .88 .8',
        'vn 0 0 1','f 1/1/1 2/2/1 3/3/1','f 1/1/1 3/3/1 4/4/1','f 2/5/1 5/6/1 6/7/1','f 2/5/1 6/7/1 3/8/1'
      ].join('\n'),'Mirrored material test');
      g.useModel(mirrored);
      project('tri',uv);
      const tangent=g.fillPosMaps().tan,raw=new Float32Array(w*h*4),gl=g.gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER,tangent.fbo);
      gl.readPixels(0,0,w,h,gl.RGBA,gl.FLOAT,raw);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      const applied=map('normal');
      const sides=[sample(raw,.21,.5)[3],sample(raw,.72,.5)[3]];
      const padding=[sample(raw,.09,.5)[3],sample(raw,.89,.5)[3]];
      const projected=[sample(applied,.21,.5),sample(applied,.72,.5)];
      return {coverage,maxNormalDelta,culled,unculled,sides,padding,projected,error:gl.getError()};
    });
    console.log(JSON.stringify(result));
    assert(result.coverage>1000 && result.maxNormalDelta<.01,'A flat triplanar normal must not tilt or override the baked surface');
    const c=result.culled;
    assert(Math.abs(c.topRough-.62)<.015 && Math.abs(c.topHeight-.5)<.015 && c.topLayerAlpha===0,'The culled cap must keep the underlying roughness, height and normal');
    assert(Math.abs(c.topNormal[0]-.5)<.01 && Math.abs(c.topNormal[1]-.5)<.01 && c.topNormal[2]>.99,'The cap must keep a flat material normal');
    assert(Math.abs(c.wallRough-.32)<.015 && Math.abs(c.wallHeight-.73)<.015 && Math.abs(c.wallNormal[0]-.5)>.08,'The wall must retain projected material detail');
    assert(Math.abs(result.unculled-.32)<.015,'Disabling culling should still project onto the cap');
    assert(result.sides[0]*result.sides[1]<-.9 && result.padding.every((v,i)=>v===result.sides[i]),'Mirrored tangent signs must survive padding');
    assert(result.projected.every(n=>Math.abs(n[0]-.5)>.08) && (result.projected[0][0]-.5)*(result.projected[1][0]-.5)<0,'The mesh tangent orientation must convert projected red-channel detail on both islands');
    assert.equal(result.error,0);
    assert.deepEqual(errors,[]);
    console.log('PASS projected normals preserve the bake, cylindrical caps preserve underlying maps, and mirrored tangent frames remain valid');
  } finally {
    await browser.close();
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
