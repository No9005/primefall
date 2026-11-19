import json,subprocess,os
P=[
("bed",12,True,"Dark crashed spaceship interior: low air handler hum, soft metal ticking, faint hull creaks, very quiet, steady, seamless loop"),
("core",8,True,"Deep plasma reactor core hum with a slow electric pulse, steady, sci-fi, seamless loop"),
("vent",3,False,"Ventilation duct releases a burst of air, hiss and rattle, in a large metal hall"),
("creak",3,False,"Distant creak and groan of a damaged metal hull, slow, low"),
("spark",2,False,"Short electrical crackle and spark from a broken wire, distant"),
("steam",2,False,"Pipe leaks steam, short hiss with a metal tick"),
("debris",2,False,"Distant debris clatters and settles in a metal corridor"),
("shuffle",2,False,"A deck of plastic playing cards riffle shuffled twice, close and crisp"),
("play_1",0.5,False,"Card snapped onto a metal slot with a soft electronic click, short"),
("play_2",0.5,False,"Card snapped onto a metal slot with a soft electronic click, short"),
("back_1",0.5,False,"Card pulled back out of a slot, light slide and a soft click, short"),
("back_2",0.5,False,"Card pulled back out of a slot, light slide and a soft click, short"),
("energy_up",0.5,False,"Short rising electric charge blip, soft sci-fi UI sound"),
("energy_down",0.5,False,"Short falling power-down blip, soft sci-fi UI sound")]
for k,d,loop,t in P:
    out=f"sfx/map/{k}.mp3"
    body={"text":t,"duration_seconds":d,"prompt_influence":0.5}
    if loop: body.update({"loop":True,"model_id":"eleven_text_to_sound_v2"})
    r=subprocess.run(["curl","-sS","-w","%{http_code}","-o",out,"-X","POST","https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128","-H","xi-api-key: placeholder","-H","Content-Type: application/json","-d",json.dumps(body)],capture_output=True,text=True)
    print(k,r.stdout,os.path.getsize(out),flush=True)
    if r.stdout!="200": print(open(out,errors="ignore").read()[:300]); break
