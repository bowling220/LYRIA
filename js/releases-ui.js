/* Local release notes. No account writes, forced refreshes, artificial progress, or microphone use. */
(() => {
 const seenKey='lyria:release-seen';let storage=null,data=null,loading=null,modal=null,automatic=false,opened=false,settled=false,waitTimer=null,releaseIndex=0,changeIndex=0,buildInfo=null;
 for(const name of ['localStorage','sessionStorage'])try{const candidate=window[name];candidate.setItem('lyria:release-storage-check','1');candidate.removeItem('lyria:release-storage-check');storage=candidate;break}catch{}
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const icon=name=>{const node=el('span');node.innerHTML=window.LyriaUI.icon(name);node.setAttribute('aria-hidden','true');return node};
 const seen=()=>{try{return storage?.getItem(seenKey)}catch{return null}};
 function badges(){document.querySelectorAll('[data-open-release]').forEach(button=>{const unread=Boolean(data && seen()!==data.releases[0].id);button.classList.toggle('has-update',unread);const dot=button.querySelector('.release-unread');if(dot)dot.hidden=!unread;button.setAttribute('aria-label',unread?'What’s new · New update available':'What’s new')})}
 function acknowledge(){if(!data)return;try{storage?.setItem(seenKey,data.releases[0].id)}catch{}badges()}
 function createModal(){
  if(modal)return;
  modal=el('div','modal release-modal');modal.id='release-modal';modal.setAttribute('inert','');modal.setAttribute('aria-labelledby','release-title');
  modal.innerHTML='<div class="modal-content release-content"><button type="button" class="close-button" aria-label="Close update notes"></button><div class="release-art" aria-hidden="true"><div class="release-orbit"></div><span class="release-logo"></span><span class="release-art-label">A LITTLE CLOSER.</span></div><div class="release-copy"><p class="release-eyebrow">FRESH FROM LYRIA <span id="release-date"></span></p><h2 id="release-title" tabindex="-1">Getting your space ready.</h2><p id="release-summary" class="release-summary"></p><div id="release-loading" class="release-loading" role="status"><span class="release-loading-mark" aria-hidden="true"></span><span id="release-loading-text">Opening your conversations…</span></div><div id="release-changes" class="release-changes" hidden></div><nav id="release-history" class="release-history" aria-label="Update pages" hidden><button type="button" id="release-older">Earlier update</button><span id="release-page" role="status"></span><button type="button" id="release-newer">Newer update</button></nav><nav id="release-change-pages" class="release-change-pages" aria-label="Changes in this update"><button type="button" id="release-change-back">Previous</button><span id="release-change-page" role="status"></span><button type="button" id="release-change-next">Next</button></nav><p id="release-build" class="release-build" aria-label="Installed version and configuration"></p><p id="release-error" class="release-error" role="status" hidden></p><button id="release-retry" type="button" hidden>Try loading notes again</button><div class="release-footer"><span id="release-footer-note">Your place in LYRIA stays yours.</span><button id="release-continue" type="button" class="primary-action">Continue to LYRIA</button></div></div></div>';
  modal.querySelector('.close-button').append(icon('close'));modal.querySelector('.release-logo').append(icon('chat'));document.body.append(modal);window.LyriaUI.mountModal(modal);
  modal.querySelector('#release-older').addEventListener('click',()=>{releaseIndex++;changeIndex=0;notes()});
  modal.querySelector('#release-newer').addEventListener('click',()=>{releaseIndex--;changeIndex=0;notes()});
  modal.querySelector('#release-change-back').addEventListener('click',()=>{changeIndex--;notes()});
  modal.querySelector('#release-change-next').addEventListener('click',()=>{changeIndex++;notes()});
  modal.querySelector('#release-continue').addEventListener('click',()=>window.LyriaUI.closeModal(modal));
  modal.querySelector('#release-retry').addEventListener('click',()=>{loading=null;load().then(()=>show(false)).catch(showError)});
  new MutationObserver(()=>{if(opened && modal.dataset.uiOpen==='false'){opened=false;clearTimeout(waitTimer);acknowledge()}}).observe(modal,{attributes:true,attributeFilter:['data-ui-open']});
 }
 function change(item){
  const row=el('div','release-change');row.append(icon(item.icon));const copy=el('div');const heading=el('h3','',item.title);heading.append(el('span','release-change-type',item.type));copy.append(heading,el('p','',item.description));row.append(copy);return row;
 }
 function notes(slow=false){
  if(!data || !modal)return;
  settled=true;clearTimeout(waitTimer);const current=data.releases[releaseIndex];
  modal.classList.remove('is-loading');document.getElementById('release-title').textContent=current.title;document.getElementById('release-summary').textContent=current.summary;document.getElementById('release-date').textContent=new Date(current.date+'T12:00:00Z').toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
  document.getElementById('release-loading').hidden=true;const list=document.getElementById('release-changes');list.hidden=false;document.getElementById('release-change-pages').hidden=false;list.replaceChildren(...current.changes.slice(changeIndex,changeIndex+1).map(change));
  document.getElementById('release-change-back').disabled=changeIndex===0;document.getElementById('release-change-next').disabled=changeIndex>=current.changes.length-1;document.getElementById('release-change-page').textContent='Change '+(changeIndex+1)+' of '+current.changes.length;
  const history=document.getElementById('release-history');history.hidden=data.releases.length<2;
  document.getElementById('release-older').disabled=releaseIndex>=data.releases.length-1;document.getElementById('release-newer').disabled=releaseIndex===0;
  document.getElementById('release-page').textContent=(releaseIndex+1)+' / '+data.releases.length;
  buildStatus();
  document.getElementById('release-footer-note').textContent=slow?'LYRIA is still connecting in the background.':'No need to leave your place.';
  document.getElementById('release-error').hidden=true;document.getElementById('release-retry').hidden=true;
 }
 function buildStatus(){
  if(!modal || !data)return;
  const info=document.getElementById('release-build'),keyPresent=window.LyriaGifLibrary?window.LyriaGifLibrary.online():buildInfo?.giphyConfigured;
  const commit=typeof buildInfo?.commit==='string'?buildInfo.commit.slice(0,8):'not reported';
  info.textContent='Version '+data.releases[0].id+' · Build '+commit+' · GIF search: '+(keyPresent?'configured':'key not included in this build');
  info.title=buildInfo?.builtAt?'Built '+buildInfo.builtAt:'Build metadata unavailable. Hosting must run npm run build.';
 }
 function ready(){return window.LyriaConnection?.isReady('startup') && window.LyriaConnection?.isReady('channels')}
 function show(auto){
  createModal();releaseIndex=0;changeIndex=0;automatic=auto;settled=false;opened=true;
  document.getElementById('release-error').hidden=true;document.getElementById('release-retry').hidden=true;
  if(data && (!auto || ready()))notes();
  else{modal.classList.add('is-loading');document.getElementById('release-title').textContent='A fresh LYRIA is here.';document.getElementById('release-summary').textContent='Making a little room for what’s new.';document.getElementById('release-loading').hidden=false;document.getElementById('release-changes').hidden=true;document.getElementById('release-history').hidden=true;document.getElementById('release-change-pages').hidden=true;waitTimer=setTimeout(()=>notes(true),8000)}
  window.LyriaUI.openModal(modal);
 }
 function showError(){
  createModal();clearTimeout(waitTimer);modal.classList.remove('is-loading');document.getElementById('release-loading').hidden=true;document.getElementById('release-title').textContent='What’s new in LYRIA';document.getElementById('release-summary').textContent='Your app is still available.';document.getElementById('release-error').hidden=false;document.getElementById('release-error').textContent='Release notes couldn’t load. Try again when you’re connected.';document.getElementById('release-retry').hidden=false;
 }
 function restoredPanels(){try{return Object.keys(sessionStorage).some(key=>key.startsWith('lyria:panels:'+location.pathname+':') && JSON.parse(sessionStorage.getItem(key))?.length)}catch{return false}}
 let attempted=false;
 function maybeAuto(){
  if(attempted || !data || !storage || !document.body.classList.contains('app-page') || seen()===data.releases[0].id || !window.LyriaConnection?.isReady('startup'))return;
  attempted=true;
  // Preserve an open/restored panel instead of putting an announcement above it.
  if(restoredPanels() || document.querySelector('.modal:not(#app-loading-modal)[data-ui-open="true"]'))return;
  show(true);
 }
 async function load(){
  if(loading)return loading;
  loading=(async()=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),4000);
   try{const response=await fetch('js/releases.json',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('Unavailable');const value=await response.json();
    if(value.schemaVersion!==1 || !Array.isArray(value.releases) || !value.releases.length || value.releases.some(r=>typeof r.id!=='string' || (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date+'T12:00:00Z'))) || typeof r.title!=='string' || typeof r.summary!=='string' || !Array.isArray(r.changes) || r.changes.some(c=>typeof c.title!=='string' || typeof c.description!=='string' || typeof c.type!=='string')))throw Error('Invalid release notes');
    data=value;badges();return value;
   }finally{clearTimeout(timer)}
  })();return loading;
 }
 function setup(){
  document.querySelectorAll('[data-open-release]').forEach(button=>button.addEventListener('click',()=>{show(false);if(!data)load().then(()=>notes()).catch(showError)}));
  window.addEventListener('lyria:connection-state',()=>{maybeAuto();if(opened && automatic && ready()){if(!settled)notes();else document.getElementById('release-footer-note').textContent='No need to leave your place.'}});
  window.addEventListener('storage',event=>{if(event.key===seenKey){badges();if(data && seen()===data.releases[0].id && opened)window.LyriaUI.closeModal(modal)}});
  fetch('js/build-info.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(value=>{if(value && typeof value.commit==='string')buildInfo=value;buildStatus()}).catch(()=>{});
  load().then(maybeAuto).catch(()=>{});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
