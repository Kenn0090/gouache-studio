#!/usr/bin/env python3
"""Built-in mixed grunges, made with the same layer maths as the app's Grunge Mixer (FS_TXMIX in src/js/ui/textures.js):
each layer is sampled at fract(uv*scale), optionally inverted, and blended into the result below with a mode and opacity.
Writes assets/grunge/mix-*.webp (1024 px, seamless when the sources are) and updates assets/grunge/previews.json.
Run: python3 scripts/grunge-mixes.py"""
import os, json, hashlib, base64, io
import numpy as np
from PIL import Image
ROOT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..');G=os.path.join(ROOT,'assets','grunge');S=1024
def src(name):
    im=Image.open(os.path.join(G,name+'.webp')).convert('L');return np.asarray(im,dtype=np.float32)/255.0
def sample(a,scale):
    n=a.shape[0];idx=(np.floor((np.arange(S)+.5)/S*scale*n)%n).astype(np.int64);return a[np.ix_(idx,idx)]
def blend(a,b,mode):
    if mode=='multiply':return a*b
    if mode=='screen':return a+b-a*b
    if mode=='add':return np.minimum(1,a+b)
    if mode=='difference':return np.abs(a-b)
    if mode=='overlay':return np.where(a<.5,2*a*b,1-2*(1-a)*(1-b))
    if mode=='min':return np.minimum(a,b)
    if mode=='max':return np.maximum(a,b)
    return b
def levels(a,lo,hi):return np.clip((a-lo)/max(1e-3,hi-lo),0,1)
# name, label, category, [ (source, mode, opacity, scale, invert) ... ], (levels lo, hi)
MIXES=[
 ('mix-battle-damage','Battle damage','Mixed',[('jagged-long-gashes','normal',1,1,False),('chipped-surface-wear','max',.7,1,False),('hard-crossed-gashes','screen',.5,2,False)],(.08,.9)),
 ('mix-blade-scratches','Blade scratches','Mixed',[('hairline-scratches','normal',1,1,False),('tangled-scratches','max',.6,2,False),('hard-crossed-gashes','max',.35,1,False)],(.05,.85)),
 ('mix-handled-wear','Handled wear','Mixed',[('greasy-swirls','normal',1,1,False),('thumb-prints','screen',.6,2,False),('streaky-wipes','multiply',.4,1,False)],(.05,.9)),
 ('mix-bullet-nicks','Bullet nicks','Mixed',[('chips','normal',1,2,False),('scattered-rings','max',.5,2,False),('specks','max',.6,1,False)],(.1,.8)),
 ('mix-panel-grime','Panel grime','Mixed',[('weathered-grime','normal',1,1,False),('leaks-5','multiply',.6,1,False),('specks','overlay',.4,2,False)],(.0,.95)),
 ('mix-sandblasted','Sandblasted','Mixed',[('speckle','normal',1,2,False),('micro-scratches','screen',.5,2,False),('dust','multiply',.4,1,False)],(.05,.9)),
 ('mix-ornate-tarnish','Ornate tarnish','Mixed',[('foggy-blotches','normal',1,1,False),('fine-grime','multiply',.7,2,False),('speckle','max',.3,1,False)],(.05,.95)),
 ('mix-scorch','Scorch marks','Mixed',[('splotches','normal',1,1,False),('smudges','multiply',.7,1,False),('rough-distress-scan','multiply',.5,2,False)],(.05,.9)),
 ('mix-painterly','Painterly breakup','Mixed',[('brush-smears','normal',1,1,False),('foggy-blotches','overlay',.6,1,False),('streaks','multiply',.3,2,False)],(.05,.95)),
 ('mix-mud-splash','Mud splash','Mixed',[('spatter','normal',1,1,False),('splotches','max',.6,1,False),('dirt','multiply',.5,2,False)],(.05,.9)),
 ('mix-lichen','Lichen patches','Mixed',[('bubble-stains','normal',1,1,False),('plaster-grunge','multiply',.6,1,False),('specks','screen',.3,2,False)],(.05,.9)),
 ('mix-sun-bleach','Sun bleach','Mixed',[('foggy-blotches','normal',1,1,False),('weathered-plaster-scan','screen',.5,1,False),('streaks','multiply',.25,1,False)],(.1,.95)),
]
def main():
    pv=json.load(open(os.path.join(G,'previews.json')))
    for slug,label,cat,rows,(lo,hi) in MIXES:
        acc=None
        for name,mode,op,scale,inv in rows:
            b=sample(src(name),scale)
            if inv:b=1-b
            acc=b if acc is None else acc+(blend(acc,b,mode)-acc)*op
        acc=levels(acc,lo,hi)
        a0,a1=np.percentile(acc,1),np.percentile(acc,99.5);acc=levels(acc,a0,a1)  # use the full black-to-white range
        im=Image.fromarray((acc*255+.5).astype(np.uint8),'L').convert('RGB')
        p=os.path.join(G,slug+'.webp');im.save(p,'WEBP',quality=88,method=6)
        sha=hashlib.sha256(open(p,'rb').read()).hexdigest();b=io.BytesIO();im.resize((96,96),Image.LANCZOS).save(b,'WEBP',quality=80)
        pv['items'][slug]={'sha256':sha,'image':'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()}
        print(slug,round(float(acc.mean()),3))
    json.dump(pv,open(os.path.join(G,'previews.json'),'w'),indent=2)
if __name__=='__main__':main()
