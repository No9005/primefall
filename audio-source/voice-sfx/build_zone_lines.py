import json,base64,subprocess
G=[("Laser barrier around the Prime Zone",[("laser_hum","Laser barrier hum (loop, low)",True),("laser_off","Laser barrier dissolves (flicker, power-down)",False)]),
("Zone and score",[("zone_taken","Zone taken",False),("score_a","Point scores: ka-ching, take A",False),("score_b","Point scores: ka-ching, take B",False)]),
("Countdown (5, 4, 3, 2, 1)",[("tick_a","Number appears: wumpf, take A",False),("tick_b","Number appears: wumpf, take B",False),("final","Last number: long low duuud",False)])]
rows=[]
for g,ks in G:
    items=[]
    for k,t,l in ks:
        p=f"map/loops/{k}.wav" if l else f"map/final/{k}.mp3"
        d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
        items.append({"k":k,"t":t,"d":round(d,2),"l":l,"a":("data:audio/wav;base64," if l else "data:audio/mpeg;base64,")+base64.b64encode(open(p,"rb").read()).decode()})
    rows.append({"g":g,"i":items})
h=open("max_lines_template.html").read().replace("Max Voice Lines","Zone and Countdown Sounds").replace("Max Overload: voice lines","Zone and countdown sounds").replace("Morgan, eleven_v4. Raw takes, levelled to −16 LUFS, silence cut. Lengths over 3.5 s are marked.","Generated with ElevenLabs. Loops play until you press Stop (the same button). Levelled the way they would sit in the mix.")
h=h.replace("const a=new Audio(it.a);a.preload=\"auto\";","const a=new Audio(it.a);a.preload=\"auto\";a.loop=!!it.l;")
h=h.replace("b.onclick=()=>{if(cur&&cur!==a){cur.pause();cur.currentTime=0}cur=a;a.currentTime=0;a.play()};","b.onclick=()=>{if(cur===a&&!a.paused){a.pause();a.currentTime=0;b.textContent=\"▶\";return}if(cur&&cur!==a){cur.pause();cur.currentTime=0}cur=a;a.currentTime=0;a.play();b.textContent=a.loop?\"■\":\"▶\";a.onended=()=>{b.textContent=\"▶\"}};")
h=h.replace("data-x","data-x").replace("__DATA__",json.dumps(rows))
open("zone_lines.html","w").write(h); print(len(h)//1024,"KB")
