(function(root,factory){
'use strict';
var api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root&&root.OfficeAI)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
var VERSION='8.2.0';
var DEFAULT_TIMEOUT=30000;
var diag={lastError:null,lastSuccess:null,lastModel:null};

function textOf(r){
  if(r==null)return '';
  if(typeof r==='string')return r.trim();
  if(typeof r.text==='string')return r.text.trim();
  var m=r.message||(r.choices&&r.choices[0]&&r.choices[0].message);
  if(m){
    if(typeof m.content==='string')return m.content.trim();
    if(Array.isArray(m.content))return m.content.map(function(x){return typeof x==='string'?x:(x&&x.text)||''}).join('\n').trim();
  }
  if(r.choices&&r.choices[0]&&typeof r.choices[0].text==='string')return r.choices[0].text.trim();
  return '';
}
function timeout(p,ms,label){
  var timer;
  var t=new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error((label||'AI')+' timeout'));},ms||DEFAULT_TIMEOUT);});
  return Promise.race([p,t]).finally(function(){clearTimeout(timer);});
}
function errText(e){return String((e&&e.msg)||(e&&e.message)||e||'errore sconosciuto').replace(/\s+/g,' ').slice(0,300);}
function providerForModel(model){
  model=String(model||'').toLowerCase();
  if(model.indexOf('claude')===0)return 'anthropic';
  if(model.indexOf('gemini')===0)return 'google';
  if(model.indexOf('grok')===0)return 'xai';
  return 'openai';
}
function modelForRole(role,forceModel){
  if(forceModel)return forceModel;
  if(role==='skeptic'||role==='sentinel')return 'claude-opus-4-8';
  return 'gpt-5.6-luna';
}
function systemFor(role){
  var common='Sei un agente di The Office. Rispondi in italiano. Separa fatti, ipotesi e limiti. Non fingere verifiche o azioni non eseguite.';
  var extra={
    director:' Coordina e restituisci una decisione operativa con rischi e prossimi passi.',
    scout:' Cerca evidenze quando lo strumento web è disponibile e segnala ciò che non hai verificato.',
    analyst:' Analizza alternative, dati, trade-off e probabilità.',
    skeptic:' Sei il revisore indipendente: cerca errori, omissioni e affermazioni non supportate.',
    builder:' Produci una soluzione implementabile con test e rollback.',
    wildcard:' Proponi alternative non ovvie ma realistiche.',
    sentinel:' Controlla sicurezza, privacy, permessi e reversibilità.'
  };
  return common+(extra[role]||extra.director);
}
function buildMessages(role,prompt,history){
  var out=[{role:'system',content:systemFor(role)}];
  (history||[]).slice(-10).forEach(function(m){if(m&&m.content)out.push({role:m.role==='assistant'?'assistant':'user',content:String(m.content).slice(0,6000)});});
  out.push({role:'user',content:String(prompt||'')});
  return out;
}
function puterCallArgs(role,prompt,opts){
  opts=opts||{};
  var model=modelForRole(role,opts.forceModel);
  var options={model:model,normalize:true};
  if(role==='scout'&&opts.webSearch!==false)options.tools=[{type:'web_search'}];
  return {messages:buildMessages(role,prompt,opts.history),testMode:false,options:options,model:model};
}
async function fixedPuter(role,prompt,opts){
  if(!root.puter||!root.puter.ai||typeof root.puter.ai.chat!=='function')throw new Error('Puter.js non disponibile');
  var args=puterCallArgs(role,prompt,opts);
  try{
    /* Important: call AI directly. Puter essential APIs handle auth automatically. */
    var pending=root.puter.ai.chat(args.messages,args.testMode,args.options);
    var raw=await timeout(pending,(opts&&opts.timeout)||DEFAULT_TIMEOUT,'Puter');
    var text=textOf(raw);
    if(!text)throw new Error('Puter ha restituito una risposta vuota');
    diag.lastError=null;diag.lastSuccess=new Date().toISOString();diag.lastModel=args.model;
    return {text:text,gateway:'puter',model:args.model,provider:providerForModel(args.model),runtime:'8.2'};
  }catch(e){
    diag.lastError=errText(e);diag.lastModel=args.model;
    throw e;
  }
}
function verdict(text){
  var t=String(text||'').toUpperCase();
  if(/VERDICT\s*:\s*PASS/.test(t))return 'pass';
  if(/VERDICT\s*:\s*WARN/.test(t))return 'warn';
  return 'unknown';
}
function extractPrimary(r){return r&&r.primary?r.primary:r;}

