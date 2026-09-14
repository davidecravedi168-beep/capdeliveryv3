(function(root,factory){
'use strict';
var api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root&&root.OfficeAI)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
var VERSION='9.0.0';
var REPO='davidecravedi168-beep/capdeliveryv3';
var AUDIT_KEY='officeV9ToolAudit';
var LEARN_KEY='officeV9EvalMemory';
var CACHE_TTL=60000;
var cache={repoStatus:null,repoStatusAt:0};

function now(){return Date.now();}
function text(v){return String(v==null?'':v);}
function errText(e){return String((e&&e.message)||e||'errore sconosciuto').replace(/\s+/g,' ').slice(0,420);}
function safeParse(v,f){try{return JSON.parse(v);}catch(e){return f;}}
function storage(){try{return root.localStorage||null;}catch(e){return null;}}
function readJSON(key,fallback){var s=storage();if(!s)return fallback;try{return safeParse(s.getItem(key),fallback)||fallback;}catch(e){return fallback;}}
function writeJSON(key,value){var s=storage();if(!s)return false;try{s.setItem(key,JSON.stringify(value));return true;}catch(e){return false;}}
function audit(event){var items=readJSON(AUDIT_KEY,[]);items.unshift(Object.assign({at:new Date().toISOString()},event||{}));items=items.slice(0,250);writeJSON(AUDIT_KEY,items);return items[0];}
function auditList(){return readJSON(AUDIT_KEY,[]);}

function learning(){return readJSON(LEARN_KEY,{runs:0,verified:0,degraded:0,revised:0,byModel:{},last:null});}
function recordRun(result,ms){
  var l=learning();l.runs++;
  if(result&&result.verified)l.verified++;
  if(result&&result.degraded)l.degraded++;
  if(result&&result.revision&&result.revision.attempted)l.revised++;
  var p=result&&result.primary||{};var model=p.model||'unknown';
  var m=l.byModel[model]||{runs:0,verified:0,degraded:0,avgLatencyMs:0};
  m.runs++;if(result&&result.verified)m.verified++;if(result&&result.degraded)m.degraded++;
  m.avgLatencyMs=Math.round(((m.avgLatencyMs||0)*(m.runs-1)+(Number(ms)||0))/m.runs);
  l.byModel[model]=m;l.last={at:new Date().toISOString(),model:model,verified:!!(result&&result.verified),degraded:!!(result&&result.degraded),latencyMs:Number(ms)||0};
  writeJSON(LEARN_KEY,l);return l;
}

function decode64(v){
  v=text(v).replace(/\s+/g,'');
  if(typeof root.atob==='function')return decodeURIComponent(Array.prototype.map.call(root.atob(v),function(c){return'%'+('00'+c.charCodeAt(0).toString(16)).slice(-2);}).join(''));
  if(typeof Buffer!=='undefined')return Buffer.from(v,'base64').toString('utf8');
  return '';
}
function validPath(path){path=text(path).trim();return !!path&&path.length<220&&!/(^|\/)\.\.(\/|$)/.test(path)&&/^[A-Za-z0-9._\/-]+$/.test(path);}
function fetchJSON(url,ms){
  if(typeof root.fetch!=='function')return Promise.reject(new Error('fetch non disponibile'));
  var timer;var t=new Promise(function(_,reject){timer=setTimeout(function(){reject(new Error('tool fetch timeout'));},ms||12000);});
  return Promise.race([root.fetch(url,{headers:{'Accept':'application/vnd.github+json'}}).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}),t]).finally(function(){clearTimeout(timer);});
}

