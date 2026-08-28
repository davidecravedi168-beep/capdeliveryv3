from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
orig=s

def once(old,new,label):
    global s
    if old in s:
        s=s.replace(old,new,1)
    elif new not in s:
        raise SystemExit('missing '+label+' anchor')

# Reduce runtime third-party surface. The following migration pins SheetJS to the official 0.20.3 distribution.
s=s.replace('<link rel="preconnect" href="https://fonts.googleapis.com">\n','')
s=s.replace('<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet">\n','')
once('<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>','<script src="vendor/xlsx.full.min.js"></script>','SheetJS')
if '<meta name="robots" content="noindex,nofollow,noarchive">' not in s:
    s=s.replace('<title>CAP Delivery Control</title>','<title>CAP Delivery Control</title>\n<meta name="robots" content="noindex,nofollow,noarchive">\n<meta name="referrer" content="no-referrer">',1)

# Security/premium layer.
if '<link rel="stylesheet" href="cap-security-premium.css">' not in s:
    s=s.replace('</head>','<link rel="stylesheet" href="cap-security-premium.css">\n</head>',1)
if '<script src="cap-security-premium.js"></script>' not in s:
    s=s.replace('</body>','<script src="cap-security-premium.js"></script>\n</body>',1)

# Privacy-first login and product language.
once('<input id="login-name" type="text" autocomplete="username" placeholder="Nome utente" value="Amministratore">','<input id="login-name" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="Nome utente">','login identity')
once('<div class="notice">Accesso collegato al backend CAP Delivery. Le modifiche vengono salvate nel database centrale.</div>','<div class="notice">Accesso riservato · dati aziendali · sessione protetta. Usa esclusivamente la tua utenza personale.</div>','login notice')
once('<span class="mark" style="width:9px;height:9px;margin:0 8px 0 0"></span>CAP Delivery<small>Control Center · produzione MVP</small>','<span class="mark" style="width:9px;height:9px;margin:0 8px 0 0"></span>CAP Delivery<small>Transit Point Operating System</small>','brand')
once('<div class="version">Final Production · Smart + Timeline</div>','<div class="version">Secure Premium · 6.4.1</div>','version')
once("const APP_VERSION='CAP Delivery 6.4 · Transit Point Operating System';","const APP_VERSION='CAP Delivery 6.4.1 · Security + Premium';",'app version')

# No operational dataset survives a reload/tab close. Session token remains session-scoped.
old_snapshot="""function saveSessionSnapshot(){
  try{
    sessionStorage.setItem(SNAPSHOT_KEY,JSON.stringify({
      drivers:state.drivers,vans:state.vans,routes:state.routes,emergencies:state.emergencies,
      lastUpdated:state.lastUpdated?state.lastUpdated.toISOString():null
    }));
  }catch(e){}
}
function restoreSessionSnapshot(){
  try{
    const s=JSON.parse(sessionStorage.getItem(SNAPSHOT_KEY)||'null');
    if(!s)return false;
    state.drivers=s.drivers||[];state.vans=s.vans||[];state.routes=s.routes||[];state.emergencies=s.emergencies||[];
    state.lastUpdated=s.lastUpdated?new Date(s.lastUpdated):null;
    return true;
  }catch(e){return false}
}
"""
new_snapshot="""function saveSessionSnapshot(){
  try{sessionStorage.removeItem(SNAPSHOT_KEY)}catch(e){}
}
function restoreSessionSnapshot(){
  try{sessionStorage.removeItem(SNAPSHOT_KEY)}catch(e){}
  return false;
}
"""
once(old_snapshot,new_snapshot,'browser data snapshot')
once("setResilienceBanner('warn','Backend momentaneamente non raggiungibile: stai vedendo gli ultimi dati disponibili di questa sessione.');","setResilienceBanner('warn','Backend momentaneamente non raggiungibile: nessuna copia persistente dei dati aziendali viene mantenuta nel browser.');",'offline snapshot message')
once("setResilienceBanner('warn','Backend momentaneamente non raggiungibile. Gli ultimi dati restano visibili; le modifiche sono temporaneamente disabilitate per evitare duplicazioni.');","setResilienceBanner('warn','Backend momentaneamente non raggiungibile. Restano visibili solo i dati già presenti in memoria; le modifiche sono disabilitate fino alla riconnessione.');",'offline memory message')

# Do not create browser-side full-data exports.
old_backup="""function exportBackup(){
  const payload={version:APP_VERSION,exportedAt:new Date().toISOString(),drivers:state.drivers,vans:state.vans,routes:state.routes,emergencies:state.emergencies};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download='cap-delivery-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Backup esportato');
}
"""
new_backup="""function exportBackup(){toast('Export locale disattivato per protezione dei dati aziendali')}
"""
once(old_backup,new_backup,'local backup function')
once('<div class="actions"><button class="btn ghost" onclick="exportBackup()">Esporta backup</button></div>','<div class="cap-trust-line"><b>Protezione dati:</b> export locale disattivato · backup gestito lato database.</div>','backup button')

