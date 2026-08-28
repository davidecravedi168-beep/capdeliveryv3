(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  root.CapOpsCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const txt=v=>String(v??'').trim();
  const norm=v=>txt(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const num=v=>Number.isFinite(Number(v))?Number(v):0;
  const truthy=v=>v===true||v===1||['1','true','si','sì','yes','ok'].includes(norm(v));
  const unavailableWords=['malatt','ferie','assent','riposo','indispon','non disponibil','forfait','sospes'];
  const badVanWords=['guasto','officina','fermo','ko','manutenz','blocc','non disponibile'];
  const closedWords=['chius','closed','complet','done','consegn','annull','cancel'];
  const openRouteWords=['scopert','open','apert','da assegn','unassigned','pending','attiv'];
  const highWords=['crit','alta','high','urgente','p1','rosso'];
  function hasAny(v,arr){const n=norm(v);return arr.some(w=>n.includes(w));}
  function routeIsClosed(r){return hasAny(r?.status,closedWords);}
  function routeIsOpen(r){return !routeIsClosed(r);}
  function routeIsUncovered(r){return routeIsOpen(r)&&(!r?.driver_id||hasAny(r?.status,['scopert','unassigned','da assegn']));}
  function driverUnavailable(d){return hasAny(d?.status,unavailableWords);}
  function driverAvailable(d){const s=norm(d?.status);return !driverUnavailable(d)&&(!s||['dispon','attiv','ok','presente','liber'].some(w=>s.includes(w)));}
  function vanUnavailable(v){return hasAny(v?.status,badVanWords);}
  function emergencyOpen(e){if(e?.is_open===false||e?.is_open===0||norm(e?.is_open)==='false')return false;return !e?.closed_at;}
  function priorityRank(p){const n=norm(p);if(highWords.some(w=>n.includes(w)))return 3;if(['media','medium','p2','ambra','amber'].some(w=>n.includes(w)))return 2;return 1;}
  function shiftForRoute(r){const w=norm(r?.time_window);if(/(^|\D)(0?[5-9]|1[0-2])[:.]/.test(w)||w.includes('am')||w.includes('matt'))return 'AM';if(/(^|\D)(1[4-9]|2[0-3])[:.]/.test(w)||w.includes('pm')||w.includes('pomer'))return 'PM';return ''}
  function routeLoadMap(routes){const m={};for(const r of routes||[]){if(!routeIsOpen(r)||!r.driver_id)continue;m[r.driver_id]=(m[r.driver_id]||0)+1;}return m;}
  function rankDrivers(route,drivers,routes){
    const load=routeLoadMap(routes||[]),need=shiftForRoute(route);
    return (drivers||[]).map(d=>{
      let score=50,reasons=[];
      if(driverAvailable(d)){score+=28;reasons.push('disponibile');}
      else if(driverUnavailable(d)){score-=70;reasons.push('non disponibile');}
      const sh=txt(d.shift).toUpperCase();
      if(need&&sh){if(sh.includes(need)){score+=18;reasons.push('turno compatibile');}else{score-=10;reasons.push('turno diverso');}}
      if(truthy(d.double_ok)){score+=8;reasons.push('doppio turno consentito');}
      const l=load[d.id]||0;if(l){score-=l*14;reasons.push(`${l} giro/i già assegnati`);}else reasons.push('nessun giro attivo');
      const extra=num(d.extra_hours);if(extra>0){score-=Math.min(extra,20)*0.6;reasons.push(`${extra}h extra mese`);}
      return {id:d.id,name:txt(d.name)||'Autista',score:Math.max(0,Math.min(100,Math.round(score))),reasons,available:driverAvailable(d)};
    }).sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name,'it'));
  }
  function buildSnapshot(input={}){
    const drivers=input.drivers||[],vans=input.vans||[],routes=input.routes||[],emergencies=input.emergencies||[];
    const openRoutes=routes.filter(routeIsOpen),uncovered=openRoutes.filter(routeIsUncovered),openEmergencies=emergencies.filter(emergencyOpen);
    const unavailableDrivers=drivers.filter(driverUnavailable),availableDrivers=drivers.filter(driverAvailable),badVans=vans.filter(vanUnavailable),readyVans=vans.filter(v=>!vanUnavailable(v));
    const assignedDriverIds=new Set(openRoutes.filter(r=>r.driver_id).map(r=>String(r.driver_id)));
    const absentWithRoute=unavailableDrivers.filter(d=>assignedDriverIds.has(String(d.id)));
    const capacityBase=Math.max(1,availableDrivers.length),utilization=Math.round((openRoutes.length/capacityBase)*100);
    let pressure=0;
    pressure+=Math.min(45,uncovered.length*18);
    pressure+=Math.min(25,openEmergencies.reduce((s,e)=>s+priorityRank(e.priority)*3,0));
    pressure+=Math.min(15,badVans.length*5);
    pressure+=Math.min(15,absentWithRoute.length*8);
    if(utilization>100) pressure+=Math.min(20,Math.round((utilization-100)/5));
    pressure=Math.max(0,Math.min(100,pressure));
    const situation=pressure>=70?'CRIT':pressure>=35?'ATT':'OK';
    const exceptions=[];
    uncovered.forEach(r=>exceptions.push({severity:3,type:'Giro scoperto',title:txt(r.code)||'Giro senza codice',detail:[txt(r.zone),txt(r.time_window)].filter(Boolean).join(' · '),route_id:r.id}));
    openEmergencies.forEach(e=>exceptions.push({severity:priorityRank(e.priority),type:'Emergenza',title:txt(e.title)||txt(e.type)||'Emergenza aperta',detail:txt(e.description)||txt(e.notes),emergency_id:e.id}));
    absentWithRoute.forEach(d=>exceptions.push({severity:3,type:'Copertura',title:`${txt(d.name)||'Autista'} non disponibile`,detail:'Ha almeno un giro attivo assegnato',driver_id:d.id}));
    badVans.forEach(v=>exceptions.push({severity:2,type:'Flotta',title:`${txt(v.plate)||'Mezzo'} · ${txt(v.status)||'da verificare'}`,detail:txt(v.note),van_id:v.id}));
    exceptions.sort((a,b)=>b.severity-a.severity||a.type.localeCompare(b.type,'it'));
    const actions=[];
    uncovered.slice(0,4).forEach(r=>{const cand=rankDrivers(r,drivers,routes)[0];actions.push({severity:3,title:`Copri ${txt(r.code)||'giro scoperto'}`,detail:cand?`Prima opzione: ${cand.name} · score operativo ${cand.score}/100`:'Nessun autista candidabile',target:'giri',route_id:r.id});});
    openEmergencies.filter(e=>priorityRank(e.priority)>=3).slice(0,3).forEach(e=>actions.push({severity:3,title:`Gestisci: ${txt(e.title)||'emergenza critica'}`,detail:txt(e.description)||'Apri il dettaglio e assegna un responsabile',target:'emergenze',emergency_id:e.id}));
    badVans.slice(0,2).forEach(v=>actions.push({severity:2,title:`Verifica mezzo ${txt(v.plate)||''}`.trim(),detail:txt(v.status)||'Stato mezzo non operativo',target:'flotta',van_id:v.id}));
    if(!actions.length)actions.push({severity:1,title:'Nessuna eccezione critica',detail:'Controlla il piano e conferma la copertura prima del prossimo picco operativo',target:'dashboard'});
    return {
      generated_at:new Date().toISOString(),situation,pressure,utilization,
      metrics:{drivers_total:drivers.length,drivers_available:availableDrivers.length,drivers_unavailable:unavailableDrivers.length,routes_open:openRoutes.length,routes_uncovered:uncovered.length,emergencies_open:openEmergencies.length,vans_ready:readyVans.length,vans_unavailable:badVans.length},
      exceptions,actions,
      trust:{mode:'RULE_BASED_OPERATIONAL_INTELLIGENCE',gps_connected:false,predictive_eta:false,note:'Nessun ETA o posizione viene inventato senza feed GPS reale.'}
    };
  }
  return {buildSnapshot,rankDrivers,routeIsUncovered,driverUnavailable,driverAvailable,vanUnavailable,emergencyOpen};
});
