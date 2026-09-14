(function(root,factory){
'use strict';
var api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root&&root.OfficeAI)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
var VERSION='8.5.0';
var diag={lastRecovery:null,lastFailure:null,lastModel:null,attempts:0};

function textOf(r){
  if(r==null)return '';
  if(typeof r==='string')return r.trim();
  if(typeof r.text==='string')return r.text.trim();
  var m=r.message||(r.choices&&r.choices[0]&&r.choices[0].message);
  if(m){
    if(typeof m.content==='string')return m.content.trim();
    if(Array.isArray(m.content))return m.content.map(function(x){return typeof x==='string'?x:(x&&x.text)||'';}).join('\n').trim();
  }
  if(r.choices&&r.choices[0]&&typeof r.choices[0].text==='string')return r.choices[0].text.trim();
  return '';
}
function errText(e){return String((e&&e.msg)||(e&&e.message)||e||'errore sconosciuto').replace(/\s+/g,' ').slice(0,360);}
function wait(ms){return new Promise(function(resolve){setTimeout(resolve,ms);});}
function withTimeout(p,ms,label){
  var timer;
  var t=new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error((label||'AI')+' timeout'));},ms);});
  return Promise.race([p,t]).finally(function(){clearTimeout(timer);});
}
function adaptiveTimeout(prompt,requested){
  var n=String(prompt||'').length;
  var floor=n>12000?90000:n>5000?75000:45000;
  return Math.max(Number(requested)||0,floor);
}
function providerForModel(model){
  var id=String(model||'').toLowerCase();
  if(id.indexOf('claude')>=0)return 'anthropic';
  if(id.indexOf('gemini')>=0)return 'google';
  if(id.indexOf('grok')>=0)return 'xai';
  if(id.indexOf('qwen')>=0)return 'alibaba';
  return 'openai';
}
function systemFor(role){
  var common='Sei un agente di The Office. Rispondi in italiano. Separa fatti, ipotesi e limiti. Non fingere verifiche o azioni non eseguite.';
  var extra={director:' Coordina e restituisci una decisione operativa con rischi e prossimi passi.',scout:' Cerca evidenze quando lo strumento web e disponibile e segnala cio che non hai verificato.',analyst:' Analizza alternative, dati, trade-off e probabilita.',skeptic:' Sei il revisore indipendente: cerca errori, omissioni e affermazioni non supportate.',builder:' Produci una soluzione implementabile con test e rollback.',wildcard:' Proponi alternative non ovvie ma realistiche.',sentinel:' Controlla sicurezza, privacy, permessi e reversibilita.'};
  return common+(extra[role]||extra.director);
}
function messagesFor(role,prompt,history){
  var out=[{role:'system',content:systemFor(role)}];
  (history||[]).slice(-8).forEach(function(m){if(m&&m.content)out.push({role:m.role==='assistant'?'assistant':'user',content:String(m.content).slice(0,5000)});});
  out.push({role:'user',content:String(prompt||'')});
  return out;
}
function scoreModel(id,role,avoid){
  id=String(id||'');
  if(!id||id===avoid)return -9999;
  var s=0;
  if(role==='skeptic'||role==='sentinel'){
    if(/claude-opus-4-8/i.test(id))s+=150;
    else if(/claude-(opus|sonnet)/i.test(id))s+=130;
    else if(/gemini/i.test(id))s+=110;
    else if(/gpt-5/i.test(id))s+=100;
  }else{
    if(/gpt-5\.6-luna/i.test(id))s+=150;
    else if(/gpt-5\.6/i.test(id))s+=140;
    else if(/claude-(opus|sonnet)/i.test(id))s+=125;
    else if(/gemini/i.test(id))s+=115;
    else if(/gpt-5/i.test(id))s+=105;
  }
  if(/nano|mini|flash-lite/i.test(id))s-=25;
  return s;
}
async function modelCandidates(role,avoid){
  var preferred=role==='skeptic'||role==='sentinel'?'claude-opus-4-8':'gpt-5.6-luna';
  var out=[];
  function add(id){id=String(id||'');if(id&&id!==avoid&&out.indexOf(id)<0)out.push(id);}
  add(preferred);
  if(root.puter&&root.puter.ai&&typeof root.puter.ai.listModels==='function'){
    try{
      var items=await withTimeout(root.puter.ai.listModels(),8000,'Puter model list');
      (Array.isArray(items)?items:[]).map(function(m){return{id:m&&m.id,score:scoreModel(m&&m.id,role,avoid)};})
        .filter(function(x){return x.score>-9000;}).sort(function(a,b){return b.score-a.score;}).slice(0,6).forEach(function(x){add(x.id);});
    }catch(e){}
  }
  if(role==='skeptic'||role==='sentinel'){add('gpt-5.6-luna');}else{add('claude-opus-4-8');}
  return out.slice(0,4);
}
async function resilientChat(role,prompt,opts){
  opts=opts||{};
  if(!root.puter||!root.puter.ai||typeof root.puter.ai.chat!=='function')throw new Error('Puter.js non disponibile');
  var timeout=adaptiveTimeout(prompt,opts.timeout);
  var candidates=await modelCandidates(role,opts.avoidModel);
  var errors=[];
  var max=Math.min(2,candidates.length);
  for(var i=0;i<max;i++){
    var model=candidates[i];
    try{
      diag.attempts++;
      var options={model:model,normalize:true};
      if(role==='scout'&&opts.webSearch!==false)options.tools=[{type:'web_search'}];
      if(i>0)await wait(350);
      var raw=await withTimeout(root.puter.ai.chat(messagesFor(role,prompt,opts.history),false,options),timeout,'Puter recovery');
      var text=textOf(raw);
      if(!text)throw new Error('Puter ha restituito una risposta vuota');
      diag.lastRecovery=new Date().toISOString();diag.lastFailure=null;diag.lastModel=model;
      return {text:text,gateway:'puter',provider:providerForModel(model),model:model,runtime:'8.5',recovered:true,recoveryAttempt:i+1};
    }catch(e){
      errors.push(model+': '+errText(e));
      diag.lastFailure=errors.join(' | ').slice(0,700);diag.lastModel=model;
    }
  }
  throw new Error(errors.join(' | ')||'Nessun modello di recovery disponibile');
}
function verdict(text){
  var t=String(text||'').toUpperCase();
  if(/VERDICT\s*:\s*PASS/.test(t))return 'pass';
  if(/VERDICT\s*:\s*WARN/.test(t))return 'warn';
  if(/VERDICT\s*:\s*FAIL/.test(t))return 'fail';
  return 'unknown';
}
function install(ctx){
  var base=ctx.OfficeAI;
  if(!base||base.__v85Installed)return base;
  var originalRun=base.run;
  var originalStatus=base.status;
  if(typeof originalRun!=='function')return base;

  async function recover(prompt,opts,previous){
    opts=opts||{};
    var exact=base.__v83&&typeof base.__v83.exactDirective==='function'?base.__v83.exactDirective(prompt):null;
    var actualPrompt=exact&&base.__v83&&typeof base.__v83.strictPrompt==='function'?base.__v83.strictPrompt(exact):prompt;
    var role=opts.role||'director';
    try{
      var primary=await resilientChat(role,actualPrompt,{history:exact?[]:(opts.history||[]),timeout:opts.timeout,webSearch:opts.webSearch});
      if(exact){
        var actual=String(primary.text||'').trim();
        var matched=actual===exact;
        return {text:matched?exact:actual,primary:primary,review:null,verified:matched,degraded:false,trace:['recovery:'+primary.gateway+':'+primary.model],exactContract:{mode:'deterministic',expected:exact,actual:actual,matched:matched},verificationMode:'exact-output',recovered:true,recovery:{from:previous&&previous.primary&&previous.primary.reason||'degraded',attempted:true,success:true}};
      }
      var out={text:primary.text,primary:primary,review:null,verified:false,degraded:false,trace:['recovery:'+primary.gateway+':'+primary.model],recovered:true,recovery:{from:previous&&previous.primary&&previous.primary.reason||'degraded',attempted:true,success:true}};
      if(opts.verify===false)return out;
      var reviewPrompt='Richiesta originale:\n'+prompt+'\n\nBozza da revisionare:\n'+primary.text+'\n\nPrima riga obbligatoria: VERDICT: PASS, VERDICT: WARN oppure VERDICT: FAIL. Poi massimo 5 punti con errori, omissioni o correzioni.';
      try{
        var review=await resilientChat('skeptic',reviewPrompt,{history:[],timeout:opts.timeout,webSearch:false,avoidModel:primary.model});
        out.review=review;out.trace.push('review:'+review.gateway+':'+review.model);
        var v=verdict(review.text);
        out.verified=v==='pass';
        if(v==='warn'||v==='fail')out.text=primary.text+'\n\n---\nRevisione Skeptic: '+review.text;
      }catch(e){
        out.review={text:'Revisione non completata: '+errText(e),gateway:'local',provider:'local',model:'review-fallback',degraded:true,reason:errText(e)};
        out.trace.push('review:local:degraded');
      }
      return out;
    }catch(e){
      if(previous){previous.recovery={attempted:true,success:false,error:errText(e)};return previous;}
      throw e;
    }
  }

  async function run(prompt,opts){
    var first=await originalRun(prompt,opts||{});
    if(!first||!first.degraded)return first;
    return recover(prompt,opts||{},first);
  }
  function status(){
    var s=typeof originalStatus==='function'?originalStatus():{};
    s.version=VERSION;
    s.resilience={adaptiveTimeout:true,maxRecoveryAttempts:2,dynamicModelDiscovery:true};
    s.runtime85={lastRecovery:diag.lastRecovery,lastFailure:diag.lastFailure,lastModel:diag.lastModel,attempts:diag.attempts};
    return s;
  }
  base.run=run;
  base.status=status;
  base.__v85Installed=true;
  base.__v85={adaptiveTimeout:adaptiveTimeout,modelCandidates:modelCandidates,resilientChat:resilientChat,diag:diag};
  return base;
}

return {VERSION:VERSION,install:install,adaptiveTimeout:adaptiveTimeout,modelCandidates:modelCandidates,textOf:textOf,verdict:verdict};
});
