import base64,subprocess,re,json,os,datetime
D=os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else "."
os.chdir(D)
hist={h["history_item_id"]:h for h in json.load(open("history.json"))}
match=json.load(open("match.json"))   # source file path -> [history ids]
def pid(path):
    n=os.path.basename(path); n=re.sub(r"^[0-9a-f]{8}-","",n); low=n.lower()
    t=re.search(r"T(\d\d_\d\d_\d\d)",n); t=t.group(1) if t else ""
    if low.startswith("kit_"):
        if low.startswith("kit_select_1"): return "kit_select_1" if t=="20_06_41" else "kit_select_2"
        if low.startswith("kit_hit_2_new"): return "kit_hit_2"
        if low.startswith("kit_hit_2"): return "kit_defeat_2"
        m=re.match(r"kit_([a-z]+(?:_\d)?)",low); return "kit_"+m.group(1)
    if low.startswith("tilly_"):
        if low.startswith("tilly_select_different"): return "tilly_select_ember"
        if low.startswith("tilly_select_3"): return "tilly_select_c"
        if low.startswith("tilly_select_2"): return "tilly_select_b"
        if low.startswith("tilly_select"): return "tilly_select_a"
        if re.match(r"tilly_attack_3_2",low): return "tilly_attack_3b"
        m=re.match(r"tilly_([a-z]+(?:_\d)?)",low); return "tilly_"+m.group(1)
    pats=[("max_select ElevenLabs","select_a"),("max_select 2 ","select_b"),("max_attac_1 ","attack_1a"),("Max_attack_1 2","attack_1b"),("max_attack_2 ElevenLabs","attack_2a"),("max_attack_2  2 ","attack_2b"),("max_attack_2  3 ","attack_2c"),("Max_attack_3","attack_3a"),("max_hit_1 ","hit_1a"),("max_hot_1 2","hit_1b"),("Max_hit_2","hit_2a"),("max_hit_2 2","hit_2b"),("max_hit_3 ElevenLabs","hit_3a"),("max_hit_3 2 ","hit_3b"),("max_hit_3 3 ","hit_3c"),("max_exhausted ElevenLabs","exhausted_a"),("max_exhausted 2 ","exhausted_b"),("max_exhausted 3 ","exhausted_c"),("max_victory ElevenLabs","victory_a"),("max_victory 2 ","victory_b"),("Max_victory_2","victory_2"),("max_defeat ElevenLabs","defeat_a"),("max_defeat 2 ","defeat_b"),("max_defeat_2","defeat_2")]
    used=pid.__dict__.setdefault("u",set())
    for p,i in pats:
        if n.startswith(p) and i not in used: used.add(i); return "max_"+i
meta={}
for src,ids in sorted(match.items()):
    p=pid(src)
    if p: meta[p]=hist[ids[0]]
def info(p):
    h=meta.get(p)
    if not h: return "","",""
    d=(h.get("dialogue") or [{}])[0]; s=h["settings"]
    if not d.get("voice_name") and h.get("history_item_id") in tuple(["ZpxWgfHgpJTaMrcSRsy0","yJFDrGsU61RRRPGj4bnj"]+list(json.load(open("api/tilly_ids.json")).values())+list(json.load(open("api/tilly_card_ids.json")).values())+list(json.load(open("api/tilly_react_ids.json")).values())): d={**d,"voice_name":"Bella (API)"}
    when=datetime.datetime.fromtimestamp(h["date_unix"],datetime.timezone.utc).strftime("%d.%m. %H:%M")
    return d.get("text") or h.get("text") or "", f'{(d.get("voice_name") or "").split(" - ")[0]} · {h["model_id"]} · stability {s.get("stability")} · similarity {s.get("similarity") if s.get("similarity") is not None else 0.75} · {when} UTC', h["history_item_id"]
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
def lim(occ): return 1.5 if occ.startswith(("Hit:","Goes into","Full Cover","Card:")) else 3.5 if occ.startswith(("Attack","Hit")) else 4
H={}
def g(h,gid,occ,text,takes): H.setdefault(h,[]).append((gid,occ,text,takes))
K="out/kit_%s.mp3"; KH="Kit Crosshair · Oxley, Evil Character"
g(KH,"kit_select","Select","Nobody asked for my real name. Nobody will.",[("Take 1",K%"select_1","kit_select_1",1),("Take 2",K%"select_2","kit_select_2",0)])
for k,o,t in [("attack_1","Attack 1","Quiet."),("attack_2","Attack 2","Clean."),("attack_3","Attack 3","Noted."),("hit_1","Hit 1","Sloppy."),("hit_2","Hit 2","That will cost you."),("hit_3","Hit 3","Hm."),("exhausted","Exhausted","Contract terminated."),("victory","Victory","Paid in full."),("victory_2","Victory 2","Nothing personal. Everything billable."),("defeat","Defeat","Bad debt."),("defeat_2","Defeat 2","That is a bonus I will not be collecting.")]:
    g(KH,"kit_"+k,o,t,[("Take 1",K%k,"kit_"+k,1)])
