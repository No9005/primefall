import json,os,subprocess
R="review_kit/"; D="/home/user/primefall/apps/web/public/assets/audio/kit/"
os.makedirs(D+"voice",exist_ok=True); os.makedirs(D+"sfx",exist_ok=True)
OLD="/home/user/primefall/apps/web/public/assets/voice/kit/"
V={
"attack-1":("/"+OLD+"kit_attack_1","Quiet."),"attack-2":("/"+OLD+"kit_attack_2","Clean."),"attack-3":("/"+OLD+"kit_attack_3","Noted."),
"select":("select","Nobody asked for my real name. Nobody will."),
"long-shot-1":("long_shot_1","Breathe out. It helps."),"long-shot-2":("long_shot_2","Dead centre. As usual."),
"vanish-1":("vanish_1","I was never here."),"vanish-2":("vanish_2","Don't look for me."),
"personal-space-1":("personal_space_1","Personal space. Look it up."),"personal-space-2":("personal_space_2","Too close. Let's fix that."),
"shield-breaker-1":("shield_breaker_1","Armour is a suggestion."),"shield-breaker-2":("shield_breaker_2a","Hard shell. Soft centre."),"shield-breaker-3":("shield_breaker_2b","Let's see what's underneath."),
"pitch-1":("pitch_1","Everything has a price."),"pitch-2":("pitch_2","No questions asked."),"pitch-3":("pitch_3","Cards. Organs. Doesn't matter."),
"wait-1":("wait_1","Patience."),"wait-2":("wait_2","I can wait."),"wait-3":("wait_3","Patience is a firearm."),
"hit-light-1":("hit_light_1","Hm."),"hit-light-2":("hit_light_2","Noted."),
"hit-heavy-1":("hit_heavy_1","Sloppy. My mistake."),"hit-heavy-2":("hit_heavy_2","That will cost you."),
"hit-hidden-1":("hit_hidden_1","So much for subtle."),"hit-hidden-2":("hit_hidden_2","Well. That's one way to be seen."),
"hidden-ends-1":("hidden_ends_1","Spotted. Fine."),"hidden-ends-2":("hidden_ends_2","Hello."),
"cover-1":("cover_1","Better."),"cover-2":("cover_2","Cosy."),
"full-cover-1":("full_cover_1","Try again."),"full-cover-2":("full_cover_2","They always miss."),
"exhausted-1":("exhausted_1_from","Contract terminated."),"exhausted-2":("exhausted_2","Tell them I was never here."),
"victory-1":("victory_1","Paid in full."),"victory-2":("victory_2","Nothing personal. Everything billable."),"victory-3":("victory_3","Satisfied customers. Mostly."),
"defeat-1":("defeat_1","Bad debt."),"defeat-2":("defeat_2","That is a bonus I will not be collecting.")}
S={
"lightning":("lightning","Long Shot and Shield Breaker lead: a bolt of lightning"),
"impact-body":("impact_body","Long Shot impact with a bass body"),
"shield-breaker":("shield_breaker","Shield Breaker shot"),
"personal-space":("personal_space","Personal Space: the blow with weight"),
"vanish":("vanish","Hidden begins: the Hero fades"),"hidden-ends":("hidden_ends","Hidden ends: the shimmer"),
"cover-brush":("cover_brush","cloth brushes the wall in cover"),
"step-1":("step_1","cat-like step"),"step-2":("step_2","cat-like step"),"step-3":("step_3","cat-like step"),
"exhausted-collapse":("exhausted","Exhausted: light armour and cape collapse")}
def conv(src,dst,br):
    subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-ac","1","-ar","44100","-codec:a","libmp3lame","-b:a",br,dst],check=True)
def dur(p): return round(float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))*1000)
assets={}
for k,(f,t) in V.items():
    conv((R+"v_kit_"+f+".mp3") if not f.startswith("/") else f[1:]+".mp3",D+f"voice/{k}.mp3","80k"); assets["voice."+k]={"file":f"voice/{k}.mp3","kind":"voice","text":t,"durationMs":dur(D+f"voice/{k}.mp3")}
for k,(f,t) in S.items():
    conv(R+"s_"+f+".mp3",D+f"sfx/{k}.mp3","96k"); assets["sfx."+k]={"file":f"sfx/{k}.mp3","kind":"sfx","what":t,"durationMs":dur(D+f"sfx/{k}.mp3")}
