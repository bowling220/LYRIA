/* A short, dismissible first-account guide with a permanent replay control. */
(() => {
  const $=id=>document.getElementById(id),UI=window.LyriaUI;
  const steps=Object.freeze([
    {target:'#rail-chats',icon:'chat',title:'Your conversations',description:'Chats keeps your conversations, favorites, and community rooms together.'},
    {target:'#rail-discover',icon:'news',title:'See what’s happening',description:'Discover opens community news and the latest things people are sharing.'},
    {target:'#settings-btn',icon:'sparkles',title:'Make your profile yours',description:'Open Settings for profile pictures, GIF banners, themes, and free avatar decorations.'},
    {target:'#make-voice-call',icon:'mic',title:'Talk when typing isn’t enough',description:'Inside a conversation, Join voice starts a small voice room. You stay in control of your microphone.'}
  ]);
  let index=0,active=false,uid='',previousFocus=null,highlighted=null;
  const storageKey=value=>'lyria:onboarding:v1:'+value;
  const pendingKey=value=>'lyria:onboarding-pending:'+value;
  const isComplete=value=>{try{return localStorage.getItem(storageKey(value))==='complete'}catch{return false}};
  function rememberComplete(){
    if(uid)try{localStorage.setItem(storageKey(uid),'complete');sessionStorage.removeItem(pendingKey(uid))}catch{}
  }
  function clearHighlight(){
    highlighted=null;const spotlight=$('guide-spotlight');spotlight.classList.remove('has-target');spotlight.removeAttribute('style');
  }
  function placeSpotlight(){
    const spotlight=$('guide-spotlight');if(!highlighted || !highlighted.getClientRects().length){spotlight.classList.remove('has-target');spotlight.removeAttribute('style');return}
    const rect=highlighted.getBoundingClientRect(),pad=8;
    spotlight.classList.add('has-target');spotlight.style.left=Math.max(8,rect.left-pad)+'px';spotlight.style.top=Math.max(8,rect.top-pad)+'px';spotlight.style.width=Math.min(innerWidth-16,rect.width+pad*2)+'px';spotlight.style.height=Math.min(innerHeight-16,rect.height+pad*2)+'px';
  }
  function render(){
    const step=steps[index];clearHighlight();
    const candidate=document.querySelector(step.target);
    if(candidate && candidate.getClientRects().length)highlighted=candidate;
    placeSpotlight();
    $('guide-step-label').textContent=(index+1)+' of '+steps.length;
    $('guide-icon').dataset.icon=step.icon;$('guide-icon').removeAttribute('data-icon-ready');UI.hydrate($('welcome-guide'));
    $('guide-title').textContent=step.title;$('guide-description').textContent=step.description;
    $('guide-back').disabled=index===0;$('guide-next').textContent=index===steps.length-1?'Start exploring':'Next';
    [...$('guide-progress').children].forEach((dot,dotIndex)=>dot.classList.toggle('is-current',dotIndex===index));
  }
  function start({force=false,userId}={}){
    const user=window.firebase?.auth?.().currentUser;uid=userId || user?.uid || uid;
    if(active || !uid || (!force && isComplete(uid)))return;
    previousFocus=document.activeElement;index=0;active=true;
    UI.closeModal($('settings-modal'));
    $('welcome-guide').hidden=false;$('welcome-guide').setAttribute('aria-hidden','false');document.body.classList.add('guide-open');
    render();requestAnimationFrame(()=>$('skip-welcome-guide').focus());
  }
  function finish(){
    if(!active)return;rememberComplete();active=false;clearHighlight();
    $('welcome-guide').hidden=true;$('welcome-guide').setAttribute('aria-hidden','true');document.body.classList.remove('guide-open');
    if(previousFocus?.isConnected)previousFocus.focus();
  }
  function maybeStart(value,attempt=0){
    uid=value || uid;if(!uid || isComplete(uid))return;
    let pending=false;try{pending=sessionStorage.getItem(pendingKey(uid))==='1'}catch{}
    if(!pending)return;
    const dialogOpen=document.querySelector('.modal[data-ui-open="true"]');
    if(dialogOpen && attempt<120){setTimeout(()=>maybeStart(uid,attempt+1),500);return}
    if(!dialogOpen)start({userId:uid});
  }
  for(let dot=0;dot<steps.length;dot++){const marker=document.createElement('span');marker.setAttribute('aria-hidden','true');$('guide-progress').append(marker)}
  $('guide-next').addEventListener('click',()=>{if(index===steps.length-1)finish();else{index++;render()}});
  $('guide-back').addEventListener('click',()=>{if(index>0){index--;render()}});
  $('skip-welcome-guide').addEventListener('click',finish);
  $('replay-welcome-guide').addEventListener('click',()=>start({force:true}));
  $('welcome-guide').addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();finish();return}
    if(event.key==='ArrowRight'){event.preventDefault();$('guide-next').click();return}
    if(event.key==='ArrowLeft'){event.preventDefault();$('guide-back').click();return}
    if(event.key==='Tab'){
      const controls=[...$('welcome-guide').querySelectorAll('button:not(:disabled)')];if(!controls.length)return;
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first.focus()}
    }
  });
  window.addEventListener('resize',()=>{if(active)placeSpotlight()});
  window.addEventListener('lyria:account-created',event=>maybeStart(event.detail?.uid));
  window.addEventListener('lyria:profile-updated',event=>maybeStart(event.detail?.uid));
  window.LyriaOnboarding={steps,start,finish,isComplete};
  const current=window.firebase?.auth?.().currentUser;if(current)maybeStart(current.uid);
})();
