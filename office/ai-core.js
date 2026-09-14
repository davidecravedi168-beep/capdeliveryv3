(function(root,factory){
  var api=factory(root||{});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.OfficeAI=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

var VERSION='8.0.0';
var HEALTH_KEY='officeAiHealthV8';
var PREF_KEY='officeAiPrefsV8';
var POLLI_KEY='officePollinationsPkV8';
var DEFAULT_TIMEOUT=26000;
var CIRCUIT_FAILURES=2;
var CIRCUIT_COOLDOWN=120000;
var modelCache={at:0,items:[]};

var ROLE_HINTS={
  director:{providers:['openai','anthropic','google'],patterns:[/gpt-5\.6-sol/i,/gpt-5\.6-terra/i,/gpt-5\.6-luna/i,/gpt-5\.6/i,/claude-opus/i,/gemini/i]},
  scout:{providers:['openai','google','perplexity'],patterns:[/gpt-5\.6-luna/i,/gpt-5\.6/i,/gemini/i,/perplexity/i]},
  analyst:{providers:['openai','anthropic','google'],patterns:[/gpt-5\.6-sol/i,/gpt-5\.6-terra/i,/gpt-5\.6-luna/i,/claude-opus/i,/gemini/i]},
  skeptic:{providers:['anthropic','google','openai'],patterns:[/claude-opus/i,/claude-sonnet/i,/gemini/i,/gpt-5\.6/i]},
  builder:{providers:['openai','anthropic','google','qwen'],patterns:[/gpt-5\.6-sol/i,/gpt-5\.6-luna/i,/coder/i,/claude-sonnet/i,/gemini/i]},
  wildcard:{providers:['google','xai','openai'],patterns:[/gemini/i,/grok/i,/gpt-5\.6/i]},
  sentinel:{providers:['anthropic','openai','google'],patterns:[/claude-opus/i,/claude-sonnet/i,/gpt-5\.6/i,/gemini/i]},
  archivist:{providers:['openai','google'],patterns:[/gpt-5\.6-luna/i,/gemini/i]}
};

function now(){return Date.now()}
function safeParse(s,fallback){try{return JSON.parse(s)}catch(e){return fallback}}
function storage(kind){try{return root[kind]||null}catch(e){return null}}
function readJSON(kind,key,fallback){var s=storage(kind);if(!s)return fallback;try{return safeParse(s.getItem(key),fallback)||fallback}catch(e){return fallback}}
function writeJSON(kind,key,value){var s=storage(kind);if(!s)return;try{s.setItem(key,JSON.stringify(value))}catch(e){}}
function prefs(){var p=readJSON('localStorage',PREF_KEY,{puter:true,verify:true});if(typeof p.puter!=='boolean')p.puter=true;if(typeof p.verify!=='boolean')p.verify=true;return p}
function setPrefs(next){var p=prefs();Object.keys(next||{}).forEach(function(k){p[k]=next[k]});writeJSON('localStorage',PREF_KEY,p);return p}
function health(){return readJSON('sessionStorage',HEALTH_KEY,{puter:{fails:0,openUntil:0},pollinations:{fails:0,openUntil:0}})}
function saveHealth(h){writeJSON('sessionStorage',HEALTH_KEY,h)}
function publishableKey(){var s=storage('sessionStorage');if(!s)return '';try{return s.getItem(POLLI_KEY)||''}catch(e){return ''}}
function isPublishableKey(k){return /^pk_[A-Za-z0-9._-]{6,}$/.test(String(k||'').trim())}
function setPollinationsKey(k){k=String(k||'').trim();if(!isPublishableKey(k))throw new Error('Usa solo una chiave Pollinations publishable pk_. Le chiavi segrete sk_ non vanno nel browser.');var s=storage('sessionStorage');if(!s)throw new Error('Session storage non disponibile');s.setItem(POLLI_KEY,k);return true}
function clearPollinationsKey(){var s=storage('sessionStorage');if(s)try{s.removeItem(POLLI_KEY)}catch(e){}}

function errorText(e){return String(e&&e.message||e||'errore sconosciuto').replace(/\s+/g,' ').slice(0,240)}
function classifyError(e){var t=errorText(e).toLowerCase();if(/budget|quota|credit|payment|billing|insufficient/.test(t))return 'budget';if(/timeout|aborted|abort/.test(t))return 'timeout';if(/401|403|auth|login|sign.?in|unauthor/.test(t))return 'auth';if(/429|rate/.test(t))return 'rate';if(/network|fetch|offline|failed to fetch/.test(t))return 'network';return 'provider'}
function mark(provider,ok,e){var h=health();var x=h[provider]||{fails:0,openUntil:0};if(ok){x.fails=0;x.openUntil=0;x.lastSuccess=new Date().toISOString();x.lastError=null;x.lastKind=null}else{x.fails=(x.fails||0)+1;x.lastError=errorText(e);x.lastKind=classifyError(e);x.lastFailure=new Date().toISOString();if(x.fails>=CIRCUIT_FAILURES)x.openUntil=now()+CIRCUIT_COOLDOWN}h[provider]=x;saveHealth(h);return x}
function isOpen(provider){var x=health()[provider]||{};return Number(x.openUntil||0)>now()}

function timeoutPromise(promise,ms,label){var timer;var timeout=new Promise(function(_,reject){timer=setTimeout(function(){var e=new Error((label||'provider')+' timeout');e.code='TIMEOUT';reject(e)},ms||DEFAULT_TIMEOUT)});return Promise.race([promise,timeout]).finally(function(){clearTimeout(timer)})}
function extractText(r){if(r==null)return '';if(typeof r==='string')return r;if(typeof r.text==='string')return r.text;var m=r.message||r.choices&&r.choices[0]&&r.choices[0].message;if(m){if(typeof m.content==='string')return m.content;if(Array.isArray(m.content))return m.content.map(function(b){return typeof b==='string'?b:(b&&b.text)||''}).join('\n').trim()}if(r.choices&&r.choices[0]&&typeof r.choices[0].text==='string')return r.choices[0].text;return ''}
function cleanText(s){return String(s||'').replace(/^```(?:markdown|text)?\s*/i,'').replace(/```\s*$/,'').trim()}

function normalizeProvider(p){p=String(p||'').toLowerCase();if(p==='anthropic')return 'anthropic';if(p==='google')return 'google';if(p==='xai')return 'xai';if(p==='openai')return 'openai';return p}
async function listModels(){if(modelCache.items.length&&now()-modelCache.at<10*60*1000)return modelCache.items;if(!root.puter||!root.puter.ai||typeof root.puter.ai.listModels!=='function')return [];try{var items=await timeoutPromise(root.puter.ai.listModels(),8000,'Puter model list');modelCache={at:now(),items:Array.isArray(items)?items:[]};return modelCache.items}catch(e){return []}}
function scoreModel(m,role,providerPin,avoidModel){var id=String(m&&m.id||'');var provider=normalizeProvider(m&&m.provider||'');if(!id||id===avoidModel)return -9999;if(providerPin&&provider!==normalizeProvider(providerPin))return -9999;var hint=ROLE_HINTS[role]||ROLE_HINTS.director;var score=0;var pi=hint.providers.indexOf(provider);if(pi>=0)score+=80-pi*10;for(var i=0;i<hint.patterns.length;i++)if(hint.patterns[i].test(id)){score+=120-i*8;break}if(/nano|mini|flash-lite/i.test(id))score-=15;if(/preview/i.test(id))score-=3;return score}
async function choosePuterModel(role,providerPin,avoidModel){var items=await listModels();if(items.length){var ranked=items.map(function(m){return{m:m,s:scoreModel(m,role,providerPin,avoidModel)}}).filter(function(x){return x.s>-9000}).sort(function(a,b){return b.s-a.s});if(ranked.length)return {id:ranked[0].m.id,provider:ranked[0].m.provider||providerPin||'auto'}}var fallback=role==='skeptic'||role==='sentinel'?'claude-opus-4-8':'gpt-5.6-luna';return{id:fallback,provider:providerPin||'auto'}}

function systemPrompt(role){var common='Sei un agente di The Office. Rispondi in italiano, con fatti separati da ipotesi. Non fingere di aver eseguito azioni o verifiche che non hai eseguito. Se mancano dati, dichiaralo. Mantieni il testo operativo e conciso.';var extra={director:'Coordina gli specialisti e restituisci una decisione con prossimi passi e rischi.',scout:'Cerca evidenze e fonti quando gli strumenti lo consentono; segnala cosa non hai verificato.',analyst:'Analizza dati, alternative, costi, probabilita e trade-off.',skeptic:'Sei il revisore indipendente. Cerca errori, omissioni, affermazioni non supportate e failure mode.',builder:'Trasforma l obiettivo in una soluzione implementabile, con criteri di test e rollback.',wildcard:'Proponi alternative non ovvie ma realistiche, spiegando perche potrebbero funzionare.',archivist:'Organizza il contesto e preserva decisioni, vincoli e assunzioni.',sentinel:'Controlla sicurezza, privacy, permessi, reversibilita e necessita di conferma umana.'};return common+' '+(extra[role]||extra.director)}
function messagesFor(role,prompt,history){var msgs=[{role:'system',content:systemPrompt(role)}];(history||[]).slice(-10).forEach(function(m){if(!m||!m.content)return;msgs.push({role:m.role==='assistant'?'assistant':'user',content:String(m.content).slice(0,6000)})});msgs.push({role:'user',content:String(prompt||'')});return msgs}

async function callPuter(role,prompt,opts){if(isOpen('puter'))throw new Error('Puter circuit open');if(!root.puter||!root.puter.ai||typeof root.puter.ai.chat!=='function')throw new Error('Puter non disponibile');var chosen=await choosePuterModel(role,opts&&opts.modelProvider,opts&&opts.avoidModel);var options={model:chosen.id,normalize:true};if(role==='scout'&&opts&&opts.webSearch!==false)options.tools=[{type:'web_search'}];if(opts&&opts.modelProvider)options.provider=normalizeProvider(opts.modelProvider);var resp=await timeoutPromise(root.puter.ai.chat(messagesFor(role,prompt,opts&&opts.history),options),opts&&opts.timeout||DEFAULT_TIMEOUT,'Puter');var text=cleanText(extractText(resp));if(!text)throw new Error('Puter ha restituito una risposta vuota');mark('puter',true);return{text:text,gateway:'puter',model:chosen.id,provider:chosen.provider||options.provider||'auto'}}

function pollinationsModel(role){if(role==='skeptic'||role==='sentinel')return 'claude-opus-4.7';if(role==='wildcard')return 'gemini';return 'gpt-5.6-luna'}
async function callPollinations(role,prompt,opts){if(isOpen('pollinations'))throw new Error('Pollinations circuit open');var key=publishableKey();if(!isPublishableKey(key))throw new Error('Pollinations publishable key non configurata');if(typeof root.fetch!=='function')throw new Error('fetch non disponibile');var ctrl=typeof AbortController!=='undefined'?new AbortController():null;var timer=ctrl?setTimeout(function(){ctrl.abort()},opts&&opts.timeout||DEFAULT_TIMEOUT):null;try{var res=await root.fetch('https://gen.pollinations.ai/v1/chat/completions',{method:'POST',headers:{'Authorization':'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:pollinationsModel(role),messages:messagesFor(role,prompt,opts&&opts.history)}),signal:ctrl?ctrl.signal:undefined});var body=await res.text();var data=safeParse(body,{error:{message:body.slice(0,240)}});if(!res.ok)throw new Error(data&&data.error&&data.error.message||('Pollinations HTTP '+res.status));var text=cleanText(extractText(data));if(!text)throw new Error('Pollinations ha restituito una risposta vuota');mark('pollinations',true);return{text:text,gateway:'pollinations',model:pollinationsModel(role),provider:'pollinations'}}finally{if(timer)clearTimeout(timer)}}

function localFallback(prompt,reason){var topic=String(prompt||'').trim();var kind=/codic|app|svilupp|bug|implement/i.test(topic)?'implementazione':/ricerc|mercato|font|competitor/i.test(topic)?'ricerca':/decid|scegli|confront/i.test(topic)?'decisione':'analisi';return {text:'Modalita degradata: nessun provider AI esterno ha completato il run. La richiesta e stata salvata e l ufficio non si blocca.\n\nObiettivo rilevato: '+(topic||'richiesta senza testo')+'\nTipo di lavoro: '+kind+'.\nProssimo passo sicuro: riprovare quando un provider torna disponibile oppure configurare un secondo gateway. Nessuna risposta AI viene simulata come se fosse verificata.',gateway:'local',model:'deterministic-fallback',provider:'local',degraded:true,reason:reason||'provider unavailable'} }

async function invoke(role,prompt,opts){opts=opts||{};var pref=String(opts.gateway||'auto').toLowerCase();var p=prefs();var errors=[];if(pref==='local')return localFallback(prompt,'forced local');if((pref==='auto'||pref==='puter')&&p.puter!==false){try{return await callPuter(role,prompt,opts)}catch(e){mark('puter',false,e);errors.push('Puter: '+errorText(e));if(pref==='puter')return localFallback(prompt,errors.join(' | '))}}if(pref==='auto'||pref==='pollinations'){try{return await callPollinations(role,prompt,opts)}catch(e){mark('pollinations',false,e);errors.push('Pollinations: '+errorText(e));if(pref==='pollinations')return localFallback(prompt,errors.join(' | '))}}return localFallback(prompt,errors.join(' | ')||'nessun gateway abilitato')}

function verdict(text){var t=String(text||'').toUpperCase();if(/VERDICT\s*:\s*PASS/.test(t))return 'pass';if(/VERDICT\s*:\s*WARN/.test(t))return 'warn';return 'unknown'}
async function run(prompt,opts){opts=opts||{};var role=opts.role||'director';var primary=await invoke(role,prompt,opts);var out={text:primary.text,primary:primary,review:null,verified:false,degraded:!!primary.degraded,trace:[primary.gateway+':'+primary.model]};if(primary.degraded||opts.verify===false||prefs().verify===false)return out;var reviewPrompt='Richiesta originale:\n'+prompt+'\n\nBozza da revisionare:\n'+primary.text+'\n\nFai una revisione indipendente. Prima riga obbligatoria: VERDICT: PASS oppure VERDICT: WARN. Poi massimo 5 punti con errori, omissioni o correzioni. Non riscrivere tutta la risposta.';var review=await invoke('skeptic',reviewPrompt,{history:[],avoidModel:primary.model,modelProvider:primary.provider==='anthropic'?'google':'anthropic',timeout:opts.timeout,webSearch:false});out.review=review;out.trace.push(review.gateway+':'+review.model);out.verified=!review.degraded&&verdict(review.text)==='pass';if(!review.degraded&&verdict(review.text)==='warn')out.text=primary.text+'\n\n---\nRevisione Skeptic: '+review.text;return out}

async function round(prompt,opts){opts=opts||{};var roles=opts.roles||['analyst','skeptic','wildcard'];var entries=await Promise.all(roles.map(function(role){return invoke(role,prompt,{history:opts.history||[],gateway:opts.gateway||'auto',verify:false,webSearch:role==='scout'})}));var joined=roles.map(function(role,i){return role.toUpperCase()+':\n'+entries[i].text}).join('\n\n');var decision=await invoke('director','Tema della Tavola Rotonda:\n'+prompt+'\n\nInterventi indipendenti:\n'+joined+'\n\nSintetizza la decisione. Distingui consenso, dissenso, rischi e prossimi 3 passi. Non affermare che un punto e verificato se gli interventi non lo dimostrano.',{history:opts.history||[],gateway:opts.gateway||'auto',verify:false});return{entries:roles.map(function(role,i){return{role:role,result:entries[i]}}),decision:decision,degraded:entries.every(function(x){return x.degraded})||decision.degraded}}

async function test(){var r=await invoke('director','Rispondi esattamente con: OFFICE_OK',{verify:false,timeout:12000,webSearch:false});return{ok:!r.degraded&&/OFFICE_OK/i.test(r.text),result:r}}
function status(){var h=health(),p=prefs(),key=publishableKey();return{version:VERSION,puter:{enabled:p.puter!==false,available:!!(root.puter&&root.puter.ai),circuitOpen:isOpen('puter'),health:h.puter||{}},pollinations:{configured:isPublishableKey(key),circuitOpen:isOpen('pollinations'),health:h.pollinations||{}},verify:p.verify!==false}}

return{VERSION:VERSION,run:run,round:round,test:test,status:status,setPrefs:setPrefs,setPollinationsKey:setPollinationsKey,clearPollinationsKey:clearPollinationsKey,localFallback:localFallback,__test:{extractText:extractText,classifyError:classifyError,isPublishableKey:isPublishableKey,systemPrompt:systemPrompt,verdict:verdict,scoreModel:scoreModel}};
});
