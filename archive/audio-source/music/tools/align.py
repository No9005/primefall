import subprocess,numpy as np,json,os
sr=44100; BPM=72.0; BAR=4*60/BPM; LOOP=8*BAR   # 26.6667 s
def load(p,ch=2): return np.frombuffer(subprocess.run(["ffmpeg","-v","error","-i",p,"-f","f32le","-ac",str(ch),"-ar",str(sr),"-"],capture_output=True).stdout,dtype=np.float32).reshape(-1,ch)
def env(x,hop_ms=5,k_ms=20):
    m=np.abs(x).mean(axis=1); k=int(sr*k_ms/1000); e=np.convolve(m,np.ones(k)/k,mode="same")[::int(sr*hop_ms/1000)]; return e-e.mean()
def tempo_precise(x):
    e=env(x,1,10); ac=np.correlate(e,e,"full")[len(e)-1:]; ac/=ac[0]
    # 4 bars = 16 beats at ~72 BPM = ~13333 ms; search 13100..13600 ms with 1 ms steps
    L=max(range(13100,13600),key=lambda i:ac[i]); return 60000*16/L, float(ac[L])
def stretch(x,ratio):  # ratio>1 = faster; ffmpeg atempo keeps the pitch
    p=subprocess.run(["ffmpeg","-v","error","-f","f32le","-ar",str(sr),"-ac","2","-i","-","-af",f"atempo={ratio:.6f}","-f","f32le","-"],input=x.astype(np.float32).tobytes(),capture_output=True)
    return np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,2)
def rotate_loop(x,start_s,n_s=LOOP,fade_ms=60):
    """The layer as a loop of exactly 8 bars that starts at `start_s`: the end of the audio is blended into its beginning."""
    n=int(round(n_s*sr)); f=int(sr*fade_ms/1000); s=int(round(start_s*sr)); L=len(x)
    j=(L-s)%L  # where the end of x meets its beginning in the rotated loop
    idx=(np.arange(n)+s)%L; y=x[idx].copy()
    if 0<j<n and j>=f:
        t=np.linspace(0,1,f)[:,None]
        y[j-f:j]=x[L-f:L]*np.cos(t*np.pi/2)+x[:f]*np.sin(t*np.pi/2)
    return y
def first_beat(x,bpm=BPM):
    e=env(x,5,20); beat=60/bpm; step=int(round(beat/0.005)); best=None
    # comb: mean envelope at the beat grid for phase offsets 0..beat
    for off in range(0,step):
        v=e[off::step].mean()
        if best is None or v>best[0]: best=(v,off)
    return best[1]*0.005
def bar_phase(x,ref_env,bpm=BPM):
    # which beat of the bar: cross-correlate with the reference (drums) envelope over +-1.7 s
    e=env(x,5,20); n=min(len(e),len(ref_env)); a=ref_env[:n]; b=e[:n]
    cc=np.correlate(a,b,"full"); mid=len(b)-1; best=max(range(mid-340,mid+340),key=lambda i:cc[i]); return (best-mid)*0.005
def lowband(x,fc=180):
    p=subprocess.run(["ffmpeg","-v","error","-f","f32le","-ar",str(sr),"-ac","2","-i","-","-af",f"lowpass=f={fc}","-f","f32le","-"],input=x.astype(np.float32).tobytes(),capture_output=True); return np.frombuffer(p.stdout,dtype=np.float32).reshape(-1,2)
if __name__=="__main__":
    out={}
    D="layers/"; names={"drums":"drums2","pulse":"pulse2","drone":"drone2"}
    X={k:load(D+v+".mp3") for k,v in names.items()}
    for k in ["drums","pulse"]:
        bpm,c=tempo_precise(X[k]); out[k]={"measured_bpm":round(bpm,3)}; print(k,"measured BPM",round(bpm,3))
        X[k]=stretch(X[k],72.0/bpm)
        print("  stretched length",round(len(X[k])/sr,3),"s")
    beat=60/BPM
    fb_d=first_beat(X["drums"]); fb_p=first_beat(X["pulse"]); print("grid phase drums",round(fb_d,3),"pulse",round(fb_p,3))
    ed=env(lowband(X["drums"][int(fb_d*sr):]),5,30); best=None
    for k_ in range(0,8):
        st=fb_p+k_*beat; ep=env(lowband(X["pulse"][int(st*sr):]),5,30); n_=min(len(ed),len(ep),int(20/0.005)); c=float(np.dot(ed[:n_],ep[:n_])/(np.linalg.norm(ed[:n_])*np.linalg.norm(ep[:n_])+1e-9))
        print("  pulse start +%d beats: kick/thump similarity %.3f"%(k_,c))
        if best is None or c>best[0]: best=(c,k_)
    starts={"drums":fb_d,"pulse":fb_p+best[1]*beat,"drone":0.0}
    for k in X:
        y=rotate_loop(X[k],starts[k]); out.setdefault(k,{})["start_s"]=round(starts[k],3); out[k]["length_s"]=round(len(y)/sr,4); np.save(f"aligned_{k}.npy",y)
    json.dump(out,open("align.json","w"),indent=1); print(json.dumps(out))
