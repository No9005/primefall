import numpy as np, json, subprocess, itertools, base64
SR=32000; BPM=72; BEAT=60/BPM; BEATS=64; N=int(BEATS*BEAT*SR)
T=json.load(open("notes.json"))
rng=np.random.default_rng(7)
mtof=lambda m:440*2**((m-69)/12)
def lp(x,fc,slope=2):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=1/(1+(f/fc)**(2*slope)); return np.fft.irfft(X,len(x))
def hp(x,fc):
    X=np.fft.rfft(x); f=np.fft.rfftfreq(len(x),1/SR); X*=(f/fc)**4/(1+(f/fc)**4); return np.fft.irfft(X,len(x))
saw=lambda f,t:2*((f*t)%1)-1
def place(buf,s,w):
    i=int(s*BEAT*SR); w=w[:max(0,len(buf)-i)]; buf[i:i+len(w)]+=w
def env(n,a,r,d=None):
    t=np.arange(n)/SR; e=np.minimum(1,t/a)*np.minimum(1,np.maximum(0,(n/SR-t)/r))
    if d: e*=np.exp(-t/d)
    return e
def tr_pad(notes,det=.006,fc=1200,a=.9,r=.8,amp=.10):
    b=np.zeros(N+SR*3)
    for s,d,n,v in notes:
        L=int((d*BEAT+r)*SR); t=np.arange(L)/SR; w=sum(saw(mtof(n)*(1+x),t+n*.013) for x in (-det,0,det))
        place(b,s,w*env(L,a,r)*(v/127)*amp)
    return lp(b[:N],fc)
def tr_drone(notes):
    b=np.zeros(N)
    for s,d,n,v in notes:
        t=np.arange(N)/SR; w=saw(mtof(n),t)+.6*saw(mtof(n)*1.004,t); w=w*(1+.12*np.sin(2*np.pi*.11*t+n))
        b+=w*(v/127)*.12
    return lp(hp(b,35),500)*env(N,2,2)
