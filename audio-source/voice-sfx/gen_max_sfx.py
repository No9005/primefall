import json,subprocess,os
LOW="low-pitched, no high frequencies, dry"
P=[
("step_1",0.5,'Heavy old powered exosuit footstep: deep servo whine "wuiit-wuuup" (rises, then drops low) with one dull heavy steel stomp on concrete, deep, '+LOW),
("step_2",0.5,'Heavy old powered exosuit footstep: deep servo whine "wuiit-wuuup" (rises, then drops low) with one dull heavy steel stomp on concrete, deep, '+LOW),
("step_3",0.5,'Heavy old powered exosuit footstep: deep servo whine "wuiit-wuuup" (rises, then drops low) with one dull heavy steel stomp on concrete, deep, '+LOW),
("slam",1.2,"Deep heavy shotgun blast from an armoured arm cannon with a steel slam and a low servo thud, "+LOW),
("double",1.5,"Two deep heavy shotgun blasts about 0.35 s apart from an armoured arm cannon, low servo whine between them, "+LOW),
("concussion",1.5,'Slow concussive cannon: deep servo charging "wuuuup", then a very low dull whump shockwave, '+LOW),
("rush",1.5,'Heavy exosuit charging forward: deep servo wind-up "wuiit-wuuup", low jet rumble and heavy steel stomps like a tank sprinting, '+LOW),
("hook_fire",1.5,"Heavy iron chain launched from an exosuit: thick links rattling out fast, then snapping taut with a deep metal clank, "+LOW),
("hook_pull",1.0,"Heavy iron chain dragged and reeled in under load: deep grinding rattle and a final dull steel thud, "+LOW),
("hardhat",0.8,"Heavy steel helmet locks on with a deep servo clunk and a dull clang, "+LOW),
("cover",0.8,"Heavy steel exosuit body pressed against a concrete wall: dull deep metal thump, "+LOW),
("steel_hit_1",0.5,"Bullet hitting thick steel armour plate: a dull deep clang thud, low-pitched, no ringing highs, dry"),
("steel_hit_2",0.5,"Bullet hitting thick steel armour plate: a dull deep clang thud, low-pitched, no ringing highs, dry"),
("exhausted",3.0,'Old heavy exosuit running out of power: deep servo "wuuuuup" winding down slowly, hydraulic sigh, then a massive steel collapse onto the ground with low rattling parts, '+LOW)]
for k,d,t in P:
    out=f"sfx/max/{k}.mp3"
    r=subprocess.run(["curl","-sS","-w","%{http_code}","-o",out,"-X","POST","https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128","-H","xi-api-key: placeholder","-H","Content-Type: application/json","-d",json.dumps({"text":t,"duration_seconds":d,"prompt_influence":0.5})],capture_output=True,text=True)
    print(k,r.stdout,os.path.getsize(out),flush=True)
    if r.stdout!="200": print(open(out,errors="ignore").read()[:300]); break
