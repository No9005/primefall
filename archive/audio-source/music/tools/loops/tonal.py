import numpy as np
from scipy.ndimage import median_filter
from pads import *
def tonal_stretch(x,stretch,N=65536,seed=1,over_db=7,fmax=5000):
    rng=np.random.default_rng(seed);w=np.hanning(N);hop_out=N//2;hop_in=hop_out/stretch
    nframes=int((len(x)-N)/hop_in)+1;out=np.zeros(int(nframes*hop_out)+N);f=np.fft.rfftfreq(N,1/sr)
    for i in range(nframes):
        pos=int(i*hop_in);fr=x[pos:pos+N]*w
        if len(fr)<N:break
        S=np.abs(np.fft.rfft(fr));med=median_filter(S,size=61)+1e-9
        keep=(S>med*10**(over_db/20))&(f<fmax);S2=np.where(keep,S,0)
        S2=S2*np.exp(-(f/3500)**2)                               # no air above a few kHz: that was the hiss of the fan
        y=np.fft.irfft(S2*np.exp(1j*rng.uniform(0,2*np.pi,len(S))),N)*w;out[i*hop_out:i*hop_out+N]+=y
    return out
def flatness(y):
    m=y.mean(1)[sr:sr+int(8*sr)];S=np.abs(np.fft.rfft(m*np.hanning(len(m))))**2;f=np.fft.rfftfreq(len(m),1/sr);S=S[(f>60)&(f<8000)]+1e-18
    return float(np.exp(np.mean(np.log(S)))/np.mean(S))
def centroid(y):
    m=y.mean(1)[sr:sr+int(8*sr)];S=np.abs(np.fft.rfft(m*np.hanning(len(m))));f=np.fft.rfftfreq(len(m),1/sr);return float((S*f).sum()/S.sum())
if __name__=='__main__':
    for name,(t0,t1) in {'victory':(20.4,22.6),'defeat':(20.4,23.4)}.items():
        src=ld(J+'jingle-%s.mp3'%name);x=equalise(src[int(t0*sr):int(t1*sr)],-22)
        ch=[tonal_stretch(x[:,c],40 if name=='victory' else 14,seed=3+c) for c in range(2)];n=min(len(c) for c in ch);p=np.stack([c[:n] for c in ch],1)
        # slow movement: two detuned copies would need more material; a gentle slow amplitude swell per channel keeps the pad breathing
        t=np.arange(len(p))/sr;p[:,0]*=1+0.12*np.sin(2*np.pi*t/9.0);p[:,1]*=1+0.12*np.sin(2*np.pi*t/11.0+1.3)
        print(name,'pad %.1f s'%(len(p)/sr))
        loop=make_loop(p);g=10**((-24-20*np.log10(np.sqrt(np.mean(loop**2))))/20);loop=loop*g
        old=np.load('loop_%s.npy'%name).astype(np.float64)
        print('   spectral flatness (1 = noise, 0 = pure tones): old %.4f -> new %.4f; centroid old %.0f -> new %.0f Hz'%(flatness(old),flatness(loop),centroid(old),centroid(loop)))
        metrics(loop,name+' tonal pad loop');np.save('loop2_%s.npy'%name,loop.astype(np.float32))
