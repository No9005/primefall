import numpy as np,base64,wave,json,io
sr=44100
V='/home/user/primefall/apps/web/public/assets/audio/'
def wavb(x,gain):
    pcm=(np.clip(x*gain,-1,1)*32767).astype('<i2');b=io.BytesIO();w=wave.open(b,'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr);w.writeframes(pcm.tobytes());w.close();return b.getvalue()
b64=lambda b:base64.b64encode(b).decode()
data={'jingle':{},'loop':{},'voice':{}};texts={}
for n in ('victory','defeat'):
    data['jingle'][n]=b64(open('../inpaint/jingle-%s.mp3'%n,'rb').read())
    for var,f,g in (('pad19','pad19_%s.npy',1.33),('direct','direct_%s.npy',1.0)):
        data['loop'][n+':'+var]=b64(wavb(np.load(f%n).astype(np.float64),g))   # all about 9 dB under the loud part of the jingle
data['loop']['defeat:eleven']=b64(wavb(np.load('defeat_loop_final.npy').astype(np.float64),1.0))
data['loop']['victory:eleven']=b64(wavb(np.load('calm_victory_ola250.npy').astype(np.float64),1.0))
for h in ('max','tilly','kit'):
    m=json.load(open(V+h+'/manifest.json'))
    for kind,ids in (('victory',[1,2,3]),('defeat',[1,2])):
        for i in ids:
            k='%s-%d'%(kind,i);data['voice']['%s:%s'%(h,k)]=b64(open(V+h+'/voice/%s.mp3'%k,'rb').read());texts['%s:%s'%(h,k)]=m['assets']['voice.'+k]['text']
tpl=open('../parts-tpl.html').read()
head=tpl.split('</style>')[0].replace('<title>Refrain Vergleich</title>','<title>Ende-Musik Abnahme</title>')+'''
.opt{display:grid;gap:6px}.opt .lab{font-weight:600;font-size:14px}.chips{display:flex;flex-wrap:wrap;gap:6px}
.mark{position:absolute;top:0;bottom:0;width:2px;background:var(--ok)}.mark2{position:absolute;top:0;bottom:0;width:2px;background:var(--mut)}
.bar{height:28px}.row label{font-size:14px}
</style>'''
body=open('page_body.html').read()
html=head+body.replace('__DATA__',json.dumps(data)).replace('__TXT__',json.dumps(texts,ensure_ascii=False))
open('../end-music.html','w').write(html);print(len(html)/1e6)
