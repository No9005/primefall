import numpy as np, subprocess, itertools, base64, json, wave
SR=44100; BEAT=60/72; BAR=4*BEAT; TOTAL=8*BAR; N=int(round(TOTAL*SR))
A="/home/user/primefall/audio-source/music/layers/aligned/"
def mtof(m): return 440*2**((m-69)/12)
def load(path,pitch=None):
    af=[]
    if pitch: af=["-af",f"rubberband=pitch={pitch}"]
    raw=subprocess.run(["ffmpeg","-v","error","-i",path,*af,"-ac","1","-ar",str(SR),"-f","f32le","-"],capture_output=True,check=True).stdout
    x=np.frombuffer(raw,dtype=np.float32).astype(np.float64)[:N]; return np.pad(x,(0,N-len(x)))
def lowpass(x,fc,slope=2):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/(1+(f/fc)**(2*slope)); return np.fft.irfft(X,len(x))
def highpass(x,fc):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=(f/fc)**4/(1+(f/fc)**4); return np.fft.irfft(X,len(x))
def saw(f,t): return 2*((f*t)%1)-1
CH=[(41,[53,56,60]),(39,[51,55,58]),(37,[49,53,56]),(36,[48,52,55])]  # bass root, pad voicing: Fm, Eb, Db, C
REG=2*BAR
# ---- bass
t=np.arange(N)/SR
osc=np.zeros(N); sub=np.zeros(N)
for c,(root,_) in enumerate(CH):
    s,e=int(c*REG*SR),int((c+1)*REG*SR); tt=t[s:e]
    osc[s:e]=saw(mtof(root),tt)+0.7*saw(mtof(root)*1.004,tt)+0.5*np.sign(np.sin(2*np.pi*mtof(root)*tt))
    sub[s:e]=np.sin(2*np.pi*mtof(root)*tt)
dark=lowpass(osc,260); bright=lowpass(osc,1700)
env=np.zeros(N); br=np.zeros(N); subenv=np.zeros(N)
amp=[1,.55,.8,.55,.95,.55,.8,.55]
for i in range(64):
    t0=i*BEAT/2; s=int(t0*SR); L=int(BEAT/2*SR*1.0); tl=np.arange(L)/SR
    a=amp[i%8]; att=np.minimum(1,tl/.008)
    env[s:s+L]+=a*att*np.exp(-tl/.20)[:len(env[s:s+L])] if s+L<=N else 0
    br[s:s+L]+=a*att*np.exp(-tl/.07)[:len(br[s:s+L])] if s+L<=N else 0
    subenv[s:s+L]+=a*att*np.exp(-tl/.30)[:len(subenv[s:s+L])] if s+L<=N else 0
bass=np.tanh(2.2*((dark*(1-np.clip(br,0,1))+bright*np.clip(br,0,1))*env/ (np.abs(osc).max()) *3+0.9*sub*subenv))
bass=highpass(bass,28)
# ---- pad
pad=np.zeros(N+int(2*SR))
for c,(_,notes) in enumerate(CH):
    s=int(c*REG*SR); Ls=int((REG+1.4)*SR); tl=np.arange(Ls)/SR; y=np.zeros(Ls)
    for m in notes:
        for dt in (-.006,0,.006): y+=saw(mtof(m)*(1+dt),tl+ (0.13*m))
    ev=np.minimum(1,tl/1.0)*np.minimum(1,np.maximum(0,(REG+1.4-tl)/1.0))
    y=y*ev*(1+0.06*np.sin(2*np.pi*0.18*tl+c))
    pad[s:s+Ls]+=y
pad[:int(2*SR)]+=pad[N:N+int(2*SR)]  # fold the tail: seamless loop
pad=pad[:N]; pad=highpass(lowpass(pad,1300),110)
# ---- ElevenLabs layers, drone and pulse transposed from D to F (+3 semitones)
k=2**(3/12)
drone=load(A+"drone.mp3",k); pulse=load(A+"pulse.mp3",k); drums=load(A+"drums.mp3")
def norm(x,db): return x/np.sqrt(np.mean(x**2))*10**(db/20)
st={"drone":norm(drone,-27),"pad":norm(pad,-26),"bass":norm(bass,-21),"drums":norm(drums,-26)*1.0+norm(pulse,-31)}
for k_,v in st.items(): open(f"stem_{k_}.raw","wb").write((np.clip(v,-1,1)*32767).astype('<i2').tobytes())
out={}
names=["drone","pad","bass","drums"]
for combo in itertools.product([0,1],repeat=4):
    key="".join(map(str,combo)); mix=sum(st[n]*c for n,c in zip(names,combo)) if any(combo) else np.zeros(N)
    pk=np.abs(mix).max()
    if pk>10**(-1/20): mix=mix*10**(-1/20)/pk
    open(f"h_{key}.raw","wb").write((mix*32767).astype('<i2').tobytes())
    subprocess.run(["ffmpeg","-y","-v","error","-f","s16le","-ar",str(SR),"-ac","1","-i",f"h_{key}.raw","-ar","32000","-b:a","64k",f"h_{key}.mp3"],check=True)
    out[key]=base64.b64encode(open(f"h_{key}.mp3","rb").read()).decode()
json.dump(out,open("hmix.json","w")); print(sum(len(v) for v in out.values())/1e6,"MB b64")
