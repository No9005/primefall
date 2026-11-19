"""Seamless 8-bar loop from a layer file.
 0. the file is stretched once by a tiny factor so its beats sit on the 72 BPM grid (the files run at about 72.16 BPM); the end is now longer than 8 bars
 1. start and end are rising zero crossings, the end exactly one loop (N samples) after the start; the start is searched within the first 20 ms
 2. overlap-add instead of butt-joining: the overhang behind the end (the material that really follows the loop) is cross-faded
    into the start with an equal-power curve
 3. librosa: how strong the onset envelope is at each cut, to see whether the cuts sit on a transient"""
import numpy as np,librosa,sys
from grid import *
from fixall import metrics,stretch,encode
HOP=64
def rising(mono,a,b):
    a=max(a,1);return np.nonzero((mono[a-1:b-1]<=0)&(mono[a:b]>0))[0]+a
def build(x,tempo_factor,ov_ms=100,verbose=True):
    xs=stretch(x,tempo_factor);mono=xs.mean(1)
    zc=set(rising(mono,0,len(mono)).tolist());cands=[s for s in rising(mono,0,int(.020*sr)) if (s+N) in zc]
    if not cands:
        cands=[s for s in rising(mono,0,int(.020*sr)) if any((s+N+d) in zc for d in (-1,1,-2,2))];print('  (end zero crossing off by a sample or two)')
    s=int(cands[0]);e=s+N;over_avail=len(xs)-e
    if verbose:print('stretched file %.3f s; start zero crossing at %d samples (%.2f ms), end at %d (%.3f s), overhang available %d samples = %.0f ms'%(len(xs)/sr,s,s/sr*1000,e,e/sr,over_avail,over_avail/sr*1000))
    ov=min(int(ov_ms*sr/1000),over_avail-1)
    env=librosa.onset.onset_strength(y=mono.astype(np.float32),sr=sr,hop_length=HOP,n_fft=1024,fmax=8000);med=float(np.median(env))
    onsets=librosa.onset.onset_detect(onset_envelope=env,sr=sr,hop_length=HOP,units='time',backtrack=False)
    for nm,idx in (('start',s),('end',e)):
        k=int(idx/HOP);near=[round(t*1000-idx/sr*1000) for t in onsets if abs(t-idx/sr)<0.08]
        print('  %s cut: onset strength in the 30 ms after it %.1fx median; detected onsets within 80 ms (ms relative to the cut): %s'%(nm,env[k:k+int(.03*sr/HOP)].max()/med,near))
    y=xs[s:e].copy();over=xs[e:e+ov];t=np.linspace(0,np.pi/2,ov)[:,None]
    y[:ov]=over*np.cos(t)+xs[s:s+ov]*np.sin(t)
    print('  overlap-add of %d samples (%.0f ms), equal power'%(ov,ov/sr*1000))
    return y
if __name__=='__main__':
    x=load(sys.argv[1],False);metrics(x,'refrain original')
    y=build(x,float(sys.argv[2]) if len(sys.argv)>2 else 72/72.16);metrics(y,'refrain overlap-add loop');encode(y,'refrain_ola');np.save('refrain_ola.npy',y.astype(np.float32))
