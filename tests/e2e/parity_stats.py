import sys
from PIL import Image
import numpy as np
for n in sys.argv[1:]:
    A=np.asarray(Image.open(n+'_old.png').convert('RGB'),dtype=float);B=np.asarray(Image.open(n+'_new.png').convert('RGB'),dtype=float)
    bgA=A[2,2];bgB=B[2,2]
    m=(np.abs(A-bgA).sum(2)>12)&(np.abs(B-bgB).sum(2)>12)
    a=A[m];b=B[m]
    la=a@[.2126,.7152,.0722];lb=b@[.2126,.7152,.0722]
    print(n,'bg old',bgA,'new',bgB,'object px',m.sum())
    print('  mean rgb old',a.mean(0).round(1),'new',b.mean(0).round(1),' lum ratio new/old',round(lb.mean()/la.mean(),3))
    print('  lum std old',la.std().round(1),'new',lb.std().round(1),' correlation',round(float(np.corrcoef(la,lb)[0,1]),3))
    print('  mean abs diff',np.abs(a-b).mean().round(1))
