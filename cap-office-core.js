(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.CapOfficeCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const norm=v=>String(v??'').trim().toLowerCase();
function todayRome(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
function isTodayRoute(r,today){const d=String(r?.service_date||'').slice(0,10);return !d||d===today}
function isUnavailable(d){const x=norm(d?.status||d?.shift);return /malatt|ferie|assen|riposo|indispon/.test(x)}
function isVanReady(v){const x=norm(v?.status);return !x||/operativ|dispon|pront|ok/.test(x)}
function isOpenEmergency(e){return e?.is_open!==false&&!/chius|closed|risolt/.test(norm(e?.status))}
function isUncoveredRoute(r){const x=norm(r?.status);return !r?.driver_id||/scopert|uncover|assegnare/.test(x)}
function buildBriefing(input={}){
  const today=input.today||todayRome();
  const drivers=input.drivers||[],vans=input.vans||[],routes=(input.routes||[]).filter(r=>isTodayRoute(r,today)),emergencies=input.emergencies||[];
  const driverById=new Map(drivers.map(d=>[String(d.id),d]));
  const uncovered=routes.filter(isUncoveredRoute);
  const assignedUnavailable=routes.filter(r=>r.driver_id&&isUnavailable(driverById.get(String(r.driver_id))));
  const vanIssues=vans.filter(v=>!isVanReady(v));
  const openEmergencies=emergencies.filter(isOpenEmergency);
  const items=[];
  uncovered.slice(0,4).forEach(r=>items.push({severity:3,title:`Giro ${r.code||''} scoperto`.trim(),detail:[r.zone,r.time_window].filter(Boolean).join(' · '),target:'giri'}));
  assignedUnavailable.slice(0,3).forEach(r=>items.push({severity:3,title:`Autista non disponibile su ${r.code||'giro'}`,detail:'Verificare sostituzione prima della partenza.',target:'turni'}));
  vanIssues.slice(0,3).forEach(v=>items.push({severity:2,title:`Mezzo ${v.plate||''} da verificare`.trim(),detail:v.note||v.status||'Stato mezzo non pronto.',target:'flotta'}));
  openEmergencies.slice(0,4).forEach(e=>items.push({severity:/alta|urgent|crit/.test(norm(e.priority))?3:2,title:e.title||'Emergenza aperta',detail:e.description||'',target:'emergenze'}));
  const pressure=Math.min(100,uncovered.length*25+assignedUnavailable.length*20+vanIssues.length*8+openEmergencies.length*10);
  return {today,metrics:{routes:routes.length,uncovered:uncovered.length,assigned_unavailable:assignedUnavailable.length,van_issues:vanIssues.length,emergencies:openEmergencies.length},pressure,items:items.sort((a,b)=>b.severity-a.severity).slice(0,8)};
}
function sourceLabel(s){const mode=String(s?.mode||'');if(mode==='LIVE_INTERNAL')return 'LIVE CAP';if(mode==='MANUAL_IMPORT')return 'IMPORT MANUALE';if(mode==='MANUAL_VERIFY')return 'VERIFICA MANUALE';if(mode==='EXTERNAL_UNLINKED')return 'APP ESTERNA';return 'NON DEFINITO'}
return {todayRome,buildBriefing,sourceLabel};
});
