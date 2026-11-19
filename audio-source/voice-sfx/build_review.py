import base64,json,os,re
R="/home/user/primefall/apps/web/public/assets/pixel-heroes/controller/"
os.chdir(os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else ".")
b64=lambda p:base64.b64encode(open(p,"rb").read()).decode()
# ---- sprite sheets ----
SHEETS=["select_ready","pulse","tag","drone","demolish","scrapforce","deploy","scrapfield","hit","half","full","exhausted","idle","walk"]
clips={c["name"]:c for c in json.load(open(R+"clips.json"))["clips"]}
SP={}
for n in SHEETS:
    a=json.load(open(R+n+".json"))
    layers={}
    for k,v in a["animations"].items(): layers[k.split(".")[-1]]=v
    fr={k:[v["frame"]["x"],v["frame"]["y"],v["frame"]["w"],v["frame"]["h"],v["spriteSourceSize"]["x"],v["spriteSourceSize"]["y"]] for k,v in a["frames"].items()}
    SP[n]={"frames":fr,"layers":layers,"frameMs":clips[n]["frameMs"],"loop":clips[n]["loop"],"dur":clips[n]["durationMs"],"png":"data:image/png;base64,"+b64(R+n+".png")}
# ---- audio ----
AUD={}
for f in os.listdir("review"):
    AUD[f[:-4]]="data:audio/mpeg;base64,"+b64("review/"+f)
