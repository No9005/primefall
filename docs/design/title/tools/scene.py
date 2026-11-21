import numpy as np, math, random
from PIL import Image, ImageDraw
from scipy.ndimage import gaussian_filter, shift as ndshift, binary_erosion, binary_dilation
W,H=640,296
YS,XS=np.mgrid[0:H,0:W]
BAYER=np.array([[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]])/16.0
DITH=BAYER[YS%4,XS%4]
def vnoise(cells,seed,w=W,h=H):
    rng=np.random.default_rng(seed); gx,gy=int(cells*w/h)+3,cells+3; g=rng.random((gy,gx))
    ys,xs=np.mgrid[0:h,0:w]; fx=xs/w*(gx-3); fy=ys/h*(gy-3); x0=fx.astype(int); y0=fy.astype(int); tx=fx-x0; ty=fy-y0
    tx=tx*tx*(3-2*tx); ty=ty*ty*(3-2*ty)
    a=g[y0,x0]*(1-tx)+g[y0,x0+1]*tx; b=g[y0+1,x0]*(1-tx)+g[y0+1,x0+1]*tx; return a*(1-ty)+b*ty
def fbm(seed,cells=(3,6,12,24),weights=(.4,.3,.2,.1)): return sum(w*vnoise(c,seed+i) for i,(c,w) in enumerate(zip(cells,weights)))
def ramp(v,colors,soft=0.0):
    n=len(colors)-1; x=np.clip(v,0,1)*n; i=np.floor(x).astype(int); f=x-i
    e=np.clip((f-.5)/max(soft,1e-3)+.5,0,1) if soft>0 else (f>0.999).astype(float)
    return np.array(colors,float)[np.clip(i+(e>DITH),0,n)]
def rgb(h): return np.array([int(h[i:i+2],16) for i in (1,3,5)],float)
def sky(seed=1):
    arr=np.zeros((H,W,3)); arr[...]=rgb('#04060f'); arr+=(YS/H)[...,None]*np.array((2,3,7))
    r=random.Random(seed)
    for _ in range(150):
        x,y=r.randrange(W),r.randrange(H); arr[y,x]=r.choice([rgb('#46506f'),rgb('#6a7494'),rgb('#2c3450'),rgb('#8892b4')])
    for _ in range(9):
        x,y=r.randrange(8,W-8),r.randrange(6,H//2); arr[y,x]=rgb('#c8d6f4')
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]: arr[y+dy,x+dx]=rgb('#3a4a78')
        arr[y,x+2]=arr[y,x-2]=rgb('#2c3858')
    return arr
SUN=np.array((-0.75,-0.55)); SUN=SUN/np.linalg.norm(SUN)
def shade_from_height(hm,strength=6.0):
    gy,gx=np.gradient(gaussian_filter(hm,0.6)); return np.clip(0.5+(-(gx*SUN[0]+gy*SUN[1]))*strength,0,1)
