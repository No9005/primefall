import numpy as np
from tonal import *
def rms_db(a):return 20*np.log10(np.sqrt(np.mean(a**2))+1e-9)
def direct_loop(src,t0,t1,ov_ms=150):
    """the second before the drums rise, looped as it is; the end is cross-faded (equal power) into what came before the start, so the start follows without a seam"""
    a,b=int(t0*sr),int(t1*sr);ov=int(ov_ms*sr/1000)
    # cut at rising zero crossings of the mono signal
    m=src.mean(1)
    za=a+int(np.argmax((m[a:a+800]<=0)&(m[a+1:a+801]>0)));zb=b+int(np.argmax((m[b:b+800]<=0)&(m[b+1:b+801]>0)))
    loop=src[za:zb].copy();pre=src[za-ov:za];t=np.linspace(0,np.pi/2,ov)[:,None]
    loop[-ov:]=loop[-ov:]*np.cos(t)+pre*np.sin(t);return loop
for name in ('victory','defeat'):
    src=ld(J+'jingle-%s.mp3'%name)
    d=direct_loop(src,19.0,20.0);g=10**((-24-rms_db(d))/20);d=d*g
    print(name,'direct loop: %.3f s, gain %.1f dB, seam step %.4f'%(len(d)/sr,20*np.log10(g),np.abs(d[0]-d[-1]).max()),'| RMS %.1f'%rms_db(d))
    np.save('direct_%s.npy'%name,d.astype(np.float32))
    x=equalise(src[int(18.9*sr):int(20.0*sr)],-22)
    ch=[tonal_stretch(x[:,c],60,N=32768,seed=5+c) for c in range(2)];n=min(len(c) for c in ch);p=np.stack([c[:n] for c in ch],1)
    t=np.arange(len(p))/sr;p[:,0]*=1+0.10*np.sin(2*np.pi*t/9.0);p[:,1]*=1+0.10*np.sin(2*np.pi*t/11.0+1.3)
    loop=make_loop(p);g=10**((-24-rms_db(loop))/20);loop=loop*g
    print(name,'pad from 18.9-20 s: %.1f s source -> loop'%1.1);metrics(loop,'   pad');print('   centroid %.0f Hz, flatness %.4f'%(centroid(loop),flatness(loop)))
    np.save('pad19_%s.npy'%name,loop.astype(np.float32))
