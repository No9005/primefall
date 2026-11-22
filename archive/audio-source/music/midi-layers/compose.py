"""Notstrom MIDI layers v2: 16 bars, 72 BPM, 4/4, D minor, with a tension arc.
 A  bars 1-4   : Dm Dm Bb Bb               (the statement)
 B1 bars 5-8   : Gm Gm Eb Eb               (the subdominant and the flat II: darker, colder)
 B2 bars 9-12  : Gm Eb E°7 A7b9            (a chord every bar, a chromatic bass step Eb to E, the diminished chord and the
                                            dominant with the flat ninth: the peak of the tension)
 C  bars 13-16 : D5 Bb5 C5 D5              (the resolution in power chords, no third)"""
import numpy as np, mido, os, json
BPM=72; BARS=16; BEATS=BARS*4; PPQ=480
# name: (chord tones for pad/arp, bass root, power-chord tones, accent colour)
CHORDS={"Dm":([62,65,69],38,[50,57,62]),"Bb":([58,62,65],34,[46,53,58]),"Gm":([55,58,62],31,[43,50,55]),"Eb":([55,58,63],39,[51,58,63]),
        "E°7":([52,55,58,61],40,[52,58,64]),"A7b9":([57,61,64,67,70],33,[45,52,58]),"D5":([50,57,62],38,[50,57,62]),"Bb5":([46,53,58],34,[46,53,58]),"C5":([48,55,60],36,[48,55,60])}
BARCH=["Dm","Dm","Bb","Bb","Gm","Gm","Eb","Eb","Gm","Eb","E°7","A7b9","D5","Bb5","C5","D5"]
LABEL={"Dm":"Dm","Bb":"B♭","Gm":"Gm","Eb":"E♭","E°7":"E°7","A7b9":"A7♭9","D5":"D5","Bb5":"B♭5","C5":"C5"}
SECTION=lambda bar:"A" if bar<4 else "B1" if bar<8 else "B2" if bar<12 else "C"
ORDER=["drone","pulse","bass","drums","pad","stabs","melody","arp","war","choir","strings","tension","ticks","braams","glimmer"]
NAME={"glimmer":"glimmer","arp":"arpeggio","war":"war-drums","choir":"choir","strings":"strings-tremolo","tension":"tension-line","ticks":"ticks","braams":"braams"}
T={k:[] for k in ORDER}
add=lambda tr,s,d,n,v:T[tr].append((float(s),float(d),int(n),int(v)))
def spans():
    out=[];start=0
    for b in range(1,BARS+1):
        if b==BARS or BARCH[b]!=BARCH[start]: out.append((start,b-start,BARCH[start])); start=b
    return out
SP=spans()
# drone: pedal on D and A, the whole loop (the owner can mute it)
for n,v in [(38,60),(45,52),(50,48)]: add("drone",0,BEATS,n,v)
# pulse: heartbeat lub-dub on every beat
for b in range(BEATS): add("pulse",b,.2,26,105); add("pulse",b+.34,.18,26,72)
# bass
for bar in range(BARS):
    ch=BARCH[bar]; root=CHORDS[ch][1]; sec=SECTION(bar); b0=bar*4
    if sec in("A","B1"):
        for e in range(8):
            n=root+(12 if e in(3,7) and bar%2==0 else 0)
            if bar%2==1 and e>=6: n=root+7
            add("bass",b0+e*.5,.45,n,112 if e%4==0 else 88)
    elif sec=="B2":  # sixteenth pumping on the root, building up
        for e in range(16): add("bass",b0+e*.25,.22,root+(12 if e%8==7 else 0),min(127,84+int((bar-8)*7)+(16 if e%4==0 else 0)))
    else:            # resolution: root and octave in eighths, heavy
        for e in range(8): add("bass",b0+e*.5,.46,root+(12 if e%2==1 else 0),124 if e%2==0 else 104)
# pad: chord held per span (the power chords of the resolution too)
for s,L,ch in SP:
    for n in CHORDS[ch][0]: add("pad",s*4,L*4,n-12 if ch in("D5","Bb5","C5") else n-12,64 if SECTION(s)=="A" else 76 if SECTION(s)!="C" else 92)
# stabs: off-beat power chords on the 'and' of 2 and 4; in B2 on every 'and', in C also on the 'and' of 1 and 3
for bar in range(BARS):
    ch=BARCH[bar]; pw=CHORDS[ch][2]; sec=SECTION(bar); b0=bar*4
    pos={"A":(1.5,3.5),"B1":(1.5,3.5),"B2":(.5,1.5,2.5,3.5),"C":(.5,1.5,2.5,3.5)}[sec]
    tones=[p+12 for p in pw]
    if ch=="A7b9": tones=[57+12,64+12,70+12]  # A, E and the flat ninth Bb: the cluster that bites
    if ch=="E°7": tones=[52+12,58+12,64+12]   # E, Bb (tritone) and E
    for p in pos:
        for n in tones: add("stabs",b0+p,.3,n,96 if sec!="C" else 110)