def planet(arr,hy=140,R=470,cx=None,seed=3,atmo=60,lit=1.0,horizon_tilt=0.0):
    cx=W*0.5 if cx is None else cx; cy=hy+R
    arc=cy-np.sqrt(np.maximum(R*R-(XS-cx)**2,0))+horizon_tilt*(XS-cx); d=arc-YS; below=-d
    # the lit side: the sun is up and to the left, so the limb is bright on the left and falls into night on the right
    side=np.clip(1.0-(XS-W*0.0)/(W*1.15),0,1)**1.1*lit
    # atmosphere above the limb: stepped bands, airglow on the lit side
    ATM=[rgb(h) for h in ('#7fa6dc','#5d84c0','#436aa4','#32528a','#243e6e','#192d54','#102040','#0b1630','#070e22','#050a18')]
    t=np.clip(d/atmo,0,1); band=np.floor(t*(len(ATM)-1)).astype(int); atmo_col=np.array(ATM)[np.clip(band,0,len(ATM)-1)]
    atmo_col=atmo_col*(0.18+0.62*side[...,None])
    above=(d>=0)&(d<atmo); arr=np.where(above[...,None],atmo_col*(1-t[...,None]*0.0)+arr*0.0,arr)
    # ground: height field -> land/ocean, relief shading
    hm=fbm(seed,(3,6,12,24,48),(.42,.28,.16,.09,.05)); sea=0.50
    land=hm>sea; relief=shade_from_height(hm,22.0)
    ocean_c=[rgb(h) for h in ('#05101e','#071a2e','#0a2540','#103358')]
    land_c=[rgb(h) for h in ('#0d1a1c','#15262a','#1f3638','#2e4a48','#43625c')]
    depth=np.clip((sea-hm)/0.25,0,1)
    oc=ramp(0.25+0.45*(1-depth)+0.3*side,ocean_c,0.0)
    ln=ramp(0.12+0.5*relief+0.30*side*(0.5+0.5*(hm-sea)*3),land_c,0.0)
    col=np.where(land[...,None],ln,oc)
    shore=land&~binary_erosion(land,iterations=1); col=np.where(shore[...,None],rgb('#4b6a68')*(0.35+0.65*side[...,None]),col)
    shal=(~land)&binary_dilation(land,iterations=2); col=np.where(shal[...,None],col*0.5+rgb('#1c5a70')*0.5*(0.4+0.6*side[...,None]),col)
    # cloud decks: cel-shaded, lit edge toward the sun, cast shadow on the ground
    from scipy.ndimage import zoom as _zoom
    small=sum(w*vnoise(c,seed+40+i,w=W//4,h=H) for i,(c,w) in enumerate(zip((5,10,20,40),(.45,.3,.15,.1))))
    cm=_zoom(small,(H/small.shape[0],W/small.shape[1]),order=1)[:H,:W]; cloud=cm>0.545
    cloud_sh=ndshift(cloud.astype(float),(5,6),order=0)>0.5
    col=np.where((cloud_sh&~cloud)[...,None],col*0.45,col)
    inner=binary_erosion(cloud,iterations=2); lit_edge=cloud&~ndshift(cloud.astype(float),(-2,-2),order=0).astype(bool)|(cloud&~ndshift(cloud.astype(float),(0,-2),order=0).astype(bool))
    dark_edge=cloud&~ndshift(cloud.astype(float),(2,2),order=0).astype(bool)
    cc=np.where(cloud[...,None],rgb('#3c4966'),col)
    cc=np.where((cloud&~inner)[...,None],rgb('#55688c'),cc)
    cc=np.where((dark_edge)[...,None],rgb('#26304a'),cc)
    cc=np.where(lit_edge[...,None],rgb('#8da0c0'),cc)
    col=np.where(cloud[...,None],cc*(0.35+0.7*side[...,None]),col)
    # fall off toward the bottom and the right: the night side
    col=col*(0.25+0.75*np.clip(side*1.3+0.2,0,1))[...,None]*(1-0.45*np.clip((below-30)/200,0,1))[...,None]
    # rim light
    rim=np.clip(1-below/14,0,1)[...,None]*(0.35+0.9*side[...,None]); col=col+rim*np.array((70,100,150))
    arr=np.where((below>=0)[...,None],col,arr)
    arr=np.where(((below>=0)&(below<1.6))[...,None],rgb('#a8c6f0')*(0.4+0.6*side[...,None]),arr)
    return arr,arc
def lerp(a,b,t): return a+(b-a)*t
def glow_add(arr,mask,color,sigma,gain,steps=6):
    """Stepped bloom: blur a light mask, posterise it, add it (the way the game's light pools are stepped)."""
    g=gaussian_filter(mask.astype(float),sigma); g=g/(g.max()+1e-6) if g.max()>0 else g
    g=np.floor(np.clip(g*gain,0,1)*steps)/steps
    return arr+g[...,None]*np.array(color,float)
def to_img(arr): return Image.fromarray(np.clip(arr,0,255).astype('uint8'),'RGB')
def finish(img,colors=96):
    q=img.quantize(colors=colors,method=Image.Quantize.MEDIANCUT,dither=Image.Dither.NONE); return q.convert('RGB')
def tongues(img,head,direction,length,width,seed,layers=4,wob=0.35,hot=1.0):
    """Layered, ragged flame: outer red, orange, yellow, white core, each a polygon with a noisy edge, drawn into `img`."""
    d=ImageDraw.Draw(img); r=random.Random(seed); hx,hy=head; L=math.hypot(*direction); dx,dy=direction[0]/L,direction[1]/L; px,py=-dy,dx
    cols=[(150,40,18),(232,92,26),(255,172,56),(255,238,176)][:layers]; cols=cols if layers==4 else cols
    N=int(length/3)
    for li,(col,scale) in enumerate(zip(cols,(1.0,0.74,0.50,0.26))):
        top=[];bot=[]; ph=r.random()*6
        for i in range(N+1):
            t=i/N; u=t*length*(0.55+0.45*scale)
            w=width*scale*(1-t)**0.8*(1+wob*(0.6+0.4*scale)*math.sin(t*(9+li*3)+ph)*(1-t*0.4)+0.12*(r.random()-0.5))
            top.append((hx+dx*u+px*w,hy+dy*u+py*w)); bot.append((hx+dx*u-px*w,hy+dy*u-py*w))
        d.polygon(top+bot[::-1],fill=col)
    # licking tongues off the edge
    for _ in range(int(width*0.9)):
        t=r.random()**1.5; u=t*length*0.9; side=1 if r.random()<.5 else -1; w=width*(1-t)**0.75
        x0=hx+dx*u+px*w*side*0.8; y0=hy+dy*u+py*w*side*0.8; l=r.uniform(6,16)*(1-t*0.5)
        d.line([(x0,y0),(x0+dx*l+px*side*r.uniform(1,4),y0+dy*l+py*side*r.uniform(1,4))],fill=r.choice(cols[:3]),width=1)
    return img
def sparks(img,head,direction,length,count,seed,spread):
    d=ImageDraw.Draw(img); r=random.Random(seed); hx,hy=head; L=math.hypot(*direction); dx,dy=direction[0]/L,direction[1]/L
    for _ in range(count):
        u=r.random()**1.3*length; v=(r.random()-.5)*spread*(0.3+u/length*0.9); x=hx+dx*u-dy*v; y=hy+dy*u+dx*v
        d.point((x,y),fill=r.choice([(255,236,170),(255,168,52),(226,84,24),(255,255,255)]))
        if r.random()<0.25: d.point((x+dx,y+dy),fill=(226,84,24))
    return img
def shockarc(img,nose,angle,radius,spread=62):
    """The bright plasma sheath in front of a falling body: a thin arc, white inside, orange outside."""
    d=ImageDraw.Draw(img); a=math.radians(angle)
    for k,(col,rr) in enumerate([((226,84,24),radius+3),((255,168,52),radius+1),((255,244,200),radius)]):
        pts=[]
        for s in range(-spread,spread+1,3):
            t=math.radians(s); ang=a+t; pts.append((nose[0]+math.cos(ang)*rr-math.cos(a)*radius*0.2*0,nose[1]+math.sin(ang)*rr))
        d.line(pts,fill=col,width=1)
    return img
def crystal(img,cx,cy,angle,size,burn=True):
    d=ImageDraw.Draw(img); a=math.radians(angle); ca,sa=math.cos(a),math.sin(a)
    def P(x,y): return (cx+(x*ca-y*sa)*size, cy+(x*sa+y*ca)*size)
    pts={'tip':(1.0,0.0),'a':(0.46,-0.30),'b':(0.50,0.02),'c':(0.42,0.34),'d':(-0.30,-0.40),'e':(-0.34,0.0),'f':(-0.38,0.44),'g':(-0.78,-0.22),'h':(-0.84,0.10),'i':(-0.70,0.34),'t':(-1.05,-0.04)}
    Q={k:P(*v) for k,v in pts.items()}
    def poly(keys,col): d.polygon([Q[k] for k in keys],fill=col)
    # body: five faces, light from the upper left
    poly('a d e b'.split(),(214,244,255)); poly('b e f c'.split(),(112,172,226)); poly('d g h e'.split(),(168,222,248)); poly('e h i f'.split(),(58,104,176))
    poly('g t h'.split(),(124,184,232)); poly('h t i'.split(),(40,78,148)); poly('tip a b'.split(),(246,252,255)); poly('tip b c'.split(),(130,186,230))
    # inner light: veins and stars
    for p0,p1 in [((0.2,-0.12),(-0.55,-0.02)),((0.05,0.14),(-0.42,0.22)),((0.30,-0.22),(-0.1,-0.30)),((-0.1,0.02),(-0.6,0.12))]: d.line([P(*p0),P(*p1)],fill=(255,255,255))
    for sx,sy in [(0.2,-0.12),(-0.3,0.18),(-0.5,-0.05)]:
        x,y=P(sx,sy); d.point((x,y),fill=(255,255,255)); d.point((x+1,y),fill=(180,230,255)); d.point((x-1,y),fill=(180,230,255)); d.point((x,y+1),fill=(180,230,255)); d.point((x,y-1),fill=(180,230,255))
    # ridges and the outline (dark, selective)
    for k0,k1 in [('a','d'),('b','e'),('c','f'),('d','g'),('e','h'),('f','i')]: d.line([Q[k0],Q[k1]],fill=(30,52,110))
    for ks in ['tip a d g t i f c tip'.split()]:
        pass
    for k0,k1 in [('tip','a'),('a','d'),('d','g'),('g','t'),('t','i'),('i','f'),('f','c'),('c','tip')]: d.line([Q[k0],Q[k1]],fill=(8,12,34))
    if burn:  # the nose burns, the lit edges glow orange
        poly('tip a b'.split(),(255,206,120)); 
        d.polygon([Q['tip'],P(0.72,-0.14),P(0.72,0.14)],fill=(255,244,200))
        for k0,k1 in [('tip','a'),('tip','c')]: d.line([Q[k0],Q[k1]],fill=(255,150,40))
        d.line([Q['c'],Q['f']],fill=(255,120,30)); d.line([Q['a'],Q['d']],fill=(255,170,60))
    return img
def chips(img,cx,cy,direction,count,seed,size):
    d=ImageDraw.Draw(img); r=random.Random(seed); L=math.hypot(*direction); dx,dy=direction[0]/L,direction[1]/L
    for _ in range(count):
        u=r.uniform(0.4,1.6)*size*1.6; v=(r.random()-.5)*size*1.4; x=cx+dx*u-dy*v; y=cy+dy*u+dx*v; s=r.uniform(1.5,3.2)
        d.polygon([(x,y-s),(x+s*0.6,y),(x,y+s*1.1),(x-s*0.6,y)],fill=(170,226,250)); d.point((x,y-s),fill=(255,255,255))
        l=r.uniform(6,14); d.line([(x,y),(x+dx*l,y+dy*l)],fill=(226,84,24)); d.line([(x,y),(x+dx*l*0.5,y+dy*l*0.5)],fill=(255,200,100))
