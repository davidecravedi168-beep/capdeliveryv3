from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s
if 'cap-ops-layer.css' not in s:
    if '</head>' not in s: raise SystemExit('missing </head>')
    s=s.replace('</head>','<link rel="stylesheet" href="cap-ops-layer.css">\n</head>',1)
if 'cap-tp-route-layer.css' not in s:
    if '</head>' not in s: raise SystemExit('missing </head> for TP css')
    s=s.replace('</head>','<link rel="stylesheet" href="cap-tp-route-layer.css">\n</head>',1)
if 'cap-ops-core.js' not in s:
    if '</body>' not in s: raise SystemExit('missing </body>')
    s=s.replace('</body>','<script src="cap-ops-core.js"></script>\n<script src="cap-ops-layer.js"></script>\n</body>',1)
if 'cap-tp-route-layer.js' not in s:
    if '</body>' not in s: raise SystemExit('missing </body> for TP js')
    s=s.replace('</body>','<script src="cap-tp-route-layer.js"></script>\n</body>',1)
if "const APP_VERSION='Final Production 5.0';" in s:
    s=s.replace("const APP_VERSION='Final Production 5.0';","const APP_VERSION='CAP Delivery 6.1 · Esselunga TP Control';",1)
elif "const APP_VERSION='CAP Delivery 6.0 · Operations Intelligence';" in s:
    s=s.replace("const APP_VERSION='CAP Delivery 6.0 · Operations Intelligence';","const APP_VERSION='CAP Delivery 6.1 · Esselunga TP Control';",1)
elif "const APP_VERSION='CAP Delivery 6." not in s:
    raise SystemExit('APP_VERSION contract changed: guarded migration stopped')
if s==orig:
    print('CAP V6.1 base patch already satisfied by newer version')
else:
    p.write_text(s,encoding='utf-8')
    print('CAP V6.1 base patch applied')
for marker in ['cap-ops-layer.css','cap-ops-core.js','cap-ops-layer.js','cap-tp-route-layer.css','cap-tp-route-layer.js']:
    if marker not in s: raise SystemExit(f'missing marker: {marker}')
if "const APP_VERSION='CAP Delivery 6." not in s: raise SystemExit('missing CAP 6.x version marker')
