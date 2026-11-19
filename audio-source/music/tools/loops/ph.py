import numpy as np
from grid import *
P=60/72
def phases(x,lo,hi,win=6.667,hop=1.667):
    fl,dt=flux(x,lo,hi);res=[]
    for w0 in np.arange(0,N/sr-win+0.01,hop):
        a=int(w0/dt);b=int((w0+win)/dt);seg=fl[a:b];best=(-1,0)
        for ph in np.arange(0,P,0.002):
            idx=((ph+np.arange(int(win/P))*P)/dt).astype(int);idx=idx[idx<len(seg)];sc=seg[idx].sum()
            if sc>best[0]:best=(sc,ph)
        res.append((round(w0,2),round(best[1]*1000)))
    return res
if __name__=='__main__':
    import sys
    x=load(sys.argv[1])
    for lo,hi in ((40,200),(200,1500),(1500,6000)):
        r=phases(x,lo,hi);print(lo,hi,[p for _,p in r])
