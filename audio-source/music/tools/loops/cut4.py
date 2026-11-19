import numpy as np
from grid import *
from fixall import metrics,encode
from cutpoints import xs,mono,phi,BEAT,rising,sp
L=int(round(16*BEAT*sr))
def make(k,ov_ms=100):
    s0=int((phi+k*BEAT-0.015)*sr);z=rising(mono,s0-441,s0+441);s=int(z[np.argmin(np.abs(z-s0))]);e=s+L
    z2=set(rising(mono,e-20,e+20).tolist())
    # end on a zero crossing too: take the nearest one, and move the start with it so the loop keeps its length
    zz=np.array(sorted(z2));e=int(zz[np.argmin(np.abs(zz-e))]) if len(zz) else e;Lk=e-s
    ov=int(ov_ms*sr/1000);loop=xs[s:e].copy();over=xs[e:e+ov];t=np.linspace(0,np.pi/2,ov)[:,None]
    loop[:ov]=over*np.cos(t)+xs[s:s+ov]*np.sin(t)          # equal power: what really follows the end gives way to the start
    two=np.vstack([loop,loop]);D=len(two)
    pos=np.linspace(0,D-1,N);y=np.stack([np.interp(pos,np.arange(D),two[:,c]) for c in range(2)],axis=1)   # 0.003 % to the exact length
    return y,s,e
for k in (2,7,1,6):
    y,s,e=make(k);half=N//2
    print('k=%d: loop from %.3f s to %.3f s (%d samples)'%(k,s/sr,e/sr,e-s))
    metrics(y,'  4-bar loop k=%d, wrap'%k)
    m=y.mean(1);n=int(.04*sr);a,b=sp(m[half-n:half]),sp(m[half:half+n]);print('  middle seam (the repeat): step %.3f, spectral sim %.2f'%(np.abs(y[half]-y[half-1]).max(),float(a@b)))
    encode(y,'refrain_4bar_k%d'%k);np.save('refrain_4bar_k%d.npy'%k,y.astype(np.float32))
