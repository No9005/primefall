import base64,os,subprocess,json,sys
M="../music2/"
def dur(p): return float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",p]))
def b64(p): return "data:audio/mpeg;base64,"+base64.b64encode(open(p,"rb").read()).decode()
MARKS=[["Intro",0],["Strophe 1",20],["Aufbau",60],["Refrain 1",73.3],["Strophe 2",100],["Refrain 2",126.7],["Bridge",153.3],["Finale",180],["Ende",220]]
items=[
 ("local","Whole piece, parts joined","Joined here: Stage 1 + Stage 2 + Stage 3 (3:53)",M+"local_stitch.mp3","I cut the three stages together myself (0:00 to 1:40 from stage 1, 1:40 to 3:00 from stage 2, 3:00 to the end from stage 3) with 150 ms crossfades at the two seams. Same material as the next piece, except that the last seconds before a seam are not blended.",MARKS),
 ("stage3","Whole piece, parts joined","Stage 3 as delivered (3:53): Stage 2 kept, then Finale and Ende",M+"stage3.mp3","The API kept the first 3:00 and generated Finale and Ende after it. Stage 1 and Stage 2 are the first 1:40 and 3:00 of this piece, kept unchanged.",MARKS),
 ("full","Older versions","Piece v1 (3:53, one call; lower quality copy)",M+"full_64.mp3","Tempo about 80 BPM, the Bridge was not quiet, the female voice too dominant, the German too precise, men missing in the choir.",None),
 ("refrain","Older versions","Refrain test (26.7 s): the one with the right feeling",M+"refrain1.mp3","Used as the sound reference for the staged version.",None),
 ("test10","Older versions","First test (10 s): heartbeat bass only (lower quality copy)",M+"test10_64.mp3","Everything audible is in the bass; discarded.",None),
]
data={}
groups=[]
for k,g,t,p,n,mk in items:
    data[k]=b64(p)
    if not groups or groups[-1]["g"]!=g: groups.append({"g":g,"i":[]})
    groups[-1]["i"].append({"k":k,"t":t,"d":round(dur(p),1),"n":n,"m":mk})
html='''<title>Notstrom Music</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#12161c;--panel:#1b222b;--steel:#3d5a73;--teal:#2ec4b6;--text:#dbe4ec;--muted:#8a99a8;--orange:#ff8a3d}
@media (prefers-color-scheme:light){:root:not([data-theme="dark"]){--bg:#eef1f4;--panel:#fff;--steel:#7d93a6;--teal:#13897e;--text:#18222c;--muted:#5a6a78;--orange:#c4561a}}
:root[data-theme="light"]{--bg:#eef1f4;--panel:#fff;--steel:#7d93a6;--teal:#13897e;--text:#18222c;--muted:#5a6a78;--orange:#c4561a}
body{background:var(--bg);color:var(--text);font:15px/1.45 Inter,system-ui,sans-serif;padding-inline:max(16px,env(safe-area-inset-left,0px)) max(16px,env(safe-area-inset-right,0px));padding-block:20px 40px;max-width:720px;margin:0 auto}
h1{font:600 22px "Space Grotesk",Inter,sans-serif;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 8px}
h2{font:600 12px Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:24px 0 8px}
.row{background:var(--panel);border:1px solid var(--steel);border-radius:10px;padding:10px 12px;margin-bottom:8px}
.top{display:flex;gap:12px;align-items:center}
button{font:inherit;color:#06201d;background:var(--teal);border:0;border-radius:50%;width:40px;height:40px;flex:none;cursor:pointer}
button:focus-visible{outline:3px solid var(--text);outline-offset:2px}
.tx{min-width:0;flex:1}.d{color:var(--muted);font-size:12px;font-variant-numeric:tabular-nums;white-space:nowrap}
.n{color:var(--muted);font-size:13px;margin:6px 0 0 52px}
button.mb{width:auto;height:32px;border-radius:8px;padding:0 10px;font-size:13px;background:var(--panel);color:var(--text);border:1px solid var(--steel)}
.mk{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 0}
input[type=range]{width:100%;margin:8px 0 0;accent-color:var(--teal)}
</style>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Space+Grotesk:wght@600&display=swap">
<h1>Notstrom: all music so far</h1>
<p class="sub">ElevenLabs Music v2.5. Newest first. The slider seeks, the buttons jump to the sections; one piece plays at a time.</p>
<div id="app"></div>
<script>
var G=__G__,A=__A__,cur=null,curBtn=null;
function f(s){s=Math.floor(s);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")}
var app=document.getElementById("app");
G.forEach(function(g){var h=document.createElement("h2");h.textContent=g.g;app.append(h);
 g.i.forEach(function(it){var r=document.createElement("div");r.className="row";
  var a=new Audio(A[it.k]);a.preload="metadata";
  var top=document.createElement("div");top.className="top";
  var b=document.createElement("button");b.type="button";b.textContent="\\u25B6";b.setAttribute("aria-label","Play "+it.t);
  var t=document.createElement("div");t.className="tx";t.textContent=it.t;
  var d=document.createElement("div");d.className="d";d.textContent="0:00 / "+f(it.d);
  var s=document.createElement("input");s.type="range";s.min=0;s.max=it.d;s.step=0.1;s.value=0;s.setAttribute("aria-label","Position");
  b.onclick=function(){if(cur===a&&!a.paused){a.pause();b.textContent="\\u25B6";return}
   if(cur&&cur!==a){cur.pause();curBtn.textContent="\\u25B6"}cur=a;curBtn=b;a.play();b.textContent="\\u275A\\u275A"};
  a.ontimeupdate=function(){s.value=a.currentTime;d.textContent=f(a.currentTime)+" / "+f(it.d)};
  a.onended=function(){b.textContent="\\u25B6"};
  s.oninput=function(){a.currentTime=+s.value};
  top.append(b,t,d);r.append(top,s);
  if(it.m){var mm=document.createElement("div");mm.className="mk";it.m.forEach(function(m){var q=document.createElement("button");q.type="button";q.className="mb";q.textContent=m[0];q.onclick=function(){if(cur&&cur!==a){cur.pause();curBtn.textContent="\\u25B6"}cur=a;curBtn=b;a.currentTime=m[1];a.play();b.textContent="\\u275A\\u275A"};mm.append(q)});r.append(mm)}
  if(it.n){var n=document.createElement("div");n.className="n";n.textContent=it.n;r.append(n)}
  app.append(r)})});
</script>'''.replace("__G__",json.dumps(groups)).replace("__A__",json.dumps(data))
open("music_all.html","w").write(html); print(len(html)//1024,"KB",[g["g"] for g in groups])