T="tilly/out/tilly_%s.mp3"; TH="Tilly Turnover · Bella, Professional Bright Warm"
g(TH,"tilly_select","Select","Everything is a spare part if you squint hard enough.",[("Take A",T%"select_a","tilly_select_a",0),("Take B",T%"select_b","tilly_select_b",1),("Take C",T%"select_c","tilly_select_c",0),("Not chosen: other AI voice “Ember, Energetic Confident Protagonist”",T%"select_ember","tilly_select_ember",0)])
g(TH,"tilly_attack_1","Attack 1","Calibrating.",[("Take 1",T%"attack_1","tilly_attack_1",1)])
g(TH,"tilly_attack_2","Attack 2","This should not work.",[("Take 1",T%"attack_2","tilly_attack_2",1)])
g(TH,"tilly_attack_3","Attack 3","Fire in the hole. Probably.",[("Take A",T%"attack_3","tilly_attack_3",1),("Take B",T%"attack_3b","tilly_attack_3b",0)])
for k,o,t in [("hit_1","Hit 1","Okay. Ow."),("hit_2","Hit 2","That was a load-bearing arm."),("hit_3","Hit 3","Warranty void!"),("exhausted","Exhausted","Somebody get a wrench."),("victory","Victory","Four screws left over. Perfect."),("victory_2","Victory 2","Reassembled. Ahead of schedule."),("defeat","Defeat","I can fix this. Give me an hour."),("defeat_2","Defeat 2","It was fine when I started.")]:
    g(TH,"tilly_"+k,o,t,[("Take 1",T%k,"tilly_"+k,1)])
M="max/out/max_%s.mp3"; MH="Max Overload · Morgan, Deep, Powerful, and Confident"
def mx(gid,o,t,ids):
    labs="ABC"
    g(MH,"max_"+gid,o,t,[(("Take "+labs[i]) if len(ids)>1 else "Take 1",M%x,"max_"+x,1 if len(ids)==1 else 0) for i,x in enumerate(ids)])
mx("select","Select","",["select_a","select_b"]); mx("attack_1","Attack 1","",["attack_1a","attack_1b"]); mx("attack_2","Attack 2","",["attack_2a","attack_2b","attack_2c"]); mx("attack_3","Attack 3","",["attack_3a"]); mx("hit_1","Hit 1","",["hit_1a","hit_1b"]); mx("hit_2","Hit 2","",["hit_2a","hit_2b"]); mx("hit_3","Hit 3","",["hit_3a","hit_3b","hit_3c"]); mx("exhausted","Exhausted","",["exhausted_a","exhausted_b","exhausted_c"]); mx("victory","Victory","",["victory_a","victory_b"]); mx("victory_2","Victory 2","",["victory_2"]); mx("defeat","Defeat","",["defeat_a","defeat_b"]); mx("defeat_2","Defeat 2","",["defeat_2"])

