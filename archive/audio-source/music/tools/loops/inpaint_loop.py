import numpy as np,subprocess
from grid import *
from fixall import metrics,encode
from seamless2 import rising
def cen(a):
    S=np.abs(np.fft.rfft(a*np.hanning(len(a))));f=np.fft.rfftfreq(len(a),1/sr);return (S*f).sum()/S.sum()
y=np.frombuffer(subprocess.run(['ffmpeg','-loglevel','error','-i','../inpaint/refrain-inpaint-b-seed424242.mp3','-f','f32le','-ac','2','-ar','44100','-'],capture_output=True).stdout,'<f4').reshape(-1,2).astype(np.float64)
mono=y.mean(1)
# the beat grid of the output: beats at 0.040 + k/1.2 s, exactly 72 BPM from start to end; the cut sits 15 ms before the first beat, at a rising zero crossing
cands=rising(mono,int(.010*sr),int(.040*sr));s=int(cands[np.argmin(np.abs(cands-int(.025*sr)))]);e=s+N
print('start zero crossing %.2f ms, end %d samples later at %.3f s; overhang behind the end %.2f s'%(s/sr*1000,N,e/sr,(len(y)-e)/sr))
ref_rms=-21.5   # the refrain file in the game
outs={}
for ov_ms in (100,250,500):
    ov=int(ov_ms*sr/1000);loop=y[s:e].copy();t=np.linspace(0,np.pi/2,ov)[:,None]
    loop[:ov]=y[e:e+ov]*np.cos(t)+y[s:s+ov]*np.sin(t)      # equal power: the real continuation (bar 1 again) gives way to the start
    outs[ov_ms]=loop
loop_hard=y[s:e].copy()
rms=lambda a:20*np.log10(np.sqrt(np.mean(a**2)))
g=10**((ref_rms-rms(outs[250]))/20);print('loop RMS %.1f dB, game file -21.5 dB -> gain %.2f (%.1f dB)'%(rms(outs[250]),g,20*np.log10(g)))
g=min(g,1/np.abs(outs[250]).max()*0.98)
for nm,l in (('hard',loop_hard),*[('ola%d'%k,v) for k,v in outs.items()]):
    z=l*g;metrics(z,'inpainted loop, %s'%nm)
    m=z.mean(1);n=int(.1*sr);print('      last/first 100 ms: centroid %.0f / %.0f Hz, RMS %.1f / %.1f dB'%(cen(m[-n:]),cen(m[:n]),rms(m[-n:]),rms(m[:n])))
    encode(np.clip(z,-1,1),'refrain_inp_%s'%nm);np.save('refrain_inp_%s.npy'%nm,z.astype(np.float32))
