(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const norm=v=>String(v??'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  let lastRemote=null,remoteAt=0,fetching=false,lastSig='';
  function localSnapshot(){
    if(typeof CapOpsCore==='undefined'||typeof state==='undefined')return null;
    return CapOpsCore.buildSnapshot({drivers:state.drivers||[],vans:state.vans||[],routes:state.routes||[],emergencies:state.emergencies||[]});
  }
  async function refreshRemote(){
    if(fetching||typeof api!=='function'||typeof state==='undefined'||state.tab!=='dashboard')return;
    fetching=true;
    try{
      const data=await api('/api/ops/snapshot');
      if(data&&data.metrics){lastRemote=data;remoteAt=Date.now();render();}
    }catch(e){}finally{fetching=false}
  }
  function snapshot(){return lastRemote&&Date.now()-remoteAt<5*60*1000?lastRemote:localSnapshot()}
  function metric(label,value,cls=''){return `<div class="capops-kpi"><span>${esc(label)}</span><b class="${cls}">${esc(value)}</b></div>`}
  function item(x){
    const target=x.target||(x.route_id?'giri':x.emergency_id?'emergenze':x.van_id?'flotta':'dashboard');
    return `<div class="capops-item"><i class="capops-sev s${Math.max(1,Math.min(3,Number(x.severity)||1))}"></i><div class="capops-copy"><b>${esc(x.title||x.type||'Eccezione')}</b><span>${esc(x.detail||'')}</span></div><button class="capops-jump" data-capops-target="${esc(target)}">APRI</button></div>`;
  }
  function todayRome(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
  function domainProfile(s){
    const routes=(typeof state!=='undefined'?state.routes:[])||[], emergencies=(typeof state!=='undefined'?state.emergencies:[])||[], vans=(typeof state!=='undefined'?state.vans:[])||[];
    const today=s.operational_date||todayRome();
    const todays=routes.filter(r=>{const d=String(r.service_date||'').slice(0,10);return !d||d===today});
    const text=[...todays.map(r=>`${r.code||''} ${r.zone||''} ${r.time_window||''} ${r.status||''} ${r.notes||''}`),...emergencies.map(e=>`${e.type||''} ${e.priority||''} ${e.title||''} ${e.description||''} ${e.notes||''}`),...vans.map(v=>`${v.plate||''} ${v.status||''} ${v.note||''}`)].join(' ').toLowerCase();
    const count=(re)=>{const m=text.match(re);return m?m.length:0};
    const windows=todays.filter(r=>String(r.time_window||'').trim()).length;
    const lockers=count(/\blocker\b/g), bread=count(/\bpane\b/g);
    const floorNotes=count(/\bpiano\b|ascensore|\bscale\b/g);
    const coldFlags=count(/surgelat|temperatur|cella fredd|catena del freddo|frigo/g);
    const safetyFlags=count(/fren|pneumatic|gomma|liquido freni|guasto|officina/g);
    const open=Math.max(0,Number(s.metrics?.routes_open)||0),uncovered=Math.max(0,Number(s.metrics?.routes_uncovered)||0);
    const coverage=open?Math.max(0,Math.round((open-uncovered)/open*100)):100;
    return {today,windows,lockers,bread,floorNotes,coldFlags,safetyFlags,coverage,dataGaps:['GPS/ETA reale','telemetria temperatura','n° consegne/colli per giro','orari reali partenza/arrivo','piano/ascensore strutturato']};
  }
  function render(){
    if(typeof state==='undefined')return;
    const main=document.getElementById('main');if(!main)return;
    const old=document.getElementById('capops-command-center');
    if(state.tab!=='dashboard'){if(old)old.remove();lastSig='';return}
    const s=snapshot();if(!s)return;
    const m=s.metrics||{},d=domainProfile(s);
    const topExceptions=(s.exceptions||[]).slice(0,5),actions=(s.actions||[]).slice(0,4);
    const source=lastRemote&&Date.now()-remoteAt<5*60*1000?'backend verificato':'fallback locale';
    const sig=JSON.stringify({situation:s.situation,pressure:s.pressure,utilization:s.utilization,m,exceptions:topExceptions,actions,d,source});
    if(sig===lastSig&&old)return;lastSig=sig;
    const html=`<section id="capops-command-center" class="capops-wrap">
      <div class="capops-hero">
        <div class="capops-eyebrow">ESSELUNGA A CASA · TRANSIT POINT · ${esc(source)}</div>
        <div class="capops-head"><div><div class="capops-title">Control tower TP · ${esc(d.today)}</div><div class="capops-situation ${esc(s.situation)}">${esc(s.situation)}</div></div><div class="capops-pressure"><b>${esc(s.pressure)}%</b><span>pressione operativa</span></div></div>
        <div class="capops-meter"><i style="width:${Math.max(0,Math.min(100,Number(s.pressure)||0))}%"></i></div>
        <div class="capops-summary">${m.routes_uncovered?`Priorità: ${m.routes_uncovered} giro/i scoperti.`:'Copertura giri senza criticità rilevate.'} ${m.emergencies_open?`${m.emergencies_open} emergenza/e aperte.`:'Nessuna emergenza aperta.'} Copertura TP ${esc(d.coverage)}% · utilizzo risorse ${esc(s.utilization)}%.</div>
        <div class="capops-grid">${metric('Giri oggi',m.routes_open||0)}${metric('Scoperti',m.routes_uncovered||0,m.routes_uncovered?'red':'green')}${metric('Autisti disponibili',m.drivers_available||0)}${metric('Mezzi pronti',m.vans_ready||0)}</div>
      </div>
      <div class="capops-block"><h3>TP readiness · Esselunga</h3><div class="capops-sub">Dal transit point alla consegna al piano, senza inventare dati che non arrivano dai sistemi reali.</div><div class="capops-grid">${metric('Fasce valorizzate',d.windows)}${metric('Locker citati',d.lockers)}${metric('Pane / fresco note',d.bread)}${metric('Piano / scale note',d.floorNotes)}</div><div class="capops-list">${d.coldFlags?item({severity:2,type:'Catena del freddo',title:'Controllo temperatura/celle citato nei dati',detail:'Verifica il contesto operativo: senza telemetria non viene dichiarata alcuna anomalia.'}):''}${d.safetyFlags?item({severity:3,type:'Sicurezza mezzo',title:'Nota mezzo/sicurezza da verificare',detail:'Freni, pneumatici, guasto o officina compaiono nei dati operativi.',target:'flotta'}):''}</div><div class="capops-trust">DATA GAP PER LIVELLO PRO · ${d.dataGaps.map(esc).join(' · ')}. Finché questi feed non esistono, CAP li segnala come mancanti e non crea ETA, temperature o carichi fittizi.</div></div>
      <div class="capops-block"><h3>Eccezioni prima di tutto</h3><div class="capops-sub">Giro scoperto, autista assente assegnato, mezzo non idoneo ed emergenza alta salgono prima delle attività normali.</div><div class="capops-list">${topExceptions.length?topExceptions.map(item).join(''):'<div class="capops-item"><i class="capops-sev"></i><div class="capops-copy"><b>Nessuna eccezione critica</b><span>Il sistema non rileva anomalie prioritarie nei dati disponibili.</span></div></div>'}</div></div>
      <div class="capops-block"><h3>Next best action</h3><div class="capops-sub">Copertura giro e sostituzioni: prima disponibilità/compatibilità, poi carico già assegnato ed extra mese. Il doppio turno resta una scelta umana, non un automatismo.</div><div class="capops-actions">${actions.map(a=>`<button class="capops-action" data-capops-target="${esc(a.target||'dashboard')}"><b>${esc(a.title)}</b><span>${esc(a.detail||'')}</span></button>`).join('')}</div></div>
      <div class="capops-trust">TRUST LAYER · Modello operativo specifico per spesa a casa/TP. Non vengono inventati GPS, ETA, traffico, temperatura o numero consegne. Le priorità derivano esclusivamente dai dati realmente presenti.</div>
    </section>`;
    if(old)old.outerHTML=html; else main.insertAdjacentHTML('afterbegin',html);
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-capops-target]');if(!b)return;const target=b.getAttribute('data-capops-target');if(typeof go==='function'&&target)go(target)});
  function schedule(){setTimeout(()=>{render();if(typeof state!=='undefined'&&state.tab==='dashboard')refreshRemote()},40)}
  const main=document.getElementById('main');if(main)new MutationObserver(muts=>{if(muts.every(m=>m.target.closest&&m.target.closest('#capops-command-center')))return;schedule()}).observe(main,{childList:true,subtree:true});
  window.addEventListener('online',refreshRemote);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshRemote()});
  setInterval(()=>{render();refreshRemote()},3*60*1000);
  schedule();
})();