# ---- extra takes from the history that were not downloaded before ----
import collections
matched={i for ids in match.values() for i in ids}
VOICE={"2gPFXx8pN3Avh27Dw5Ma":KH,"hpp4J3VqNfWAUOO0d1Us":TH,"WtA85syCrJwasGeHGH2p":TH,"SAxJUlDKRc79XAyeWyMu":MH}
def toks(t): return re.sub(r"[^a-z0-9' ]+"," ",re.sub(r"\[[^\]]*\]","",t.lower())).replace("'","").split()
def has(a,b):
    return any(b[i:i+len(a)]==a for i in range(len(b)-len(a)+1)) if a else False
def core(h): d=(h.get("dialogue") or [{}])[0]; return toks(d.get("text") or h.get("text") or "")
others=collections.defaultdict(list)
for h in sorted(hist.values(),key=lambda x:x["date_unix"]):
    i=h["history_item_id"]
    if i in matched or i in tuple(["ZpxWgfHgpJTaMrcSRsy0","yJFDrGsU61RRRPGj4bnj"]+list(json.load(open("api/tilly_ids.json")).values())+list(json.load(open("api/tilly_card_ids.json")).values())+list(json.load(open("api/tilly_react_ids.json")).values())): continue
    d=(h.get("dialogue") or [{}])[0]; hero=VOICE.get(d.get("voice_id"))
    if not hero: print("unknown voice",d.get("voice_name")); continue
    c=core(h); best=None
    for gid,occ,text,takes in H[hero]:
        for lab,p,k,sel in takes:
            if k in meta:
                kc=core(meta[k])
                if kc and c and (kc==c or has(c,kc) or has(kc,c)): best=(gid,occ,text,takes); break
        if best: break
    when=datetime.datetime.fromtimestamp(h["date_unix"],datetime.timezone.utc).strftime("%d.%m. %H:%M")
    meta["x_"+i]=h
    voice=(d.get("voice_name") or "").split(" - ")[0]
    lab=f"Extra take, {when} UTC" + (" · not chosen: Ember" if voice=="Ember" else "")
    entry=(lab,f"extra/{i}.mp3","x_"+i,0)
    if best: best[3].append(entry)
    else: others[hero].append(entry)
for hero,es in others.items(): H[hero].append(("other_"+hero[:4],"Other texts","(from your history, not in the 12 lines)",es))

# ---- new takes made through the API (Bella, eleven_v4) ----
API_IDS=json.load(open("api/tilly_ids.json"))
API=[("New API take A (Bella, stability 0.0)","api/out/tilly_select_bella_A.mp3","ZpxWgfHgpJTaMrcSRsy0","tilly_select"),("New API take B (Bella, stability 0.5)","api/out/tilly_select_bella_B.mp3","yJFDrGsU61RRRPGj4bnj","tilly_select")]
for k,i in API_IDS.items():
    API.append(("New API take (Bella, stability 0.5)" if not k.endswith("_v2") else "New API take 2 (Bella, stability 0.5)",f"api/out/tilly_bella_{k}.mp3",i,"tilly_"+k.replace("_v2","")))
if not any(x[0]=="tilly_attack_4" for x in H[TH]):
    H[TH].insert(4,("tilly_attack_4","Attack 4","This should not work! It's working!",[]))
for lab,p,i,gid0 in API:
    meta["a_"+i]=hist[i]
    for gid,occ,text,takes in H[TH]:
        if gid==gid0: takes.append((lab,p,"a_"+i,1 if (gid=="tilly_attack_4" and not lab.startswith("New API take 2")) else 0))