# drums (GM): kick 36, snare 38, closed hat 42, open hat 46, toms 50/47/45, crash 49
for bar in range(BARS):
    b0=bar*4; sec=SECTION(bar)
    kicks={"A":(0,2),"B1":(0,1.5,2),"B2":(0,1,2,3),"C":(0,.5,1.5,2,2.5)}[sec]
    for pos in kicks: add("drums",b0+pos,.25,36,118 if pos==0 else 100)
    snares=(1,3)
    for pos in snares: add("drums",b0+pos,.25,38,110)
    for e in range(8):
        if e==7: add("drums",b0+3.5,.4,46,90)
        else: add("drums",b0+e*.5,.2,42,84 if e%2==0 else 62)
    if sec=="B2" and bar==11:  # snare roll into the resolution
        for i in range(8): add("drums",b0+2+i*.25,.2,38,70+i*8)
    elif bar%4==3 and sec!="B2":
        for i,n in enumerate((50,47,45,45)): add("drums",b0+3+i*.25,.2,n,108)
    if bar in(0,4,8,12): add("drums",b0,1,49,116)
# melody (the hook), one bar at a time: (pitch, beats)
M={0:[(74,2),(77,1),(76,1)],1:[(74,3),(None,1)],2:[(70,2),(74,1),(72,1)],3:[(70,3),(None,1)],
   4:[(67,2),(70,1),(69,1)],5:[(67,1),(69,1),(70,1),(74,1)],6:[(75,2),(74,1),(70,1)],7:[(79,2),(77,1),(75,1)],
   8:[(74,1),(75,1),(77,1),(79,1)],9:[(82,2),(79,1),(82,1)],10:[(82,1),(85,1),(82,1),(79,1)],11:[(85,1),(82,1),(79,1),(76,1)],
   12:[(77,2),(81,2)],13:[(79,2),(77,2)],14:[(76,2),(79,2)],15:[(81,1),(77,1),(74,2)]}
MVEL={12:78,13:72,14:68,15:62}  # the resolution: dreamy, slow and soft
for bar,notes in M.items():
    t=bar*4
    for n,d in notes:
        if n is not None: add("melody",t,d*(.99 if bar>=12 else .92),n,MVEL.get(bar,100))
        t+=d
# arpeggio: sixteenths zig-zag over the chord tones (two octaves), crescendo inside every chord span
for s,L,ch in SP:
    tones=CHORDS[ch][0] if ch not in("D5","Bb5","C5") else [CHORDS[ch][2][0]+12,CHORDS[ch][2][1]+12,CHORDS[ch][2][2]+12]
    rr=tones+[t+12 for t in tones]; k=len(rr); seq=list(range(k))+list(range(k-2,0,-1)); n_steps=L*16
    if SECTION(s)=="C":  # dreamy: eighths, soft, no crescendo
        for i in range(L*8): add("arp",s*4+i*.5,.45,rr[seq[i%len(seq)]],54+(8 if i%2==0 else 0))
        continue
    for i in range(n_steps):
        vel=int(58+(i/max(1,n_steps-1))*47)+(14 if i%4==0 else 0)
        add("arp",s*4+i*.25,.2,rr[seq[i%len(seq)]],min(vel,122))
# war drums, pitched: 'bam-bam  bam-bam' on D2 and A1
for bar in range(BARS):
    b0=bar*4; top=38; low=33
    pat=[(0,top,127),(.5,top,100),(2,low,120),(2.5,low,96)] if bar<8 else [(0,top,127),(.5,top,104),(1,top,90),(2,low,122),(2.5,low,100),(3,low,92)]
    if bar%4==3: pat=[p for p in pat if p[0]<2]+[(2,top,118),(2.33,top,104),(2.67,top,110),(3,low,126),(3.5,low,112)]
    for pos,n,v in pat: add("war",b0+pos,.4,n,v)
# choir: the men on open vowels, root and fifth in two octaves, held per chord, swelling
for s,L,ch in SP:
    pw=CHORDS[ch][2]; sec=SECTION(s)
    for n in (pw[0]-12,pw[0],pw[1]): add("choir",s*4,L*4,n,58 if sec=="A" else 72 if sec!="C" else 84)
