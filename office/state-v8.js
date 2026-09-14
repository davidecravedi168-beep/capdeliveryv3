(function(){'use strict';
const KEY='theOfficeV8';
const now=()=>new Date().toISOString();
const AGENTS=[
{id:'director',emoji:'🐶',name:'Director',animal:'Boxer',role:'Coordina, decide e sintetizza',provider:'OpenAI',on:true},
{id:'scout',emoji:'🦮',name:'Scout',animal:'Retriever',role:'Ricerca web, fonti e benchmark',provider:'OpenAI',on:true},
{id:'analyst',emoji:'🐱',name:'Analyst',animal:'Gatto',role:'Dati, confronti e scenari',provider:'Google',on:true},
{id:'skeptic',emoji:'🦉',name:'Skeptic',animal:'Gufo',role:'Dissenso, errori e qualità',provider:'Anthropic',on:true},
{id:'builder',emoji:'🐻‍❄️',name:'Builder',animal:'Orso',role:'Piani, codice e implementazione',provider:'xAI',on:true},
{id:'sentinel',emoji:'🐕‍🦺',name:'Sentinel',animal:'Rottweiler',role:'Sicurezza, permessi e rischi',provider:'OpenAI',on:true},
{id:'wildcard',emoji:'🦊',name:'Wildcard',animal:'Volpe',role:'Alternative e idee fuori schema',provider:'xAI',on:true},
{id:'archivist',emoji:'🐢',name:'Archivist',animal:'Tartaruga',role:'Memoria, contesto e conoscenza',provider:'Auto',on:true},
{id:'auditor',emoji:'🦔',name:'Auditor',animal:'Riccio',role:'Controllo finale e tracciabilità',provider:'Anthropic',on:true}
];
const BASE={version:8,view:'home',agents:AGENTS,tasks:[],approvals:[],projects:[{id:'office',name:'The Office',stage:'Operational',progress:78},{id:'cap',name:'CAP Delivery',stage:'Operations',progress:68}],notes:[],events:[],results:[],audit:[],chat:[{id:'welcome',at:now(),by:'Director',me:false,txt:'Ufficio pronto. Collega il motore AI e assegnami un lavoro: vedrai quali agenti vengono scelti, cosa stanno facendo e il risultato finale.'}],round:[],runs:[],settings:{execution:'balanced',approval:'sensitive',maxAgents:4,autoWeb:true},improve:{cycles:0,proposals:[]}};
const clone=o=>JSON.parse(JSON.stringify(o));
function normalize(s){
 if(!s||s.version!==8)return clone(BASE);
 s.agents=Array.isArray(s.agents)?s.agents:clone(AGENTS);
 AGENTS.forEach(a=>{if(!s.agents.some(x=>x.id===a.id))s.agents.push(clone(a));});
 ['tasks','approvals','projects','notes','events','results','audit','chat','round','runs'].forEach(k=>{if(!Array.isArray(s[k]))s[k]=clone(BASE[k]);});
 s.settings=Object.assign({},BASE.settings,s.settings||{});s.improve=Object.assign({},BASE.improve,s.improve||{});s.view=s.view||'home';return s;
}
function load(){try{return normalize(JSON.parse(localStorage.getItem(KEY)||'null'));}catch(e){return clone(BASE)}}
let data=load();
function save(){try{localStorage.setItem(KEY,JSON.stringify(data));}catch(e){}}
function stamp(){return new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'})}
function audit(txt,kind='info'){data.audit.unshift({id:'a'+Date.now()+Math.random(),at:now(),time:stamp(),kind,txt});data.audit=data.audit.slice(0,250);save();}
function agent(id){return data.agents.find(a=>a.id===id)||data.agents[0]}
function task(title,owner='Director',meta={}){const t={id:'t'+Date.now()+Math.random().toString(16).slice(2),title,owner,status:'queued',progress:0,createdAt:now(),updatedAt:now(),runId:null,detail:'In coda',...meta};data.tasks.unshift(t);audit('Task creato: '+title,'task');return t;}
function patchTask(id,patch){const t=data.tasks.find(x=>x.id===id);if(!t)return null;Object.assign(t,patch,{updatedAt:now()});save();return t;}
function chat(by,txt,me=false,meta={}){data.chat.push({id:'c'+Date.now()+Math.random(),at:now(),by,txt,me,...meta});data.chat=data.chat.slice(-120);save();}
function result(title,body,meta={}){const r={id:'r'+Date.now()+Math.random().toString(16).slice(2),title,body,at:now(),type:'AI deliverable',...meta};data.results.unshift(r);data.results=data.results.slice(0,80);audit('Risultato prodotto: '+title,'result');return r;}
function approval(title,reason,meta={}){const a={id:'p'+Date.now()+Math.random().toString(16).slice(2),title,reason,state:'pending',at:now(),...meta};data.approvals.unshift(a);audit('Approvazione richiesta: '+title,'approval');return a;}
function run(taskId,title,team){const r={id:'run'+Date.now()+Math.random().toString(16).slice(2),taskId,title,team,startedAt:now(),endedAt:null,status:'running',events:[],outputs:{},final:null,error:null};data.runs.unshift(r);data.runs=data.runs.slice(0,50);save();return r;}
function runEvent(runId,agentId,status,text){const r=data.runs.find(x=>x.id===runId);if(!r)return;r.events.push({at:now(),agentId,status,text});r.events=r.events.slice(-100);save();}
function reset(){data=clone(BASE);save();}
window.OfficeState={get:()=>data,save,audit,agent,task,patchTask,chat,result,approval,run,runEvent,reset,now};
})();