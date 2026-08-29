from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]; AS=ROOT/'assets'; AS.mkdir(exist_ok=True)
BG=(5,11,19); TEAL=(50,212,195); CYAN=(80,180,220); INK=(235,240,244); GOLD=(228,184,82)
def icon(size):
    im=Image.new('RGB',(size,size),BG); d=ImageDraw.Draw(im); o=max(2,int(size*.012)); pad=int(size*.08)
    d.rounded_rectangle((pad,pad,size-pad,size-pad),radius=int(size*.18),outline=(36,91,91),width=o)
    w=max(4,int(size*.032))
    # route
    pts=[(size*.30,size*.62),(size*.48,size*.62),(size*.62,size*.45),(size*.73,size*.53)]
    d.line(pts,fill=TEAL,width=w,joint='curve')
    for x,y in (pts[0],pts[-1]): d.ellipse((x-size*.035,y-size*.035,x+size*.035,y+size*.035),outline=INK,width=max(3,int(size*.018)))
    # pin
    d.ellipse((size*.61,size*.20,size*.74,size*.33),outline=GOLD,width=max(3,int(size*.02)))
    d.polygon([(size*.675,size*.37),(size*.61,size*.28),(size*.74,size*.28)],fill=GOLD)
    # van
    d.rounded_rectangle((size*.24,size*.42,size*.48,size*.57),radius=int(size*.025),outline=INK,width=max(3,int(size*.018)))
    d.polygon([(size*.48,size*.47),(size*.56,size*.47),(size*.61,size*.57),(size*.48,size*.57)],outline=INK)
    d.ellipse((size*.29,size*.54,size*.35,size*.60),fill=INK); d.ellipse((size*.50,size*.54,size*.56,size*.60),fill=INK)
    return im
for s in (180,192,512): icon(s).save(AS/f'cap-icon-{s}.png',optimize=True)
(ROOT/'manifest.webmanifest').write_text('''{\n  "name":"CAP Delivery Control",\n  "short_name":"CAP Delivery",\n  "start_url":"./",\n  "scope":"./",\n  "display":"standalone",\n  "background_color":"#050b13",\n  "theme_color":"#050b13",\n  "icons":[\n    {"src":"assets/cap-icon-192.png","sizes":"192x192","type":"image/png","purpose":"any maskable"},\n    {"src":"assets/cap-icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}\n  ]\n}''',encoding='utf-8')
p=ROOT/'index.html'; s=p.read_text(encoding='utf-8')
links='''\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="192x192" href="assets/cap-icon-192.png">\n<link rel="apple-touch-icon" sizes="180x180" href="assets/cap-icon-180.png">\n<meta name="apple-mobile-web-app-title" content="CAP Delivery">'''
if 'cap-icon-180.png' not in s:s=s.replace('</title>','</title>'+links,1)
s=s.replace('<span class="mark"></span>','<img src="assets/cap-icon-192.png" alt="" width="44" height="44" style="border-radius:13px;display:block;margin:0 auto 10px">',1)
if '<div class="brand">CAP Delivery' in s and 'cap-brand-inline' not in s:
    s=s.replace('<div class="brand">CAP Delivery','<div class="brand" style="display:flex;align-items:center;gap:9px"><img id="cap-brand-inline" src="assets/cap-icon-192.png" alt="" width="34" height="34" style="border-radius:10px"><span>CAP Delivery',1).replace('</small></div><div class="who">','</small></span></div><div class="who">',1)
p.write_text(s,encoding='utf-8'); print('CAP premium branding ready')