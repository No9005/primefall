import base64,json,os
R="/home/user/primefall/apps/web/public/assets/pixel-heroes/bruiser/"
b64=lambda p:base64.b64encode(open(p,"rb").read()).decode()
SHEETS=["select_ready","slam","double","rush","hook","concussion","block","shield","hit","half","full","exhausted","idle","walk","wait"]
clips={c["name"]:c for c in json.load(open(R+"clips.json"))["clips"]}
SP={}
for n in SHEETS:
    a=json.load(open(R+n+".json")); layers={k.split(".")[-1]:v for k,v in a["animations"].items()}
    fr={k:[v["frame"]["x"],v["frame"]["y"],v["frame"]["w"],v["frame"]["h"],v["spriteSourceSize"]["x"],v["spriteSourceSize"]["y"]] for k,v in a["frames"].items()}
    SP[n]={"frames":fr,"layers":layers,"frameMs":clips[n]["frameMs"],"loop":clips[n]["loop"],"dur":clips[n]["durationMs"],"png":"data:image/png;base64,"+b64(R+n+".png")}
AUD={f[:-4]:"data:audio/mpeg;base64,"+b64("review_max/"+f) for f in os.listdir("review_max")}
V=lambda n:"v_max_"+n; S=lambda n:"s_"+n
def vo(*p): return [{"label":l,"key":V(k)} for l,k in p]
def so(*p): return [{"label":l,"key":S(k)} for l,k in p]
steps=lambda i:so(*([("Step %d"%((i+j)%3+1),"step_%d"%((i+j)%3+1)) for j in range(3)]))
scenes=[
 {"id":"select","title":"Select","note":"The BIO sheet when Max is chosen. He fires three shots (flashes at about 1400, 2200 and 3000 ms). GUESS: the times are read from the frames.","sheets":[["select_ready",0]],"total":3600,"voff":0,"guess":True,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Take B","select_old_b"),("Take A","select_old_a"))},
          {"id":"s1","kind":"sfx","at":1400,"label":"Shot 1","opts":so(("Slam shot","slam"))},
          {"id":"s2","kind":"sfx","at":2200,"label":"Shot 2","opts":so(("Slam shot","slam"))},
          {"id":"s3","kind":"sfx","at":3000,"label":"Shot 3","opts":so(("Slam shot","slam"))}]},
 {"id":"walk","title":"Walk (steps)","note":"GUESS: one stomp per half cycle (320 ms) with the servo “wuiit-wuuup”.","sheets":[["walk",0]],"total":1920,"voff":0,"guess":True,
  "cues":[{"id":"s%d"%i,"kind":"sfx","at":160+320*i,"label":"Step %d"%(i+1),"opts":so(*([("Metal step %d (new)"%(((i+j)%3)+1),"mstep_%d"%(((i+j)%3)+1)) for j in range(3)]+[("Servo step %d (old)"%(((i+j)%3)+1),"step_%d"%(((i+j)%3)+1)) for j in range(3)]))} for i in range(6)]},
 {"id":"attack","title":"Basic attack (Slam)","note":"The shot leaves at 620 ms.","sheets":[["slam",0]],"total":2400,"voff":-200,"fire":620,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Weapons free!","attack_1"),("Engaging, as per the manual!","attack_2"),("Consider it filed!","attack_3"))},
          {"id":"f","kind":"sfx","at":620,"label":"Shot","opts":so(("Slam shot","slam"))},
          {"id":"i","kind":"sfx","at":650,"label":"Impact on target","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"handle","title":"Handle With Care","note":"Same clip as the basic attack.","sheets":[["slam",0]],"total":2400,"voff":-200,"fire":620,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Fragile, sir!","handle_1"),("Sign here!","handle_2"))},
          {"id":"f","kind":"sfx","at":620,"label":"Shot","opts":so(("Slam shot","slam"))},
          {"id":"i","kind":"sfx","at":650,"label":"Impact","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"buy2","title":"Buy One, Get Two","note":"GUESS: two shots, about 600 ms into the clip.","sheets":[["double",0]],"total":2800,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Double order! No refunds!","buy2_1"),("Bulk delivery!","buy2_2"))},
          {"id":"f","kind":"sfx","at":600,"label":"Two shots","opts":so(("Double blast","double"))},
          {"id":"i","kind":"sfx","at":650,"label":"Impact 1","opts":so(("Flesh stab (shared)","hit_flesh"))},
          {"id":"i2","kind":"sfx","at":1000,"label":"Impact 2","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"coffee","title":"Time for Coffee","note":"GUESS: the pulse leaves at about 700 ms.","sheets":[["concussion",0]],"total":2600,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Take five, soldier!","coffee_1"),("Speed limit is zero!","coffee_2"))},
          {"id":"f","kind":"sfx","at":700,"label":"Pulse","opts":so(("Concussion","concussion"))}]},
 {"id":"express","title":"Express Delivery (Charge)","note":"GUESS: the charge starts at about 200 ms.","sheets":[["rush",0]],"total":2600,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Incoming!","express_1"),("Coming through!","express_2"))},
          {"id":"f","kind":"sfx","at":200,"label":"Rush","opts":so(("Rush","rush"))}]},
 {"id":"hook","title":"Cargo Hook (Pull)","note":"GUESS: the chain leaves at about 800 ms; the pull begins around 1900 ms.","sheets":[["hook",0]],"total":3200,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Fall in, soldier!","hook_1"),("Report to me! NOW!","hook_2"))},
          {"id":"f","kind":"sfx","at":800,"label":"Chain out","opts":so(("Chain launch","hook_fire"))},
          {"id":"p","kind":"sfx","at":1900,"label":"Chain pull","opts":so(("Chain pull","hook_pull"))}]},
 {"id":"hardhat","title":"Hard Hat (Shield)","note":"GUESS: the Block clip stands in; the helmet locks at about 700 ms. Shield forms with the shared pop.","sheets":[["block",0]],"total":3200,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Helmet on! Regulation twelve!","hardhat_1"),("Safety first. Then violence.","hardhat_2"))},
          {"id":"s","kind":"sfx","at":700,"label":"Helmet","opts":so(("Helmet lock","hardhat"))},
          {"id":"p","kind":"sfx","at":900,"label":"Shield forms","opts":so(("Shield pop (shared)","shield_pop"))}]},
 {"id":"pitch","title":"Pitch","note":"No animation of its own. Voice only.","sheets":[["idle",0]],"total":2200,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Requisition approved!","pitch_1"),("Surplus. Discarded.","pitch_2"))}]},
 {"id":"wait","title":"Wait","note":"Voice only.","sheets":[["wait",0]],"total":2200,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Standing by.","wait_1"),("Awaiting orders.","wait_2"))}]},
 {"id":"light","title":"Hit: light (1 damage)","note":"Steel first, no flesh. Voice just after the impact.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash",
  "cues":[{"id":"i","kind":"sfx","at":0,"label":"Steel hit","opts":so(("Ricochet 1","ricochet_1"),("Ricochet 2","ricochet_2"),("Steel hit A (old)","steel_hit_1"),("Steel hit B (old)","steel_hit_2"))},
          {"id":"v","kind":"voice","at":150,"label":"Voice","opts":vo(("That tickled.","light_1"),("Is that all?","light_2"))}]},
 {"id":"heavy","title":"Hit: heavy (2+ damage)","note":"Steel first, then flesh (80 ms later). Voice after.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash",
  "cues":[{"id":"i","kind":"sfx","at":0,"label":"Steel hit","opts":so(("Steel tears 1","tear_1"),("Steel tears 2","tear_2"),("Steel hit B (old)","steel_hit_2"),("Steel hit A (old)","steel_hit_1"))},
          {"id":"f","kind":"sfx","at":80,"label":"Flesh","opts":so(("Flesh stab (shared)","hit_flesh"))},
          {"id":"v","kind":"voice","at":200,"label":"Voice","opts":vo(("Is that ALL you've got?!","heavy_1"),("Pain is temporary! Paperwork is forever!","heavy_2"))}]},
 {"id":"absorb","title":"Hit absorbed by Shield","note":"Steel, with the shared Shield hit.","sheets":[["shield",0]],"total":2600,"voff":0,"visual":"flash",
  "cues":[{"id":"i","kind":"sfx","at":0,"label":"Steel hit","opts":so(("Ricochet 1","ricochet_1"),("Ricochet 2","ricochet_2"),("Steel hit A (old)","steel_hit_1"),("Steel hit B (old)","steel_hit_2"))},
          {"id":"s","kind":"sfx","at":0,"label":"Shield","opts":so(("Shield hit (shared)","shield_hit"))},
          {"id":"v","kind":"voice","at":150,"label":"Voice","opts":vo(("Request denied!","shield_1"),("Nice try, soldier!","shield_2"))}]},
 {"id":"cover","title":"Goes into cover","note":"GUESS: the body meets the wall at about 850 ms.","sheets":[["half",0]],"total":1600,"voff":-200,"guess":True,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("In position!","cover_1"),("Taking cover, sir.","cover_2"))},{"id":"sc","kind":"sfx","at":350,"label":"Scrape","opts":so(("Metal scrapes on stone","cover_scrape"))},{"id":"t","kind":"sfx","at":1050,"label":"Contact","opts":so(("Steel body thump","cover"))}]},
 {"id":"fullcover","title":"Full Cover holds","note":"GUESS: contact at about 850 ms.","sheets":[["full",0]],"total":1600,"voff":0,"guess":True,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Fortification holds!","full_1"),("Not today!","full_2"))},{"id":"sc","kind":"sfx","at":350,"label":"Scrape","opts":so(("Metal scrapes on stone","cover_scrape"))},{"id":"t","kind":"sfx","at":1050,"label":"Contact","opts":so(("Steel body thump","cover"))}]},
 {"id":"exhausted","title":"Exhausted","note":"“Suit power… at zero.” with the servo winding down, then the steel collapse, then “Tell them… I never stopped shooting.”","sheets":[["exhausted",0]],"total":7000,"voff":0,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice, part 1","opts":vo(("Suit power… at zero.","exh_1"))},{"id":"s","kind":"sfx","at":1200,"label":"Power-down and collapse","opts":so(("Collapse","exhausted"))},{"id":"v2","kind":"voice","at":4300,"label":"Voice, part 2","opts":vo(("Tell them… I never stopped shooting.","exh_2"))}]},
 {"id":"victory","title":"Victory","note":"Voice only.","sheets":[["idle",0]],"total":4000,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Mission accomplished! File the report!","vic_1"),("Target neutralised. Dismissed!","vic_2"),("Invoice is in the mail, sir!","vic_3"))}]},
 {"id":"defeat","title":"Defeat","note":"Voice only.","sheets":[["idle",0]],"total":4000,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Requesting early retirement.","def_1"),("Retreat is not in the manual!","def_2"))}]},
]
used=set()
for sc in scenes:
    for c in sc["cues"]:
        for o in c["opts"]: assert o["key"] in AUD,o["key"]; used.add(o["key"])
AU={k:AUD[k] for k in used}
tpl=open("review_template_max.html").read()
open("review_max.html","w").write(tpl.replace("__SCENES__",json.dumps(scenes)).replace("__SPRITES__",json.dumps(SP)).replace("__AUDIO__",json.dumps(AU)))
print(len(open("review_max.html").read())//1024,"KB",len(used),"audio files")
