'use strict';
const assert=require('assert');

const store={};
globalThis.localStorage={getItem:k=>Object.prototype.hasOwnProperty.call(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v)}};
globalThis.fetch=async(url)=>{
  if(String(url).includes('/branches/main'))return {ok:true,json:async()=>({commit:{sha:'abc123'},protected:false})};
  if(String(url).includes('/contents/office/runtime-v9.js'))return {ok:true,json:async()=>({type:'file',sha:'file123',size:4,encoding:'base64',content:Buffer.from('TEST').toString('base64')})};
  return {ok:false,status:404,json:async()=>({})};
};

let originalCalls=[];
let recoveryCalls=[];
globalThis.OfficeAI={
  run:async(prompt,opts)=>{
    originalCalls.push({prompt,opts});
    if(String(prompt).trim()==='OFFICE_OK')return {text:'OFFICE_OK',primary:{text:'OFFICE_OK',gateway:'puter',provider:'openai',model:'gpt-5.6-luna'},review:null,verified:true,degraded:false,exactContract:{matched:true}};
    return {
      text:'Bozza iniziale\n\n---\nRevisione Skeptic: VERDICT: WARN\nCorreggi.',
      primary:{text:'Bozza iniziale',gateway:'puter',provider:'openai',model:'gpt-5.6-luna'},
      review:{text:'VERDICT: WARN\nCorreggi.',gateway:'puter',provider:'anthropic',model:'claude-opus-4-8'},
      verified:false,degraded:false,trace:['puter:gpt-5.6-luna','puter:claude-opus-4-8']
    };
  },
  status:()=>({version:'8.5.0'}),
  __v83:{exactDirective:p=>String(p).trim().toUpperCase()==='OFFICE_OK'?'OFFICE_OK':null},
  __v85:{
    resilientChat:async(role,prompt,opts)=>{
      recoveryCalls.push({role,prompt,opts});
      if(role==='director')return {text:'Risposta corretta',gateway:'puter',provider:'openai',model:'gpt-5.6-luna'};
      if(role==='skeptic')return {text:'VERDICT: PASS\nCorrezioni recepite.',gateway:'puter',provider:'anthropic',model:'claude-opus-4-8'};
      if(role==='scout')return {text:'Ricerca aggiornata verificata dallo Scout',gateway:'puter',provider:'openai',model:'gpt-5.6-luna'};
      throw new Error('unexpected role');
    }
  }
};

const mod=require('../office/runtime-v9.js');

(async()=>{
  assert.equal(mod.VERSION,'9.0.0');
  assert.equal(globalThis.OfficeAI.__v9Installed,true);

  const caps=globalThis.OfficeAI.tools.capabilities();
  assert.equal(caps.runtime,'9.0.0');
  assert.ok(caps.tools.find(x=>x.name==='repo.status'&&x.available));
  assert.ok(caps.tools.find(x=>x.name==='repo.write'&&!x.available&&x.approval));
  assert.ok(caps.tools.find(x=>x.name==='tests.run'&&!x.available));

  const repo=await globalThis.OfficeAI.tools.execute('repo.status');
  assert.equal(repo.ok,true);
  assert.equal(repo.value.sha,'abc123');

  const file=await globalThis.OfficeAI.tools.execute('repo.file',{path:'office/runtime-v9.js'});
  assert.equal(file.ok,true);
  assert.equal(file.value.content,'TEST');

  const denied=await globalThis.OfficeAI.tools.execute('repo.write',{path:'x'});
  assert.equal(denied.ok,false);
  assert.equal(denied.available,false);
  assert.equal(denied.approvalRequired,true);

  const note=await globalThis.OfficeAI.tools.execute('memory.note',{title:'Regola',body:'errore -> correzione'});
  assert.equal(note.ok,true);

  const result=await globalThis.OfficeAI.run('Analizza questa decisione',{role:'director'});
  assert.equal(result.text,'Risposta corretta');
  assert.equal(result.verified,true);
  assert.equal(result.revision.attempted,true);
  assert.equal(result.revision.firstVerdict,'warn');
  assert.equal(result.revision.finalVerdict,'pass');
  assert.equal(recoveryCalls[0].role,'director');
  assert.equal(recoveryCalls[1].role,'skeptic');

  const withTools=await globalThis.OfficeAI.run('Controlla il repository GitHub e fai benchmark competitor',{role:'director'});
  assert.ok(withTools.tools.used.some(x=>x.tool==='capabilities.snapshot'));
  assert.ok(withTools.tools.used.some(x=>x.tool==='web.research')||withTools.tools.used.some(x=>x.tool==='repo.status'));
  assert.ok(originalCalls[1].prompt.includes('EVIDENZE TOOL V9'));

  const exact=await globalThis.OfficeAI.run('OFFICE_OK',{role:'director'});
  assert.equal(exact.text,'OFFICE_OK');
  assert.equal(exact.verified,true);

  const status=globalThis.OfficeAI.status();
  assert.equal(status.version,'9.0.0');
  assert.equal(status.toolRuntime.enabled,true);
  assert.equal(status.autoRevision.enabled,true);
  assert.equal(status.learning.training,false);
  assert.ok(status.learning.stats.runs>=3);
  assert.ok(globalThis.OfficeAI.tools.audit().length>0);
  console.log('office-v9-runtime.test.cjs: ok');
})().catch(e=>{console.error(e);process.exit(1)});
