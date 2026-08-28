from pathlib import Path
import re
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

v62="const APP_VERSION='CAP Delivery 6.2 · Office Bridge + Esselunga TP';"
v63="const APP_VERSION='CAP Delivery 6.3 · Enterprise TP Control';"
if v62 in s:
    s=s.replace(v62,v63,1)
version_match=re.search(r"const APP_VERSION='CAP Delivery 6\.(\d+)",s)
if not version_match or int(version_match.group(1))<3:
    raise SystemExit('APP_VERSION below 6.3 or unrecognized')

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

old_sort=""".sort((a,b)=>{
      if(!!a.double_ok!==!!b.double_ok)return a.double_ok?-1:1;
      const ae=Number(a.extra_hours||0),be=Number(b.extra_hours||0);
      if(ae!==be)return ae-be;
      return a.name.localeCompare(b.name,'it');
    })"""
new_sort=""".sort((a,b)=>{
      if(!!a.double_ok!==!!b.double_ok)return a.double_ok?-1:1;
      const af=window.CapEnterprise?.fairnessForDriver?.(a.id)||{},bf=window.CapEnterprise?.fairnessForDriver?.(b.id)||{};
      const ab=Number(af.double_30||0)*10+Number(af.double_60||0)*3+Number(af.double_90||0)+Number(af.extra_30||0)*2;
      const bb=Number(bf.double_30||0)*10+Number(bf.double_60||0)*3+Number(bf.double_90||0)+Number(bf.extra_30||0)*2;
      if(ab!==bb)return ab-bb;
      const ae=Number(a.extra_hours||0),be=Number(b.extra_hours||0);
      if(ae!==be)return ae-be;
      return a.name.localeCompare(b.name,'it');
    })"""
if 'fairnessForDriver?.(a.id)' not in s:
    if old_sort not in s: raise SystemExit('driver ranking anchor changed')
    s=s.replace(old_sort,new_sort,1)

old_reason="const reason=(d.double_ok?'Disponibile a doppio turno · ':'Non preferenziale per doppio · ')+Number(d.extra_hours||0)+' h extra mese';"
new_reason="const f=window.CapEnterprise?.fairnessForDriver?.(d.id)||{};const recent=Number(f.double_30||0);const reason=(d.double_ok?'Disponibile a doppio · ':'Non preferenziale · ')+recent+' doppi/30g · '+Number(f.extra_30||d.extra_hours||0)+' h extra/30g';"
if 'doppi/30g' not in s:
    if old_reason not in s: raise SystemExit('driver suggestion reason anchor changed')
    s=s.replace(old_reason,new_reason,1)

for marker in ['cap-enterprise-layer.css','cap-enterprise-core.js','cap-enterprise-layer.js','__planningEntries:plan','window.CapEnterprise.confirmImportPreview','window.CapEnterprise.syncPlanningWorkload','fairnessForDriver?.(a.id)','doppi/30g']:
    if marker not in s: raise SystemExit('missing marker: '+marker)
version_match=re.search(r"const APP_VERSION='CAP Delivery 6\.(\d+)",s)
if not version_match or int(version_match.group(1))<3:
    raise SystemExit('post-migration APP_VERSION below 6.3')

if s!=orig:
    p.write_text(s,encoding='utf-8')
    print('CAP Delivery 6.3 enterprise patch applied')
else:
    print('CAP Delivery 6.3 enterprise patch already satisfied by newer version')
