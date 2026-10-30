/* Local release notes. No account writes, forced refreshes, artificial progress, or microphone use. */
(() => {
 const seenKey='lyria:release-seen';let storage=null,data=null,loading=null,modal=null,automatic=false,opened=false,settled=false,waitTimer=null,releaseIndex=0,changeIndex=0,buildInfo=null,detailsOpen=false;
 for(const name of ['localStorage','sessionStorage'])try{const candidate=window[name];candidate.setItem('lyria:release-storage-check','1');candidate.removeItem('lyria:release-storage-check');storage=candidate;break}catch{}
 const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node};
 const icon=name=>{const node=el('span');node.innerHTML=window.LyriaUI.icon(name);node.setAttribute('aria-hidden','true');return node};
 const seen=()=>{try{return storage?.getItem(seenKey)}catch{return null}};
 function badges(){document.querySelectorAll('[data-open-release]').forEach(button=>{const unread=Boolean(data && seen()!==data.releases[0].id);button.classList.toggle('has-update',unread);const dot=button.querySelector('.release-unread');if(dot)dot.hidden=!unread;button.setAttribute('aria-label',unread?'What’s new · New update available':'What’s new')})}
 function acknowledge(){if(!data)return;try{storage?.setItem(seenKey,data.releases[0].id)}catch{}badges()}
 function createModal(){
  if(modal)return;
  modal=el('div','modal release-modal');modal.id='release-modal';modal.setAttribute('inert','');modal.setAttribute('aria-labelledby','release-title');
  modal.innerHTML=`<div class="modal-content release-content"><button type="button" class="close-button" aria-label="Close update notes"></button><header class="release-art"><div class="release-welcome-copy"><p class="release-art-label">FRESH FROM LYRIA</p><p class="release-welcome-title">Glad you’re here.</p></div><div class="release-illustration" aria-hidden="true"><span class="release-logo"></span><span class="release-heart"></span><span class="release-spark"></span></div></header><div class="release-copy"><div class="release-meta"><label class="sr-only" for="release-select">Choose an update</label><select id="release-select"></select><time id="release-date"></time></div><h2 id="release-title" tabindex="-1">A little more to love.</h2><p id="release-summary" class="release-summary"></p><div class="release-stage"><div id="release-loading" class="release-loading" role="status"><span class="release-loading-mark" aria-hidden="true"></span><span id="release-loading-text">Opening your conversations…</span></div><div id="release-changes" class="release-changes" hidden></div><section id="release-details" class="release-details" aria-label="Installed version details" hidden><span class="release-details-icon" aria-hidden="true"></span><h3>Your installed version</h3><p id="release-build" class="release-build"></p><p id="release-built-at"></p></section><p id="release-error" class="release-error" role="status" hidden></p><button id="release-retry" type="button" hidden>Try loading notes again</button></div><nav id="release-change-pages" class="release-change-pages" aria-label="Changes in this update"><button type="button" id="release-change-back" aria-label="Previous change"></button><div class="release-steps"><div id="release-dots" class="release-dots"></div><span id="release-change-page" role="status"></span></div><button type="button" id="release-change-next">Next</button></nav><p id="release-footer-note" class="release-footer-note" role="status" hidden></p><div class="release-footer"><button id="release-continue" type="button" class="primary-action">Back to LYRIA</button><button id="release-info-toggle" type="button" aria-label="Version and build details" aria-expanded="false" aria-controls="release-details" title="Version and build details"></button></div></div></div>`;
  modal.querySelector('.close-button').append(icon('close'));modal.querySelector('.release-logo').append(icon('chat'));modal.querySelector('.release-heart').append(icon('heart'));modal.querySelector('.release-spark').append(icon('star'));modal.querySelector('#release-change-back').append(icon('arrow'));modal.querySelector('#release-info-toggle').append(icon('info'));modal.querySelector('.release-details-icon').append(icon('info'));document.body.append(modal);window.LyriaUI.mountModal(modal);
  modal.querySelector('#release-select').addEventListener('change',event=>{releaseIndex=Number(event.target.value);changeIndex=0;notes()});
  modal.querySelector('#release-info-toggle').addEventListener('click',()=>{detailsOpen=!detailsOpen;detailView()});
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
  settled=true;document.getElementById('release-info-toggle').disabled=false;clearTimeout(waitTimer);const current=data.releases[releaseIndex];
  modal.classList.remove('is-loading');document.getElementById('release-title').textContent=current.title;document.getElementById('release-summary').textContent=current.summary;document.getElementById('release-date').textContent=new Date(current.date+'T12:00:00Z').toLocaleDateString(undefined,{timeZone:'UTC',month:'short',day:'numeric',year:'numeric'});
  document.getElementById('release-loading').hidden=true;document.getElementById('release-select').hidden=false;const list=document.getElementById('release-changes');list.hidden=false;document.getElementById('release-change-pages').hidden=false;list.replaceChildren(...current.changes.slice(changeIndex,changeIndex+1).map(change));
  document.getElementById('release-change-back').disabled=changeIndex===0;document.getElementById('release-change-next').disabled=changeIndex>=current.changes.length-1;document.getElementById('release-change-page').textContent='Change '+(changeIndex+1)+' of '+current.changes.length;
  const select=document.getElementById('release-select');select.replaceChildren(...data.releases.map((release,index)=>{const option=el('option','',index===0?'Latest update':release.title);option.value=String(index);return option}));select.value=String(releaseIndex);
  const dots=document.getElementById('release-dots');dots.replaceChildren(...current.changes.map((item,index)=>{const button=el('button');button.type='button';button.setAttribute('aria-label','Read change '+(index+1)+': '+item.title);button.setAttribute('aria-current',String(index===changeIndex));button.addEventListener('click',()=>{changeIndex=index;notes();document.getElementById('release-dots').children[index]?.focus()});return button}));
  detailsOpen=false;detailView();
  buildStatus();
  document.getElementById('release-footer-note').textContent=slow?'LYRIA is still connecting in the background.':'';document.getElementById('release-footer-note').hidden=!slow;
  document.getElementById('release-error').hidden=true;document.getElementById('release-retry').hidden=true;
 }
 function detailView(){
  document.getElementById('release-details').hidden=!detailsOpen;
  document.getElementById('release-changes').hidden=detailsOpen || !settled;
  document.getElementById('release-change-pages').hidden=detailsOpen || !settled;
  const button=document.getElementById('release-info-toggle');button.setAttribute('aria-expanded',String(detailsOpen));button.setAttribute('aria-label',detailsOpen?'Back to update notes':'Version and build details');button.title=button.getAttribute('aria-label');
 }
 function buildStatus(){
  if(!modal || !data)return;
  const info=document.getElementById('release-build'),keyPresent=window.LyriaGifLibrary?window.LyriaGifLibrary.online():buildInfo?.giphyConfigured;
  const commit=typeof buildInfo?.commit==='string'?buildInfo.commit.slice(0,8):'not reported';
  info.textContent='Version '+data.releases[0].id+' · Build '+commit+' · GIF search: '+(keyPresent?'configured':'key not included in this build');
  const built=buildInfo?.builtAt && new Date(buildInfo.builtAt);document.getElementById('release-built-at').textContent=built && Number.isFinite(built.getTime())?'Built '+built.toLocaleString():'Build date unavailable.';
 }
 function ready(){return window.LyriaConnection?.isReady('startup') && window.LyriaConnection?.isReady('channels')}
 function show(auto){
  createModal();releaseIndex=0;changeIndex=0;automatic=auto;settled=false;opened=true;detailsOpen=false;detailView();document.getElementById('release-info-toggle').disabled=true;
  document.getElementById('release-error').hidden=true;document.getElementById('release-retry').hidden=true;
  if(data && (!auto || ready()))notes();
  else{modal.classList.add('is-loading');document.getElementById('release-title').textContent='Make yourself at home.';document.getElementById('release-summary').textContent='Your people, your conversations, and a few new things to enjoy.';document.getElementById('release-loading').hidden=false;document.getElementById('release-changes').hidden=true;document.getElementById('release-select').hidden=true;document.getElementById('release-change-pages').hidden=true;waitTimer=setTimeout(()=>notes(true),8000)}
  window.LyriaUI.openModal(modal);
 }
 function showError(){
  createModal();clearTimeout(waitTimer);modal.classList.remove('is-loading');settled=false;detailsOpen=false;detailView();document.getElementById('release-info-toggle').disabled=true;document.getElementById('release-select').hidden=true;document.getElementById('release-loading').hidden=true;document.getElementById('release-title').textContent='Let’s try that again.';document.getElementById('release-summary').textContent='You can keep exploring LYRIA.';document.getElementById('release-error').hidden=false;document.getElementById('release-error').textContent='Release notes couldn’t load. Try again when you’re connected.';document.getElementById('release-retry').hidden=false;
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
  window.addEventListener('lyria:connection-state',()=>{maybeAuto();if(opened && automatic && ready()){if(!settled)notes();else document.getElementById('release-footer-note').hidden=true}});
  window.addEventListener('storage',event=>{if(event.key===seenKey){badges();if(data && seen()===data.releases[0].id && opened)window.LyriaUI.closeModal(modal)}});
  fetch('js/build-info.json',{cache:'no-store'}).then(response=>response.ok?response.json():null).then(value=>{if(value && typeof value.commit==='string')buildInfo=value;buildStatus()}).catch(()=>{});
  load().then(maybeAuto).catch(()=>{});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
