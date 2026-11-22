import numpy as np
from synth import *
def wup2(f0,f1,dur,dec,gain,seed,noise_fc=380,drop=0.07):
    n=int(dur*sr);t=np.arange(n)/sr
    f=f1+(f0-f1)*np.exp(-t/drop);ph=2*np.pi*np.cumsum(f)/sr
    tone=np.sin(ph)+0.2*np.sin(2*ph)                              # less upper body than before: duller
    rng=np.random.default_rng(seed);noise=lp(rng.standard_normal(n),noise_fc)*env(n,0.02,0.07)*3.0   # a soft, low puff
    return gain*(tone*env(n,0.012,dec)*0.8+noise*0.45)
def impact2(f,dur,gain,seed):
    n=int(dur*sr);t=np.arange(n)/sr;rng=np.random.default_rng(seed)
    f_t=f+55*np.exp(-t/0.05);ph=2*np.pi*np.cumsum(f_t)/sr
    thud=np.sin(ph)*env(n,0.006,0.2)
    rumble=lp(rng.standard_normal(n),140)*env(n,0.03,0.3)*1.4
    return gain*(thud*0.9+rumble*0.4)
def wobble(y,rate,depth,seed=0):
    t=np.arange(len(y))/sr;return y*(1-depth+depth*0.5*(1+np.sin(2*np.pi*rate*t+seed)))
def build2(base,spacing,impact_at,total,wob=None,seed=0):
    parts=[(k*spacing,wup2(base,base*0.45,0.40,0.14,(1.0,0.9,0.8)[k],seed+k)) for k in range(3)]
    parts.append((impact_at,impact2(base*0.4,0.8,0.85,seed+9)))
    y=mix(parts,total)
    if wob:y=wobble(y,*wob)
    y=lp(y,1400)                                                   # nothing bright is left
    y=np.tanh(y*1.3)/1.3;f=int(0.35*sr);y[-f:]*=np.linspace(1,0,f)**1.5
    return y/np.abs(y).max()*0.5
if __name__=='__main__':
    V={'d':dict(base=140,spacing=0.17,impact_at=0.50,total=1.5,wob=None,seed=20),
       'e':dict(base=140,spacing=0.17,impact_at=0.50,total=1.6,wob=(6.0,0.45,0.0),seed=20),
       'f':dict(base=125,spacing=0.20,impact_at=0.58,total=1.8,wob=(4.5,0.55,0.0),seed=30)}
    import numpy as np
    for k,v in V.items():
        y=build2(**v);enc(y,'wup_%s.mp3'%k)
        S=np.abs(np.fft.rfft(y*np.hanning(len(y))));fq=np.fft.rfftfreq(len(y),1/sr)
        print(k,'%.2f s, RMS %.1f dB, centroid %.0f Hz, above 1 kHz share %.3f'%(len(y)/sr,20*np.log10(np.sqrt(np.mean(y**2))),(S*fq).sum()/S.sum(),(S[fq>1000]**2).sum()/(S**2).sum()))
    import subprocess
    c=np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i','wup_c.mp3','-f','f32le','-ac','1','-ar','44100','-'],capture_output=True).stdout,'<f4').astype(np.float64)
    S=np.abs(np.fft.rfft(c*np.hanning(len(c))));fq=np.fft.rfftfreq(len(c),1/sr);print('c (reference) %.2f s, RMS %.1f dB, centroid %.0f Hz, above 1 kHz share %.3f'%(len(c)/sr,20*np.log10(np.sqrt(np.mean(c**2))),(S*fq).sum()/S.sum(),(S[fq>1000]**2).sum()/(S**2).sum()))
