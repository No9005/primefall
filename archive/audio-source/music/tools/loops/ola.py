import numpy as np
from grid import *
from fixall import metrics,continuation_patch,encode
def split(x,fc=200):
    X=np.fft.rfft(x,axis=0);f=np.fft.rfftfreq(len(x),1/sr);m=(f<fc)[:,None]
    low=np.fft.irfft(X*m,len(x),axis=0);return low,x-low
def ola_splice(sig,M,W,fc_search=None):
    """cross-fades the end into pre-roll found inside the file: the material that precedes a match of the head, found by waveform similarity, aligned on a rising zero crossing"""
    mono=sig.mean(1);n=len(mono)
    z0=int(np.argmax((mono[:-1]<=0)&(mono[1:]>0)))        # the first rising zero crossing of the head
    head=mono[z0:z0+W];hn=head-head.mean()
    lim=n-W-M-2*sr//100
    # candidate start q (the match of the head); the pre-roll is sig[q-M+z0 : q+z0]
    seg=mono[:lim+W];num=np.correlate(seg,hn,'valid');e=np.sqrt(np.convolve(seg**2,np.ones(W),'valid')*np.sum(hn**2)+1e-12);nc=num/e
    rising=np.zeros(len(nc),bool);rising[1:]=(mono[:len(nc)-1]<=0)&(mono[1:len(nc)]>0)       # q is a rising zero crossing like z0
    valid=rising&(np.arange(len(nc))>=M+z0)&(np.arange(len(nc))<lim)
    q=int(np.argmax(np.where(valid,nc,-9)))
    pre=sig[q-M:q] if False else sig[q-M+0:q+0]
    # align: the head starts at index z0, so the pre-roll precedes index z0 of the loop
    y=sig.copy();t=np.linspace(0,np.pi/2,M)[:,None]
    end_idx=slice(n-M,n)
    y[end_idx]=sig[end_idx]*np.cos(t)+pre*np.sin(t)
    return y,q/sr,float(nc[q])
if __name__=='__main__':
    import json
    x=load('../before/refrain.m4a',False)
    low,mh=split(x)
    T=72/72.16
    from fixall import stretch
    out={}
    for M_ms in (40,100,200,400):
        M=int(M_ms*sr/1000);W=int(.06*sr)
        mhs,q,c=ola_splice(mh,M,W)
        lows=continuation_patch(low,int(.015*sr),int(.02*sr))
        y=lows+mhs
        # same grid correction as the repo version
        s=stretch(y,T)[:N]
        # re-apply the seam patch on the stretched version (the stretch smears the blend a little)
        print('M=%d ms: pre-roll from %.3f s, match corr %.2f'%(M_ms,q,c));metrics(s,'  OLA %d ms (mid+high), stretched'%M_ms)
        encode(s,'ola%d'%M_ms)
