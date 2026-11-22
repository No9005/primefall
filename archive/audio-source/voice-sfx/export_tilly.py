import json,os,subprocess
R="review/"; D="/home/user/primefall/apps/web/public/assets/audio/tilly/"
os.makedirs(D+"voice",exist_ok=True); os.makedirs(D+"sfx",exist_ok=True)
V={ # id -> (review file, spoken text)
"select":("v_tilly_select_bella_B","Everything is a spare part! If you squint hard enough!"),
"attack-1":("v_tilly_bella_attack_1","Ooh, let's see what THIS one does!"),
"attack-2":("v_tilly_bella_attack_2","Ooh, I wonder what this button does!"),
"attack-3":("v_tilly_bella_attack_3","Fire in the hole! Probably!"),
"attack-4":("v_tilly_bella_attack_4_v2","This should not work... It's working! It's WORKING!"),
"price-tag-1":("v_tilly_card_price_tag_1","Everything must go!"),"price-tag-2":("v_tilly_card_price_tag_2","Marked down!"),
"site-survey-1":("v_tilly_card_site_survey_1","Go fetch!"),"site-survey-2":("v_tilly_card_site_survey_2","Eyes up, buddy!"),
"urban-renewal-1":("v_tilly_card_urban_renewal_fresh_a","Fresh START!"),"urban-renewal-2":("v_tilly_card_urban_renewal_2","Redecorating!"),
"temporary-solution-1":("v_tilly_card_temporary_solution_1","Good enough!"),"temporary-solution-2":("v_tilly_card_temporary_solution_2","Instant wall!"),
"heavy-metal-1":("v_tilly_card_heavy_metal_1","Turn it up!"),"heavy-metal-2":("v_tilly_card_heavy_metal_2","Scrap party!"),
"pitch-1":("v_tilly_card_pitch_1","Parts is parts!"),"pitch-2":("v_tilly_card_pitch_2","Waste not!"),
"hit-light-1":("v_tilly_react_light_1","Ouchie!"),"hit-light-2":("v_tilly_react_light_2_cut","Hey!"),
"hit-heavy-1":("v_tilly_react_heavy_1","That hurt!"),"hit-heavy-2":("v_tilly_react_heavy_2","Ow, ow, ow!"),
"hit-shield-1":("v_tilly_react_shield_1_cut","Ha, nope!"),"hit-shield-2":("v_tilly_react_shield_2","Nice try!"),
"cover-1":("v_tilly_react_cover_1","Duck and cover!"),"cover-2":("v_tilly_react_cover_2","Hiding spot!"),
"full-cover-1":("v_tilly_react_fullcover_1","Built it myself!"),"full-cover-2":("v_tilly_react_fullcover_2","Can't touch this!"),
"exhausted-1":("v_tilly_bella_exhausted_a","I need... a new body."),"exhausted-2":("v_tilly_bella_exhausted_b","And a hug."),
"victory-1":("v_tilly_victory_screws","Four screws left over. Perfect."),"victory-2":("v_tilly_bella_victory","It worked! IT WORKED! I can't believe it worked!"),"victory-3":("v_tilly_bella_victory_2","Reassembled! Ahead of schedule!"),
"defeat-1":("v_tilly_bella_defeat","It's fine... it's fine... I can fix this. Probably."),"defeat-2":("v_tilly_bella_defeat_2","I'll build a bigger one! Next time!")}
S={ # id -> (review file, what it is)
"tag-fire":("s_tilly_tag_fire","Price Tag launch"),"tag-hit":("s_tilly_tag_hit","Price Tag impact"),
"bomb-swoosh":("s_tilly_bomb_swoosh_a","Urban Renewal bomb flight"),"bomb-blast":("s_tilly_bomb_blast","Urban Renewal blast"),
"scrap-gain":("s_tilly_scrap_gain","Scrap gain; the heavy clunk is about 900 ms into the file"),
"cover-slam":("s_tilly_cover_slam","Temporary Solution: crate slams down"),"cover-wall":("s_tilly_cover_wall","Temporary Solution: wall goes up"),
"cover-crumble":("s_tilly_cover_crumble","oldest Placed Cover crumbles"),"scrap-field":("s_tilly_scrap_field","Heavy Metal: Scrap Field spreads"),
"scout-drone":("s_tilly_scout_drone","Site Survey: drone"),"hit-flesh":("s_tilly_hit_flesh_b","impact on a Hero that is hit (shared by all Heroes)"),
"shield-pop":("s_tilly_shield_pop_bass","Shield forms, with bass thump (shared)"),"shield-hit":("s_tilly_shield_hit_bass","Shield absorbs a hit, with bass thump (shared)"),
"cover-thump":("s_tilly_cover_thump_b","body meets the wall in cover"),"step-1":("s_tilly_leather_step_1","leather boot step"),"step-2":("s_tilly_leather_step_2","leather boot step"),"step-3":("s_tilly_leather_step_3","leather boot step"),
"exhausted-collapse":("s_tilly_exhausted","Exhausted: armour collapses")}
def conv(src,dst,br):
    subprocess.run(["ffmpeg","-v","error","-y","-i",R+src+".mp3","-ac","1","-ar","44100","-codec:a","libmp3lame","-b:a",br,dst],check=True)
def dur(p): return round(float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))*1000)
assets={}
for k,(f,t) in V.items():
    conv(f,D+f"voice/{k}.mp3","80k"); assets["voice."+k]={"file":f"voice/{k}.mp3","kind":"voice","text":t,"durationMs":dur(D+f"voice/{k}.mp3")}
