from pathlib import Path

FILES={
    'index':Path('index.html'),
    'planning':Path('cap-planning-horizon-layer.js'),
    'ops':Path('cap-ops-layer.js'),
    'office':Path('cap-office-bridge.js'),
    'enterprise':Path('cap-enterprise-layer.js'),
}
text={k:p.read_text(encoding='utf-8') for k,p in FILES.items()}
orig=dict(text)

def replace_once(key,old,new,label):
    s=text[key]
    if old in s:
        text[key]=s.replace(old,new,1)
    elif new not in s:
        raise SystemExit(f'missing CAP 6.5 anchor: {label}')

# Frontend shell: version + resilience rail assets.
if 'cap-live-status.css' not in text['index']:
    if '</head>' not in text['index']: raise SystemExit('missing </head>')
    text['index']=text['index'].replace('</head>','<link rel="stylesheet" href="cap-live-status.css">\n</head>',1)
if 'cap-live-status.js' not in text['index']:
    if '</body>' not in text['index']: raise SystemExit('missing </body>')
    text['index']=text['index'].replace('</body>','<script src="cap-live-status.js"></script>\n</body>',1)
replace_once('index',"const APP_VERSION='CAP Delivery 6.4.1 · Security + Premium';","const APP_VERSION='CAP Delivery 6.5 · Resilience + Operational Clarity';",'APP_VERSION')
replace_once('index','<div class="version">Secure Premium · 6.4.1</div>','<div class="version">Resilience Premium · 6.5</div>','visible version')

# Session policy: token must never fall back to persistent localStorage.
replace_once('planning',"const token=()=>sessionStorage.getItem('cap_token')||localStorage.getItem('cap_token')||'';","const token=()=>sessionStorage.getItem('cap_token')||'';",'planning session token')

# Planning source truth + correct in-memory fallback source.
if 'function sourceLabel(h)' not in text['planning']:
    anchor="  function fmtDate(d){try{return new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'Europe/Rome'}).format(new Date(d+'T12:00:00Z'))}catch{return d}}\n"
    insert=anchor+"  function sourceLabel(h){const mode=String(h?.source_quality?.mode||'BACKEND_LIVE').toUpperCase();return mode.includes('LOCAL_FALLBACK')?'MODALITÀ DEGRADATA · FALLBACK LOCALE':'BACKEND LIVE · DATI CONFERMATI';}\n"
    replace_once('planning',anchor,insert,'planning source label')
replace_once('planning','<div class="planning-source">Solo dati reali importati / backend · nessuna disponibilità inferita</div>','<div class="planning-source">${esc(sourceLabel(h))} · Solo dati reali · nessuna disponibilità inferita</div>','planning source copy')
old_load="""    try{const remote=await api('/api/planning-horizon?days=7');if(remote?.calendar){render(remote);window.dispatchEvent(new CustomEvent('cap:planning-horizon',{detail:remote}));return remote;}}catch(e){}
    const entries=Array.isArray(window.__planningEntries)?window.__planningEntries:[];const routes=Array.isArray(window.routes)?window.routes:[];const drivers=Array.isArray(window.drivers)?window.drivers:[];
    const local=H.buildHorizon({entries,routes,drivers,startDate:todayRome(),days:7});local.source_quality={...(local.source_quality||{}),mode:'LOCAL_FALLBACK_NO_BACKEND'};render(local);window.dispatchEvent(new CustomEvent('cap:planning-horizon',{detail:local}));return local;"""
new_load="""    try{const remote=await api('/api/planning-horizon?days=7');if(remote?.calendar){remote.source_quality={...(remote.source_quality||{}),mode:'BACKEND_LIVE'};window.CapLiveStatus?.report?.('planning',true);render(remote);window.dispatchEvent(new CustomEvent('cap:planning-horizon',{detail:remote}));return remote;}}catch(e){window.CapLiveStatus?.report?.('planning',false,e?.message||'planning backend non disponibile')}
    const entries=Array.isArray(window.__planningEntries)?window.__planningEntries:[];const routes=(typeof state!=='undefined'&&Array.isArray(state.routes))?state.routes:[];const drivers=(typeof state!=='undefined'&&Array.isArray(state.drivers))?state.drivers:[];
    const local=H.buildHorizon({entries,routes,drivers,startDate:todayRome(),days:7});local.source_quality={...(local.source_quality||{}),mode:'LOCAL_FALLBACK_NO_BACKEND'};render(local);window.dispatchEvent(new CustomEvent('cap:planning-horizon',{detail:local}));return local;"""