# strings tremolo: repeated sixteenths on the chord tones, a crescendo from bar 5 to bar 12, full in the resolution
for bar in range(BARS):
    ch=BARCH[bar]; tones=CHORDS[ch][0]; sec=SECTION(bar)
    if sec=="A": base,top_v=30,44
    elif sec=="B1": base,top_v=44+(bar-4)*4,58+(bar-4)*4
    elif sec=="B2": base,top_v=62+(bar-8)*7,76+(bar-8)*8
    else: base,top_v=72,80
    for i in range(16):
        v=int(base+(top_v-base)*i/15)
        for n in tones[-2:]: add("strings",bar*4+i*.25,.24,n+12,min(v,118))
# tension line: chromatic climb; half notes in bars 5-8 (D4 to A4), quarter notes in bars 9-12 (Bb4 to C#6)
for i in range(8): add("tension",16+i*2,1.9,62+i,70+i*3)
for i in range(16): add("tension",32+i,.95,70+i,84+i*2)
# ticks: a clock, tick-tock on two high pitches, bars 1-12 (it stops for the resolution)
for b in range(48): add("ticks",b,.15,86 if b%2==0 else 83,100 if b%4==0 else 78)
# braams: a low brass hit on every section start (the chord's root and fifth, octave low)
for bar in (0,4,8,12):
    ch=BARCH[bar]; pw=CHORDS[ch][2]
    for n in (pw[0]-12,pw[1]-12,pw[0]): add("braams",bar*4,3.5,n,124)
# glimmer (celesta): a rising run into bar 13, then slow high notes: the dreamy part
for i,n in enumerate((74,76,77,79,81,82,84,86)): add("glimmer",46+i*.25,.4,n,58+i*3)
for bar,(a,b) in {12:(77+12,81+12),13:(79+12,77+12),14:(76+12,79+12),15:(81+12,86)}.items():
    add("glimmer",bar*4,2,a,64); add("glimmer",bar*4+2,2,b,58)
GM={"drone":(89,"Warm Pad"),"pulse":(39,"Synth Bass 2"),"bass":(38,"Synth Bass 1"),"drums":(None,"Drum kit (channel 10)"),"pad":(52,"Choir Aahs"),
    "stabs":(62,"Synth Brass 1"),"melody":(81,"Lead 2 (sawtooth)"),"arp":(80,"Lead 1 (square)"),"war":(116,"Taiko Drum"),"choir":(53,"Voice Oohs"),
    "strings":(44,"Tremolo Strings"),"tension":(82,"Lead 3 (calliope)"),"ticks":(115,"Woodblock"),"braams":(61,"Brass Section"),"glimmer":(8,"Celesta")}
CHAN={"drone":0,"pulse":1,"bass":2,"drums":9,"pad":3,"stabs":4,"melody":5,"arp":6,"war":7,"choir":8,"strings":10,"tension":11,"ticks":12,"braams":13,"glimmer":14}
def track(tr,ch):
    tk=mido.MidiTrack(); tk.append(mido.MetaMessage("track_name",name=tr,time=0))
    prog=GM[tr][0]
    if prog is not None: tk.append(mido.Message("program_change",program=prog,channel=ch,time=0))
    ev=[]
    for s,d,n,v in T[tr]: ev.append((round(s*PPQ),1,n,v)); ev.append((round((s+d)*PPQ),0,n,0))
    ev.sort(key=lambda e:(e[0],e[1])); last=0
    for tick,on,n,v in ev:
        tk.append(mido.Message("note_on" if on else "note_off",note=n,velocity=v,channel=ch,time=tick-last)); last=tick
    tk.append(mido.MetaMessage("end_of_track",time=max(0,BEATS*PPQ-last))); return tk
def conductor():
    tk=mido.MidiTrack(); tk.append(mido.MetaMessage("track_name",name="tempo",time=0)); tk.append(mido.MetaMessage("set_tempo",tempo=mido.bpm2tempo(BPM),time=0))
    tk.append(mido.MetaMessage("time_signature",numerator=4,denominator=4,time=0)); tk.append(mido.MetaMessage("key_signature",key="Dm",time=0)); return tk
if __name__=="__main__":
    os.makedirs("out",exist_ok=True)
    for f in os.listdir("out"): os.remove("out/"+f)
    for i,tr in enumerate(ORDER):
        m=mido.MidiFile(type=1,ticks_per_beat=PPQ); m.tracks.append(conductor()); m.tracks.append(track(tr,CHAN[tr])); m.save(f"out/{i+1:02d}-{NAME.get(tr,tr)}.mid")
    m=mido.MidiFile(type=1,ticks_per_beat=PPQ); m.tracks.append(conductor())
    for tr in ORDER: m.tracks.append(track(tr,CHAN[tr]))
    m.save("out/00-notstrom-all-layers.mid")
    json.dump(T,open("notes.json","w")); json.dump({"barch":BARCH,"label":LABEL,"order":ORDER},open("meta.json","w"))
    print({k:len(v) for k,v in T.items()})
