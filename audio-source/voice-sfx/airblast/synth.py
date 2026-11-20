import numpy as np,wave,subprocess
sr=44100
def env(n,att,dec):
    t=np.arange(n)/sr;return np.minimum(t/att,1)*np.exp(-t/dec)
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/sr);y=np.zeros_like(x);s=0
    for i,v in enumerate(x):s=(1-a)*v+a*s;y[i]=s
    return y
def wup(f0,f1,dur=0.16,gain=1.0,seed=0):
    n=int(dur*sr);t=np.arange(n)/sr
    f=f1+(f0-f1)*np.exp(-t/0.035);ph=2*np.pi*np.cumsum(f)/sr
    tone=np.sin(ph)+0.35*np.sin(2*ph)                       # a soft thump with a little body
    rng=np.random.default_rng(seed);noise=lp(rng.standard_normal(n),900)*env(n,0.004,0.025)*3.0   # the puff of air
    return gain*(tone*env(n,0.004,0.05)*0.8+noise*0.5)
def impact(f=62,dur=0.55,gain=1.0,seed=1):
    n=int(dur*sr);t=np.arange(n)/sr;rng=np.random.default_rng(seed)
    f_t=f+90*np.exp(-t/0.03);ph=2*np.pi*np.cumsum(f_t)/sr
    thud=np.sin(ph)*env(n,0.003,0.12)
    crack=lp(rng.standard_normal(n),3000)*env(n,0.001,0.018)*0.9      # the shock wave
    rumble=lp(rng.standard_normal(n),180)*env(n,0.01,0.2)*1.2
    return gain*(thud*0.9+crack*0.35+rumble*0.35)
def mix(parts,total):
    out=np.zeros(int(total*sr))
    for at,x in parts:
        i=int(at*sr);out[i:i+len(x)]+=x[:len(out)-i]
    return out
def build(base,spacing,total=1.0,pitch_drop=0.5,levels=(1.0,0.9,0.8),impact_at=0.30,seed=0):
    parts=[(k*spacing,wup(base*1.0,base*pitch_drop,gain=levels[k],seed=seed+k)) for k in range(3)]
    parts.append((impact_at,impact(f=base*0.42,gain=0.9,seed=seed+9)))
    y=mix(parts,total);y=np.tanh(y*1.4)/1.4
    # fade the end
    f=int(0.12*sr);y[-f:]*=np.linspace(1,0,f);return y/np.abs(y).max()*0.5
def enc(y,path):
    raw=y.astype('<f4').tobytes();subprocess.run(['ffmpeg','-loglevel','error','-y','-f','f32le','-ar',str(sr),'-ac','1','-i','-','-c:a','libmp3lame','-b:a','96k',path],input=raw,check=True)
if __name__=='__main__':
    V={'a':dict(base=190,spacing=0.09,impact_at=0.30,seed=0),'b':dict(base=165,spacing=0.12,impact_at=0.38,seed=10),'c':dict(base=140,spacing=0.15,impact_at=0.46,seed=20)}
    for k,v in V.items():
        y=build(**v,total=1.0);enc(y,'wup_%s.mp3'%k)
        r=20*np.log10(np.sqrt(np.mean(y**2)));print(k,'RMS %.1f dB, peak %.2f, %.2f s'%(r,np.abs(y).max(),len(y)/sr))
