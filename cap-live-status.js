(function(){
'use strict';
const CHANNEL_TTL=5*60*1000;
const channels=new Map();
let health={ok:null,checkedAt:0,latencyMs:null,version:null,error:null};
let checking=false,timer=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const apiBase=()=>String(window.API_BASE||window.CapOfficeBridge?.API_BASE||(typeof API!=='undefined'?API:'')).replace(/\/$/,'');
function age(ms){if(!ms)return 'mai';const s=Math.max(0,Math.round((Date.now()-ms)/1000));if(s<10)return 'ora';if(s<60)return `${s}s fa`;const m=Math.round(s/60);return m<60?`${m} min fa`:`${Math.round(m/60)} h fa`;}
function activeFailures(){const now=Date.now();return [...channels.entries()].filter(([,v])=>v.ok===false&&now-v.at<CHANNEL_TTL);}
function snapshot(){
  const offline=navigator.onLine===false;
  const failed=activeFailures();
  let state='CHECK',label='Verifica sistema',detail='Stato backend in verifica';
  if(offline){state='OFFLINE';label='Offline';detail='Nessuna rete: non considerare i dati come aggiornati.';}
  else if(health.ok===false){state='DOWN';label='Backend non disponibile';detail='Modalità degradata: i dati live non sono confermati.';}
  else if(failed.length){state='DEGRADED';label='Dati parzialmente degradati';detail='Almeno una fonte CAP non ha risposto correttamente.';}
  else if(health.ok===true){state='LIVE';label='Backend verificato';detail=`Ultimo controllo ${age(health.checkedAt)}${health.latencyMs!=null?` · ${health.latencyMs} ms`:''}`;}
  return {state,label,detail,health:{...health},failed:failed.map(([channel,v])=>({channel,...v}))};
}
function mount(){
  const top=document.querySelector('.top');if(!top)return null;
  let el=document.getElementById('cap-live-status');
  if(el)return el;
  el=document.createElement('div');el.id='cap-live-status';el.className='cap-live-status';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
  const anchor=document.getElementById('cap-security-rail')||top.querySelector('.resilience-banner')||top.lastElementChild;
  if(anchor&&anchor.parentNode===top)top.insertBefore(el,anchor.nextSibling);else top.appendChild(el);
  el.addEventListener('click',e=>{if(e.target.closest('[data-cap-live-retry]'))check(true)});
  return el;
}
function render(){
  const el=mount();if(!el)return;const s=snapshot();
  const failed=s.failed.length?` · ${s.failed.map(x=>esc(x.channel)).join(', ')}`:'';
  el.className=`cap-live-status ${s.state.toLowerCase()}`;
  el.innerHTML=`<span class="cap-live-dot"></span><div class="cap-live-copy"><b>${esc(s.label)}</b><small>${esc(s.detail)}${failed}</small></div><button type="button" data-cap-live-retry ${checking?'disabled':''}>${checking?'VERIFICA…':'RIPROVA'}</button>`;
}
function report(channel,ok,detail=''){
  const key=String(channel||'unknown').slice(0,40);channels.set(key,{ok:ok===true,detail:String(detail||'').slice(0,160),at:Date.now()});render();
}
async function fetchHealth(path){
  const base=apiBase();if(!base)throw new Error('API base assente');const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),8000),started=Date.now();
  try{const r=await fetch(base+path,{cache:'no-store',signal:ctrl.signal});const body=await r.json().catch(()=>({}));if(!r.ok||body.ok!==true)throw new Error(body.error||`HTTP ${r.status}`);return {body,latencyMs:Date.now()-started};}finally{clearTimeout(timeout)}
}
async function check(force=false){
  if(checking)return snapshot();if(!force&&health.checkedAt&&Date.now()-health.checkedAt<30000)return snapshot();checking=true;render();
  try{
    let out;try{out=await fetchHealth('/health/ready')}catch(_e){out=await fetchHealth('/health')}
    health={ok:true,checkedAt:Date.now(),latencyMs:Number(out.body.db_latency_ms??out.latencyMs),version:out.body.version||null,error:null};
  }catch(e){health={ok:false,checkedAt:Date.now(),latencyMs:null,version:null,error:e?.name==='AbortError'?'timeout':String(e?.message||'errore')};}
  finally{checking=false;render()}
  return snapshot();
}
window.CapLiveStatus={report,check,snapshot};
window.addEventListener('online',()=>check(true));window.addEventListener('offline',render);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check(false)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{render();setTimeout(()=>check(true),350)});else{render();setTimeout(()=>check(true),350)}
timer=setInterval(()=>{if(document.visibilityState==='visible')check(false)},60*1000);
})();
