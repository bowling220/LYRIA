/* Loading follows the existing connection lifecycle, never a release/version flag. */
(() => {
  const connection = window.LyriaConnection;
  if (!connection) return;
  const labels = {
    startup:['Opening LYRIA.','Getting your account and your space ready.'],
    channels:['Finding your conversations.','Bringing your people together.'],
    messages:['Opening your conversation.','Your messages are on their way.'],
    requests:['Opening your inbox.','Checking your latest friend requests.']
  };
  const cards = new Map(), starts = new Map();
  let modal, shown = false, timer, frame;
  let dismissedContext=null;
  const context=()=>location.pathname+location.search;
  function card(part) {
    const node = document.createElement('section');
    node.className = 'app-loading-card'; node.dataset.loadingPart = part;
    node.setAttribute('aria-label','Loading '+(part==='startup'?'LYRIA':part));
    node.innerHTML = '<div class="app-loading-logo" aria-hidden="true">'+(window.LyriaUI?.icon('chat') || 'L')+'</div><span class="app-loading-brand">LYRIA</span><h2></h2><p class="app-loading-copy" role="status" aria-live="polite"></p><div class="app-loading-track" aria-hidden="true"><span></span></div><button type="button" class="app-loading-retry secondary-action" hidden>Try again</button>';
    node.querySelector('button').addEventListener('click',()=>connection.retry());
    return node;
  }
  function paint(node,state,snapshot) {
    node.dataset.loadingPart=state.part;
    const failed = state.error || !snapshot.online;
    node.classList.toggle('has-error',failed);
    node.setAttribute('aria-busy',String(!failed));
    node.querySelector('h2').textContent = !snapshot.online?'Waiting for a connection.':state.error?'Let’s get you connected.':labels[state.part][0];
    node.querySelector('.app-loading-copy').textContent = !snapshot.online?'You’re offline. Reconnect when you’re ready; your drafts stay here.':state.error?state.message:labels[state.part][1];
    const retry = node.querySelector('.app-loading-retry');
    retry.hidden = !failed; retry.disabled = !failed || !snapshot.online || snapshot.reconnecting;
    retry.textContent = snapshot.reconnecting?'Reconnecting…':'Try again';
  }
  function loadedContent() {
    const messages=document.getElementById('messages');
    const call=document.getElementById('call-stage');
    return Boolean((messages?.getClientRects().length && messages.querySelector('.message')) ||
      (call?.getClientRects().length && !call.hidden) || document.querySelector('#inbox-messages .inbox-message'));
  }
  function foreground(snapshot) {
    return snapshot.parts.filter(state=>labels[state.part] && (state.part!=='requests' || document.getElementById('inbox-messages')) &&
      (state.part==='startup' || !loadedContent()))
      .sort((a,b)=>['startup','messages','requests','channels'].indexOf(a.part)-['startup','messages','requests','channels'].indexOf(b.part));
  }
  function hideScreen() {
    if (!shown) return;
    shown = false;
    if (window.LyriaUI) window.LyriaUI.closeModal(modal); else modal.style.display = 'none';
    window.dispatchEvent(new Event('lyria:loading-screen-state'));
  }
  function dismiss() {
    dismissedContext=context();
    hideScreen();
  }
  function queueUpdate() { if(connection.snapshot().reconnecting)dismissedContext=null;if(!frame)frame=requestAnimationFrame(()=>{frame=0;update()}); }
  window.LyriaLoading={isBlocking:()=>shown};
  function setup() {
    modal = document.createElement('div'); modal.id = 'app-loading-modal';
    modal.className = 'modal app-loading-modal'; modal.setAttribute('inert','');
    modal.setAttribute('aria-labelledby','app-loading-title');
    const content = card('startup'); content.classList.add('modal-content');
    content.querySelector('h2').id = 'app-loading-title';
    const skip = document.createElement('button'); skip.type = 'button'; skip.className = 'app-loading-skip'; skip.textContent = 'Keep browsing';
    skip.addEventListener('click',dismiss);
    content.append(skip); modal.append(content); document.body.append(modal);
    window.LyriaUI?.mountModal?.(modal);
    new MutationObserver(()=>{
      if (shown && modal.dataset.uiOpen==='false') dismiss();
    }).observe(modal,{attributes:true,attributeFilter:['data-ui-open']});
    for(const id of ['messages','inbox-messages']){const host=document.getElementById(id);if(host)new MutationObserver(queueUpdate).observe(host,{childList:true})}
    new MutationObserver(queueUpdate).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-ui-open']});
    update();
  }
  function update() {
    if (!modal) return;
    clearTimeout(timer);
    const snapshot = connection.snapshot(), now = Date.now(), active = new Set();
    const candidates=foreground(snapshot);
    const state=dismissedContext===context()?null:candidates[0];
    const another=document.querySelector('.modal:not(#app-loading-modal)[data-ui-open="true"]');
    if(state && !another){
      paint(modal.querySelector('.app-loading-card'),state,snapshot);
      if(!shown){shown=true;window.LyriaUI?.openModal(modal);window.dispatchEvent(new Event('lyria:loading-screen-state'))}
    }else hideScreen();
    let remaining = Infinity;
    for (const state of snapshot.parts.filter(p=>labels[p.part])) {
      const key = state.part+':'+state.revision; active.add(key);
      if (!starts.has(key)) starts.set(key,now);
      const wait = 650-(now-starts.get(key));
      if (wait>0) { remaining=Math.min(remaining,wait);continue; }
      if (state.part==='startup') continue;
      let node = cards.get(state.part);
      if (!node) { node=card(state.part);cards.set(state.part,node); }
      paint(node,state,snapshot);
      if (state.part==='messages') {
        // Use the actual empty message view, never cover loaded messages, call
        // controls, the composer or navigation during a background reconnect.
        const host = document.querySelector('#messages .empty-state');
        if (host && !host.contains(node)) host.replaceChildren(node);
      } else if (state.part==='channels') {
        const list = document.getElementById('channels-list');
        node.classList.add('app-loading-compact');
        if (list && !node.isConnected) list.before(node);
      } else {
        const host = document.getElementById('inbox-messages');
        if (host && !host.querySelector('.inbox-message') && !host.contains(node)) host.replaceChildren(node);
      }
    }
    for (const [part,node] of cards) if (!snapshot.parts.some(p=>p.part===part)) {node.remove();cards.delete(part);}
    for (const key of starts.keys()) if (!active.has(key)) starts.delete(key);
    if(!candidates.length)dismissedContext=null;
    if (Number.isFinite(remaining)) timer=setTimeout(update,remaining+1);
  }
  window.addEventListener('lyria:connection-state',queueUpdate);
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',setup); else setup();
})();
