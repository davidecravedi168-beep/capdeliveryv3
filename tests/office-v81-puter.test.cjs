'use strict';
const assert=require('assert');
const calls=[];
globalThis.puter={
  ai:{chat:(messages,testMode,options)=>{calls.push({messages,testMode,options});return Promise.resolve({message:{content:'OFFICE_OK'}})}},
  auth:{isSignedIn:()=>true,signIn:()=>Promise.resolve(true)}
};
globalThis.OfficeAI={
  run:async(prompt)=>({text:'fallback',primary:{text:'fallback',gateway:'local',model:'fallback',provider:'local',degraded:true}}),
  status:()=>({puter:{enabled:true,available:true},pollinations:{configured:false}}),
  localFallback:(prompt,reason)=>({text:'fallback',gateway:'local',model:'fallback',provider:'local',degraded:true,reason})
};
const patch=require('../office/runtime-v81.js');

(async()=>{
  assert.equal(globalThis.OfficeAI.__v81Installed,true);
  const r=await globalThis.OfficeAI.__v81.fixedPuter('director','test',{history:[]});
  assert.equal(r.text,'OFFICE_OK');
  assert.equal(r.model,'gpt-5.6-luna');
  assert.equal(calls.length,1);
  assert.equal(calls[0].testMode,false,'message-array Puter calls must pass false as the second argument');
  assert.equal(calls[0].options.model,'gpt-5.6-luna');
  assert.ok(Array.isArray(calls[0].messages));
  assert.equal(calls[0].messages.at(-1).content,'test');
  const args=patch.puterCallArgs('skeptic','x',[]);
  assert.equal(args.testMode,false);
  assert.equal(args.model,'claude-opus-4-8');
  console.log('office-v81-puter.test.cjs: ok');
})().catch(e=>{console.error(e);process.exit(1)});
