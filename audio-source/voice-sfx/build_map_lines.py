import json,base64,subprocess
G=[("Notstrom: loops (WAV, no gap at the seam)",[("bed2","NEW bed: slow, deep ventilation fan",True),("bed2_dark","NEW bed, softly filtered (above 1.2 kHz cut)",True),("bed_old","Old bed (the high whine is in here)",True),("bed_dark","Same bed, filtered dark (everything above 700 Hz cut), to hear whether the whine is gone",True),("core","Plasma core hum (loop, near the Prime Zone)",True)]),
("Notstrom: now and then (random, every 10 to 25 s)",[("vent","Ventilation burst",False),("creak","Hull creaks",False),("spark","Sparks",False),("steam","Steam leak",False),("debris","Debris",False)]),
("Cards",[("shuffle_a","NEW single riffle, take A (two of these make the shuffle)",False),("shuffle_b","NEW single riffle, take B",False),("shuffle","Old shuffle (irregular)",False),("play_1","Play a card 1",False),("play_2","Play a card 2",False),("back_1","Take a card back 1",False),("back_2","Take a card back 2",False)]),
("Draw a card (new)",[("draw_a","Draw a card, take A",False),("draw_b","Draw a card, take B",False)]),
("Energy (to be replaced, Energy -1 dropped)",[("energy_bub","NEW Energy +1: soft bubble",False),("energy_bzzt","NEW Energy +1: small zap",False),("energy_up","Old Energy +1 (the cheesy one)",False)])]
rows=[]
for g,ks in G:
    items=[]
    for k,t,l in ks:
        p=f"map/loops/{k}.wav" if l else f"map/final/{k}.mp3"
        d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
        items.append({"k":k,"t":t,"d":round(d,2),"l":l,"a":("data:audio/wav;base64," if l else "data:audio/mpeg;base64,")+base64.b64encode(open(p,"rb").read()).decode()})
    rows.append({"g":g,"i":items})
h=open("max_lines_template.html").read().replace("Max Voice Lines","Notstrom and Card Sounds").replace("Max Overload: voice lines","Notstrom and card sounds").replace("Morgan, eleven_v4. Raw takes, levelled to −16 LUFS, silence cut. Lengths over 3.5 s are marked.","Generated with ElevenLabs. Loops play until you press Stop (the same button). Levelled the way they would sit in the mix.")
h=h.replace("const a=new Audio(it.a);a.preload=\"auto\";","const a=new Audio(it.a);a.preload=\"auto\";a.loop=!!it.l;")
h=h.replace("b.onclick=()=>{if(cur&&cur!==a){cur.pause();cur.currentTime=0}cur=a;a.currentTime=0;a.play()};","b.onclick=()=>{if(cur===a&&!a.paused){a.pause();a.currentTime=0;b.textContent=\"▶\";return}if(cur&&cur!==a){cur.pause();cur.currentTime=0}cur=a;a.currentTime=0;a.play();b.textContent=a.loop?\"■\":\"▶\";a.onended=()=>{b.textContent=\"▶\"}};")
h=h.replace("data-x","data-x").replace("__DATA__",json.dumps(rows))
open("map_lines.html","w").write(h); print(len(h)//1024,"KB")