function install(ctx){
  var base=ctx.OfficeAI;
  if(!base||base.__v82Installed)return base;
  var originalRun=base.run;
  var originalStatus=base.status;
  var originalLocal=base.localFallback;

  async function pollinationsOrLocal(role,prompt,opts,reason){
    if(typeof originalRun==='function'){
      var r=await originalRun(prompt,{role:role,history:(opts&&opts.history)||[],gateway:'pollinations',verify:false,timeout:opts&&opts.timeout,webSearch:opts&&opts.webSearch});
      var p=extractPrimary(r);
      if(p&&p.degraded&&reason)p.reason=(reason+' | '+(p.reason||'')).slice(0,500);
      return p;
    }
    return originalLocal?originalLocal(prompt,reason):{text:'Modalità degradata: '+reason,gateway:'local',model:'fallback',provider:'local',degraded:true,reason:reason};
  }
  async function invoke(role,prompt,opts){
    try{return await fixedPuter(role,prompt,opts||{});}
    catch(e){return pollinationsOrLocal(role,prompt,opts||{},'Puter: '+errText(e));}
  }
  async function run(prompt,opts){
    opts=opts||{};
    var role=opts.role||'director';
    var primary=await invoke(role,prompt,opts);
    var out={text:primary.text,primary:primary,review:null,verified:false,degraded:!!primary.degraded,trace:[primary.gateway+':'+primary.model]};
    if(primary.degraded||opts.verify===false)return out;
    var reviewPrompt='Richiesta originale:\n'+prompt+'\n\nBozza da revisionare:\n'+primary.text+'\n\nPrima riga obbligatoria: VERDICT: PASS oppure VERDICT: WARN. Poi massimo 5 punti con errori, omissioni o correzioni.';
    var reviewModel=primary.model==='claude-opus-4-8'?'gpt-5.6-luna':'claude-opus-4-8';
    var review=await invoke('skeptic',reviewPrompt,{history:[],forceModel:reviewModel,timeout:opts.timeout,webSearch:false});
    out.review=review;
    out.trace.push(review.gateway+':'+review.model);
    out.verified=!review.degraded&&verdict(review.text)==='pass';
    if(!review.degraded&&verdict(review.text)==='warn')out.text=primary.text+'\n\n---\nRevisione Skeptic: '+review.text;
    return out;
  }
  async function round(prompt,opts){
    opts=opts||{};
    var roles=opts.roles||['analyst','skeptic','wildcard'];
    var entries=await Promise.all(roles.map(function(role){return invoke(role,prompt,{history:opts.history||[],webSearch:role==='scout',timeout:opts.timeout});}));
    var joined=roles.map(function(role,i){return role.toUpperCase()+':\n'+entries[i].text;}).join('\n\n');
    var decision=await invoke('director','Tema della Tavola Rotonda:\n'+prompt+'\n\nInterventi indipendenti:\n'+joined+'\n\nSintetizza consenso, dissenso, rischi e prossimi 3 passi.',{history:opts.history||[],timeout:opts.timeout});
    return {entries:roles.map(function(role,i){return {role:role,result:entries[i]};}),decision:decision,degraded:entries.every(function(x){return x.degraded;})||decision.degraded};
  }
  async function test(){
    var r=await invoke('director','Rispondi esattamente con: OFFICE_OK',{verify:false,timeout:15000,webSearch:false});
    return {ok:!r.degraded&&/OFFICE_OK/i.test(r.text),result:r};
  }
  function status(){
    var s=typeof originalStatus==='function'?originalStatus():{};
    s.version=VERSION;
    s.hotfix='direct-puter-auto-auth';
    s.auth={mode:'automatic-by-puter'};
    try{s.auth.puterSignedIn=!!(ctx.puter&&ctx.puter.auth&&ctx.puter.auth.isSignedIn&&ctx.puter.auth.isSignedIn());}catch(e){s.auth.puterSignedIn=false;}
    s.runtime82={lastError:diag.lastError,lastSuccess:diag.lastSuccess,lastModel:diag.lastModel};
    return s;
  }
  base.run=run;
  base.round=round;
  base.test=test;
  base.status=status;
  base.__v82Installed=true;
  base.__v82={fixedPuter:fixedPuter,puterCallArgs:puterCallArgs,diag:diag};
  return base;
}

return {VERSION:VERSION,install:install,puterCallArgs:puterCallArgs,buildMessages:buildMessages,modelForRole:modelForRole,textOf:textOf,verdict:verdict};
});