V=lambda n:"v_tilly_"+n
S=lambda n:"s_tilly_"+n
def vopts(*pairs): return [{"label":l,"key":V(k)} for l,k in pairs]
def sopts(*pairs): return [{"label":l,"key":S(k)} for l,k in pairs]
scenes=[
 {"id":"select","title":"Select","note":"The BIO sheet when Tilly is chosen: she releases the drone. GUESS: the drone leaves at about 900 ms.","sheets":[["select_ready",0]],"total":2400,"voff":0,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Take B (new)","select_bella_B"),("Take A","select_bella_A"))},
          {"id":"d","kind":"sfx","at":900,"label":"Drone","opts":sopts(("Scout drone","scout_drone"))}]},
 {"id":"walk","title":"Walk (steps)","note":"GUESS: one step per half cycle; the foot-down moments are my estimate. Leather boots on a hard floor.","sheets":[["walk",0]],"total":1740,"voff":0,"guess":True,
  "cues":[{"id":"a","kind":"sfx","at":145,"label":"Step 1","opts":sopts(("Leather 1 (new)","leather_step_1"),("Leather 2 (new)","leather_step_2"),("Leather 3 (new)","leather_step_3"),("Soft 1 (muffled)","step_soft_1"),("Metal 1 (old)","step_1"))},
          {"id":"b","kind":"sfx","at":435,"label":"Step 2","opts":sopts(("Leather 2 (new)","leather_step_2"),("Leather 3 (new)","leather_step_3"),("Leather 1 (new)","leather_step_1"),("Soft 2 (muffled)","step_soft_2"),("Metal 2 (old)","step_2"))},
          {"id":"c","kind":"sfx","at":725,"label":"Step 3","opts":sopts(("Leather 3 (new)","leather_step_3"),("Leather 1 (new)","leather_step_1"),("Leather 2 (new)","leather_step_2"),("Soft 3 (muffled)","step_soft_3"),("Metal 3 (old)","step_3"))},
          {"id":"d","kind":"sfx","at":1015,"label":"Step 4","opts":sopts(("Leather 1 (new)","leather_step_1"),("Leather 2 (new)","leather_step_2"),("Leather 3 (new)","leather_step_3"),("Soft 1 (muffled)","step_soft_1"),("Metal 1 (old)","step_1"))},
          {"id":"e","kind":"sfx","at":1305,"label":"Step 5","opts":sopts(("Leather 2 (new)","leather_step_2"),("Leather 3 (new)","leather_step_3"),("Leather 1 (new)","leather_step_1"),("Soft 2 (muffled)","step_soft_2"),("Metal 2 (old)","step_2"))},
          {"id":"f","kind":"sfx","at":1595,"label":"Step 6","opts":sopts(("Leather 3 (new)","leather_step_3"),("Leather 1 (new)","leather_step_1"),("Leather 2 (new)","leather_step_2"),("Soft 3 (muffled)","step_soft_3"),("Metal 3 (old)","step_3"))}]},
 {"id":"attack","title":"Attack (generic bolt)","note":"The basic attack. There is no sound for the shot yet; the Price Tag launch stands in.","sheets":[["pulse",0]],"total":2400,"voff":0,"visual":"bolt","fire":620,"hit":900,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Attack 1","bella_attack_1"),("Attack 2","bella_attack_2"),("Attack 3","bella_attack_3"),("Attack 4 (take 1)","bella_attack_4"),("Attack 4 (take 2)","bella_attack_4_v2"))},
          {"id":"f","kind":"sfx","at":620,"label":"Shot (stand-in)","opts":sopts(("Tag fire","tag_fire"))},
          {"id":"h","kind":"sfx","at":900,"label":"Impact","opts":sopts(("Hit impact","hit_impact"))}]},
 {"id":"price","title":"Price Tag","note":"Beats from the code: the tag leaves at 730 ms.","sheets":[["tag",0]],"total":2800,"voff":-200,"visual":"bolt","fire":730,"hit":1030,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Everything must go!","card_price_tag_1"),("Marked down!","card_price_tag_2"))},
          {"id":"f","kind":"sfx","at":730,"label":"Launch","opts":sopts(("Tag fire","tag_fire"))},
          {"id":"h","kind":"sfx","at":1030,"label":"Impact","opts":sopts(("Tag hit","tag_hit"))}]},
 {"id":"survey","title":"Site Survey","note":"GUESS: the code has no effect for the drone, only the Hero clip. The timing of the sound is my estimate.","sheets":[["drone",0]],"total":3600,"voff":-200,"visual":"drone","guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Go fetch!","card_site_survey_1"),("Eyes up, buddy!","card_site_survey_2"))},
          {"id":"d","kind":"sfx","at":600,"label":"Drone","opts":sopts(("Scout drone","scout_drone"))}]},
 {"id":"urban","title":"Urban Renewal and Scrap","note":"The bomb leaves at 820 ms and lands at 1160 ms. The Scrap clip follows at 3400 ms; its sound is placed so that the clunk lands when the fist closes (2020 ms).","sheets":[["demolish",0],["scrapforce",3400]],"total":6800,"voff":-200,"visual":"bomb",
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Fresh START! (new A)","card_urban_renewal_fresh_a"),("Fresh… START! (new B)","card_urban_renewal_fresh_b"),("Fresh start! (old)","card_urban_renewal_1"),("Redecorating!","card_urban_renewal_2"))},
          {"id":"t","kind":"sfx","at":820,"label":"Bomb flight","opts":sopts(("Swoosh A (new)","bomb_swoosh_a"),("Swoosh B (new)","bomb_swoosh_b"),("Zoop (old)","bomb_throw"))},
          {"id":"b","kind":"sfx","at":1160,"label":"Blast","opts":sopts(("Blast","bomb_blast"))},
          {"id":"g","kind":"sfx","at":4520,"label":"Scrap gain","opts":sopts(("Scrap gain","scrap_gain"))}]},
 {"id":"temp","title":"Temporary Solution","note":"Beats from the code constants: slam 950 ms, wall up 1170 ms, placed 1400 ms. The crate is part of the Hero clip.","sheets":[["deploy",0]],"total":3400,"voff":-200,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Good enough!","card_temporary_solution_1"),("Instant wall!","card_temporary_solution_2"))},
          {"id":"s","kind":"sfx","at":950,"label":"Slam","opts":sopts(("Cover slam","cover_slam"))},
          {"id":"w","kind":"sfx","at":1170,"label":"Wall up","opts":sopts(("Cover wall","cover_wall"))}]},
 {"id":"heavy","title":"Heavy Metal","note":"The Scrap Field leaves at 820 ms.","sheets":[["scrapfield",0]],"total":3400,"voff":-200,"visual":"field",
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Turn it up!","card_heavy_metal_1"),("Scrap party!","card_heavy_metal_2"))},
          {"id":"f","kind":"sfx","at":820,"label":"Field","opts":sopts(("Scrap field","scrap_field"))}]},
 {"id":"pitch","title":"Pitch (Cannibalize)","note":"No animation of its own yet; Tilly idles. Voice only.","sheets":[["idle",0]],"total":1800,"voff":0,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Parts is parts!","card_pitch_1"),("Waste not!","card_pitch_2"))}]},
 {"id":"light","title":"Hit: light (1 damage)","note":"Voice at the impact.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash",
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Ouchie!","react_light_1"),("Hey! (duplicate cut)","react_light_2_cut"),("Hey! (original)","react_light_2"))},
          {"id":"i","kind":"sfx","at":0,"label":"Impact","opts":sopts(("Flesh stab A (new)","hit_flesh_a"),("Flesh stab B (new)","hit_flesh_b"),("Old impact","hit_impact"))}]},
 {"id":"heavyhit","title":"Hit: heavy (2+ damage)","note":"Voice at the impact.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash",
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("That hurt!","react_heavy_1"),("Ow, ow, ow!","react_heavy_2"))},
          {"id":"i","kind":"sfx","at":0,"label":"Impact","opts":sopts(("Flesh stab A (new)","hit_flesh_a"),("Flesh stab B (new)","hit_flesh_b"),("Old impact","hit_impact"))}]},
 {"id":"shield","title":"Hit: Shield absorbs","note":"Tilly has no Shield clip of her own, so the Hit clip stands in.","sheets":[["hit",0]],"total":2600,"voff":0,"visual":"flash","guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Ha, nope! (cut)","react_shield_1_cut"),("Ha, nope! (original)","react_shield_1"),("Nice try!","react_shield_2"))},
          {"id":"i","kind":"sfx","at":0,"label":"Shield hit","opts":sopts(("Shield hit + bass thump (new)","shield_hit_bass"),("Shield pop + bass thump (new)","shield_pop_bass"),("Shield hit (old)","shield_hit"),("Shield pop (old)","shield_pop"))}]},
 {"id":"cover","title":"Goes into cover","note":"At the end of a Move onto Cover. GUESS: the code gives only the rest point (about 1050 ms); the body hits the wall a little before that.","sheets":[["half",0]],"total":1600,"voff":-200,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Duck and cover!","react_cover_1"),("Hiding spot!","react_cover_2"))},
          {"id":"t","kind":"sfx","at":850,"label":"Contact","opts":sopts(("Thump A (new)","cover_thump_a"),("Thump B (new)","cover_thump_b"))}]},
 {"id":"fullcover","title":"Full Cover holds","note":"A shot fails against Full Cover. The Full Cover clip stands in; GUESS for the contact sound.","sheets":[["full",0]],"total":1600,"voff":0,"guess":True,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Built it myself!","react_fullcover_1"),("Can't touch this!","react_fullcover_2"))},
          {"id":"t","kind":"sfx","at":850,"label":"Contact","opts":sopts(("Thump B (new)","cover_thump_b"),("Thump A (new)","cover_thump_a"))}]},
 {"id":"exhausted","title":"Exhausted","note":"The voice is split: “I need… a new body.” comes first, the armour clatters (sound from 1860 ms), then “And a hug.” follows once the clatter has died down. The slab has formed at 4860 ms.","sheets":[["exhausted",0]],"total":5400,"voff":0,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice, part 1","opts":vopts(("I need… a new body.","bella_exhausted_a"))},
          {"id":"s","kind":"sfx","at":1860,"label":"Collapse","opts":sopts(("Exhausted","exhausted"))},
          {"id":"v2","kind":"voice","at":4300,"label":"Voice, part 2","opts":vopts(("And a hug.","bella_exhausted_b"))}]},
 {"id":"victory","title":"Victory","note":"Voice only. The first take is the earlier one with the screws; the two new takes are different lines.","sheets":[["idle",0]],"total":4000,"voff":0,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("Four screws left over. Perfect. (earlier take)","victory_screws"),("It worked! IT WORKED! I can't believe it worked! (new)","bella_victory"),("Reassembled! Ahead of schedule! (new)","bella_victory_2"))}]},
 {"id":"defeat","title":"Defeat","note":"Voice only.","sheets":[["idle",0]],"total":4000,"voff":0,
  "cues":[{"id":"v","kind":"voice","at":0,"label":"Voice","opts":vopts(("It's fine… I can fix this","bella_defeat"),("I'll build a bigger one","bella_defeat_2"))}]},
]
used=set()
for sc in scenes:
    for c in sc["cues"]:
        for o in c["opts"]:
            assert o["key"] in AUD,o["key"]; used.add(o["key"])
AU={k:AUD[k] for k in used}
tpl=open("review_template.html").read()
html=tpl.replace("__SCENES__",json.dumps(scenes)).replace("__SPRITES__",json.dumps(SP)).replace("__AUDIO__",json.dumps(AU))
open("review.html","w").write(html); print(len(html)//1024,"KB",len(used),"audio files")
