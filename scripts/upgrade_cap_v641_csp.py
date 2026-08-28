from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s
csp="default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.sheetjs.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://cap-backend.davidecravedi168-beep.deno.net; object-src 'none'; base-uri 'none'; form-action 'self'; upgrade-insecure-requests"
meta=f'<meta http-equiv="Content-Security-Policy" content="{csp}">'
if meta not in s:
    s=s.replace('<meta name="referrer" content="no-referrer">','<meta name="referrer" content="no-referrer">\n'+meta,1)
if 'https://fonts.googleapis.com' in s or 'https://fonts.gstatic.com' in s:raise SystemExit('external font source remains')
if s!=orig:p.write_text(s,encoding='utf-8');print('CAP browser CSP added')
else:print('CAP browser CSP already present')
