(function(){
  'use strict';
  const H=window.CapPlanningHorizon;
  if(!H) return;
  const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const qs=(s,r=document)=>r.querySelector(s);
  const apiBase=()=>String(window.API_BASE||window.CapOfficeBridge?.API_BASE||'').replace(/\/$/,'');
  const token=()=>sessionStorage.getItem('cap_token')||localStorage.getItem('cap_token')||'';
  async function api(path,opts={}){
    const t=token(); const h={'Content-Type':'application/json',...(opts.headers||{})}; if(t)h.Authorization='Bearer '+t;
    const r=await fetch(apiBase()+path,{...opts,headers:h,cache:'no-store'}); if(!r.ok)throw new Error((await r.json().catch(()=>({}))).error||`HTTP ${r.status}`); return r.status===204?null:r.json();
  }
  function todayRome(){try{return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}catch{return new Date().toISOString().slice(0,10)}}
  function host(){
    let el=qs('#capPlanningHorizon'); if(el)return el;
    const candidates=[qs('#dashboard'),qs('[data-page="dashboard"]'),qs('.main')].filter(Boolean);
    const parent=candidates[0]; if(!parent)return null;
    el=document.createElement('section');el.id='capPlanningHorizon';el.className='card planning-horizon';
    parent.appendChild(el);return el;
  }
  function fmtDate(d){try{return new Intl.DateTimeFormat('it-IT',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'Europe/Rome'}).format(new Date(d+'T12:00:00Z'))}catch{return d}}
  function render(h){
    const el=host();if(!el)return;
    const t=h.totals||{};const acts=H.prioritizedActions(h).slice(0,6);
    el.innerHTML=`<div class="planning-head"><div><h3>Planning Horizon · 7 giorni</h3><div class="planning-source">Solo dati reali importati / backend · nessuna disponibilità inferita</div></div><span class="planning-state ${esc(h.state)}">${esc(h.state)}</span></div>
      <div class="planning-kpis"><div class="planning-kpi"><span>Giri</span><b>${t.routes||0}</b></div><div class="planning-kpi"><span>Scoperti</span><b>${t.uncovered||0}</b></div><div class="planning-kpi"><span>Ass. non disp.</span><b>${t.assigned_unavailable||0}</b></div><div class="planning-kpi"><span>Doppi guard</span><b>${t.double_without_clearance||0}</b></div><div class="planning-kpi"><span>Da verificare</span><b>${t.unknown_assignments||0}</b></div></div>
      <div class="planning-strip">${(h.calendar||[]).map(d=>`<article class="planning-day ${esc(d.state)}"><div class="planning-date">${esc(fmtDate(d.date))}</div><div class="planning-metric"><b>${d.planned_routes}</b> giri pianificati</div><div class="planning-metric"><b>${d.uncovered}</b> scoperti</div><div class="planning-metric"><b>${d.assigned_unavailable}</b> assegnati non disp.</div><div class="planning-metric"><b>${d.double_without_clearance}</b> doppi da validare</div><div class="planning-metric"><b>${d.unknown_assignments}</b> da verificare</div>${d.planned_routes===0?'<div class="planning-empty">Nessun giro caricato: dato non disponibile, non = giornata vuota.</div>':''}</article>`).join('')}</div>
      ${acts.length?`<div class="planning-actions">${acts.map(a=>`<div class="planning-action"><span>${esc(fmtDate(a.date))} · ${esc(a.label)}</span><b>P${a.priority}</b></div>`).join('')}</div>`:'<div class="planning-empty">Nessuna criticità rilevata nei dati attualmente caricati.</div>'}`;
  }
  async function load(){
    try{
      const remote=await api('/api/planning-horizon?days=7');
      if(remote?.calendar){render(remote);window.dispatchEvent(new CustomEvent('cap:planning-horizon',{detail:remote}));return remote;}
    }catch(e){/* fallback locale esplicito */}
    const entries=Array.isArray(window.__planningEntries)?window.__planningEntries:[];
    const routes=Array.isArray(window.routes)?window.routes:[];
    const drivers=Array.isArray(window.drivers)?window.drivers:[];
    const local=H.buildHorizon({entries,routes,drivers,startDate:todayRome(),days:7});
    local.source_quality={...(local.source_quality||{}),mode:'LOCAL_FALLBACK_NO_BACKEND'};
    render(local);window.dispatchEvent(new CustomEvent('cap:planning-horizon',{detail:local}));return local;
  }
  async function sync(entries,source='planning-ui'){
    const clean=H.sanitizeEntries(entries);
    if(!clean.length)return {ok:true,accepted:0,ignored:0};
    const payload={source,entries:clean.map(x=>({...x,service_date:x.date}))};
    const out=await api('/api/planning-horizon/import',{method:'POST',body:JSON.stringify(payload)});
    await load();return out;
  }
  window.CapPlanningUI={load,sync,render};
  window.addEventListener('cap:data-ready',()=>load().catch(()=>{}));
  window.addEventListener('cap:planning-imported',e=>sync(e.detail?.entries||window.__planningEntries||[],e.detail?.source||'planning-import').catch(()=>load()));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(load,250));else setTimeout(load,250);
})();