# ---- Tilly card lines (API, Bella, stability 0.5) ----
CARD_IDS=json.load(open("api/tilly_card_ids.json"))
CARDS=[("price_tag","Price Tag"),("site_survey","Site Survey"),("urban_renewal","Urban Renewal"),("temporary_solution","Temporary Solution"),("heavy_metal","Heavy Metal"),("pitch","Pitch (Cannibalize)")]
for ck,cn in CARDS:
    for n in (1,2):
        k=f"{ck}_{n}"; i=CARD_IDS[k]; meta["c_"+i]=hist[i]
        t=(hist[i].get("dialogue") or [{}])[0].get("text") or hist[i].get("text")
        spoken=re.sub(r"\[[^\]]*\]\s*","",t).strip()
        H[TH].append(("tilly_card_"+k,f"Card: {cn}, line {n}",spoken,[("Take 1 (API, Bella)",f"api/out/tilly_card_{k}.mp3","c_"+i,1)]))

# ---- Tilly reactions (API): hits and cover ----
REACT_IDS=json.load(open("api/tilly_react_ids.json"))
REACT=[("shield","Hit: Shield absorbs"),("light","Hit: light (1 damage)"),("heavy","Hit: heavy (2+ damage)"),("cover","Goes into cover"),("fullcover","Full Cover holds")]
for rk,rn in REACT:
    for n in (1,2):
        k=f"{rk}_{n}"; i=REACT_IDS[k]; meta["r_"+i]=hist[i]
        t=(hist[i].get("dialogue") or [{}])[0].get("text") or hist[i].get("text")
        spoken=re.sub(r"\[[^\]]*\]\s*","",t).strip()
        H[TH].append(("tilly_react_"+k,f"{rn}, line {n}",spoken,[("Take 1 (API, Bella)",f"api/out/tilly_react_{k}.mp3","r_"+i,1)]))

# cut takes: the duplicate removed by ffmpeg (new takes, nothing overwritten)
for gk in ("light_2","shield_1"):
    for gid,occ,text,takes in H[TH]:
        if gid=="tilly_react_"+gk:
            lab,p,k,sel=takes[0]
            takes[0]=(lab,p,k,0)
            takes.append(("Take 2 (duplicate cut, by me)",f"api/out/tilly_react_{gk}_cut.mp3",k,1))

esc=lambda s:s.replace("&","&amp;").replace("<","&lt;").replace(">","&gt;")
out=""
tabs=""
for n,(h,groups) in enumerate(H.items()):
    short=h.split(" ")[0]
    tabs+=f'<button type="button" role="tab" class="tab" id="tab{n}" data-t="{n}" aria-selected="{"true" if n==0 else "false"}">{short}</button>'
    out+=f'<div class="hero" data-hero="{n}" role="tabpanel" aria-labelledby="tab{n}"{"" if n==0 else " hidden"}><h2>{h}</h2>\n'
    for gid,occ,text,takes in groups:
        l=lim(occ)
        out+=f'<details class="grp" data-g="{gid}"><summary><span class="occ">{occ}</span>'+(f'<span class="line">“{text}”</span>' if text else '')+f'<span class="sel"></span><button type="button" class="psel" aria-label="Play selected take of {occ}">▶</button></summary><ul>\n'
        for i,(lab,p,k,sel) in enumerate(takes):
            d=dur(p); b=base64.b64encode(open(p,"rb").read()).decode(); f=p.split("/")[-1]
            prompt,det,hid=info(k)
            nc=lab.startswith("Not chosen")
            out+=f'''<li{' class="nc"' if nc else ''}><button type="button" class="play" data-src="data:audio/mpeg;base64,{b}" aria-label="Play {occ}, {lab}">▶</button>
<label class="pick"><input type="radio" name="{gid}" value="{f}"{' checked' if sel else ''}><span class="tk">{lab}</span><span class="file">{f}</span></label>
<div class="dur{' over' if d>l else ''}">{d:.2f} s<span>limit {l:g} s</span></div>
<div class="meta"><code class="pr">{esc(prompt)}</code><span class="det">{esc(det)}</span></div></li>\n'''
        out+='</ul></details>\n'
    out+='</div>\n'
