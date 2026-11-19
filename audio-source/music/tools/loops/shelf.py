import numpy as np
from scipy.signal import lfilter
from grid import *
from fixall import metrics,encode
def high_shelf(db,f0=2000,S=1.0):
    A=10**(db/40);w=2*np.pi*f0/sr;cw,sw=np.cos(w),np.sin(w);al=sw/2*np.sqrt((A+1/A)*(1/S-1)+2);t=2*np.sqrt(A)*al
    b=[A*((A+1)+(A-1)*cw+t),-2*A*((A-1)+(A+1)*cw),A*((A+1)+(A-1)*cw-t)];a=[(A+1)-(A-1)*cw+t,2*((A-1)-(A+1)*cw),(A+1)-(A-1)*cw-t]
    return np.array(b)/a[0],np.array(a)/a[0]
def shelve(x,db,where,ramp_ms=300):
    """a high shelf above 2 kHz of `db`, faded in over the last `ramp_ms` (where='end') or faded out over the first `ramp_ms` (where='start')"""
    b,a=high_shelf(db);wet=np.stack([lfilter(b,a,x[:,c]) for c in range(2)],1);R=int(ramp_ms*sr/1000)
    g=np.zeros(len(x));r=(1-np.cos(np.pi*np.arange(R)/R))/2
    if where=='end':g[-R:]=r
    else:g[:R]=r[::-1]
    return x*(1-g)[:,None]+wet*g[:,None]
def cen(seg):
    S=np.abs(np.fft.rfft(seg*np.hanning(len(seg))));f=np.fft.rfftfreq(len(seg),1/sr);return (S*f).sum()/S.sum()
def report(nm,y):
    n=int(.1*sr);m=y.mean(1);a,b=cen(m[-n:]),cen(m[:n]);r=lambda s:20*np.log10(np.sqrt(np.mean(s**2)))
    print('%-34s last 100 ms: centroid %4.0f Hz, RMS %.1f dB | first 100 ms: %4.0f Hz, %.1f dB | gap %+.0f Hz (%+.0f%%)'%(nm,a,r(m[-n:]),b,r(m[:n]),b-a,(b/a-1)*100))
if __name__=='__main__':
    B=np.load('refrain_B.npy').astype(np.float64);report('B as is',B)
    out={}
    out['E']=shelve(B,+4,'end');report('end +4 dB above 2 kHz (as asked)',out['E'])
    out['E6']=shelve(B,+4,'end',100);report('end +4 dB, ramp 100 ms',out['E6'])
    out['S']=shelve(B,+4,'start');report('start +4 dB above 2 kHz',out['S'])
    out['S6']=shelve(B,+6,'start');report('start +6 dB above 2 kHz',out['S6'])
    out['C']=shelve(B,-4,'end');report('end -4 dB above 2 kHz (cut)',out['C'])
    for k,v in out.items():encode(np.clip(v,-1,1),'refrain_sh_'+k)
