import json,base64,subprocess
ids=json.load(open("api/max_ids.json"))
G=[("Select (earlier takes)",["select_old_b","select_old_a"]),("Attack (basic)",["attack_1","attack_2","attack_3"]),("Handle With Care",["handle_1","handle_2"]),("Buy One, Get Two",["buy2_1","buy2_2"]),("Time for Coffee",["coffee_1","coffee_2"]),("Hard Hat",["hardhat_1","hardhat_2"]),("Express Delivery",["express_1","express_2"]),("Cargo Hook",["hook_1","hook_2"]),("Pitch",["pitch_1","pitch_2"]),("Wait",["wait_1","wait_2"]),("Hit: light",["light_1","light_2"]),("Hit: heavy",["heavy_1","heavy_2"]),("Hit: Shield absorbs",["shield_1","shield_2"]),("Goes into cover",["cover_1","cover_2"]),("Full Cover holds",["full_1","full_2"]),("Exhausted (part 1, then 2)",["exh_1","exh_2"]),("Victory",["vic_1","vic_2","vic_3"]),("Defeat",["def_1","def_2"])]
T={"attack_2":"[barks] Engaging, as per the manual! (bark cut away)","buy2_2":"[shouting] Bulk delivery! (first 0.2 s cut: noise)","select_old_b":"[stolz, schwer] I came here to move cargo and kick ass. [kurze Pause] [flach, trocken] The cargo is optional. (Take B, v4)","select_old_a":"same text, Take A (v4_exp)","light_1":"[trocken, kichernd] That tickled. (earlier take, kept)"}
rows=[]
for g,ks in G:
    items=[]
    for k in ks:
        p=f"max/final/max_{k}.mp3"
        d=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
        items.append({"k":k,"t":T.get(k) or ids[k]["text"],"d":round(d,2),"a":"data:audio/mpeg;base64,"+base64.b64encode(open(p,"rb").read()).decode()})
    rows.append({"g":g,"i":items})
html=open("max_lines_template.html").read().replace("__DATA__",json.dumps(rows))
open("max_lines.html","w").write(html); print(len(html)//1024,"KB")
