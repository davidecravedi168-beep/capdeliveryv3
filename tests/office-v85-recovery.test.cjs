'use strict';
const assert=require('assert');
let chats=[];
let primaryGptFailed=false;

globalThis.puter={ai:{
  listModels:async()=>[
    {id:'gpt-5.6-luna',provider:'openai'},
    {id:'claude-opus-4-8',provider:'anthropic'},
    {id:'gemini-3-pro',provider:'google'}
  ],
  chat:async(messages,testMode,options)=>{
    chats.push({messages,testMode,options});
    const user=messages[messages.length-1].content;
    if(user.includes('CONTRATTO OUTPUT VINCOLANTE')) return {message:{content:'OFFICE_OK'}};
    if(user.includes('Prima riga obbligatoria')) return {message:{content:'VERDICT: PASS\n- recovery verificata'}};
    if(options.model==='gpt-5.6-luna'&&!primaryGptFailed){
      primaryGptFailed=true;
      throw new Error('temporary timeout');
    }
    return {message:{content:'RECOVERED'}};
  }
}};

globalThis.OfficeAI={
  run:async()=>({
    text:'Modalita degradata',
    primary:{text:'Modalita degradata',gateway:'local',model:'deterministic-fallback',provider:'local',degraded:true,reason:'Puter: timeout | Pollinations: key assente'},
    review:null,verified:false,degraded:true
  }),
  status:()=>({version:'8.4.0'}),
  __v83:{
    exactDirective:(p)=>String(p).trim().toUpperCase()==='OFFICE_OK'?'OFFICE_OK':null,
    strictPrompt:(x)=>'CONTRATTO OUTPUT VINCOLANTE\n'+x
  }
};

const v85=require('../office/runtime-v85.js');

(async()=>{
  assert.equal(v85.adaptiveTimeout('x',0),45000);
  assert.equal(v85.adaptiveTimeout('x'.repeat(6000),0),75000);
  assert.equal(v85.adaptiveTimeout('x'.repeat(13000),0),90000);

  const recovered=await globalThis.OfficeAI.run('fammi un piano',{role:'director',verify:true});
  assert.equal(recovered.degraded,false);
  assert.equal(recovered.recovered,true);
  assert.equal(recovered.text,'RECOVERED');
  assert.equal(recovered.verified,true);
  assert.equal(recovered.primary.gateway,'puter');
  assert.equal(recovered.primary.model,'claude-opus-4-8');
  assert.equal(recovered.review.gateway,'puter');
  assert.ok(chats.some(x=>x.options.model==='gpt-5.6-luna'));
  assert.ok(chats.some(x=>x.options.model==='claude-opus-4-8'));
  assert.ok(chats.every(x=>x.testMode===false));

  const canary=await globalThis.OfficeAI.run('OFFICE_OK',{role:'director',verify:true});
  assert.equal(canary.text,'OFFICE_OK');
  assert.equal(canary.verified,true);
  assert.equal(canary.review,null);
  assert.equal(canary.exactContract.matched,true);

  const status=globalThis.OfficeAI.status();
  assert.equal(status.version,'8.5.0');
  assert.equal(status.resilience.adaptiveTimeout,true);
  assert.equal(status.resilience.dynamicModelDiscovery,true);
  assert.equal(status.resilience.maxRecoveryAttempts,2);

  console.log('office-v85-recovery.test.cjs: ok');
})().catch(e=>{console.error(e);process.exit(1)});
