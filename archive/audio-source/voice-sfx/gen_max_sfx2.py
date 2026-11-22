import json,subprocess,os
R="Bullet ricochet off thick steel armour: a hard metallic impact with a whining bounce-off, sparks, heavy low thud underneath, dry"
T="Heavy bullet tearing through steel armour plate: screeching ripping metal, plate buckling and tearing apart, deep impact underneath, dry"
S="Giant armoured mech footstep: heavy iron boot slamming onto a steel floor with a loud metallic clank, rattling armour plates and a hydraulic servo hiss, strong low-end, dry"
C="Heavy steel armour scraping and screeching along a rough concrete wall, grinding metal on stone, long metallic shriek, dry"
P=[("ricochet_1",0.8,R),("ricochet_2",0.8,R),("tear_1",1.0,T),("tear_2",1.0,T),("mstep_1",0.6,S),("mstep_2",0.6,S),("mstep_3",0.6,S),("cover_scrape",1.5,C)]
for k,d,t in P:
    out=f"sfx/max/{k}.mp3"
    r=subprocess.run(["curl","-sS","-w","%{http_code}","-o",out,"-X","POST","https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128","-H","xi-api-key: placeholder","-H","Content-Type: application/json","-d",json.dumps({"text":t,"duration_seconds":d,"prompt_influence":0.5})],capture_output=True,text=True)
    print(k,r.stdout,os.path.getsize(out),flush=True)
    if r.stdout!="200": print(open(out,errors="ignore").read()[:300]); break
