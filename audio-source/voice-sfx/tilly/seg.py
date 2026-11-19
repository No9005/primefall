import subprocess,sys,re
def env(p):
    o=subprocess.run(["ffmpeg","-hide_banner","-i",p,"-af","asetnsamples=2205,astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-","-f","null","-"],capture_output=True,text=True).stdout
    return [float(x) for x in re.findall(r"RMS_level=(-?[\d.]+|-inf)",o) if x!='-inf']
for p in sys.argv[1:]:
    e=env(p); th=-42; segs=[]; cur=None
    for i,v in enumerate(e):
        if v>th:
            if cur is None: cur=[i,i]
            else: cur[1]=i
        else:
            if cur and i-cur[1]>2: segs.append(cur); cur=None   # gap >=150ms closes a burst
    if cur: segs.append(cur)
    print(p.split('/')[-1], f"total {len(e)*0.05:.2f}s", " | ".join(f"{a*0.05:.2f}-{(b+1)*0.05:.2f}" for a,b in segs))
