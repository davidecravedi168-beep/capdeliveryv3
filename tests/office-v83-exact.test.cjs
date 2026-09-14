'use strict';
const assert=require('assert');
let calls=[];
globalThis.OfficeAI={
  run:async(prompt,opts)=>{
    calls.push({prompt,opts});
    if(prompt.includes('CONTRATTO OUTPUT VINCOLANTE'))return {text:'OFFICE_OK',primary:{text:'OFFICE_OK',gateway:'puter',provider:'openai',model:'gpt-5.6-luna',degraded:false},review:null,verified:false,degraded:false};
    return {text:'normale',primary:{text:'normale',gateway:'puter',provider:'openai',model:'gpt-5.6-luna',degraded:false},review:null,verified:false,degraded:false};
  },
  status:()=>({version:'8.2.0'})
};
const patch=require('../office/runtime-v83.js');

(async()=>{
  assert.equal(globalThis.OfficeAI.__v83Installed,true);
  assert.equal(patch.exactDirective('Rispondi solo con OFFICE_OK'),'OFFICE_OK');
  assert.equal(patch.exactDirective('Rispondi esattamente con: `HELLO`'),'HELLO');
  assert.equal(patch.exactDirective('Analizza questo testo'),null);

  const exact=await globalThis.OfficeAI.run('Rispondi solo con OFFICE_OK',{role:'director',verify:true,history:[{role:'user',content:'x'}]});
  assert.equal(exact.text,'OFFICE_OK');
  assert.equal(exact.verified,true);
  assert.equal(exact.review,null);
  assert.equal(exact.verificationMode,'exact-output');
  assert.equal(exact.exactContract.matched,true);
  assert.equal(calls[0].opts.verify,false);
  assert.deepEqual(calls[0].opts.history,[]);
  assert.ok(calls[0].prompt.includes('CONTRATTO OUTPUT VINCOLANTE'));

  const normal=await globalThis.OfficeAI.run('Analizza questo testo',{role:'analyst',verify:true});
  assert.equal(normal.text,'normale');
  assert.equal(calls[1].prompt,'Analizza questo testo');
  assert.equal(calls[1].opts.verify,true);

  const health=await globalThis.OfficeAI.test();
  assert.equal(health.ok,true);
  assert.equal(health.result.text,'OFFICE_OK');
  assert.equal(globalThis.OfficeAI.status().version,'8.3.0');
  console.log('office-v83-exact.test.cjs: ok');
})().catch(e=>{console.error(e);process.exit(1)});
