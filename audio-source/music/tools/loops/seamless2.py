"""Two more loop techniques, on the refrain stretched to the 72 BPM grid.
A  tail fold: 500 ms of what follows the loop end (the tail), faded out gently and ADDED to the first 500 ms of the loop.
   The file has only ~50 ms behind the loop end, so the tail is taken from where the file is most like the end (context match on the beat grid).
B  phase correlation: scipy.signal.correlate on a 50 ms window between the end and the start finds the end point at which the waveforms
   lie exactly in phase over each other; then the equal-power crossfade is applied."""
import numpy as np,sys
from scipy.signal import correlate
from grid import *
from fixall import metrics,stretch,encode
def rising(mono,a,b):
    a=max(a,1);return np.nonzero((mono[a-1:b-1]<=0)&(mono[a:b]>0))[0]+a
def prepare(x,tf):
    xs=stretch(x,tf);mono=xs.mean(1);s=int(rising(mono,0,int(.020*sr))[0]);return xs,mono,s
def tail_fold(xs,mono,s,tail_ms=500,ctx_ms=100):
    e=s+N;T=int(tail_ms*sr/1000);C=int(ctx_ms*sr/1000);P=60/72*sr
    ctx=mono[e-C:e] if e<=len(mono) else mono[len(mono)-C:]
    best=(-2,0)
    for k in range(2,30):                      # earlier places on the beat grid, +-20 ms
        centre=int(e-k*P)
        for m in range(centre-882,centre+883):
            if m-C<0 or m+T>e-T:continue
            c=mono[m-C:m];sc=float(np.dot(ctx-ctx.mean(),c-c.mean())/np.sqrt(np.dot(ctx-ctx.mean(),ctx-ctx.mean())*np.dot(c-c.mean(),c-c.mean())+1e-12))
            if sc>best[0]:best=(sc,m)
    sc,m=best;print('  A: tail taken from %.3f s (context similarity %.2f), %.0f beats before the end'%(m/sr,sc,(e-m)/P))
    y=xs[s:s+N].copy();tail=xs[m:m+T];fade=(0.5*(1+np.cos(np.pi*np.arange(T)/T)))[:,None]   # smooth 1 -> 0
    # the real overhang (about 48 ms) is used first, the matched tail continues behind it
    real=min(len(xs)-e,T)
    if real>0:tail=np.vstack([xs[e:e+real],tail[real:]])
    y[:T]+=tail*fade;return y
def phase_xfade(xs,mono,s,M_ms=50,span_ms=20):
    M=int(M_ms*sr/1000);d=int(span_ms*sr/1000);e0=s+N+M       # nominal end behind which the crossfade ends (loop length N once M is overlapped)
    lo=max(M+s+1,e0-d);hi=min(len(mono),e0+d)
    head=mono[s:s+M];region=mono[lo-M:hi]
    cc=correlate(region,head,mode='valid')                      # one value per candidate end point
    norm=np.sqrt(np.convolve(region**2,np.ones(M),'valid')*np.dot(head,head)+1e-12);nc=cc/norm
    j=int(np.argmax(nc));e=lo+j
    z=rising(mono,e-6,e+6);e=int(z[np.argmin(np.abs(z-e))]) if len(z) else e
    print('  B: end point moved by %+d samples (%.2f ms) to the best phase match, correlation %.2f'%(e-e0,(e-e0)/sr*1000,nc[j]))
    T=xs[e-M:e];H=xs[s:s+M];t=np.linspace(0,np.pi/2,M)[:,None];blend=T*np.cos(t)+H*np.sin(t)
    y=np.vstack([blend,xs[s+M:e-M]])                              # the blend opens the loop: the end runs into T, which gives way to H
    D=len(y);print('  B: loop %d samples (%.3f s), stretched to %d (factor %.5f)'%(D,D/sr,N,D/N))
    # a stretch of 0.01 % by interpolation, no time-stretcher (it would alter the first and last samples, which are the seam)
    pos=np.linspace(0,D-1,N);y=np.stack([np.interp(pos,np.arange(D),y[:,c]) for c in range(2)],axis=1)
    return y
if __name__=='__main__':
    x=load('../before/refrain.m4a',False);tf=72/72.16
    xs,mono,s=prepare(x,tf);print('stretched %.3f s, start zero crossing at %.2f ms'%(len(xs)/sr,s/sr*1000))
    ya=tail_fold(xs,mono,s);metrics(ya,'A tail fold (500 ms added)');encode(ya,'refrain_A')
    yb=phase_xfade(xs,mono,s);metrics(yb,'B phase-aligned crossfade');encode(yb,'refrain_B')
    np.save('refrain_A.npy',ya.astype(np.float32));np.save('refrain_B.npy',yb.astype(np.float32))