SH="../tilly/sfx/hit-flesh.mp3"
assets["sfx.hit-flesh"]={"file":SH,"kind":"sfx","what":"impact on a Hero that is hit (shared with Tilly's folder)","durationMs":dur("/home/user/primefall/apps/web/public/assets/audio/tilly/sfx/hit-flesh.mp3"),"shared":True}
v=lambda *n:["voice."+x for x in n]; s=lambda *n:["sfx."+x for x in n]
vi=lambda *n:{"play":v(*n),"mode":"inTurn"}
cues=[
{"on":"heroSelected","voice":{"play":v("select"),"atMs":0}},
{"on":"attack","note":"the basic attack, a card without its own cue; no effect of its own yet","voice":{**vi("attack-1","attack-2","attack-3"),"atMs":0}},
{"on":"cardPlayed","card":"Long Shot","clip":"long","voice":{**vi("long-shot-1","long-shot-2"),"atMs":-200},"sfx":[{"play":s("lightning"),"atMs":1650},{"play":s("impact-body"),"atMs":1680}]},
{"on":"cardPlayed","card":"Long Shot","clip":"longhidden","note":"from Hidden; Hidden ends right after the shot","voice":{**vi("long-shot-1","long-shot-2"),"atMs":-200},"sfx":[{"play":s("lightning"),"atMs":2000},{"play":s("impact-body"),"atMs":2030},{"play":s("hidden-ends"),"atMs":2100}]},
{"on":"cardPlayed","card":"Vanish","clip":"hidden","guess":True,"voice":{**vi("vanish-1","vanish-2"),"atMs":-200},"sfx":[{"play":s("vanish"),"atMs":600}]},
{"on":"cardPlayed","card":"Personal Space","clip":"knockback","voice":{**vi("personal-space-1","personal-space-2"),"atMs":-200},"sfx":[{"play":s("personal-space"),"atMs":700},{"play":s("hit-flesh"),"atMs":720}]},
{"on":"cardPlayed","card":"Shield Breaker","clip":"shieldbreaker","note":"three lines; pick with the animation","voice":{**vi("shield-breaker-1","shield-breaker-2","shield-breaker-3"),"atMs":-200},"sfx":[{"play":s("shield-breaker"),"atMs":570},{"play":s("hit-flesh"),"atMs":620}]},
{"on":"cardPitched","note":"no animation of its own yet","voice":{**vi("pitch-1","pitch-2","pitch-3"),"atMs":0}},
{"on":"waitPlayed","note":"Wait (Stakeout)","clip":"wait","voice":{**vi("wait-1","wait-2","wait-3"),"atMs":0}},
{"on":"attackHit","when":{"damage":1},"asTarget":True,"clip":"hit","voice":{**vi("hit-light-1","hit-light-2"),"atMs":0},"sfx":[{"play":s("hit-flesh"),"atMs":0}]},
{"on":"attackHit","when":{"damage":">=2"},"asTarget":True,"clip":"hit","voice":{**vi("hit-heavy-1","hit-heavy-2"),"atMs":0},"sfx":[{"play":s("hit-flesh"),"atMs":0}]},
{"on":"attackHit","asTarget":True,"whileHidden":True,"clip":"hithidden","note":"damage ends Hidden at 1500 ms; he speaks after that","voice":{**vi("hit-hidden-1","hit-hidden-2"),"atMs":1700},"sfx":[{"play":s("hit-flesh"),"atMs":0},{"play":s("hidden-ends"),"atMs":1500}]},
{"on":"hiddenEnded","note":"he attacked or is Marked; no clip of its own","guess":True,"voice":{**vi("hidden-ends-1","hidden-ends-2"),"atMs":500},"sfx":[{"play":s("hidden-ends"),"atMs":0}]},
{"on":"moveEndedOnCover","clip":"takeCover","guess":True,"voice":{**vi("cover-1","cover-2"),"atMs":-200,"chance":"sometimes"},"sfx":[{"play":s("cover-brush"),"atMs":850}]},
{"on":"attackFailed","reason":"fullCover","asTarget":True,"guess":True,"clip":"full","voice":{**vi("full-cover-1","full-cover-2"),"atMs":0},"sfx":[{"play":s("cover-brush"),"atMs":850}]},
{"on":"step","clip":"walk","guess":True,"sfx":[{"play":s("step-1","step-2","step-3"),"mode":"inTurn","atMs":125,"everyMs":250,"note":"one step per half cycle of the Walk clip"}]},
{"on":"exhausted","clip":"exhausted","voice":{"play":v("exhausted-1"),"atMs":0},"sfx":[{"play":s("exhausted-collapse"),"atMs":1700}],"voiceLater":{"play":v("exhausted-2"),"atMs":3500}},
{"on":"matchEnd","won":True,"voice":{**vi("victory-1","victory-2","victory-3"),"atMs":0}},
{"on":"matchEnd","won":False,"voice":{**vi("defeat-1","defeat-2"),"atMs":0}}]
man={"hero":"assassin","name":"Kit Crosshair","format":"mp3, mono","note":"Cues are proposals from the review of the Kit animations; times are in ms from the start of the clip of that card or event. 'guess' marks times the code does not give exactly. The game decides what a Squad may hear: play a cue only for what its Squad sees.","assets":assets,"cues":cues}
json.dump(man,open(D+"manifest.json","w"),indent=1)
print(len(V),"voice,",len(S),"sfx"); 
print(max((a["durationMs"],k) for k,a in assets.items() if a["kind"]=="voice"))
