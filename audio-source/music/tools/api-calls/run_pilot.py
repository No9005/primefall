import json,subprocess,re,sys,os
os.chdir("/tmp/claude-0/-home-user-primefall/50294b21-724b-50a3-9d7f-73d8954e0a5a/scratchpad/music2/layers")
BASE=["72 BPM, 4/4","D minor","static harmony, pedal point on D, no chord changes","dark sci-fi","analog synthesizer, 1970s and 1980s sci-fi horror atmosphere","exactly 8 bars, steady, loopable","great production quality"]
MS=26667
def plan(name,text,pos,neg,ref=None,strength="low"):
    c={"text":text,"duration_ms":MS,"positive_styles":BASE+pos,"negative_styles":neg,"context_adherence":"high"}
    if ref: c["conditioning_ref"]={"song_id":ref,"range":{"start_ms":0,"end_ms":MS}}; c["condition_strength"]=strength
    return {"composition_plan":{"chunks":[c]},"model_id":"music_v2_5","store_for_inpainting":True,"seed":7200}
LAYERS={
 "drone":("[Chor-Drone]\n{deep male chest voices drone, long held notes}\n(aah... ooh...)",["deep male chest voices, open throat, sustained drone","very sparse, low energy, calm","slow, no rhythm, long notes"],["drums","percussion","bass line","melody","female voice","fast"]),
 "pulse":("[Herzschlag-Puls]",["low pulsing synth bass like a heartbeat, two soft thumps per bar","subtle rhythmic tension, minimal, quiet","single low note D"],["drums","melody","pads","voices","choir","high frequencies"]),
 "drums":("[Kampf-Drums]",["powerful driving drums, heavy kick and snare, tight and hard","kick on every beat, snare on 2 and 4","steady groove, no fills"],["melody","bass","voices","choir","pads","synth"]),
}
def run(name,ref=None):
    body=plan(name,*LAYERS[name],ref=ref)
    json.dump(body,open(f"{name}.json","w"),indent=1)
    r=subprocess.run(["curl","-sS","-D",f"{name}.hdr","-o",f"{name}.mp3","-X","POST","https://api.elevenlabs.io/v1/music?output_format=mp3_44100_128","-H","xi-api-key: placeholder","-H","Content-Type: application/json","-d",f"@{name}.json","-w","%{http_code}"],capture_output=True,text=True)
    code=r.stdout.strip()[-3:]; sid=None
    try: sid=re.search(r"(?i)song-id:\s*(\S+)",open(f"{name}.hdr").read()).group(1)
    except Exception: pass
    print(name,code,os.path.getsize(f"{name}.mp3"),sid,flush=True)
    if code!="200": print(open(f"{name}.mp3",errors="ignore").read()[:400],flush=True); sys.exit(1)
    return sid
sid=run("drone")
run("pulse",sid); run("drums",sid)
