(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let lastRemote=null,remoteAt=0,fetching=false,lastSig='';
  function localSnapshot(){
    if(typeof CapOpsCore==='undefined'||typeof state==='undefined')return null;
    return CapOpsCore.buildSnapshot({drivers:state.drivers||[],vans:state.vans||[],routes:state.routes||[],emergencies:state.emergencies||[]});
  }
  async function refreshRemote(force=false){
    if(fetching||typeof api!=='function'||typeof state==='undefined'||state.tab!=='dashboard')return;
    if(!force&&lastRemote&&Date.now()-remoteAt<60000){render();return}
    fetching=true;
    try{const data=await api('/api/ops/snapshot');if(data&&data.metrics){lastRemote=data;remoteAt=Date.now();window.CapLiveStatus?.report?.('control tower',true);render();}}catch(e){window.CapLiveStatus?.report?.('control tower',false,e?.message||'snapshot non disponibile')}finally{fetching=false}
  }
  function snapshot(){return lastRemote&&Date.now()-remoteAt<5*60*1000?lastRemote:localSnapshot()}
  function metric(label,value,cls=''){return `<div class="capops-kpi"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`}
  function item(x){const target=x.target||(x.route_id?'giri':x.emergency_id?'emergenze':x.van_id?'flotta':'dashboard');return `<div class="capops-item"><i class="capops-sev s${Math.max(1,Math.min(3,Number(x.severity)||1))}"></i><div class="capops-copy"><b>${esc(x.title||x.type||'Eccezione')}</b><span>${esc(x.detail||'')}</span></div><button class="capops-jump" data-capops-target="${esc(target)}">APRI</button></div>`}
  function todayRome(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function fallbackDomain(s){
    const routes=(typeof state!=='undefined'?state.routes:[])||[], emergencies=(typeof state!=='undefined'?state.emergencies:[])||[], vans=(typeof state!=='undefined'?state.vans:[])||[];
    const today=s.operational_date||todayRome(),todays=routes.filter(r=>{const d=String(r.service_date||'').slice(0,10);return !d||d===today});
    const text=[...todays.map(r=>`${r.code||''} ${r.zone||''} ${r.time_window||''} ${r.status||''} ${r.notes||''}`),...emergencies.map(e=>`${e.type||''} ${e.priority||''} ${e.title||''} ${e.description||''} ${e.notes||''}`),...vans.map(v=>`${v.plate||''} ${v.status||''} ${v.note||''}`)].join(' ').toLowerCase();
    const count=re=>{const m=text.match(re);return m?m.length:0};
    return {today,windows:todays.filter(r=>String(r.time_window||'').trim()).length,lockers:count(/\blocker\b/g),bread:count(/\bpane\b/g),floorNotes:count(/\bpiano\b|ascensore|\bscale\b/g),coldFlags:count(/surgelat|temperatur|cella fredd|catena del freddo|frigo/g),safetyFlags:count(/fren|pneumatic|gomma|liquido freni|guasto|officina/g)};
  }
  function render(){
    if(typeof state==='undefined')return;const main=document.getElementById('main');if(!main)return;const old=document.getElementById('capops-command-center');
    if(state.tab!=='dashboard'){if(old)old.remove();lastSig='';return}
    const s=snapshot();if(!s)return;const m=s.metrics||{},f=fallbackDomain(s),topExceptions=(s.exceptions||[]).slice(0,6),actions=(s.actions||[]).slice(0,5);
    const source=lastRemote&&Date.now()-remoteAt<5*60*1000?'backend verificato':'fallback locale';
    const structured=source==='backend verificato'&&m.route_ops_coverage!=null;
    const open=Math.max(0,Number(m.routes_open)||0),uncovered=Math.max(0,Number(m.routes_uncovered)||0),coverage=open?Math.max(0,Math.round((open-uncovered)/open*100)):100;
    const dataGaps=Array.isArray(s.trust?.data_gaps)?s.trust.data_gaps:['GPS/ETA reale','telemetria temperatura','n° consegne/colli per giro','orari reali partenza/arrivo','piano/ascensore strutturato'];
    const sig=JSON.stringify({situation:s.situation,pressure:s.pressure,utilization:s.utilization,m,exceptions:topExceptions,actions,source,dataGaps});if(sig===lastSig&&old)return;lastSig=sig;
    const tpMetrics=structured
      ? `${metric('Consegne',m.stops_total||0)}${metric('Colli',m.packages_total||0)}${metric('Senza asc.',m.no_lift_stops||0,m.no_lift_stops?'amber':'')}${metric('Giri freddo',m.cold_chain_routes||0)}${metric('Profili TP',`${m.route_ops_coverage}%`,m.route_ops_coverage<100?'amber':'green')}${metric('TP bloccati',m.tp_blocked||0,m.tp_blocked?'red':'green')}`
      : `${metric('Fasce valorizzate',f.windows)}${metric('Locker citati',f.lockers)}${metric('Pane note',f.bread)}${metric('Piano/scale note',f.floorNotes)}`;
    const html=`<section id="capops-command-center" class="capops-wrap"><div class="capops-hero"><div class="capops-eyebrow">ESSELUNGA A CASA · TRANSIT POINT · ${esc(source)}</div><div class="capops-head"><div><div class="capops-title">Control tower TP · ${esc(s.operational_date||f.today)}</div><div class="capops-situation ${esc(s.situation)}">${esc(s.situation)}</div></div><div class="capops-pressure"><b>${esc(s.pressure)}%</b><span>pressione operativa</span></div></div><div class="capops-meter"><i style="width:${Math.max(0,Math.min(100,Number(s.pressure)||0))}%"></i></div><div class="capops-summary">${uncovered?`Priorità: ${uncovered} giro/i scoperti.`:'Copertura giri senza criticità rilevate.'} ${m.emergencies_open?`${m.emergencies_open} emergenza/e aperte.`:'Nessuna emergenza aperta.'} Copertura autisti ${esc(coverage)}% · carico risorse ${esc(s.utilization)}%.</div><div class="capops-grid">${metric('Giri oggi',open)}${metric('Scoperti',uncovered,uncovered?'red':'green')}${metric('Autisti disponibili',m.drivers_available||0)}${metric('Mezzi pronti',m.vans_ready||0)}</div></div><div class="capops-block"><h3>TP readiness · Esselunga</h3><div class="capops-sub">Dal carico nel Transit Point alla consegna al piano. I valori strutturati pesano sul carico operativo e sulle priorità.</div><div class="capops-grid">${tpMetrics}</div>${!structured&&(f.coldFlags||f.safetyFlags)?`<div class="capops-list">${f.coldFlags?item({severity:2,type:'Catena del freddo',title:'Temperatura/celle citate nelle note',detail:'È solo un indizio testuale: senza dato strutturato non viene dichiarata alcuna anomalia.'}):''}${f.safetyFlags?item({severity:3,type:'Sicurezza mezzo',title:'Nota mezzo/sicurezza da verificare',detail:'Freni, pneumatici, guasto o officina compaiono nei dati operativi.',target:'flotta'}):''}</div>`:''}<div class="capops-trust">DATA GAP · ${dataGaps.map(esc).join(' · ')}.</div></div><div class="capops-block"><h3>Eccezioni prima di tutto</h3><div class="capops-sub">Giro scoperto, autista assente assegnato, carico bloccato, freddo KO, mezzo non idoneo ed emergenza alta salgono prima del lavoro ordinario.</div><div class="capops-list">${topExceptions.length?topExceptions.map(item).join(''):'<div class="capops-item"><i class="capops-sev"></i><div class="capops-copy"><b>Nessuna eccezione critica</b><span>Il sistema non rileva anomalie prioritarie nei dati disponibili.</span></div></div>'}</div></div><div class="capops-block"><h3>Next best action</h3><div class="capops-sub">Disponibilità, turno, carico operativo già assegnato ed extra mese. Il doppio turno resta una decisione umana.</div><div class="capops-actions">${actions.map(a=>`<button class="capops-action" data-capops-target="${esc(a.target||'dashboard')}"><b>${esc(a.title)}</b><span>${esc(a.detail||'')}</span></button>`).join('')}</div></div><div class="capops-trust">TRUST LAYER · Non vengono inventati GPS, ETA, traffico, temperatura, colli o difficoltà al piano. Quando un dato manca resta esplicitamente un data gap.</div></section>`;
    if(old)old.outerHTML=html;else main.insertAdjacentHTML('afterbegin',html)
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-capops-target]');if(!b)return;const target=b.getAttribute('data-capops-target');if(typeof go==='function'&&target)go(target)});
  function schedule(){setTimeout(()=>{render();if(typeof state!=='undefined'&&state.tab==='dashboard')refreshRemote(false)},40)}
  const main=document.getElementById('main');if(main)new MutationObserver(muts=>{if(muts.every(m=>m.target.closest&&m.target.closest('#capops-command-center')))return;schedule()}).observe(main,{childList:true,subtree:true});
  window.addEventListener('cap-route-ops-updated',()=>{lastRemote=null;remoteAt=0;lastSig='';refreshRemote(true)});
  window.addEventListener('online',()=>refreshRemote(true));document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshRemote(false)});setInterval(()=>{render();refreshRemote(false)},3*60*1000);schedule();
})();
