import base64,json,os
R="/home/user/primefall/apps/web/public/assets/heroes/assassin/"
b64=lambda p:base64.b64encode(open(p,"rb").read()).decode()
SHEETS=["select_ready","long","longhidden","hidden","knockback","shieldbreaker","hit","hithidden","half","full","exhausted","idle","walk","wait"]
clips={c["name"]:c for c in json.load(open(R+"clips.json"))["clips"]}
SP={}
for n in SHEETS:
    a=json.load(open(R+n+".json")); layers={k.split(".")[-1]:v for k,v in a["animations"].items()}
    fr={k:[v["frame"]["x"],v["frame"]["y"],v["frame"]["w"],v["frame"]["h"],v["spriteSourceSize"]["x"],v["spriteSourceSize"]["y"]] for k,v in a["frames"].items()}
    SP[n]={"frames":fr,"layers":layers,"frameMs":clips[n]["frameMs"],"loop":clips[n]["loop"],"dur":clips[n]["durationMs"],"png":"data:image/png;base64,"+b64(R+n+".png")}
AUD={f[:-4]:"data:audio/mpeg;base64,"+b64("review_kit/"+f) for f in os.listdir("review_kit")}
V=lambda n:"v_kit_"+n; S=lambda n:"s_"+n
def vo(*p): return [{"label":l,"key":V(k)} for l,k in p]
def so(*p): return [{"label":l,"key":S(k)} for l,k in p]
steps=lambda i:so(*([("Step %d"%((i+j)%3+1),"step_%d"%((i+j)%3+1)) for j in range(3)]))
scenes=[
 {"id":"select","title":"Select","note":"The BIO sheet when Kit is chosen: he turns invisible (the flash is at 1800 ms). GUESS: the cape swirls from 1200 ms.","sheets":[["select_ready",0]],"total":3700,"voff":0,"guess":True,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Nobody asked for my real name.","select"))},
          {"id":"c","kind":"sfx","at":1300,"label":"Cape swirl","opts":so(("Cloth brush","cover_brush"))},
          {"id":"s","kind":"sfx","at":1800,"label":"Vanish","opts":so(("Vanish","vanish"))}]},
 {"id":"walk","title":"Walk (steps)","note":"GUESS: one step per half cycle (250 ms); the foot-down moments are my estimate. Cat-like steps.","sheets":[["walk",0]],"total":1500,"voff":0,"guess":True,
  "cues":[{"id":"s%d"%i,"kind":"sfx","at":125+250*i,"label":"Step %d"%(i+1),"opts":steps(i)} for i in range(6)]},
 {"id":"long","title":"Long Shot","note":"The shot leaves at 1650 ms (no flight). Lightning B, with the bass body on the impact.","sheets":[["long",0]],"total":3600,"voff":-200,"visual":"laser","fire":1650,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Breathe out. It helps.","long_shot_1"),("Dead centre. As usual.","long_shot_2"))},
          {"id":"f","kind":"sfx","at":1650,"label":"Shot","opts":so(("Lightning B","lightning"))},
          {"id":"i","kind":"sfx","at":1680,"label":"Impact","opts":so(("Impact + bass body","impact_body"),("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"longhidden","title":"Long Shot from Hidden","note":"From Hidden the shot leaves at 2000 ms and ends Hidden: the shimmer follows at once.","sheets":[["longhidden",0]],"total":4200,"voff":-200,"visual":"laser","fire":2000,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Breathe out. It helps.","long_shot_1"),("Dead centre. As usual.","long_shot_2"))},
          {"id":"f","kind":"sfx","at":2000,"label":"Shot","opts":so(("Lightning B","lightning"))},
          {"id":"i","kind":"sfx","at":2030,"label":"Impact","opts":so(("Impact + bass body","impact_body"),("Flesh stab (shared)","hit_flesh"))},
          {"id":"h","kind":"sfx","at":2100,"label":"Hidden ends","opts":so(("Hidden ends","hidden_ends"))}]},
 {"id":"vanish","title":"Vanish","note":"GUESS: the code has no beat for the fade; the sound at 600 ms is my estimate.","sheets":[["hidden",0]],"total":4200,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("I was never here.","vanish_1"),("Don't look for me.","vanish_2"))},
          {"id":"s","kind":"sfx","at":600,"label":"Vanish","opts":so(("Vanish","vanish"))}]},
 {"id":"personal","title":"Personal Space","note":"The blow lands at 700 ms; the target is pushed away.","sheets":[["knockback",0]],"total":2800,"voff":-200,"visual":"knock","blow":700,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Personal space. Look it up.","personal_space_1"),("Too close. Let's fix that.","personal_space_2"))},
          {"id":"b","kind":"sfx","at":700,"label":"Blow","opts":so(("Blow with weight","personal_space"))},
          {"id":"h","kind":"sfx","at":720,"label":"Impact","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"shieldb","title":"Shield Breaker","note":"The shot leaves at 570 ms. Pick the second line with the animation.","sheets":[["shieldbreaker",0]],"total":2200,"voff":-200,"visual":"laser","fire":570,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Armour is a suggestion.","shield_breaker_1"),("Hard shell. Soft centre.","shield_breaker_2a"),("Let's see what's underneath.","shield_breaker_2b"))},
          {"id":"s","kind":"sfx","at":570,"label":"Shot","opts":so(("Shield Breaker","shield_breaker"))},
          {"id":"i","kind":"sfx","at":620,"label":"Impact","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"pitch","title":"Pitch (Trade-In)","note":"No animation of its own yet. Voice only.","sheets":[["idle",0]],"total":1800,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Everything has a price.","pitch_1"),("No questions asked.","pitch_2"),("Cards. Organs. Doesn't matter.","pitch_3"))}]},
 {"id":"wait","title":"Wait (Stakeout)","note":"Voice only.","sheets":[["wait",0]],"total":2200,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Patience.","wait_1"),("I can wait.","wait_2"),("Patience is a firearm.","wait_3"))}]},
 {"id":"light","title":"Hit: light (1 damage)","note":"Voice at the impact.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash","cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Hm.","hit_light_1"),("Noted.","hit_light_2"))},{"id":"i","kind":"sfx","at":0,"label":"Impact","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"heavy","title":"Hit: heavy (2+ damage)","note":"Voice at the impact.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash","cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Sloppy. My mistake.","hit_heavy_1"),("That will cost you.","hit_heavy_2"))},{"id":"i","kind":"sfx","at":0,"label":"Impact","opts":so(("Flesh stab (shared)","hit_flesh"))}]},
 {"id":"hithidden","title":"Hit while Hidden","note":"Damage ends Hidden: the after-image bursts at 1500 ms. He speaks only after that (1700 ms).","sheets":[["hithidden",0]],"total":3400,"voff":0,"visual":"flash",
  "cues":[{"id":"v","kind":"voice","at":1700,"label":"Voice","opts":vo(("So much for subtle.","hit_hidden_1"),("Well. That's one way to be seen.","hit_hidden_2"))},{"id":"i","kind":"sfx","at":0,"label":"Impact","opts":so(("Flesh stab (shared)","hit_flesh"))},{"id":"h","kind":"sfx","at":1500,"label":"Hidden ends","opts":so(("Hidden ends","hidden_ends"))}]},
 {"id":"hiddenends","title":"Hidden ends (he attacked or is Marked)","note":"No clip of its own. He becomes visible first (the shimmer, 0 to 500 ms), then he speaks (500 ms).","sheets":[["idle",0]],"total":2400,"voff":0,"guess":True,"cues":[{"id":"v","kind":"voice","at":500,"label":"Voice","opts":vo(("Spotted. Fine.","hidden_ends_1"),("Hello.","hidden_ends_2"))},{"id":"s","kind":"sfx","at":0,"label":"Shimmer","opts":so(("Hidden ends","hidden_ends"))}]},
 {"id":"cover","title":"Goes into cover","note":"GUESS: the body brushes the wall a little before the rest point (about 1050 ms).","sheets":[["half",0]],"total":1600,"voff":-200,"guess":True,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Better.","cover_1"),("Cosy.","cover_2"))},{"id":"t","kind":"sfx","at":850,"label":"Contact","opts":so(("Cloth brush","cover_brush"))}]},
 {"id":"fullcover","title":"Full Cover holds","note":"The Full Cover clip stands in; GUESS for the contact sound.","sheets":[["full",0]],"total":1600,"voff":0,"guess":True,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Try again.","full_cover_1"),("They always miss.","full_cover_2"))},{"id":"t","kind":"sfx","at":850,"label":"Contact","opts":so(("Cloth brush","cover_brush"))}]},
 {"id":"exhausted","title":"Exhausted","note":"Order: “Contract terminated.” (the take says “contract” twice, so the first one is cut away and it starts at the second), then the soft collapse of cape and body (from 1700 ms, the thud lands at about 2400 ms), then “Tell them I was never here.” (3500 ms) once it has died down.","sheets":[["exhausted",0]],"total":5400,"voff":0,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice, part 1","opts":vo(("From 0.97 s: second “contract” + “terminated”","exhausted_1_from"),("Cut at 1.6 s","exhausted_1_c16"),("Cut at 2.0 s","exhausted_1_c20"),("Cut at 1.0 s (too short)","exhausted_1"),("Original (2.5 s, twice)","exhausted_1_full"))},{"id":"s","kind":"sfx","at":1700,"label":"Collapse","opts":so(("Soft collapse","exhausted"))},{"id":"v2","kind":"voice","at":3500,"label":"Voice, part 2","opts":vo(("Tell them I was never here.","exhausted_2"))}]},
 {"id":"victory","title":"Victory","note":"Voice only.","sheets":[["idle",0]],"total":4000,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Paid in full.","victory_1"),("Nothing personal. Everything billable.","victory_2"),("Satisfied customers. Mostly.","victory_3"))}]},
 {"id":"defeat","title":"Defeat","note":"Voice only.","sheets":[["idle",0]],"total":4000,"voff":0,"cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vo(("Bad debt.","defeat_1"),("That is a bonus I will not be collecting.","defeat_2"))}]},
]
used=set()
for sc in scenes:
    for c in sc["cues"]:
        for o in c["opts"]: assert o["key"] in AUD,o["key"]; used.add(o["key"])
AU={k:AUD[k] for k in used}
tpl=open("review_template_kit.html").read()
open("review_kit.html","w").write(tpl.replace("__SCENES__",json.dumps(scenes)).replace("__SPRITES__",json.dumps(SP)).replace("__AUDIO__",json.dumps(AU)))
print(len(open("review_kit.html").read())//1024,"KB",len(used),"audio files")
