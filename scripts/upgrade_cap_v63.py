from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s

if 'cap-enterprise-layer.css' not in s:
    if '</head>' not in s: raise SystemExit('missing </head>')
    s=s.replace('</head>','<link rel="stylesheet" href="cap-enterprise-layer.css">\n</head>',1)

scripts='<script src="cap-enterprise-core.js"></script>\n<script src="cap-enterprise-layer.js"></script>\n'
if 'cap-enterprise-layer.js' not in s:
    if '</body>' not in s: raise SystemExit('missing </body>')
    s=s.replace('</body>',scripts+'</body>',1)

s=s.replace("const APP_VERSION='CAP Delivery 6.2 · Office Bridge + Esselunga TP';","const APP_VERSION='CAP Delivery 6.3 · Enterprise TP Control';")
if "CAP Delivery 6.3 · Enterprise TP Control" not in s:
    raise SystemExit('APP_VERSION anchor changed')

if '__planningEntries:plan' not in s:
    old='__todayValue:todayItem?.value||\'\',__section:section});'
    new='__todayValue:todayItem?.value||\'\',__section:section,__planningEntries:plan});'
    if old not in s: raise SystemExit('planning import anchor changed')
    s=s.replace(old,new,1)

if 'window.CapEnterprise.confirmImportPreview' not in s:
    old='''if(!criticalConfirm(`Riconosciuti ${out.length} ${names[entity]} da “${f.name}”. Confermi l’importazione?`)){if(statusEl)statusEl.textContent='Importazione annullata: nessun dato modificato.';return}'''
    new='''const importApproved=window.CapEnterprise&&typeof window.CapEnterprise.confirmImportPreview==='function'?await window.CapEnterprise.confirmImportPreview({out,entity,fileName:f.name,sheetNames:wb.SheetNames}):criticalConfirm(`Riconosciuti ${out.length} ${names[entity]} da “${f.name}”. Confermi l’importazione?`);\n   if(!importApproved){if(statusEl)statusEl.textContent='Importazione annullata: nessun dato modificato.';return}'''
    if old not in s: raise SystemExit('import confirmation anchor changed')
    s=s.replace(old,new,1)

if 'window.CapEnterprise.syncPlanningWorkload' not in s:
    old="input.value='';await refresh();await admin();"
    new="input.value='';await refresh();try{if(entity==='drivers'&&window.CapEnterprise&&typeof window.CapEnterprise.syncPlanningWorkload==='function')await window.CapEnterprise.syncPlanningWorkload(out,f.name)}catch(_e){}await admin();"
    if old not in s: raise SystemExit('import completion anchor changed')
    s=s.replace(old,new,1)

for marker in ['cap-enterprise-layer.css','cap-enterprise-core.js','cap-enterprise-layer.js',"CAP Delivery 6.3 · Enterprise TP Control",'__planningEntries:plan','window.CapEnterprise.confirmImportPreview','window.CapEnterprise.syncPlanningWorkload']:
    if marker not in s: raise SystemExit('missing marker: '+marker)

if s!=orig:
    p.write_text(s,encoding='utf-8')
    print('CAP Delivery 6.3 enterprise patch applied')
else:
    print('CAP Delivery 6.3 enterprise patch already applied')
