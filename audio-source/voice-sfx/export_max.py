import json,os,subprocess
D="/home/user/primefall/apps/web/public/assets/audio/max/"; TIL="/home/user/primefall/apps/web/public/assets/audio/tilly/sfx/"
os.makedirs(D+"voice",exist_ok=True); os.makedirs(D+"sfx",exist_ok=True)
ids=json.load(open("api/max_ids.json"))
def txt(f):
    return {"select_old_b":"I came here to move cargo and kick ass. The cargo is optional.","light_1":"That tickled."}.get(f) or ids[f]["text"].split("] ",1)[-1]
V={"select":"select_old_b","attack-1":"attack_1","attack-2":"attack_2","attack-3":"attack_3","handle-1":"handle_1","handle-2":"handle_2","buy2-1":"buy2_1","buy2-2":"buy2_2","coffee-1":"coffee_1","coffee-2":"coffee_2","hardhat-1":"hardhat_1","hardhat-2":"hardhat_2","express-1":"express_1","express-2":"express_2","hook-1":"hook_1","hook-2":"hook_2","pitch-1":"pitch_1","pitch-2":"pitch_2","wait-1":"wait_1","wait-2":"wait_2","hit-light-1":"light_1","hit-light-2":"light_2","hit-heavy-1":"heavy_1","hit-heavy-2":"heavy_2","hit-shield-1":"shield_1","hit-shield-2":"shield_2","cover-1":"cover_1","cover-2":"cover_2","full-cover-1":"full_1","full-cover-2":"full_2","exhausted-1":"exh_1","exhausted-2":"exh_2","victory-1":"vic_1","victory-2":"vic_2","victory-3":"vic_3","defeat-1":"def_1","defeat-2":"def_2"}
S={"slam":("slam","Slam Shot: heavy arm cannon (basic attack, Handle With Care, Select)"),"double":("double","Buy One, Get Two: two blasts"),"concussion":("concussion","Time for Coffee: concussive pulse"),"rush":("rush","Express Delivery: exosuit charge"),"hook-fire":("hook_fire","Cargo Hook: heavy chain launched"),"hook-pull":("hook_pull","Cargo Hook: chain reeled in"),"hardhat":("hardhat","Hard Hat: helmet locks on"),"cover-thump":("cover","steel body meets the wall in cover"),"cover-scrape":("cover_scrape","armour scrapes along the wall when taking cover"),"ricochet-1":("ricochet_1","light hit: bullet ricochets off the steel"),"ricochet-2":("ricochet_2","light hit: bullet ricochets off the steel"),"steel-tear-1":("tear_1","heavy hit: steel tears"),"steel-tear-2":("tear_2","heavy hit: steel tears"),"step-1":("mstep_1","heavy metal step"),"step-2":("mstep_2","heavy metal step"),"step-3":("mstep_3","heavy metal step"),"exhausted-collapse":("exhausted","Exhausted: servo winds down, steel collapses")}
def conv(src,dst,br): subprocess.run(["ffmpeg","-v","error","-y","-i",src,"-ac","1","-ar","44100","-codec:a","libmp3lame","-b:a",br,dst],check=True)
def dur(p): return round(float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))*1000)
assets={}
for k,f in V.items():
    conv(f"max/final/max_{f}.mp3",D+f"voice/{k}.mp3","80k"); assets["voice."+k]={"file":f"voice/{k}.mp3","kind":"voice","text":txt(f),"durationMs":dur(D+f"voice/{k}.mp3")}
for k,(f,t) in S.items():
    conv(f"max/sfx/{f}.mp3",D+f"sfx/{k}.mp3","96k"); assets["sfx."+k]={"file":f"sfx/{k}.mp3","kind":"sfx","what":t,"durationMs":dur(D+f"sfx/{k}.mp3")}
for k,what in [("hit-flesh","impact on a Hero that is hit (shared with Tilly's folder)"),("shield-pop","Shield forms (shared with Tilly's folder)"),("shield-hit","Shield absorbs a hit (shared with Tilly's folder)")]:
    assets["sfx."+k]={"file":f"../tilly/sfx/{k}.mp3","kind":"sfx","what":what,"durationMs":dur(TIL+k+".mp3"),"shared":True}
