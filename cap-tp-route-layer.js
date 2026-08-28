(function(){
'use strict';
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
let profiles=new Map(),loadedAt=0,loading=false,currentRouteId='';
const val=(v,d='')=>v===null||v===undefined?d:v;
const boolText=v=>v===true?'Sì':v===false?'No':'—';
const stageLabel=s=>({PLANNED:'Pianificato',TP_LOADING:'Carico TP',READY:'Pronto',DEPARTED:'Partito',DELIVERING:'In consegna',RETURNED:'Rientrato',BLOCKED:'Bloccato'}[String(s||'').toUpperCase()]||'Da completare');
function statusOf(p){
  if(!p||!p.updated_at)return {label:'TP da completare',cls:'warn'};
  const st=String(p.tp_stage||'').toUpperCase();
  if(st==='BLOCKED'||p.temperature_ok===false)return {label:'Blocco',cls:'bad'};
  if(st==='RETURNED')return {label:'Rientrato',cls:'ready'};
  if(st==='DEPARTED'||st==='DELIVERING')return {label:stageLabel(st),cls:'ready'};
  if(p.load_ready===true&&p.temperature_ok!==false)return {label:'Pronto',cls:'ready'};
  return {label:stageLabel(st),cls:'warn'};
}
function routeCard(p){
  const st=statusOf(p),stats=[];
  if(p.stops_count!=null)stats.push(`${p.stops_count} consegne`);
  if(p.packages_count!=null)stats.push(`${p.packages_count} colli`);
  if(p.no_lift_stops!=null&&Number(p.no_lift_stops)>0)stats.push(`${p.no_lift_stops} senza asc.`);
  if(p.chilled_required===true||p.frozen_required===true)stats.push('freddo');
  if(p.bread_required===true)stats.push('pane');
  if(p.vehicle_plate)stats.push(p.vehicle_plate);
  return `<div class="captp-route"><div class="captp-route-top"><div><div class="captp-code">${esc(p.code||p.route_id||'Giro')}</div><div class="captp-meta">${esc([p.zone,p.time_window,p.tp_code].filter(Boolean).join(' · ')||'Dati operativi da completare')}</div></div><div class="captp-spacer"></div><span class="captp-chip ${st.cls}">${esc(st.label)}</span><button class="captp-open" data-captp-route="${esc(p.route_id)}">TP</button></div>${stats.length?`<div class="captp-stats">${stats.map(x=>`<span class="captp-stat">${esc(x)}</span>`).join('')}</div>`:'<div class="captp-data-gap">Mancano i dati di carico/TP: il sistema non li stima.</div>'}</div>`;
}
function render(){
  if(typeof state==='undefined')return;
  const main=document.getElementById('main');if(!main)return;
  const old=document.getElementById('captp-today');
  if(state.tab!=='giri'){if(old)old.remove();return}
  const rows=[...profiles.values()];
  const html=`<section id="captp-today" class="captp-wrap"><div class="captp-head"><div><div class="captp-kicker">ESSELUNGA A CASA · TRANSIT POINT</div><div class="captp-title">Prontezza giri di oggi</div><div class="captp-sub">Carico, fascia, freddo, piano e partenza. Solo dati registrati.</div></div><button class="captp-open" id="captp-refresh">AGGIORNA</button></div><div class="captp-list">${rows.length?rows.map(routeCard).join(''):'<div class="captp-route"><div class="captp-meta">Profili TP non ancora disponibili. Premi Aggiorna; se il backend non è ancora aggiornato l’app continua a funzionare senza inventare dati.</div></div>'}</div></section>`;
  if(old)old.outerHTML=html;else main.insertAdjacentHTML('afterbegin',html);
}
async function refreshProfiles(force=false){
  if(loading||typeof api!=='function'||typeof state==='undefined'||state.tab!=='giri')return;
  if(!force&&Date.now()-loadedAt<60000){render();return}
  loading=true;
  try{
    const rows=await api('/api/route-ops/today');
    if(Array.isArray(rows)){profiles=new Map(rows.filter(x=>x&&x.route_id!=null).map(x=>[String(x.route_id),x]));loadedAt=Date.now();render();}
  }catch(e){render();}finally{loading=false}
}
function tri(id,label,v){const x=v===true?'true':v===false?'false':'';return `<div class="captp-field"><label>${esc(label)}</label><select id="${id}"><option value="" ${x===''?'selected':''}>Non indicato</option><option value="true" ${x==='true'?'selected':''}>Sì</option><option value="false" ${x==='false'?'selected':''}>No</option></select></div>`}
function isoLocal(v){if(!v)return '';const d=new Date(v);if(!Number.isFinite(d.getTime()))return '';const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`}
function nval(id){const e=document.getElementById(id);if(!e||e.value==='')return null;const n=Number(e.value);return Number.isFinite(n)?Math.max(0,Math.round(n)):null}
function tval(id){return (document.getElementById(id)?.value||'').trim()||null}
function bval(id){const v=document.getElementById(id)?.value;return v==='true'?true:v==='false'?false:null}
function dtval(id){const v=document.getElementById(id)?.value;return v?new Date(v).toISOString():null}
function modal(){let m=document.getElementById('captp-modal');if(m)return m;m=document.createElement('div');m.id='captp-modal';m.className='captp-modal hidden';m.innerHTML='<div class="captp-sheet" id="captp-sheet"></div>';document.body.appendChild(m);m.addEventListener('click',e=>{if(e.target===m)closeModal()});return m}
function closeModal(){const m=document.getElementById('captp-modal');if(m)m.classList.add('hidden');currentRouteId=''}
async function openRoute(id){
  currentRouteId=String(id);const m=modal(),sheet=document.getElementById('captp-sheet');m.classList.remove('hidden');sheet.innerHTML='<button class="captp-close" data-captp-close>×</button><h2>Profilo TP</h2><p>Caricamento dati reali…</p>';
  let p=profiles.get(currentRouteId)||{route_id:currentRouteId};
  try{const remote=await api(`/api/routes/${encodeURIComponent(currentRouteId)}/ops`);if(remote)p={...p,...remote};}catch(e){sheet.innerHTML='<button class="captp-close" data-captp-close>×</button><h2>Profilo TP</h2><div class="captp-error">Backend TP non disponibile. Nessun dato è stato modificato.</div>';return}
  profiles.set(currentRouteId,p);
  const editable=typeof canEdit==='function'?canEdit():false;
  sheet.innerHTML=`<button class="captp-close" data-captp-close>×</button><div class="captp-kicker">GIRO ${esc(p.code||currentRouteId)}</div><h2>Profilo operativo TP</h2><p>${esc([p.zone,p.time_window].filter(Boolean).join(' · '))}</p>${editable?'':'<div class="captp-readonly">Sola lettura: il tuo ruolo non può modificare il giro.</div>'}<div class="captp-grid"><div class="captp-field"><label>Transit Point</label><input id="captp-tp" value="${esc(val(p.tp_code))}" placeholder="es. Navacchio"></div><div class="captp-field"><label>Mezzo / targa</label><input id="captp-plate" value="${esc(val(p.vehicle_plate))}" placeholder="es. AB123CD"></div><div class="captp-field"><label>Consegne</label><input id="captp-stops" type="number" min="0" inputmode="numeric" value="${esc(val(p.stops_count))}"></div><div class="captp-field"><label>Colli</label><input id="captp-packages" type="number" min="0" inputmode="numeric" value="${esc(val(p.packages_count))}"></div><div class="captp-field"><label>Consegne senza ascensore</label><input id="captp-nolift" type="number" min="0" inputmode="numeric" value="${esc(val(p.no_lift_stops))}"></div><div class="captp-field"><label>Fase TP</label><select id="captp-stage">${['PLANNED','TP_LOADING','READY','DEPARTED','DELIVERING','RETURNED','BLOCKED'].map(x=>`<option value="${x}" ${String(p.tp_stage||'PLANNED').toUpperCase()===x?'selected':''}>${stageLabel(x)}</option>`).join('')}</select></div>${tri('captp-chilled','Fresco / refrigerato',p.chilled_required)}${tri('captp-frozen','Surgelato',p.frozen_required)}${tri('captp-bread','Pane / integrazione pane',p.bread_required)}${tri('captp-load','Carico pronto',p.load_ready)}${tri('captp-temp','Temperatura verificata OK',p.temperature_ok)}<div class="captp-field"><label>Partenza prevista</label><input id="captp-plan" type="datetime-local" value="${esc(isoLocal(p.planned_departure_at))}"></div><div class="captp-field"><label>Partenza reale</label><input id="captp-depart" type="datetime-local" value="${esc(isoLocal(p.actual_departure_at))}"></div><div class="captp-field"><label>Rientro reale</label><input id="captp-return" type="datetime-local" value="${esc(isoLocal(p.actual_return_at))}"></div><div class="captp-field full"><label>Note operative TP</label><textarea id="captp-notes" maxlength="1200">${esc(val(p.notes))}</textarea></div></div><div class="captp-quick"><button data-captp-now="depart">PARTITO ORA</button><button data-captp-now="return">RIENTRATO ORA</button></div><div class="captp-error" id="captp-error"></div><button class="captp-save" id="captp-save">SALVA PROFILO TP</button><div class="captp-trust">Non inserire dati stimati. Se temperatura, colli, piano o orari non sono disponibili, lasciali non indicati. Il sistema li tratterà come data gap.</div>`;
  if(!editable)sheet.querySelectorAll('input,select,textarea,button:not(.captp-close)').forEach(e=>e.disabled=true);
}
function payload(){return {tp_code:tval('captp-tp'),vehicle_plate:tval('captp-plate'),stops_count:nval('captp-stops'),packages_count:nval('captp-packages'),no_lift_stops:nval('captp-nolift'),chilled_required:bval('captp-chilled'),frozen_required:bval('captp-frozen'),bread_required:bval('captp-bread'),load_ready:bval('captp-load'),temperature_ok:bval('captp-temp'),tp_stage:tval('captp-stage')||'PLANNED',planned_departure_at:dtval('captp-plan'),actual_departure_at:dtval('captp-depart'),actual_return_at:dtval('captp-return'),notes:tval('captp-notes')}}
async function saveProfile(){if(!currentRouteId)return;const btn=document.getElementById('captp-save'),er=document.getElementById('captp-error');if(btn)btn.disabled=true;if(er)er.textContent='';try{const saved=await api(`/api/routes/${encodeURIComponent(currentRouteId)}/ops`,{method:'PATCH',body:JSON.stringify(payload())});profiles.set(currentRouteId,{...(profiles.get(currentRouteId)||{}),...saved});loadedAt=Date.now();if(typeof toast==='function')toast('Profilo TP salvato');window.dispatchEvent(new Event('cap-route-ops-updated'));closeModal();render();}catch(e){if(er)er.textContent=e.message||'Salvataggio non riuscito';}finally{if(btn)btn.disabled=false}}
function setNow(kind){const id=kind==='return'?'captp-return':'captp-depart',el=document.getElementById(id);if(!el)return;const d=new Date(),p=n=>String(n).padStart(2,'0');el.value=`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;const st=document.getElementById('captp-stage');if(st)st.value=kind==='return'?'RETURNED':'DEPARTED'}
document.addEventListener('click',e=>{const r=e.target.closest('[data-captp-route]');if(r){openRoute(r.getAttribute('data-captp-route'));return}if(e.target.closest('[data-captp-close]')){closeModal();return}if(e.target.id==='captp-refresh'){loadedAt=0;refreshProfiles(true);return}if(e.target.id==='captp-save'){saveProfile();return}const n=e.target.closest('[data-captp-now]');if(n)setNow(n.getAttribute('data-captp-now'))});
window.addEventListener('cap-route-ops-updated',()=>{loadedAt=0;refreshProfiles(true)});
window.addEventListener('online',()=>refreshProfiles(true));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')refreshProfiles(false)});
setInterval(()=>{render();refreshProfiles(false)},5000);
setTimeout(()=>{render();refreshProfiles(true)},300);
})();