var definitions={
  'capabilities.snapshot':{risk:'read',approval:false,available:true,description:'Stato reale degli strumenti V9 e dei limiti operativi.'},
  'repo.status':{risk:'read',approval:false,available:true,description:'Legge lo stato pubblico del branch main di capdeliveryv3.'},
  'repo.file':{risk:'read',approval:false,available:true,description:'Legge un file testuale pubblico del repository capdeliveryv3.'},
  'web.research':{risk:'read',approval:false,available:true,description:'Ricerca tramite Scout con web_search quando il provider lo supporta.'},
  'memory.note':{risk:'local-write',approval:false,available:true,description:'Salva una nota solo nel localStorage del browser.'},
  'repo.write':{risk:'external-write',approval:true,available:false,description:'Scrittura GitHub non disponibile dal sito statico: richiede un bridge autenticato.'},
  'tests.run':{risk:'execution',approval:true,available:false,description:'Esecuzione test non disponibile in GitHub Pages: richiede runner/backend collegato.'}
};
function capabilitySnapshot(){
  return {runtime:VERSION,repo:REPO,tools:Object.keys(definitions).map(function(k){return{name:k,risk:definitions[k].risk,approval:definitions[k].approval,available:definitions[k].available,description:definitions[k].description};}),policy:{auto:['read','local-write'],humanApproval:['external-write','execution','destructive'],secretsInFrontend:false},truth:'Gli strumenti non disponibili non vengono simulati.'};
}