v=lambda *n:["voice."+x for x in n]; s=lambda *n:["sfx."+x for x in n]
vi=lambda *n:{"play":v(*n),"mode":"inTurn"}
cues=[
{"on":"heroSelected","clip":"select_ready","guess":True,"note":"he fires three shots; the times are read from the frames","voice":{"play":v("select"),"atMs":0},"sfx":[{"play":s("slam"),"atMs":1400},{"play":s("slam"),"atMs":2200},{"play":s("slam"),"atMs":3000}]},
{"on":"attack","note":"the basic attack, a card without its own cue","clip":"attack","voice":{**vi("attack-1","attack-2","attack-3"),"atMs":-200},"sfx":[{"play":s("slam"),"atMs":620},{"play":s("hit-flesh"),"atImpact":True}]},
{"on":"cardPlayed","card":"Handle With Care","clip":"attack","voice":{**vi("handle-1","handle-2"),"atMs":-200},"sfx":[{"play":s("slam"),"atMs":620},{"play":s("hit-flesh"),"atImpact":True}]},
{"on":"cardPlayed","card":"Buy One, Get Two","clip":"double","guess":True,"voice":{**vi("buy2-1","buy2-2"),"atMs":-200},"sfx":[{"play":s("double"),"atMs":600},{"play":s("hit-flesh"),"atMs":650},{"play":s("hit-flesh"),"atMs":1000}]},
{"on":"cardPlayed","card":"Time for Coffee","clip":"concussion","guess":True,"voice":{**vi("coffee-1","coffee-2"),"atMs":-200},"sfx":[{"play":s("concussion"),"atMs":700}]},
{"on":"cardPlayed","card":"Express Delivery","clip":"rush","guess":True,"voice":{**vi("express-1","express-2"),"atMs":-200},"sfx":[{"play":s("rush"),"atMs":200}]},
{"on":"cardPlayed","card":"Cargo Hook","clip":"hook","guess":True,"voice":{**vi("hook-1","hook-2"),"atMs":-200},"sfx":[{"play":s("hook-fire"),"atMs":800},{"play":s("hook-pull"),"atMs":1900}]},
{"on":"cardPlayed","card":"Hard Hat","clip":"block","guess":True,"note":"the Block clip stands in for the Shield","voice":{**vi("hardhat-1","hardhat-2"),"atMs":-200},"sfx":[{"play":s("hardhat"),"atMs":700},{"play":s("shield-pop"),"atMs":900}]},
{"on":"cardPitched","note":"no animation of its own yet","voice":{**vi("pitch-1","pitch-2"),"atMs":0}},
{"on":"waitPlayed","clip":"wait","voice":{**vi("wait-1","wait-2"),"atMs":0}},
{"on":"attackHit","when":{"damage":1},"asTarget":True,"clip":"hit","note":"steel first: a ricochet","voice":{**vi("hit-light-1","hit-light-2"),"atMs":150},"sfx":[{"play":s("ricochet-1","ricochet-2"),"mode":"inTurn","atMs":0}]},
{"on":"attackHit","when":{"damage":">=2"},"asTarget":True,"clip":"hit","note":"steel first, then flesh","voice":{**vi("hit-heavy-1","hit-heavy-2"),"atMs":200},"sfx":[{"play":s("steel-tear-1","steel-tear-2"),"mode":"inTurn","atMs":0},{"play":s("hit-flesh"),"atMs":80}]},
{"on":"attackHit","when":{"damage":0,"absorbed":">0"},"asTarget":True,"clip":"absorb","voice":{**vi("hit-shield-1","hit-shield-2"),"atMs":150},"sfx":[{"play":s("ricochet-1","ricochet-2"),"mode":"inTurn","atMs":0},{"play":s("shield-hit"),"atMs":0}]},
{"on":"shieldGained","sfx":[{"play":s("shield-pop"),"atMs":900}]},
{"on":"moveEndedOnCover","clip":"takeCover","guess":True,"voice":{**vi("cover-1","cover-2"),"atMs":-200,"chance":"sometimes"},"sfx":[{"play":s("cover-scrape"),"atMs":350},{"play":s("cover-thump"),"atMs":1050}]},
{"on":"attackFailed","reason":"fullCover","asTarget":True,"clip":"full","guess":True,"voice":{**vi("full-cover-1","full-cover-2"),"atMs":0},"sfx":[{"play":s("cover-scrape"),"atMs":350},{"play":s("cover-thump"),"atMs":1050}]},
{"on":"step","clip":"walk","guess":True,"sfx":[{"play":s("step-1","step-2","step-3"),"mode":"inTurn","atMs":160,"everyMs":320,"note":"one stomp per half cycle of the Walk clip"}]},
{"on":"exhausted","clip":"exhausted","guess":True,"voice":{"play":v("exhausted-1"),"atMs":0},"sfx":[{"play":s("exhausted-collapse"),"atMs":1200}],"voiceLater":{"play":v("exhausted-2"),"atMs":4300}},
{"on":"matchEnd","won":True,"voice":{**vi("victory-1","victory-2","victory-3"),"atMs":0}},
{"on":"matchEnd","won":False,"voice":{**vi("defeat-1","defeat-2"),"atMs":0}}]
man={"hero":"bruiser","name":"Max Overload","format":"mp3, mono","note":"Cues are proposals from the review of the Max animations; times are in ms from the start of the clip of that card or event. 'guess' marks times the code does not give exactly. The game decides what a Squad may hear: play a cue only for what its Squad sees.","assets":assets,"cues":cues}
json.dump(man,open(D+"manifest.json","w"),indent=1)
print(len(V),"voice",len(S),"sfx"); print(sorted(((a["durationMs"],k) for k,a in assets.items() if a["kind"]=="voice"))[-3:])
