import json,subprocess,os
L=[
("select","[barks] I move cargo and kick ass. Cargo is optional!"),
("attack_1","[shouting] Weapons free!"),("attack_2","[barks] Engaging, as per the manual!"),("attack_3","[grunts] Consider it filed!"),
("handle_1","[barks] Fragile, sir!"),("handle_2","[shouting] Sign here!"),
("buy2_1","[barks] Double order! No refunds!"),("buy2_2","[shouting] Bulk delivery!"),
("coffee_1","[barks] Take five, soldier!"),("coffee_2","[flat, then barks] Speed limit is zero!"),
("hardhat_1","[barks] Helmet on! Regulation twelve!"),("hardhat_2","[deadpan] Safety first. Then violence."),
("express_1","[shouting] Incoming!"),("express_2","[roars] Coming through!"),
("hook_1","[barks] Fall in, soldier!"),("hook_2","[shouting] Report to me! NOW!"),
("pitch_1","[barks] Requisition approved!"),("pitch_2","[deadpan] Surplus. Discarded."),
("wait_1","[flat] Standing by."),("wait_2","[flat] Awaiting orders."),
("light_2","[deadpan] Is that all?"),
("heavy_1","[shouting] Is that ALL you've got?!"),("heavy_2","[roars] Pain is temporary! Paperwork is forever!"),
("shield_1","[barks] Request denied!"),("shield_2","[laughs] Nice try, soldier!"),
("cover_1","[barks] In position!"),("cover_2","[flat] Taking cover, sir."),
("full_1","[barks] Fortification holds!"),("full_2","[shouting] Not today!"),
("exh_1","[strained, wheezing] Suit power... at zero."),("exh_2","[quietly, exhausted] Tell them... I never stopped shooting."),
("vic_1","[shouting] Mission accomplished! File the report!"),("vic_2","[barks] Target neutralised. Dismissed!"),("vic_3","[laughs, barks] Invoice is in the mail, sir!"),
("def_1","[deadpan, tired] Requesting early retirement."),("def_2","[shouting] Retreat is not in the manual!")]
ids={}
for k,t in L:
    out=f"api/max/max_{k}.mp3"
    r=subprocess.run(["curl","-sS","-D","api/max/h.txt","-o",out,"-X","POST","https://api.elevenlabs.io/v1/text-to-speech/SAxJUlDKRc79XAyeWyMu?output_format=mp3_44100_128","-H","xi-api-key: placeholder","-H","Content-Type: application/json","-d",json.dumps({"text":t,"model_id":"eleven_v4","voice_settings":{"stability":0.3,"similarity_boost":0.75}})],capture_output=True,text=True)
    h=open("api/max/h.txt").read().lower()
    cost=[l.split(":")[1].strip() for l in h.splitlines() if l.startswith("character-cost")]
    hid=[l.split(":")[1].strip() for l in h.splitlines() if l.startswith("history-item-id")]
    ok=os.path.getsize(out)>2000
    ids[k]={"text":t,"cost":cost,"id":hid,"ok":ok}
    print(k,ok,cost,flush=True)
    if not ok: print(open(out,errors="ignore").read()[:300]); break
json.dump(ids,open("api/max_ids.json","w"),indent=1)
