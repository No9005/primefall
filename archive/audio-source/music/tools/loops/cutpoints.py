import numpy as np
from grid import *
from fixall import stretch,metrics,encode
from ph import phases
from seamless2 import rising
tf=72/72.16
x=load('../before/refrain.m4a',False);xs=stretch(x,tf);mono=xs.mean(1);BEAT=60/72
phi=0.792   # the beat grid found earlier (1.5-6 kHz band), flat from start to end after the stretch
def sp(a):
    s=np.abs(np.fft.rfft(a*np.hanning(len(a))));return s/np.linalg.norm(s)
def cen(a):
    S=np.abs(np.fft.rfft(a*np.hanning(len(a))));f=np.fft.rfftfreq(len(a),1/sr);return (S*f).sum()/S.sum()
rows=[]
W=int(.1*sr)
for L_beats in (16,):
    L=int(round(L_beats*BEAT*sr))
    for k in range(0,16+1):
        t=phi+k*BEAT-0.015;s0=int(t*sr)
        if s0<1:continue
        z=rising(mono,s0-441,s0+441)
        if len(z)==0:continue
        s=int(z[np.argmin(np.abs(z-s0))]);e=s+L
        if e+W>len(mono):continue
        after=mono[e:e+W];head=mono[s:s+W];before=mono[e-W:e]
        simsp=float(sp(after)@sp(head));rms=20*np.log10(np.sqrt(np.mean(after**2))/np.sqrt(np.mean(head**2)));cg=cen(head)/cen(after)-1
        # what the jump really is: end of the loop into its start
        jump_sp=float(sp(before)@sp(head));step=float(np.abs(xs[s]-xs[e-1]).max())
        rows.append((k,s,e,simsp,rms,cg,jump_sp,step))
print('4-bar loops (16 beats) starting at beat k; "continuation" = how much the real music after the end (bar 5 of the loop) resembles the start; "jump" = end -> start as heard')
print(' k   start   cont.sim  RMS gap dB  centroid gap  jump sim  step')
for r in sorted(rows,key=lambda r:-(r[3]+r[6])):
    print('%2d  %6.2fs   %.2f      %+.1f        %+.0f%%         %.2f     %.3f'%(r[0],r[1]/sr,r[3],r[4],r[5]*100,r[6],r[7]))
np.save('cut_rows.npy',np.array(rows))
