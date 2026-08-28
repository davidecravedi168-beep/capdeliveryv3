(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  let lastRemote=null,remoteAt=0,fetching=false;
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
  function render(){
    if(typeof state==='undefined')return;
    const main=document.getElementById('main');if(!main)return;
    const old=document.getElementById('capops-command-center');
    if(state.tab!=='dashboard'){if(old)old.remove();return}
    const s=snapshot();if(!s)return;
    const m=s.metrics||{};
    const topExceptions=(s.exceptions||[]).slice(0,5),actions=(s.actions||[]).slice(0,4);
    const source=lastRemote&&Date.now()-remoteAt<5*60*1000?'backend verificato':'fallback locale';
    const html=`<section id="capops-command-center" class="capops-wrap">
      <div class="capops-hero">
        <div class="capops-eyebrow">OPERATIONS INTELLIGENCE · ${esc(source)}</div>
        <div class="capops-head"><div><div class="capops-title">Control tower di oggi</div><div class="capops-situation ${esc(s.situation)}">${esc(s.situation)}</div></div><div class="capops-pressure"><b>${esc(s.pressure)}%</b><span>pressione operativa</span></div></div>
        <div class="capops-meter"><i style="width:${Math.max(0,Math.min(100,Number(s.pressure)||0))}%"></i></div>
        <div class="capops-summary">${m.routes_uncovered?`Priorità: ${m.routes_uncovered} giro/i scoperti.`:'Copertura giri senza criticità rilevate.'} ${m.emergencies_open?`${m.emergencies_open} emergenza/e aperte.`:'Nessuna emergenza aperta.'} Utilizzo stimato risorse ${esc(s.utilization)}%.</div>
        <div class="capops-grid">${metric('Giri aperti',m.routes_open||0)}${metric('Scoperti',m.routes_uncovered||0,m.routes_uncovered?'red':'green')}${metric('Autisti disponibili',m.drivers_available||0)}${metric('Mezzi pronti',m.vans_ready||0)}</div>
      </div>
      <div class="capops-block"><h3>Eccezioni prima di tutto</h3><div class="capops-sub">Ordinate per impatto operativo, come una vera control tower.</div><div class="capops-list">${topExceptions.length?topExceptions.map(item).join(''):'<div class="capops-item"><i class="capops-sev"></i><div class="capops-copy"><b>Nessuna eccezione critica</b><span>Il sistema non rileva anomalie prioritarie nei dati disponibili.</span></div></div>'}</div></div>
      <div class="capops-block"><h3>Next best action</h3><div class="capops-sub">Suggerimenti rule-based: supporto decisionale, non automazioni cieche.</div><div class="capops-actions">${actions.map(a=>`<button class="capops-action" data-capops-target="${esc(a.target||'dashboard')}"><b>${esc(a.title)}</b><span>${esc(a.detail||'')}</span></button>`).join('')}</div></div>
      <div class="capops-trust">TRUST LAYER · Non vengono inventati GPS, ETA o traffico. Queste priorità derivano solo da giri, disponibilità, emergenze e stato flotta realmente presenti nel sistema.</div>
    </section>`;
    if(old)old.outerHTML=html; else main.insertAdjacentHTML('afterbegin',html);
  }
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-capops-target]');if(!b)return;
    const target=b.getAttribute('data-capops-target');
    if(typeof go==='function'&&target)go(target);
  });
  function schedule(){setTimeout(()=>{render();if(typeof state!=='undefined'&&state.tab==='dashboard')refreshRemote();},30)}
  const main=document.getElementById('main');if(main)new MutationObserver(()=>schedule()).observe(main,{childList:true,subtree:false});
  window.addEventListener('online',refreshRemote);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshRemote()});
  setInterval(()=>{render();refreshRemote()},3*60*1000);
  schedule();
})();
