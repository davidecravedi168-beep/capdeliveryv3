'use strict';
const assert=require('assert');
let calls=[];
globalThis.OfficeAI={
  run:async(prompt,opts)=>{
    calls.push({prompt,opts});
    if(prompt.includes('CONTRATTO OUTPUT VINCOLANTE')) return {text:'OFFICE_OK',primary:{text:'OFFICE_OK',gateway:'puter',provider:'openai',model:'gpt-5.6-luna',degraded:false},review:null,verified:false,degraded:false};
    return {text:'unexpected',primary:{text:'unexpected',gateway:'puter',provider:'openai',model:'gpt-5.6-luna',degraded:false},review:null,verified:false,degraded:false};
  },
  status:()=>({version:'8.2.0'})
};
const patch=require('../office/runtime-v83.js');
(async()=>{
  assert.equal(patch.VERSION,'8.4.0');
  assert.equal(patch.exactDirective('OFFICE_OK'),'OFFICE_OK');
  const r=await globalThis.OfficeAI.run('OFFICE_OK',{verify:true,history:[{role:'user',content:'x'}]});
  assert.equal(r.text,'OFFICE_OK');
  assert.equal(r.verified,true);
  assert.equal(r.review,null);
  assert.equal(r.exactContract.matched,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].opts.verify,false);
  assert.deepEqual(calls[0].opts.history,[]);
  assert.ok(calls[0].prompt.includes('CONTRATTO OUTPUT VINCOLANTE'));
  console.log('office-v84-canary.test.cjs: ok');
})().catch(e=>{console.error(e);process.exit(1)});
