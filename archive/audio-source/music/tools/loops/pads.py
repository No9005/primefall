import numpy as np,subprocess,wave
sr=44100;LEN=int(round(4*4*60/72*sr))     # 4 bars at 72 BPM = 13.333 s
J='../inpaint/'
def ld(f):
    return np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-f','f32le','-ac','2','-ar','44100','-'],capture_output=True).stdout,'<f4').reshape(-1,2).astype(np.float64)
def equalise(x,target_db=-22,win=0.1,cap_db=14):
    n=int(win*sr);env=np.sqrt(np.convolve((x**2).mean(1),np.ones(n)/n,'same'))+1e-9
    k=np.ones(int(.3*sr))/int(.3*sr);env=np.convolve(env,k,'same')
    g=np.minimum(10**(target_db/20)/env,10**(cap_db/20));return x*g[:,None]
def paulstretch(x,stretch,N=32768,seed=1):
    rng=np.random.default_rng(seed);w=np.hanning(N);hop_out=N//2;hop_in=hop_out/stretch
    nframes=int((len(x)-N)/hop_in)+1;out=np.zeros(int(nframes*hop_out)+N)
    for i in range(nframes):
        pos=int(i*hop_in);fr=x[pos:pos+N]*w
        if len(fr)<N:break
        S=np.abs(np.fft.rfft(fr));ph=rng.uniform(0,2*np.pi,len(S));y=np.fft.irfft(S*np.exp(1j*ph),N)*w
        out[i*hop_out:i*hop_out+N]+=y
    return out
def pad(src,t0,t1,stretch=9,target_db=-22,name='x'):
    x=equalise(src[int(t0*sr):int(t1*sr)],target_db)
    ch=[paulstretch(x[:,c],stretch,seed=1+c) for c in range(2)];n=min(len(c) for c in ch);y=np.stack([c[:n] for c in ch],1)
    return y
def make_loop(p,ov_s=2.667):
    ov=int(ov_s*sr);p=p[N0:] if False else p
    assert len(p)>=LEN+ov+sr,len(p)/sr
    p=p[int(.5*sr):]                                # skip the fade-in of the stretch
    loop=p[:LEN].copy();over=p[LEN:LEN+ov];t=np.linspace(0,np.pi/2,ov)[:,None]
    loop[:ov]=over*np.cos(t)+p[:ov]*np.sin(t)       # equal power: the continuation of the texture gives way to the start
    return loop
def wav(path,x):
    pcm=(np.clip(x,-1,1)*32767).astype('<i2');w=wave.open(path,'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes());w.close()
def metrics(y,name):
    s=np.abs(y[0]-y[-1]).max();d=np.abs(np.diff(y,axis=0)).max(1);typ=np.percentile(d,99.9)
    m=y.mean(1);r=lambda a:20*np.log10(np.sqrt(np.mean(a**2))+1e-9);n=int(.5*sr)
    print('%s: loop %.3f s, seam step %.4f (typ %.4f, %.1fx), RMS first/last 500 ms %.1f/%.1f dB, whole %.1f dB, peak %.2f'%(name,len(y)/sr,s,typ,s/typ,r(m[:n]),r(m[-n:]),r(m),np.abs(y).max()))
if __name__=='__main__':
    for name,(t0,t1) in {'victory':(20.6,22.6),'defeat':(20.6,23.2)}.items():
        src=ld(J+'jingle-%s.mp3'%name);p=pad(src,t0,t1,stretch=18 if name=='victory' else 12,name=name)
        print(name,'stretched pad %.1f s'%(len(p)/sr))
        loop=make_loop(p);metrics(loop,name+' pad loop');np.save('loop_%s.npy'%name,loop.astype(np.float32));wav('loop_%s.wav'%name,loop*0.5)
