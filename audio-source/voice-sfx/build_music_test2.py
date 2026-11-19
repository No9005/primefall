import json,base64,subprocess
G=[("Refrain test: 26.7 s, 72 BPM, D minor, German lyrics, choir and female lead",[("refrain","Refrain 1 as generated",False)]),
("The six stems from the separation",[("bass","bass.mp3: carries everything audible",False),("other","other.mp3: nearly silent (-132 dB)",False),("guitar","guitar.mp3: nearly silent (-113 dB)",False),("drums","drums.mp3: silent",False),("piano","piano.mp3: silent",False),("vocals","vocals.mp3: nearly silent (-141 dB)",False)])]
rows=[]
for g,ks in G:
    items=[]
    for k,t,l in ks:
        p="../music2/test10.mp3" if k=="orig" else f"../music2/stems6/{k}.mp3"
        d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
        items.append({"k":k,"t":t,"d":round(d,2),"l":l,"a":("data:audio/wav;base64," if l else "data:audio/mpeg;base64,")+base64.b64encode(open(p,"rb").read()).decode()})
    rows.append({"g":g,"i":items})
h=open("max_lines_template.html").read().replace("Max Voice Lines","Notstrom and Card Sounds").replace("Max Overload: voice lines","Notstrom and card sounds").replace("Morgan, eleven_v4. Raw takes, levelled to −16 LUFS, silence cut. Lengths over 3.5 s are marked.","ElevenLabs Music v2.5, 10 s, then stem separation (six_stems_v1).")
h=h.replace("const a=new Audio(it.a);a.preload=\"auto\";","const a=new Audio(it.a);a.preload=\"auto\";a.loop=!!it.l;")
h=h.replace("b.onclick=()=>{if(cur&&cur!==a){cur.pause();cur.currentTime=0}cur=a;a.currentTime=0;a.play()};","b.onclick=()=>{if(cur===a&&!a.paused){a.pause();a.currentTime=0;b.textContent=\"▶\";return}if(cur&&cur!==a){cur.pause();cur.currentTime=0}cur=a;a.currentTime=0;a.play();b.textContent=a.loop?\"■\":\"▶\";a.onended=()=>{b.textContent=\"▶\"}};")
h=h.replace("data-x","data-x").replace("__DATA__",json.dumps(rows))
open("map_lines.html","w").write(h); print(len(h)//1024,"KB")