replace_once('planning',old_load,new_load,'planning live/fallback load')

# Core dashboard modules must expose failures instead of swallowing them.
replace_once('ops',"try{const data=await api('/api/ops/snapshot');if(data&&data.metrics){lastRemote=data;remoteAt=Date.now();render();}}catch(e){}finally{fetching=false}","try{const data=await api('/api/ops/snapshot');if(data&&data.metrics){lastRemote=data;remoteAt=Date.now();window.CapLiveStatus?.report?.('control tower',true);render();}}catch(e){window.CapLiveStatus?.report?.('control tower',false,e?.message||'snapshot non disponibile')}finally{fetching=false}",'ops live status')
replace_once('office',"try{const d=await api('/api/office-bridge');if(d&&Array.isArray(d.sources)){bridge=d;loadedAt=Date.now()}}catch(e){}finally{loading=false;render()}","try{const d=await api('/api/office-bridge');if(d&&Array.isArray(d.sources)){bridge=d;loadedAt=Date.now();window.CapLiveStatus?.report?.('office bridge',true)}}catch(e){window.CapLiveStatus?.report?.('office bridge',false,e?.message||'office bridge non disponibile')}finally{loading=false;render()}",'office live status')
old_ent="try{const [f,c,b,e]=await Promise.all([api('/api/fairness'),api('/api/shift-closures/today'),api('/api/office-bridge'),api('/api/driver-evidence/today').catch(()=>({rows:[]}))]);fairness=f;closures=Array.isArray(c)?c:[];bridge=b;driverEvidence=Array.isArray(e?.rows)?e.rows:[];loadedAt=Date.now();publishFairness();}catch(_e){}finally{loading=false;render()}"
new_ent="try{const [f,c,b,e]=await Promise.all([api('/api/fairness'),api('/api/shift-closures/today'),api('/api/office-bridge'),api('/api/driver-evidence/today').catch(()=>({rows:[]}))]);fairness=f;closures=Array.isArray(c)?c:[];bridge=b;driverEvidence=Array.isArray(e?.rows)?e.rows:[];loadedAt=Date.now();window.CapLiveStatus?.report?.('shift control',true);publishFairness();}catch(_e){window.CapLiveStatus?.report?.('shift control',false,_e?.message||'shift control non disponibile')}finally{loading=false;render()}"
replace_once('enterprise',old_ent,new_ent,'enterprise live status')

forbidden=[
    (text['planning'],"localStorage.getItem('cap_token')",'persistent planning token'),
]
for s,marker,label in forbidden:
    if marker in s: raise SystemExit('forbidden CAP 6.5 marker remains: '+label)
required={
    'index':['CAP Delivery 6.5 · Resilience + Operational Clarity','cap-live-status.css','cap-live-status.js'],
    'planning':['BACKEND LIVE · DATI CONFERMATI','LOCAL_FALLBACK_NO_BACKEND',"state.routes","state.drivers","CapLiveStatus?.report?.('planning'"],
    'ops':["CapLiveStatus?.report?.('control tower'"],
    'office':["CapLiveStatus?.report?.('office bridge'"],
    'enterprise':["CapLiveStatus?.report?.('shift control'"],
}
for key,markers in required.items():
    for marker in markers:
        if marker not in text[key]: raise SystemExit(f'missing CAP 6.5 marker in {key}: {marker}')

changed=[]
for key,p in FILES.items():
    if text[key]!=orig[key]:
        p.write_text(text[key],encoding='utf-8');changed.append(str(p))
print('CAP Delivery 6.5 resilience patch applied: '+(', '.join(changed) if changed else 'already applied'))
