"""The pictures of the title screen (apps/web/public/assets/title/), drawn from numbers: `python3 make_title.py [output folder]`.

Needs Pillow, NumPy and SciPy. The folder defaults to the one of the app. Everything is drawn at 640 x 296 pixels, the size of the
picture before it is scaled to the screen; the random parts have fixed seeds, so a run gives the same files again.
See ../README.md for what each file is and where to change it.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "apps", "web", "public", "assets", "title")
OUT = os.path.join(OUT, "")
os.makedirs(OUT, exist_ok=True)
from scene import *
import pf
from pf import G, width as fw
import numpy as np, random, math
from scipy.ndimage import binary_dilation
def rgba_from_black(arr):  # opaque where not pure black
    a=np.array(arr,float); alpha=(np.abs(a).sum(-1)>0)*255
    return Image.fromarray(np.dstack([np.clip(a,0,255),alpha]).astype('uint8'),'RGBA')
def glyph_mask(text,scale,gap=1):
    cols=sum(len(G[c][0])+gap for c in text)-gap; m=np.zeros((7*scale,cols*scale),bool); x=0
    for c in text:
        g=G[c]
        for r,row in enumerate(g):
            for k,ch in enumerate(row):
                if ch=='1': m[r*scale:(r+1)*scale,(x+k)*scale:(x+k+1)*scale]=True
        x+=len(g[0])+gap
    return m
def chunky(arr,m,x,y,scale,depth=5):
    h,w=m.shape; big=np.zeros((H,W),bool); big[y:y+h,x:x+w]=m
    for d in range(depth,0,-1):
        sh=np.zeros_like(big); sh[d:,d:]=big[:H-d,:W-d]; t=d/depth; arr[sh&~big]=np.array((226,84,24))*(1-t)+np.array((120,28,22))*t
    allm=big.copy()
    for d in range(1,depth+1):
        sh=np.zeros_like(big); sh[d:,d:]=big[:H-d,:W-d]; allm|=sh
    arr[binary_dilation(allm,iterations=1)&~allm]=(14,10,28)
    ys,xs=np.nonzero(big)
    for yy,xx in zip(ys,xs):
        t=(yy-y)/h; col=np.array((248,252,255))*(1-t)+np.array((120,200,240))*t
        if not big[yy-1,xx] or not big[yy,xx-1]: col=np.array((255,255,255))
        elif (yy-y)%(scale*3)==scale*3-1: col=col*0.86
        arr[yy,xx]=col
# 1 background: sky + planet (opaque)
a=sky(1); a,arc=planet(a,hy=262,R=600,seed=5,atmo=70,lit=0.85); finish(to_img(a),120).save(OUT+'background.png')
# 2 bright stars that blink
r=random.Random(5); tw=Image.new('RGBA',(W,H),(0,0,0,0)); td=ImageDraw.Draw(tw)
for _ in range(16):
    x,y=r.randrange(10,W-10),r.randrange(6,170); td.point((x,y),fill=(255,255,255,255))
    for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]: td.point((x+dx,y+dy),fill=(120,160,255,255))
tw.save(OUT+'stars.png')
# 4 logo: letters and the crystal on transparent
arr=np.zeros((H,W,3)); s=6; left=glyph_mask("PRIMEF",s,1); right=glyph_mask("LL",s,1)
cw=44; gap=6; total=left.shape[1]+gap+cw+gap+right.shape[1]; x0=(W-total)//2; y0=54
chunky(arr,left,x0,y0,s,6); chunky(arr,right,x0+left.shape[1]+gap+cw+gap,y0,s,6)
logo=rgba_from_black(arr); d=ImageDraw.Draw(logo)
cx=x0+left.shape[1]+gap+cw//2; top=y0-14; mid=y0+16; bot=y0+7*s+10; cwh=cw//2
d.polygon([(cx,top),(cx-cwh,mid),(cx,bot)],fill=(150,215,240)); d.polygon([(cx,top),(cx+cwh,mid),(cx,bot)],fill=(70,120,200))
d.polygon([(cx,top),(cx-cwh,mid),(cx,mid)],fill=(232,250,255)); d.polygon([(cx,mid),(cx+cwh,mid),(cx,bot)],fill=(46,82,170))
d.line([(cx,top),(cx,bot)],fill=(240,252,255)); d.line([(cx-cwh,mid),(cx+cwh,mid)],fill=(255,255,255))
for p,q in [((cx,top),(cx-cwh,mid)),((cx-cwh,mid),(cx,bot)),((cx,top),(cx+cwh,mid)),((cx+cwh,mid),(cx,bot))]: d.line([p,q],fill=(14,10,28))
logo.save(OUT+'logo.png')
print('crystal',cx,top,bot,'logo y',y0,y0+7*s)
# 5 haze behind the crystal (screen blend)
yy,xx=np.mgrid[0:H,0:W]; m=np.exp(-(((xx-cx)**2)/(2*30**2)+((yy-(y0+20))**2)/(2*44**2)))
g=np.floor(np.clip(m,0,1)*10)/10; hz=np.dstack([g*90,g*120,g*230]); Image.fromarray(hz.astype('uint8'),'RGB').save(OUT+'haze.png')
# 6 ribbon, claim
rib=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(rib); rb="A TOTALLY LEGAL SALVAGE OPERATION"; rw=fw(rb,1)+24; rx=(W-rw)//2; ry=y0-40
d.polygon([(rx,ry),(rx+rw,ry),(rx+rw+8,ry+7),(rx+rw,ry+14),(rx,ry+14),(rx-8,ry+7)],fill=(190,30,40),outline=(14,10,28)); pf.text(d,(W-fw(rb,1))//2,ry+4,rb,(255,244,220),1)
c="EVERY PRIME IS A CONTRACT"; pf.text(d,(W-fw(c,1))//2,y0+7*s+18,c,(170,185,225),1)
rib.save(OUT+'tagline.png')
# the two small lines at the foot are pictures of their own: the screen puts them in its corners, whatever its shape
for name,line in (('legal',"BY PLAYING YOU AGREE TO FORM 27B"),('version',"VERSION 0.4 (PRIME)")):
    small=Image.new('RGBA',(fw(line,1)+2,9),(0,0,0,0)); pf.text(ImageDraw.Draw(small),1,1,line,(90,220,120),1); small.save(OUT+name+'.png')

# 8 the fireball and its burst
# the fireball: a burning crystal falling down-left; its flame trails up and to the right
sp=Image.new('RGBA',(150,90),(0,0,0,0)); head=(22,68)
tongues(sp,head,(0.83,-0.5),118,8,5,layers=4,wob=0.3); sparks(sp,head,(0.83,-0.5),100,26,6,10)
d=ImageDraw.Draw(sp)
d.polygon([(head[0]-6,head[1]+1),(head[0],head[1]-6),(head[0]+6,head[1]),(head[0],head[1]+7)],fill=(176,226,250))
d.polygon([(head[0],head[1]-1),(head[0]+6,head[1]),(head[0],head[1]+7)],fill=(86,140,206)); d.line([(head[0]-6,head[1]+1),(head[0],head[1]-6),(head[0]+6,head[1])],fill=(255,255,255))
d.point((head[0]-8,head[1]+3),fill=(255,244,200)); d.point((head[0]-3,head[1]+9),fill=(255,170,60))
sp.save(OUT+'fireball.png')
# the impact: a flat bright burst on the atmosphere
im=Image.new('RGBA',(80,44),(0,0,0,0)); d=ImageDraw.Draw(im)
for r,col in [(34,(120,50,24,160)),(26,(220,96,30,220)),(17,(255,170,60,255)),(9,(255,244,200,255))]: d.ellipse([40-r,22-r*0.5,40+r,22+r*0.5],fill=col)
import random; r=random.Random(3)
for _ in range(14):
    a=r.uniform(-3.14,0); l=r.uniform(14,30); d.line([(40,22),(40+math.cos(a)*l,22+math.sin(a)*l*0.8)],fill=(255,200,100,255))
im.save(OUT+'impact.png'); print('ok')

# 7 the menu rows: plain light text, and the red pill with white text for the highlighted row; the first row is the big one
MENU=[("classic","CLASSIC",3),("attack-and-defend","ATTACK AND DEFEND",2),("glossary","GLOSSARY",2),("resume","RESUME MATCH",2)]
for i,(name,label,sc) in enumerate(MENU):
    tw_=fw(label,sc); bw=max(124,tw_+40) if i==0 else tw_+40; bh=30 if sc==3 else 22; BH=40 if sc==3 else 28
    for state in ('off','on'):
        im=Image.new('RGBA',(300,BH),(0,0,0,0)); d=ImageDraw.Draw(im); bx=(300-bw)//2; by=(BH-bh)//2
        if state=='on':
            d.rounded_rectangle([bx-3,by-3,bx+bw+3,by+bh+3],radius=8,fill=(255,60,30)); d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=6,fill=(150,16,18))
            for k in range(bh//2): d.line([(bx+3,by+3+k),(bx+bw-3,by+3+k)],fill=(int(220-k*3),int(40-k),26))
            pf.text(d,(300-tw_)//2,by+(bh-7*sc)//2,label,(255,255,255),sc,shadow=(60,6,8))
        else:
            pf.text(d,(300-tw_)//2,by+(bh-7*sc)//2,label,(196,204,228),sc,shadow=(14,10,28))
        im.save(OUT+f'menu-{name}-{state}.png')
print('done')
