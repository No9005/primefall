import numpy as np,subprocess,sys,json
from grid import sr,N,D,load
OUT='out/';import os;os.makedirs(OUT,exist_ok=True)
def metrics(y,name):
    s=np.abs(y[0]-y[-1]).max();d=np.abs(np.diff(y,axis=0)).max(axis=1);typ=np.percentile(d,99.9)
    m=y.mean(axis=1);n=int(.04*sr)
    sp=lambda a:(lambda s_:s_/np.linalg.norm(s_))(np.abs(np.fft.rfft(a*np.hanning(len(a)))))
    rms=lambda a:20*np.log10(np.sqrt(np.mean(a**2))+1e-9)
    print('%-28s seam step %.3f (typ p99.9 %.3f, %.1fx) | spectral sim %.2f | rms last/first 50ms %.1f/%.1f dB'%(name,s,typ,s/typ,sp(m[-n:])@sp(m[:n]),rms(m[-2205:]),rms(m[:2205])))
def continuation_patch(x,c,W):
    """the start is blended from what follows the best match of the end elsewhere in the file (a continuation of the tail), over c samples"""
    m=x.mean(1);tail=m[-W:];tail=tail-tail.mean();best=(-9,0)
    lim=len(m)-W-c-W
    # normalised cross-correlation by FFT
    seg=m[:lim+W]
    num=np.correlate(seg,tail,'valid')
    e=np.sqrt(np.convolve(seg**2,np.ones(W),'valid')*np.sum(tail**2)+1e-12)
    nc=num/e;i=int(np.argmax(nc[:lim]))
    ext=x[i+W:i+W+c];t=np.linspace(0,np.pi/2,c)[:,None]
    y=x.copy();y[:c]=ext*np.cos(t)+x[:c]*np.sin(t)
    print('   match at %.3f s (corr %.2f)'%(i/sr,nc[i]));return y
def despike(x,k=12,anchor=14):
    y=x.copy();d=np.abs(np.diff(x,axis=0)).max(1);med=np.convolve(d,np.ones(220)/220,'same')
    idx=np.nonzero(d>12*med+1e-4)[0];idx=idx[(idx>anchor)&(idx<len(x)-anchor)]
    fixed=[]
    for i in idx:
        if fixed and i-fixed[-1]<6: continue
        a=np.r_[np.arange(i-anchor,i-1),np.arange(i+3,i+anchor)];xs=np.arange(i-1,i+3)
        for c in range(2):
            co=np.polyfit(a,x[a,c],3);y[xs,c]=np.polyval(co,xs)
        fixed.append(i)
    print('   despiked',len(fixed),'spikes at',[round(i/sr,3) for i in fixed]);return y
def stretch(x,tempo):
    wav=OUT+'_tmp.wav';import wave
    pcm=(np.clip(x,-1,1)*32767).astype('<i2');w=wave.open(wav,'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes());w.close()
    r=subprocess.run(['ffmpeg','-loglevel','error','-i',wav,'-af','rubberband=tempo=%f:pitch=1.0:transients=crisp'%tempo,'-f','f32le','-ac','2','-ar',str(sr),'-'],capture_output=True)
    return np.frombuffer(r.stdout,'<f4').reshape(-1,2).astype(np.float64)
def encode(y,name):
    assert len(y)==N
    raw=y.astype('<f4').tobytes();p=subprocess.run(['ffmpeg','-loglevel','error','-y','-f','f32le','-ar',str(sr),'-ac','2','-i','-','-c:a','aac','-b:a','96k',OUT+name+'.m4a'],input=raw,capture_output=True)
    print('   encoded',name,subprocess.run(['ffprobe','-v','error','-show_entries','stream=duration_ts','-of','csv=p=0',OUT+name+'.m4a'],capture_output=True,text=True).stdout.strip())
if __name__=='__main__':
    # drone
    x=load(D+'drone.m4a',False);metrics(x,'drone before');y=continuation_patch(x,int(.4*sr),int(.15*sr));metrics(y,'drone after');encode(y,'drone')
    # pulse
    x=load(D+'pulse.m4a',False);metrics(x,'pulse before');y=despike(x);y=continuation_patch(y,int(.015*sr),int(.02*sr));metrics(y,'pulse after');encode(y,'pulse')
    # drums: slow to the 72 BPM grid (the file runs at about 72.165), then the end is cut to the loop length
    x=load(D+'drums.m4a',False);metrics(x,'drums before');s=stretch(x,72/72.165);print('   stretched length',len(s)/sr);y=s[:N] if len(s)>=N else np.vstack([s,np.zeros((N-len(s),2))])
    y=continuation_patch(y,int(.015*sr),int(.02*sr));metrics(y,'drums after');encode(y,'drums')