s=open("player.html").read()
head=s[:s.index('<main>')]; tail=s[s.index('<script>'):]
head=head if ".psel{" in head else head.replace("</style>",'.grp summary{display:flex;gap:8px;align-items:center;padding:8px 12px;cursor:pointer;list-style:none;min-height:52px}.grp summary::-webkit-details-marker{display:none}.grp summary::before{content:"▸";color:var(--muted);width:12px;flex:none}.grp[open] summary::before{content:"▾"}.grp[open] summary{border-bottom:1px solid var(--line)}.grp summary .occ{flex:none}.grp summary .line{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.sel{flex:none;font-size:12px;color:var(--muted)}.psel{flex:none;width:44px;height:44px;border-radius:50%;border:0;background:var(--accent);color:var(--bg);font-size:16px;cursor:pointer;margin-left:auto}.psel.on{outline:3px solid var(--accent);outline-offset:2px}.psel:focus-visible{outline:3px solid var(--fg);outline-offset:2px}\n</style>') if ".tabs{" in head else head.replace("</style>",'.tabs{display:flex;gap:8px;margin:12px 0 4px;flex-wrap:wrap}.tab{font:inherit;font-weight:600;padding:10px 16px;min-height:44px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}.tab[aria-selected="true"]{background:var(--accent);color:var(--bg);border-color:var(--accent)}.tab:focus-visible{outline:3px solid var(--fg);outline-offset:2px}\n</style>')
head=head.replace('.sel{flex:none;font-size:12px;color:var(--muted)}','.sel{flex:0 1 auto;min-width:0;max-width:38%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;color:var(--muted)}')
js='''
function showTab(n){document.querySelectorAll(".tab").forEach(function(t){t.setAttribute("aria-selected",t.dataset.t==n?"true":"false")});document.querySelectorAll(".hero").forEach(function(h){h.hidden=h.dataset.hero!=n});try{localStorage.setItem("voice-tab",n)}catch(e){}}
document.querySelectorAll(".tab").forEach(function(t){t.addEventListener("click",function(){stop();showTab(t.dataset.t)})});
try{var st=localStorage.getItem("voice-tab");if(st!==null&&document.querySelector('.tab[data-t="'+st+'"]'))showTab(st)}catch(e){}
'''
tail=tail if "showTab" in tail else tail.replace("upd();",js+"upd();",1)
jsb='''
function selPlay(det){var c=det.querySelector("input:checked");return c?c.closest("li").querySelector(".play"):null}
function labelSel(det){var c=det.querySelector("input:checked"),s=det.querySelector(".sel");if(s)s.textContent=c?c.closest("li").querySelector(".tk").textContent.replace(/^Not chosen.*/,"other voice"):"no take chosen"}
document.querySelectorAll(".psel").forEach(function(b){b.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();var d=b.closest("details"),p=selPlay(d);if(p)p.click()})});
document.querySelectorAll("details.grp").forEach(labelSel);
document.addEventListener("change",function(e){if(e.target.type==="radio")labelSel(e.target.closest("details"))});
document.getElementById("exp").addEventListener("click",function(){document.querySelectorAll("details.grp").forEach(function(d){d.open=true})});
document.getElementById("col").addEventListener("click",function(){document.querySelectorAll("details.grp").forEach(function(d){d.open=false})});
'''
tail=tail if "selPlay" in tail else tail.replace("upd();",jsb+"upd();",1)

body=f'''<main>
<h1>Voice lines</h1>
<p class="sub">Prepared files, about −16 LUFS. Under each take: the exact text with tags you entered, voice, model and settings, read from your ElevenLabs history. Orange: longer than the limit (Attack and Hit 3.5 s, the rest 4 s). The checked take of each line is the one to keep.</p>
<div class="tabs" role="tablist">{tabs}</div>
<div class="bar"><button type="button" id="exp">Expand all</button><button type="button" id="col">Collapse all</button><button type="button" id="sum">Show my selection</button><button type="button" id="copy">Copy selection</button><span id="cnt" class="sub"></span></div>
<pre id="out" hidden></pre>
{out}</main>
'''
open("player.html","w").write(head+body+tail); print(len(head+body+tail)//1024,"KB", len(meta),"takes with history")