for k,(f,t) in S.items():
    conv(f,D+f"sfx/{k}.mp3","96k"); assets["sfx."+k]={"file":f"sfx/{k}.mp3","kind":"sfx","what":t,"durationMs":dur(D+f"sfx/{k}.mp3")}
v=lambda *n:["voice."+x for x in n]; s=lambda *n:["sfx."+x for x in n]
cues=[
{"on":"heroSelected","voice":{"play":v("select"),"atMs":0}},
{"on":"attack","note":"the basic attack, a card without its own cue","clip":"attack","voice":{"play":v("attack-1","attack-2","attack-3","attack-4"),"mode":"inTurn","atMs":0},"sfx":[{"play":s("tag-fire"),"atMs":620,"guess":True,"note":"stand-in until the basic shot has its own sound"}]},
{"on":"cardPlayed","card":"Price Tag","clip":"tag","voice":{"play":v("price-tag-1","price-tag-2"),"mode":"inTurn","atMs":-200},"sfx":[{"play":s("tag-fire"),"atMs":730},{"play":s("tag-hit"),"atImpact":True}]},
{"on":"cardPlayed","card":"Site Survey","clip":"drone","guess":True,"voice":{"play":v("site-survey-1","site-survey-2"),"mode":"inTurn","atMs":-200},"sfx":[{"play":s("scout-drone"),"atMs":600}]},
{"on":"cardPlayed","card":"Urban Renewal","clip":"demolish","voice":{"play":v("urban-renewal-1","urban-renewal-2"),"mode":"inTurn","atMs":-200},"sfx":[{"play":s("bomb-swoosh"),"atMs":820},{"play":s("bomb-blast"),"atMs":1160},{"play":s("scrap-gain"),"atMs":4520,"note":"the Scrap clip (scrapforce) starts at 3400 ms; the clunk lands at 2020 ms of it"}]},
{"on":"cardPlayed","card":"Temporary Solution","clip":"deploy","voice":{"play":v("temporary-solution-1","temporary-solution-2"),"mode":"inTurn","atMs":-200},"sfx":[{"play":s("cover-slam"),"atMs":950},{"play":s("cover-wall"),"atMs":1170}]},
{"on":"coverCrumbled","note":"the oldest Placed Cover goes when a fourth is placed","sfx":[{"play":s("cover-crumble"),"atMs":1400,"note":"0.45 s after the slam"}]},
{"on":"cardPlayed","card":"Heavy Metal","clip":"scrapfield","voice":{"play":v("heavy-metal-1","heavy-metal-2"),"mode":"inTurn","atMs":-200},"sfx":[{"play":s("scrap-field"),"atMs":820}]},
{"on":"cardPitched","voice":{"play":v("pitch-1","pitch-2"),"mode":"inTurn","atMs":0}},
{"on":"attackHit","when":{"damage":1},"asTarget":True,"voice":{"play":v("hit-light-1","hit-light-2"),"mode":"inTurn","atMs":0},"sfx":[{"play":s("hit-flesh"),"atMs":0}]},
{"on":"attackHit","when":{"damage":">=2"},"asTarget":True,"voice":{"play":v("hit-heavy-1","hit-heavy-2"),"mode":"inTurn","atMs":0},"sfx":[{"play":s("hit-flesh"),"atMs":0}]},
{"on":"attackHit","when":{"damage":0,"absorbed":">0"},"asTarget":True,"guess":True,"note":"Tilly has no Shield clip of her own","voice":{"play":v("hit-shield-1","hit-shield-2"),"mode":"inTurn","atMs":0},"sfx":[{"play":s("shield-hit"),"atMs":0}]},
{"on":"shieldGained","sfx":[{"play":s("shield-pop"),"atMs":900}]},
{"on":"moveEndedOnCover","clip":"takeCover","guess":True,"voice":{"play":v("cover-1","cover-2"),"mode":"inTurn","atMs":-200,"chance":"sometimes"},"sfx":[{"play":s("cover-thump"),"atMs":850}]},
{"on":"attackFailed","reason":"fullCover","asTarget":True,"guess":True,"voice":{"play":v("full-cover-1","full-cover-2"),"mode":"inTurn","atMs":0},"sfx":[{"play":s("cover-thump"),"atMs":850}]},
{"on":"step","clip":"walk","guess":True,"sfx":[{"play":s("step-1","step-2","step-3"),"mode":"inTurn","atMs":145,"everyMs":290,"note":"one step per half cycle of the Walk clip"}]},
{"on":"exhausted","clip":"exhausted","voice":{"play":v("exhausted-1"),"atMs":0},"sfx":[{"play":s("exhausted-collapse"),"atMs":1860}],"voiceLater":{"play":v("exhausted-2"),"atMs":4300}},
{"on":"matchEnd","won":True,"voice":{"play":v("victory-1","victory-2","victory-3"),"mode":"inTurn","atMs":0}},
{"on":"matchEnd","won":False,"voice":{"play":v("defeat-1","defeat-2"),"mode":"inTurn","atMs":0}}]
man={"hero":"controller","name":"Tilly Turnover","format":"mp3, mono","note":"Cues are proposals from the review of the Tilly animations; times are in ms from the start of the clip of that card or event. 'guess' marks times the code does not give exactly. The game decides what Squad may hear: play a cue only for what its Squad sees.","assets":assets,"cues":cues}
json.dump(man,open(D+"manifest.json","w"),indent=1)
print(len(V),"voice,",len(S),"sfx")