# Upgrade parser, keep data local to the device, and avoid extra workbook features.
old_read="const ab=await f.arrayBuffer(),wb=XLSX.read(ab,{type:'array',cellDates:true});if(!wb.SheetNames?.length)throw new Error('Il file non contiene fogli leggibili');"
new_read="const ab=await f.arrayBuffer(),wb=XLSX.read(ab,{type:'array',cellDates:true,cellFormula:false,cellHTML:false,cellNF:false,bookVBA:false,WTF:false});if(!wb.SheetNames?.length)throw new Error('Il file non contiene fogli leggibili');if(wb.SheetNames.length>32)throw new Error('File troppo complesso: massimo 32 fogli per importazione');"
once(old_read,new_read,'safe workbook parser')

# Minimum 6-digit PIN for new secrets; existing current PIN remains accepted for migration.
s=s.replace("placeholder=\"${u?'•••• opzionale':'4-12 cifre'}\"","placeholder=\"${u?'•••• opzionale':'6-12 cifre'}\"")
s=s.replace("if(!id&&!/^\\d{4,12}$/.test(pin))return toast('Inserisci un PIN numerico di 4-12 cifre');","if(!id&&!/^\\d{6,12}$/.test(pin))return toast('Inserisci un PIN numerico di 6-12 cifre');")
s=s.replace("if(id&&pin&&!/^\\d{4,12}$/.test(pin))return toast('Il nuovo PIN deve avere 4-12 cifre');","if(id&&pin&&!/^\\d{6,12}$/.test(pin))return toast('Il nuovo PIN deve avere 6-12 cifre');")
s=s.replace("if(!/^\\d{4,12}$/.test(old)||!/^\\d{4,12}$/.test(p1))return toast('PIN numerico di 4-12 cifre richiesto');","if(!/^\\d{4,12}$/.test(old)||!/^\\d{6,12}$/.test(p1))return toast('PIN attuale 4-12 cifre; nuovo PIN minimo 6 cifre');")
once("closeSheet();toast('PIN aggiornato. Sarà valido dal prossimo accesso.');","closeSheet();toast('PIN aggiornato · accedi di nuovo');setTimeout(logout,700);",'PIN re-login')

# Minimize PII on the shared scheduling view. Contact data remains in the dedicated driver view.
old_driver_meta="<div class=\"meta\">${esc(d.phone||'')} · Extra ${Number(d.extra_hours||0)} h${d.double_ok?' · doppio ok':''}${turni&&raw&&raw!==sh?' · '+esc(raw):''}</div>"
new_driver_meta="<div class=\"meta\">${turni?'':`<span class=\"cap-personal\">${esc(d.phone||'')}</span>${d.phone?' · ':''}`}Extra ${Number(d.extra_hours||0)} h${d.double_ok?' · doppio ok':''}${turni&&raw&&raw!==sh?' · '+esc(raw):''}</div>"
once(old_driver_meta,new_driver_meta,'driver PII minimization')
s=s.replace('<input id="d-phone" value="${esc(d?.phone||\'\')}">','<input id="d-phone" class="cap-personal" value="${esc(d?.phone||\'\')}">')
s=s.replace('<input id="d-email" value="${esc(d?.email||\'\')}">','<input id="d-email" class="cap-personal" value="${esc(d?.email||\'\')}">')

# Corporate UI uses local system fonts; no runtime font request.
if 'font-family:-apple-system' not in s:
    s=s.replace(':root{--bg:',':root{--ui:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;--mono:"SFMono-Regular",Consolas,"Liberation Mono",monospace;--bg:',1)
    s=s.replace('font-family:Inter,sans-serif','font-family:var(--ui)')
    s=s.replace('font-family:"Barlow Condensed"','font-family:var(--ui)')
    s=s.replace('font-family:Inter','font-family:var(--ui)')
    s=s.replace('"JetBrains Mono"','var(--mono)')

for marker in [
    'CAP Delivery 6.4.1 · Security + Premium','vendor/xlsx.full.min.js','cap-security-premium.css','cap-security-premium.js',
    'nessuna copia persistente dei dati aziendali','export locale disattivato','nuovo PIN minimo 6 cifre','dati aziendali'
]:
    if marker not in s: raise SystemExit('missing 6.4.1 marker: '+marker)
for forbidden in ['cdn.jsdelivr.net/npm/xlsx@0.18.5','fonts.googleapis.com','value="Amministratore"','sessionStorage.setItem(SNAPSHOT_KEY','onclick="exportBackup()"']:
    if forbidden in s: raise SystemExit('forbidden security marker remains: '+forbidden)

if s!=orig:
    p.write_text(s,encoding='utf-8')
    print('CAP Delivery 6.4.1 Security + Premium patch applied')
else:
    print('CAP Delivery 6.4.1 Security + Premium already applied')
