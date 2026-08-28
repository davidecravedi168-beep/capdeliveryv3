(function(){
'use strict';
let privacy=false;
function apply(){
  document.body.classList.toggle('cap-privacy',privacy);
  const b=document.getElementById('cap-privacy-toggle');if(b){b.setAttribute('aria-pressed',privacy?'true':'false');b.textContent=privacy?'Privacy attiva':'Privacy';}
}
function mount(){
  const top=document.querySelector('.top');if(!top||document.getElementById('cap-security-rail'))return;
  const rail=document.createElement('div');rail.id='cap-security-rail';rail.className='cap-security-rail';rail.innerHTML='<span class="cap-security-badge">Dati aziendali protetti</span><span class="cap-security-copy">Dati operativi live · nessuna copia locale dei dataset · telemetria autisti sola lettura.</span><button type="button" class="cap-security-action" id="cap-privacy-toggle" aria-pressed="false">Privacy</button>';
  const anchor=top.querySelector('.resilience-banner')||top.lastElementChild;top.insertBefore(rail,anchor);
  rail.querySelector('#cap-privacy-toggle').addEventListener('click',()=>{privacy=!privacy;apply()});
  apply();
}
window.addEventListener('blur',()=>{if(document.getElementById('app')?.style.display!=='none'){privacy=true;apply();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){privacy=true;apply();}});
document.addEventListener('click',e=>{if(e.target.closest('.cap-personal')&&privacy){privacy=false;apply();}},true);
setTimeout(mount,100);
new MutationObserver(mount).observe(document.documentElement,{childList:true,subtree:true});
})();
