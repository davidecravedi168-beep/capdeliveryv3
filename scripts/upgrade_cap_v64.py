from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s

s=s.replace("const APP_VERSION='CAP Delivery 6.3 · Enterprise TP Control';","const APP_VERSION='CAP Delivery 6.4 · Transit Point Operating System';")

css_anchor='<link rel="stylesheet" href="cap-enterprise-layer.css">'
css_add='''<link rel="stylesheet" href="cap-enterprise-layer.css">\n<link rel="stylesheet" href="cap-planning-horizon.css">'''
if 'cap-planning-horizon.css' not in s:
    if css_anchor not in s: raise SystemExit('missing CSS anchor')
    s=s.replace(css_anchor,css_add,1)

js_anchor='<script src="cap-enterprise-layer.js"></script>'
js_add='''<script src="cap-enterprise-layer.js"></script>\n<script src="cap-planning-horizon.js"></script>\n<script src="cap-planning-horizon-layer.js"></script>'''
if 'cap-planning-horizon.js' not in s:
    if js_anchor not in s: raise SystemExit('missing JS anchor')
    s=s.replace(js_anchor,js_add,1)

old="try{if(entity==='drivers'&&window.CapEnterprise&&typeof window.CapEnterprise.syncPlanningWorkload==='function')await window.CapEnterprise.syncPlanningWorkload(out,f.name)}catch(_e){}await admin();"
new="try{if(entity==='drivers'&&window.CapEnterprise&&typeof window.CapEnterprise.syncPlanningWorkload==='function')await window.CapEnterprise.syncPlanningWorkload(out,f.name);if(window.CapEnterprise&&typeof window.CapEnterprise.syncPlanningHorizon==='function')await window.CapEnterprise.syncPlanningHorizon(out,entity,f.name)}catch(_e){}await admin();"
if old in s:s=s.replace(old,new,1)
elif 'syncPlanningHorizon(out,entity,f.name)' not in s: raise SystemExit('missing import hook anchor')

version_ok=any(x in s for x in [
    'CAP Delivery 6.4 · Transit Point Operating System',
    'CAP Delivery 6.4.1 · Security + Premium',
    'CAP Delivery 6.5 · Resilience + Operational Clarity'
])
if not version_ok: raise SystemExit('missing CAP Delivery 6.4+ version marker')
for marker in ['cap-planning-horizon.css','cap-planning-horizon.js','cap-planning-horizon-layer.js','syncPlanningHorizon(out,entity,f.name)']:
    if marker not in s: raise SystemExit('missing marker '+marker)

if s!=orig:
    p.write_text(s,encoding='utf-8')
    print('CAP frontend 6.4 finalization patch applied')
else:
    print('CAP frontend 6.4 base requirements already satisfied by newer version')
