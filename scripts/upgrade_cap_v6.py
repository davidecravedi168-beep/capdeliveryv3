from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s
if 'cap-ops-layer.css' not in s:
    if '</head>' not in s: raise SystemExit('missing </head>')
    s=s.replace('</head>','<link rel="stylesheet" href="cap-ops-layer.css">\n</head>',1)
if 'cap-ops-core.js' not in s:
    if '</body>' not in s: raise SystemExit('missing </body>')
    s=s.replace('</body>','<script src="cap-ops-core.js"></script>\n<script src="cap-ops-layer.js"></script>\n</body>',1)
s=s.replace("const APP_VERSION='Final Production 5.0';","const APP_VERSION='CAP Delivery 6.0 · Operations Intelligence';")
if s==orig:
    print('CAP V6 patch already applied')
else:
    p.write_text(s,encoding='utf-8')
    print('CAP V6 patch applied')
# fail-closed contract checks
for marker in ['cap-ops-layer.css','cap-ops-core.js','cap-ops-layer.js','CAP Delivery 6.0 · Operations Intelligence']:
    if marker not in s: raise SystemExit(f'missing marker: {marker}')
