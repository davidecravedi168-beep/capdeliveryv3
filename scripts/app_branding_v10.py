from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path(__file__).resolve().parents[1]; AS=ROOT/'assets'; AS.mkdir(exist_ok=True)
BG=(16,21,26); AMBER=(242,169,59); GREEN=(51,196,129); BLUE=(76,155,232); INK=(237,241,245)
def icon(size):
    im=Image.new('RGB',(size,size),BG); d=ImageDraw.Draw(im)
    w=max(4,int(size*.045)); r=size*.055
    pts=[(size*.25,size*.63),(size*.44,size*.45),(size*.61,size*.57),(size*.75,size*.34)]
    d.line(pts,fill=BLUE,width=w,joint='curve')
    for i,(x,y) in enumerate(pts):
        col=AMBER if i in (0,3) else GREEN
        d.ellipse((x-r,y-r,x+r,y+r),fill=col)
    # delivery box / route destination
    d.rounded_rectangle((size*.28,size*.25,size*.53,size*.48),radius=int(size*.04),outline=INK,width=max(3,int(size*.018)))
    d.line([(size*.405,size*.25),(size*.405,size*.48)],fill=INK,width=max(2,int(size*.012)))
    return im
for s in (180,192,512): icon(s).save(AS/f'cap-icon-{s}.png',optimize=True)
(ROOT/'manifest.webmanifest').write_text('''{
  "name":"CAP Delivery Control",
  "short_name":"CAP Delivery",
  "start_url":"./",
  "scope":"./",
  "display":"standalone",
  "background_color":"#10151A",
  "theme_color":"#10151A",
  "icons":[
    {"src":"assets/cap-icon-192.png","sizes":"192x192","type":"image/png","purpose":"any maskable"},
    {"src":"assets/cap-icon-512.png","sizes":"512x512","type":"image/png","purpose":"any maskable"}
  ]
}''',encoding='utf-8')
p=ROOT/'index.html'; s=p.read_text(encoding='utf-8')
links='''\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" type="image/png" sizes="192x192" href="assets/cap-icon-192.png">\n<link rel="apple-touch-icon" sizes="180x180" href="assets/cap-icon-180.png">\n<meta name="apple-mobile-web-app-title" content="CAP Delivery">'''
if 'cap-icon-180.png' not in s:s=s.replace('</title>','</title>'+links,1)
s=s.replace('<span class="mark"></span>','<img src="assets/cap-icon-192.png" alt="" width="44" height="44" style="border-radius:13px;display:block;margin:0 auto 10px">',1)
if '<div class="brand">CAP Delivery' in s and 'cap-brand-inline' not in s:
    s=s.replace('<div class="brand">CAP Delivery','<div class="brand" style="display:flex;align-items:center;gap:9px"><img id="cap-brand-inline" src="assets/cap-icon-192.png" alt="" width="34" height="34" style="border-radius:10px"><span>CAP Delivery',1).replace('</small></div><div class="who">','</small></span></div><div class="who">',1)
p.write_text(s,encoding='utf-8'); print('CAP branding ready')
