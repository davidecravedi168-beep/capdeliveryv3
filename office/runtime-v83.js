(function(root,factory){
'use strict';
var api=factory(root||{});
if(typeof module==='object'&&module.exports)module.exports=api;
if(root&&root.OfficeAI)api.install(root);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
var VERSION='8.3.0';

function unwrap(v){
  v=String(v||'').trim();
  if(v.length>=2){
    var a=v.charAt(0),b=v.charAt(v.length-1);
    if((a==='`'&&b==='`')||(a==='"'&&b==='"')||(a==="'"&&b==="'")||(a==='“'&&b==='”'))v=v.slice(1,-1).trim();
  }
  return v;
}
function exactDirective(prompt){
  var s=String(prompt||'').trim();
  var m=s.match(/^(?:rispondi|reply|respond)\s+(?:solo|solamente|esclusivamente|esattamente|only|exactly)\s*(?:(?:con|with)\s*)?:?\s*([\s\S]+)$/i);
  if(!m)return null;
  var value=unwrap(m[1]);
  if(!value||value.length>160||/[\r\n]/.test(value))return null;
  return value;
}
function strictPrompt(expected){
  return 'CONTRATTO OUTPUT VINCOLANTE. Restituisci esclusivamente il testo indicato sotto. Nessuna spiegazione, nessun markdown, nessun prefisso o suffisso.\n\nTESTO ESATTO:\n'+expected;
}
function install(ctx){
  var base=ctx.OfficeAI;
  if(!base||base.__v83Installed)return base;
  var originalRun=base.run;
  var originalStatus=base.status;
  if(typeof originalRun!=='function')return base;

  async function run(prompt,opts){
    var expected=exactDirective(prompt);
    if(!expected)return originalRun(prompt,opts||{});
    var callOpts=Object.assign({},opts||{}, {verify:false,history:[]});
    var res=await originalRun(strictPrompt(expected),callOpts);
    var p=res&&res.primary?res.primary:res;
    if(!res)res={};
    if(res.degraded||(p&&p.degraded)){
      res.exactContract={mode:'deterministic',expected:expected,matched:false,reason:'provider-degraded'};
      res.verificationMode='exact-output';
      return res;
    }
    var actual=String(res.text==null?'':res.text).trim();
    var matched=actual===expected;
    res.exactContract={mode:'deterministic',expected:expected,actual:actual,matched:matched};
    res.verificationMode='exact-output';
    res.review=null;
    res.verified=matched;
    if(matched){
      res.text=expected;
      if(res.primary)res.primary.text=expected;
    }
    return res;
  }

  async function test(){
    var r=await run('Rispondi esattamente con: OFFICE_OK',{role:'director',verify:false,timeout:15000,webSearch:false});
    return {ok:!!(r&&!r.degraded&&r.text==='OFFICE_OK'&&r.exactContract&&r.exactContract.matched),result:r};
  }

  function status(){
    var s=typeof originalStatus==='function'?originalStatus():{};
    s.version=VERSION;
    s.outputContracts={exact:true,mode:'deterministic'};
    return s;
  }

  base.run=run;
  base.test=test;
  base.status=status;
  base.__v83Installed=true;
  base.__v83={exactDirective:exactDirective,strictPrompt:strictPrompt};
  return base;
}

return {VERSION:VERSION,install:install,exactDirective:exactDirective,strictPrompt:strictPrompt};
});
