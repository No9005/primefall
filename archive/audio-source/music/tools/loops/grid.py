import subprocess,numpy as np,sys
sr=44100;N=1175971
D='/home/user/primefall/apps/web/public/assets/audio/music/'
def load(f,mono=True):
    a=np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i',f,'-f','f32le','-ac','2','-ar','44100','-'],capture_output=True).stdout,'<f4').reshape(-1,2).astype(np.float64)
    a=a[:N]; return a.mean(1) if mono else a
def flux(x,lo=40,hi=1500):
    n=1024;h=128;w=np.hanning(n);fr=np.lib.stride_tricks.sliding_window_view(x,n)[::h]*w
    S=np.abs(np.fft.rfft(fr,axis=1));f=np.fft.rfftfreq(n,1/sr);b=np.log1p(S[:,(f>=lo)&(f<hi)]*30)
    fl=np.maximum(0,np.diff(b,axis=0,prepend=b[:1])).sum(1);return fl,h/sr
def fit(fl,dt,t0=0,t1=None,Ps=np.arange(0.826,0.840,0.00005)):
    t1=t1 or len(fl)*dt;a=int(t0/dt);b=int(t1/dt);seg=fl[a:b];best=(-1,0,0)
    for P in Ps:
        k=np.arange(0,int((t1-t0)/P)-1)
        for ph in np.arange(0,P,0.002):
            idx=((ph+k*P)/dt).astype(int);sc=seg[np.clip(idx,0,len(seg)-1)].sum()
            if sc>best[0]:best=(sc,P,ph)
    return best
if __name__=='__main__':
    for name in sys.argv[1:]:
        x=load(name if '/' in name else D+name+'.m4a');fl,dt=flux(x)
        full=fit(fl,dt);h1=fit(fl,dt,0,13.3);h2=fit(fl,dt,13.3,26.6)
        print(name,'full P',round(full[1],5),'BPM',round(60/full[1],3),'| half1 P',round(h1[1],5),'half2 P',round(h2[1],5))