function install(ctx){
  var base=ctx.OfficeAI;
  if(!base||base.__v9Installed)return base;
  var originalRun=base.run, originalStatus=base.status;
  if(typeof originalRun!=='function')return base;

  async function execute(name,args,opts){
    name=text(name);args=args||{};opts=opts||{};
    var d=definitions[name];
    if(!d)return {ok:false,error:'Tool sconosciuto: '+name};
    if(!d.available){
      var unavailable={ok:false,tool:name,available:false,approvalRequired:!!d.approval,error:d.description};
      audit({type:'tool',tool:name,status:'unavailable',risk:d.risk});return unavailable;
    }
    if(d.approval&&!opts.approved){
      audit({type:'tool',tool:name,status:'approval-required',risk:d.risk});
      return {ok:false,tool:name,approvalRequired:true,risk:d.risk,error:'Approvazione umana richiesta'};
    }
    var started=now();audit({type:'tool',tool:name,status:'start',risk:d.risk});
    try{
      var value;
      if(name==='capabilities.snapshot')value=capabilitySnapshot();
      else if(name==='repo.status'){
        if(cache.repoStatus&&now()-cache.repoStatusAt<CACHE_TTL)value=cache.repoStatus;
        else{
          var b=await fetchJSON('https://api.github.com/repos/'+REPO+'/branches/main',12000);
          value={repo:REPO,branch:'main',sha:b&&b.commit&&b.commit.sha||null,protected:!!(b&&b.protected)};
          cache.repoStatus=value;cache.repoStatusAt=now();
        }
      }else if(name==='repo.file'){
        var path=text(args.path).trim();if(!validPath(path))throw new Error('Percorso file non valido');
        var f=await fetchJSON('https://api.github.com/repos/'+REPO+'/contents/'+path+'?ref=main',12000);
        if(!f||f.type!=='file')throw new Error('Risorsa non testuale o non trovata');
        value={repo:REPO,path:path,sha:f.sha||null,size:f.size||0,content:f.encoding==='base64'?decode64(f.content||''):text(f.content||'')};
        if(value.content.length>18000)value.content=value.content.slice(0,18000)+'\n[TRONCATO]';
      }else if(name==='web.research'){
        if(!base.__v85||typeof base.__v85.resilientChat!=='function')throw new Error('Scout web non disponibile nel runtime corrente');
        var q=text(args.query||args.prompt).trim();if(!q)throw new Error('Query vuota');
        value=await base.__v85.resilientChat('scout',q,{history:[],webSearch:true,timeout:Math.max(60000,Number(opts.timeout)||0)});
        if(value&&value.degraded)throw new Error(value.reason||'Scout degradato');
      }else if(name==='memory.note'){
        var notes=readJSON('officeV9Notes',[]);notes.unshift({at:new Date().toISOString(),title:text(args.title||'Nota').slice(0,120),body:text(args.body||'').slice(0,12000)});notes=notes.slice(0,100);writeJSON('officeV9Notes',notes);value={saved:true,count:notes.length};
      }
      audit({type:'tool',tool:name,status:'success',risk:d.risk,durationMs:now()-started});
      return {ok:true,tool:name,risk:d.risk,durationMs:now()-started,value:value};
    }catch(e){
      audit({type:'tool',tool:name,status:'error',risk:d.risk,durationMs:now()-started,error:errText(e)});
      return {ok:false,tool:name,risk:d.risk,durationMs:now()-started,error:errText(e)};
    }
  }

  function intent(prompt){
    var p=text(prompt),names=[];
    function add(n){if(names.indexOf(n)<0)names.push(n);}
    if(/\b(repository|repo|github|branch|commit|codebase|runtime|auto.?implement|implementa|implementazione|test)\b/i.test(p))add('capabilities.snapshot');
    if(/\b(repository|repo|github|branch|commit|codebase)\b/i.test(p))add('repo.status');
    if(/\b(competitor|concorrent|benchmark|ricerca web|cerca sul web|latest|aggiornat|novit[aà]|mercato)\b/i.test(p))add('web.research');
    var m=p.match(/\b((?:office|tests|\.github)\/[A-Za-z0-9._\/-]+)\b/);if(m)add('repo.file');
    return {tools:names.slice(0,2),filePath:m&&m[1]||null};
  }
  async function collectEvidence(prompt,opts){
    if(opts&&opts.tools===false)return [];
    var i=intent(prompt),out=[];
    for(var x=0;x<i.tools.length;x++){
      var n=i.tools[x],args={};
      if(n==='repo.file')args.path=i.filePath;
      if(n==='web.research')args.query='Ricerca aggiornata e concisa per The Office. Richiesta utente: '+text(prompt).slice(0,5000);
      var r=await execute(n,args,{timeout:opts&&opts.timeout});
      out.push(r);
    }
    return out;
  }
  function evidenceText(items){
    if(!items||!items.length)return '';
    return '\n\n[EVIDENZE TOOL V9 — dati ottenuti realmente, non simulati]\n'+items.map(function(r){
      if(!r.ok)return '- '+r.tool+': NON DISPONIBILE/ERRORE — '+r.error;
      var v=r.value;
      if(r.tool==='web.research')return '- '+r.tool+': '+text(v&&v.text||'').slice(0,6500);
      if(r.tool==='repo.file')return '- '+r.tool+' '+v.path+' sha '+v.sha+':\n'+text(v.content).slice(0,6500);
      return '- '+r.tool+': '+JSON.stringify(v).slice(0,6500);
    }).join('\n')+'\n[FINE EVIDENZE TOOL V9]';
  }
  function verdict(review){
    var t=text(review&&review.text||review).toUpperCase();
    if(/VERDICT\s*:\s*PASS/.test(t))return 'pass';
    if(/VERDICT\s*:\s*WARN/.test(t))return 'warn';
    if(/VERDICT\s*:\s*FAIL/.test(t))return 'fail';
    return 'unknown';
  }
  async function revise(originalPrompt,first,opts){
    var v1=verdict(first&&first.review);if(v1!=='warn'&&v1!=='fail')return first;
    if(!base.__v85||typeof base.__v85.resilientChat!=='function')return first;
    var draft=text(first&&first.primary&&first.primary.text||first.text);
    var critique=text(first&&first.review&&first.review.text);
    var correctionPrompt='Richiesta originale:\n'+originalPrompt+'\n\nRisposta precedente:\n'+draft+'\n\nRevisione Skeptic:\n'+critique+'\n\nCorreggi tutti i rilievi validi. Restituisci SOLO la nuova risposta finale, senza commentare il processo di revisione. Mantieni fatti, limiti e stato delle azioni aderenti a cio che e stato realmente verificato.';
    try{
      var corrected=await base.__v85.resilientChat('director',correctionPrompt,{history:[],timeout:opts&&opts.timeout,webSearch:false,avoidModel:first&&first.primary&&first.primary.model});
      var secondPrompt='Richiesta originale:\n'+originalPrompt+'\n\nRisposta corretta da revisionare:\n'+text(corrected&&corrected.text)+'\n\nPrima riga obbligatoria: VERDICT: PASS, VERDICT: WARN oppure VERDICT: FAIL. Controlla soprattutto fatti non verificati, limiti degli strumenti, sicurezza e rispetto della richiesta. Poi massimo 5 punti.';
      var second=await base.__v85.resilientChat('skeptic',secondPrompt,{history:[],timeout:opts&&opts.timeout,webSearch:false,avoidModel:corrected&&corrected.model});
      var v2=verdict(second),pass=v2==='pass',blocked=v2==='fail';
      var out=Object.assign({},first,{text:text(corrected&&corrected.text),primary:corrected,review:second,verified:pass,degraded:false,blocked:blocked});
      out.trace=(first.trace||[]).concat(['revision:'+text(corrected&&corrected.gateway)+':'+text(corrected&&corrected.model),'review2:'+text(second&&second.gateway)+':'+text(second&&second.model)]);
      out.revision={attempted:true,firstVerdict:v1,finalVerdict:v2,cycles:1,success:pass,blocked:blocked};
      if(!pass)out.text+='\n\n---\nRevisione finale Skeptic: '+text(second&&second.text);
      audit({type:'revision',status:pass?'pass':v2,firstVerdict:v1,finalVerdict:v2});
      return out;
    }catch(e){
      first.revision={attempted:true,firstVerdict:v1,finalVerdict:'error',cycles:1,success:false,error:errText(e)};
      audit({type:'revision',status:'error',error:errText(e)});return first;
    }
  }

  async function run(prompt,opts){
    opts=opts||{};var started=now();
    var exact=base.__v83&&typeof base.__v83.exactDirective==='function'?base.__v83.exactDirective(prompt):null;
    var evidence=exact?[]:await collectEvidence(prompt,opts);
    var enriched=text(prompt)+evidenceText(evidence);
    var first=await originalRun(enriched,opts);
    if(first)first.tools={used:evidence,capabilities:capabilitySnapshot()};
    var finalResult=first;
    if(first&&!first.degraded&&!exact&&opts.autoRevise!==false)finalResult=await revise(text(prompt),first,opts);
    if(finalResult)finalResult.tools=first&&first.tools||{used:evidence,capabilities:capabilitySnapshot()};
    recordRun(finalResult,now()-started);
    return finalResult;
  }
  function status(){
    var s=typeof originalStatus==='function'?originalStatus():{};
    s.version=VERSION;
    s.toolRuntime={enabled:true,repo:REPO,registered:Object.keys(definitions).length,available:Object.keys(definitions).filter(function(k){return definitions[k].available;}).length,approvalPolicy:'human-for-external-write-execution-destructive'};
    s.autoRevision={enabled:true,maxCycles:1,blockOnFinalFail:true};
    s.learning={mode:'telemetry-eval-memory',training:false,stats:learning()};
    return s;
  }

  base.run=run;
  base.status=status;
  base.tools={execute:execute,list:function(){return capabilitySnapshot().tools;},capabilities:capabilitySnapshot,audit:auditList,intent:intent};
  base.learning={status:learning};
  base.__v9Installed=true;
  base.__v9={execute:execute,intent:intent,collectEvidence:collectEvidence,verdict:verdict,revise:revise,recordRun:recordRun};
  return base;
}

return {VERSION:VERSION,install:install,definitions:definitions,capabilitySnapshot:capabilitySnapshot};
});
