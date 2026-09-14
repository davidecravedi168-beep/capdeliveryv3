'use strict';
const assert=require('assert');
const calls=[];
let signInCalls=0;
const originalSend=async()=>{};
globalThis.sendChat=originalSend;
globalThis.roundTurn=async()=>{};
globalThis.testAI=async()=>{};
globalThis.puter={
  ai:{chat:(messages,testMode,options)=>{calls.push({messages,testMode,options});return Promise.resolve({message:{content:'OFFICE_OK'}})}},
  auth:{isSignedIn:()=>false,signIn:()=>{signInCalls++;return Promise.resolve(true)}}
};
globalThis.OfficeAI={
  run:async(prompt)=>({text:'fallback',primary:{text:'fallback',gateway:'local',model:'fallback',provider:'local',degraded:true}}),
  status:()=>({puter:{enabled:true,available:true},pollinations:{configured:false}}),
  localFallback:(prompt,reason)=>({text:'fallback',gateway:'local',model:'fallback',provider:'local',degraded:true,reason})
};
const patch=require('../office/runtime-v82.js');

(async()=>{
  assert.equal(globalThis.OfficeAI.__v82Installed,true);
  assert.strictEqual(globalThis.sendChat,originalSend,'V8.2 must not wrap the user click handler with manual sign-in');
  const r=await globalThis.OfficeAI.__v82.fixedPuter('director','test',{history:[]});
  assert.equal(r.text,'OFFICE_OK');
  assert.equal(r.model,'gpt-5.6-luna');
  assert.equal(calls.length,1);
  assert.equal(calls[0].testMode,false);
  assert.equal(calls[0].options.model,'gpt-5.6-luna');
  assert.ok(Array.isArray(calls[0].messages));
  assert.equal(calls[0].messages.at(-1).content,'test');
  assert.equal(signInCalls,0,'manual puter.auth.signIn must not be called; AI API handles auth automatically');
  const s=globalThis.OfficeAI.status();
  assert.equal(s.version,'8.2.0');
  assert.equal(s.auth.mode,'automatic-by-puter');
  assert.ok(s.runtime82.lastSuccess);
  console.log('office-v82-puter.test.cjs: ok');
})().catch(e=>{console.error(e);process.exit(1)});