def tr_pulse(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int(.25*SR); t=np.arange(L)/SR; f=70*np.exp(-t/.07)+36; ph=2*np.pi*np.cumsum(f)/SR
        place(b,s,np.sin(ph)*np.exp(-t/.1)*(v/127)*.8)
    return b[:N]
def tr_bass(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int((d+.05)*BEAT*SR); t=np.arange(L)/SR; f=mtof(n)
        w=saw(f,t)+.7*saw(f*1.004,t)+.5*np.sign(np.sin(2*np.pi*f*t)); w=w/2.2+.9*np.sin(2*np.pi*f*t)
        e=np.minimum(1,t/.008)*np.exp(-t/.22)
        place(b,s,w*e*(v/127))
    b=lp(b[:N],900); return np.tanh(2.0*b)*.6
def tr_stabs(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int((d*BEAT+.15)*SR); t=np.arange(L)/SR; f=mtof(n)
        w=saw(f,t)+saw(f*1.006,t); place(b,s,w*np.minimum(1,t/.004)*np.exp(-t/.09)*(v/127)*.07)
    return lp(b[:N],3200)
def tr_melody(notes):
    b=np.zeros(N+SR*2)
    for s,d,n,v in notes:
        L=int((d*BEAT+.18)*SR); t=np.arange(L)/SR; f=mtof(n)*(1+.004*np.sin(2*np.pi*5.5*t)*np.minimum(1,t/.25))
        ph=2*np.pi*np.cumsum(f)/SR; w=.6*(2*((ph/(2*np.pi))%1)-1)+.4*np.sign(np.sin(ph))
        place(b,s,w*env(L,.02,.18)*(v/127)*.18)
    return lp(b[:N],3500)
def noise(L): return rng.uniform(-1,1,L)
def tr_drums(notes):
    b=np.zeros(N+SR*2)
    for s,d,n,v in notes:
        a=v/127
        if n==36:
            L=int(.3*SR); t=np.arange(L)/SR; f=45+90*np.exp(-t/.03); w=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.12)+.25*noise(L)*np.exp(-t/.004)
        elif n==38:
            L=int(.25*SR); t=np.arange(L)/SR; w=(lp(hp(noise(L),1500),6000)*np.exp(-t/.09)*.9+np.sin(2*np.pi*190*t)*np.exp(-t/.05)*.5)
        elif n in (42,46):
            L=int((.35 if n==46 else .06)*SR); t=np.arange(L)/SR; w=hp(noise(L),7000)*np.exp(-t/(.12 if n==46 else .02))*.45
        elif n in (45,47,50):
            L=int(.35*SR); t=np.arange(L)/SR; f0={45:90,47:120,50:160}[n]; f=f0*(1+.6*np.exp(-t/.05)); w=np.sin(2*np.pi*np.cumsum(f)/SR)*np.exp(-t/.14)
        elif n==49:
            L=int(1.8*SR); t=np.arange(L)/SR; w=hp(noise(L),4500)*np.exp(-t/.5)*.5
        else: continue
        place(b,s,w*a*.8)
    return b[:N]

def tr_arp(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int((d*BEAT+.25)*SR); t=np.arange(L)/SR; f=mtof(n)
        w=.6*saw(f,t)+.4*np.sign(np.sin(2*np.pi*f*t)); place(b,s,w*np.minimum(1,t/.003)*np.exp(-t/.16)*(v/127)*.12)
    return lp(b[:N],4200)
def tr_war(notes):
    b=np.zeros(N+SR*2)
    for s,d,n,v in notes:
        L=int(1.0*SR); t=np.arange(L)/SR; f0=mtof(n); f=f0*(1+.9*np.exp(-t/.035)); ph=2*np.pi*np.cumsum(f)/SR; body=(np.sin(ph)+.6*np.sin(2*ph)+.35*np.sin(3*ph))*np.exp(-t/.32)
        skin=lp(hp(noise(L),180),900)*np.exp(-t/.05)*.9; place(b,s,(body+skin)*(v/127)*.9)
    return b[:N]

def tr_choir(notes):
    b=np.zeros(N+SR*3)
    for s,d,n,v in notes:
        L=int((d*BEAT+.9)*SR); t=np.arange(L)/SR; f=mtof(n)*(1+.003*np.sin(2*np.pi*5*t+n))
        ph=2*np.pi*np.cumsum(f)/SR; w=(np.sin(ph)+.5*np.sin(2*ph)+.3*np.sin(3*ph)+.15*saw(f,t))
        place(b,s,w*env(L,1.1,.9)*(v/127)*.09)
    return lp(b[:N],1400)
def tr_strings(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int((d*BEAT+.1)*SR); t=np.arange(L)/SR; f=mtof(n); w=sum(saw(f*(1+x),t) for x in (-.005,.005))
        place(b,s,w*np.minimum(1,t/.01)*np.exp(-t/.2)*(v/127)*.05)
    return lp(b[:N],3000)
def tr_tension(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int((d*BEAT+.1)*SR); t=np.arange(L)/SR; f=mtof(n)*(1+.005*np.sin(2*np.pi*6*t)); ph=2*np.pi*np.cumsum(f)/SR
        w=.5*np.sign(np.sin(ph))+.5*(2*((ph/(2*np.pi))%1)-1); place(b,s,w*env(L,.03,.1)*(v/127)*.12)
    return lp(b[:N],3600)
def tr_ticks(notes):
    b=np.zeros(N+SR)
    for s,d,n,v in notes:
        L=int(.08*SR); t=np.arange(L)/SR; f=mtof(n); w=np.sin(2*np.pi*f*t)*np.exp(-t/.012)+.3*lp(hp(noise(L),2500),6000)*np.exp(-t/.01)
        place(b,s,w*(v/127)*.5)
    return b[:N]
def tr_glimmer(notes):
    b=np.zeros(N+SR*3)
    for s,d,n,v in notes:
        L=int((d*BEAT+1.5)*SR); t=np.arange(L)/SR; f=mtof(n)
        w=np.sin(2*np.pi*f*t)+.4*np.sin(2*np.pi*f*2.76*t)*np.exp(-t/.25)+.2*np.sin(2*np.pi*f*5.4*t)*np.exp(-t/.12)
        place(b,s,w*np.minimum(1,t/.003)*np.exp(-t/.9)*(v/127)*.2)
    return b[:N]
def tr_braams(notes):
    b=np.zeros(N+SR*2)
    for s,d,n,v in notes:
        L=int((d*BEAT+1.2)*SR); t=np.arange(L)/SR; f=mtof(n); w=saw(f,t)+.7*saw(f*1.007,t)+.4*np.sign(np.sin(2*np.pi*f*t))
        place(b,s,w*np.minimum(1,t/.02)*np.exp(-t/1.1)*(v/127)*.1)
    return lp(b[:N],700)
R={"drone":tr_drone,"pulse":tr_pulse,"bass":tr_bass,"drums":tr_drums,"pad":lambda x:tr_pad(x),"stabs":tr_stabs,"melody":tr_melody,"arp":tr_arp,"war":tr_war,"choir":tr_choir,"strings":tr_strings,"tension":tr_tension,"ticks":tr_ticks,"braams":tr_braams,"glimmer":tr_glimmer}
trk={k:R[k](T[k]) for k in R}
def norm(x,db): return x/np.sqrt(np.mean(x**2))*10**(db/20)
LEVEL={"drone":-30,"pulse":-31,"bass":-22,"drums":-23,"pad":-29,"stabs":-28,"melody":-24,"arp":-25,"war":-22,"choir":-27,"strings":-27,"tension":-26,"ticks":-30,"braams":-24,"glimmer":-27}
for k,v in trk.items(): open(f"stem_{k}.raw","wb").write((np.clip(norm(v,-22),-1,1)*32767).astype('<i2').tobytes())
out={}
for k,v in trk.items():
    v=norm(v,LEVEL[k]); pk=np.abs(v).max(); v=v*(.89/pk) if pk>.89 else v
    open(f"g_{k}.raw","wb").write((v*32767).astype('<i2').tobytes())
    subprocess.run(["ffmpeg","-y","-v","error","-f","s16le","-ar",str(SR),"-ac","1","-i",f"g_{k}.raw","-b:a","56k",f"g_{k}.mp3"],check=True)
    out[k]=base64.b64encode(open(f"g_{k}.mp3","rb").read()).decode()
    print(k,'rms %.1f dB peak %.2f'%(20*np.log10(np.sqrt(np.mean(v**2))),np.abs(v).max()))
json.dump(out,open("gstems.json","w")); print(sum(len(v) for v in out.values())/1e6,"MB b64")
mix=sum(norm(trk[k],LEVEL[k]) for k in trk); print('all stems summed: peak %.2f rms %.1f dB'%(np.abs(mix).max(),20*np.log10(np.sqrt(np.mean(mix**2)))))
