from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s

if 'cap-office-bridge.css' not in s:
    if '</head>' not in s: raise SystemExit('missing </head>')
    s=s.replace('</head>','<link rel="stylesheet" href="cap-office-bridge.css">\n</head>',1)

scripts='<script src="cap-office-core.js"></script>\n<script src="cap-office-bridge.js"></script>\n'
if 'cap-office-bridge.js' not in s:
    if '</body>' not in s: raise SystemExit('missing </body>')
    s=s.replace('</body>',scripts+'</body>',1)

s=s.replace("const APP_VERSION='CAP Delivery 6.1 · Esselunga TP Control';","const APP_VERSION='CAP Delivery 6.2 · Office Bridge + Esselunga TP';")
if "CAP Delivery 6.2 · Office Bridge + Esselunga TP" not in s:
    raise SystemExit('APP_VERSION anchor changed')

old="""toast(`Import completato: ${created} nuovi, ${updated} aggiornati`);
   input.value='';await refresh();await admin();"""
new="""toast(`Import completato: ${created} nuovi, ${updated} aggiornati`);
   try{if(typeof window.capOfficeMarkSource==='function')await window.capOfficeMarkSource('planning_excel','RECEIVED',`Import Excel: ${names[entity]} · ${processed} record`)}catch(_e){}
   input.value='';await refresh();await admin();"""
if old in s:
    s=s.replace(old,new,1)
elif "window.capOfficeMarkSource('planning_excel'" not in s:
    raise SystemExit('Excel import success anchor changed')

for marker in ['cap-office-bridge.css','cap-office-core.js','cap-office-bridge.js',"CAP Delivery 6.2 · Office Bridge + Esselunga TP","window.capOfficeMarkSource('planning_excel'"]:
    if marker not in s: raise SystemExit('missing marker: '+marker)

if s!=orig:
    p.write_text(s,encoding='utf-8')
    print('CAP Delivery 6.2 Office Bridge patch applied')
else:
    print('CAP Delivery 6.2 Office Bridge patch already applied')
