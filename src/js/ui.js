/* Shared LYRIA interface: custom rounded icons, feedback, and accessible dialogs. */
(() => {
  const paths = {
    chat: '<path d="M5.25 5.75A3.75 3.75 0 0 1 9 2h6a3.75 3.75 0 0 1 3.75 3.75v6.5A3.75 3.75 0 0 1 15 16h-4.1L6 20v-4.35a3.75 3.75 0 0 1-.75-2.25z"/><path d="M9 8.25h6M9 11.75h4.25"/>',
    arrow: '<path d="M5 12h13"/><path d="m14 7 5 5-5 5"/>',
    back: '<path d="M19 12H6"/><path d="m10 7-5 5 5 5"/>',
    menu: '<path d="M4 7h16M7 12h13M4 17h16"/>',
    close: '<path d="m7 7 10 10M17 7 7 17"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    hash: '<path d="M9.25 4 7 20M17 4l-2.25 16M4 9h16M3 15h16"/>',
    news: '<path d="M6 3.5h10.5A2.5 2.5 0 0 1 19 6v12.5A2.5 2.5 0 0 1 16.5 21H6a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3Z"/><path d="M7.5 8h7M7.5 12h7M7.5 16h4"/><path d="M19 7h2v10.5a2.5 2.5 0 0 1-2.5 2.5H17"/>',
    users: '<circle cx="9" cy="8" r="3.25"/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20"/><path d="M15.5 5.3a3.25 3.25 0 0 1 0 5.4M16 14.2a4.5 4.5 0 0 1 4.5 4.3V20"/>',
    settings: '<circle cx="12" cy="12" r="3.25"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.97 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.52-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.97a1.7 1.7 0 0 0-.34-1.88L4.2 7.03 7.03 4.2l.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 10.5V12a6.5 6.5 0 0 0 13 0v-1.5M12 18.5V21M8.5 21h7"/>',
    micOff: '<path d="m4 4 16 16"/><path d="M9 9v3a3 3 0 0 0 4.8 2.4M9 5.5V5a3 3 0 0 1 6 0v5M5.5 10.5V12a6.5 6.5 0 0 0 10.8 4.9M18.5 10.5V12M12 18.5V21M8.5 21h7"/>',
    volume: '<path d="M11 5.5 6.5 9H3v6h3.5L11 18.5z"/><path d="M15 9a4.25 4.25 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11"/>',
    volumeOff: '<path d="M11 5.5 6.5 9H3v6h3.5L11 18.5z"/><path d="m16 9 5 6M21 9l-5 6"/>',
    collapse: '<path d="m7 10 5 5 5-5"/>',
    expand: '<path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5"/>',
    phoneOff: '<path d="m4 4 16 16"/><path d="M7.2 8.4a13.5 13.5 0 0 0 8.4 8.4l2.1-2.1 3.3 1.5V20a2 2 0 0 1-2 2A17 17 0 0 1 2 5a2 2 0 0 1 2-2h3.8l1.5 3.3z"/>',
    inbox: '<path d="M4.5 5h15l2 10v4H2.5v-4z"/><path d="M2.5 15h5l2 3h5l2-3h5"/>',
    send: '<path d="m3 11 18-8-8 18-2.2-7.8z"/><path d="M10.8 13.2 21 3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 3.5 3.5 2.5-2.5 5 5"/>',
    star: '<path d="m12 3 2.75 5.6 6.2.9-4.5 4.4 1.05 6.1L12 17.1 6.5 20l1.05-6.1-4.5-4.4 6.2-.9z"/>',
    sparkles: '<path d="m10.5 3 1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4L4.5 9l4.4-1.6z"/><path d="m18 14 .9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9z"/>',
    check: '<path d="m5 12.5 4.2 4.2L19 6.9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 10.5V17M12 7h.01"/>',
    logout: '<path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="M10 12h11M17 8l4 4-4 4"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/>',
    heart: '<path d="M20.5 5.8a5 5 0 0 0-7.1 0L12 7.2l-1.4-1.4a5 5 0 0 0-7.1 7.1L12 21l8.5-8.1a5 5 0 0 0 0-7.1Z"/>',
    shield: '<path d="M12 3 20 6v5.5c0 5.2-3.2 8-8 10.5-4.8-2.5-8-5.3-8-10.5V6z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/>',
    link: '<path d="m9.5 14.5 5-5"/><path d="m7.5 17-1.1 1.1a4 4 0 0 1-5.6-5.6l4-4A4 4 0 0 1 10.5 8"/><path d="M13.5 16a4 4 0 0 0 5.7-.5l4-4A4 4 0 0 0 17.5 6L16 7.5"/>',
    bell: '<path d="M18.5 9a6.5 6.5 0 0 0-13 0c0 6-2.5 6.8-2.5 8.5h18c0-1.7-2.5-2.5-2.5-8.5Z"/><path d="M9.5 20.5h5"/>',
    google: '<path d="M21 12.2c0-.6-.05-1.2-.16-1.7H12v3.4h5.05a4.3 4.3 0 0 1-1.87 2.8v2.3h3.02C19.97 17.35 21 15.05 21 12.2Z" fill="currentColor" stroke="none"/><path d="M12 21c2.55 0 4.7-.85 6.27-2.3l-3.02-2.3c-.84.56-1.92.9-3.25.9-2.46 0-4.55-1.66-5.3-3.9H3.58v2.38A9.47 9.47 0 0 0 12 21Z" fill="currentColor" stroke="none" opacity=".78"/><path d="M6.7 13.4A5.7 5.7 0 0 1 6.4 12c0-.49.1-.97.3-1.4V8.22H3.58A9 9 0 0 0 3 12c0 1.45.35 2.83.98 4.02z" fill="currentColor" stroke="none" opacity=".56"/><path d="M12 6.7c1.39 0 2.63.48 3.61 1.42l2.7-2.7A9.05 9.05 0 0 0 3.58 8.22L6.7 10.6C7.45 8.36 9.54 6.7 12 6.7Z" fill="currentColor" stroke="none" opacity=".92"/>',
    reply: '<path d="M9 8 4 12l5 4"/><path d="M5 12h7a7 7 0 0 1 7 7"/>',
    reaction: '<circle cx="12" cy="12" r="9"/><path d="M8.5 10h.01M15.5 10h.01M8 14.5c1 1.4 2.3 2 4 2s3-.6 4-2"/>',
    edit: '<path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
    pin: '<path d="m9 3 6 6M8 8l8 8M6 10l8-8 6 6-8 8M9 15l-5 5"/>',
    mention: '<circle cx="12" cy="12" r="4"/><path d="M16 12v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3 6.7"/>',
    file: '<path d="M6 3h7l5 5v13H6z"/><path d="M13 3v5h5"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4 4 0 0 0 8 0"/><path d="M8 9h.01M16 9h.01"/>',
    more: '<circle cx="5" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none"/>',
    copy: '<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    userPlus: '<circle cx="9" cy="8" r="3.25"/><path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.2 2.9M18 10v6M15 13h6"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.chat}</svg>`;
  const hydrate = root => root.querySelectorAll('[data-icon]:not([data-icon-ready])').forEach(el => {
    el.innerHTML = icon(el.dataset.icon); el.dataset.iconReady = '';
  });
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const notify = (message, type='info') => {
    let region = document.querySelector('#toast-region');
    if (!region) {
      region = document.createElement('div'); region.id = 'toast-region'; region.setAttribute('aria-live','polite'); region.setAttribute('aria-atomic','false'); document.body.append(region);
    }
    const toast = document.createElement('div'); toast.className = `toast toast-${type}`;
    toast.innerHTML = icon(type === 'success' ? 'check' : 'info') + '<p></p><button type="button" aria-label="Dismiss notification">'+icon('close')+'</button>';
    toast.querySelector('p').textContent = message;
    const close = () => toast.remove(); toast.querySelector('button').addEventListener('click',close);
    region.append(toast); while (region.children.length > 3) region.firstElementChild.remove();
    let timer = setTimeout(close,8000);
    toast.addEventListener('mouseenter',()=>clearTimeout(timer));
    toast.addEventListener('focusin',()=>clearTimeout(timer));
    toast.addEventListener('mouseleave',()=>{timer=setTimeout(close,8000)});
  };
  // Remember navigation UI in this tab, never account data, files, or pending actions.
  let panelScope=null,panelHandlers={},restoringPanels=false,panelToken=0,saveFrame=0,panelInteraction=0;
  const panelOrder=[];
  function savePanels(){
    if(!panelScope || restoringPanels)return;
    const panels=panelOrder.map(id=>{
      const modal=document.getElementById(id),handler=panelHandlers[id];
      if(!modal || !handler || modal.dataset.uiOpen!=='true' || !modal.style.display || modal.style.display==='none')return null;
      const active=document.activeElement;
      return {id,data:handler.capture?.(modal) || {},scroll:modal.scrollTop,contentScroll:modal.querySelector('.modal-content')?.scrollTop || 0,focus:modal.contains(active)?active.id:''};
    }).filter(Boolean);
    try{sessionStorage.setItem(panelScope,JSON.stringify(panels))}catch{}
  }
  function queuePanelSave(){if(!saveFrame)saveFrame=requestAnimationFrame(()=>{saveFrame=0;savePanels()})}
  function stopPanelRestoration(){++panelToken;restoringPanels=false;panelScope=null;panelHandlers={}}
  async function restorePanels(user,handlers,revision=panelInteraction){
    const token=++panelToken,scope='lyria:panels:'+location.pathname+':'+user.uid;
    panelScope=scope;panelHandlers=handlers;restoringPanels=true;
    if(revision!==panelInteraction){restoringPanels=false;savePanels();return}
    let saved=[];try{const value=JSON.parse(sessionStorage.getItem(scope));if(Array.isArray(value))saved=value.slice(0,8)}catch{}
    const current=()=>panelToken===token && panelScope===scope;
    try{
      for(const panel of saved){
        if(!current())break;
        const handler=handlers[panel?.id];if(!handler || !Object.hasOwn(handlers,panel.id))continue;
        try{
          await handler.open(panel.data || {},current);
          await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
          if(!current())break;
          const modal=document.getElementById(panel.id);if(modal?.dataset.uiOpen!=='true')continue;
          const top=value=>Number.isFinite(value)?Math.max(0,Math.min(value,10000000)):0;
          modal.scrollTop=top(panel.scroll);const content=modal.querySelector('.modal-content');if(content)content.scrollTop=top(panel.contentScroll);
          const focus=typeof panel.focus==='string'?document.getElementById(panel.focus):null;
          if(focus && modal.contains(focus) && !focus.disabled && focus.getClientRects().length && focus.type!=='file')focus.focus({preventScroll:true});
        }catch(error){console.warn('Panel could not reopen:',panel.id,error.code || 'unavailable')}
      }
    }finally{if(current()){restoringPanels=false;savePanels()}}
  }
  document.addEventListener('pointerdown',event=>{if(event.isTrusted)++panelInteraction;if(event.isTrusted && restoringPanels){++panelToken;restoringPanels=false;queuePanelSave()}},true);
  document.addEventListener('keydown',event=>{if(event.isTrusted)++panelInteraction;if(event.isTrusted && restoringPanels){++panelToken;restoringPanels=false;queuePanelSave()}},true);
  document.addEventListener('focusin',queuePanelSave);
  document.addEventListener('input',queuePanelSave);
  document.addEventListener('click',queuePanelSave);
  document.addEventListener('scroll',queuePanelSave,true);
  window.addEventListener('pagehide',savePanels);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)savePanels()});
  const previousFocus = new WeakMap();
  let lastTrigger;
  document.addEventListener('click', event => { lastTrigger = event.target.closest('button, a'); }, true);
  const closeModal = modal => { modal.style.display = 'none'; };
  const openModal = modal => { modal.style.display = 'flex'; };
  const setup = () => {
    hydrate(document);
    const modals = [...document.querySelectorAll('.modal')];
    const sync = modal => {
      const open = modal.style.display && modal.style.display !== 'none';
      if (modal.dataset.uiOpen === String(Boolean(open))) return;
      modal.dataset.uiOpen = String(Boolean(open));
      const order=panelOrder.indexOf(modal.id);if(order>=0)panelOrder.splice(order,1);if(open)panelOrder.push(modal.id);
      panelOrder.forEach((id,index)=>{document.getElementById(id).style.zIndex=String(1000+index)});
      modal.setAttribute('aria-hidden', String(!open)); modal.toggleAttribute('inert', !open);
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
      if (open) {
        const trigger = document.activeElement === document.body ? lastTrigger : document.activeElement;
        previousFocus.set(modal, trigger?.closest('[inert]') ? document.getElementById('header-menu-toggle') : trigger);
        requestAnimationFrame(()=>{
          // Honor focus explicitly placed inside the dialog before this frame,
          // and never focus a dialog that closed while its frame was pending.
          if(modal.dataset.uiOpen==='true' && !modal.contains(document.activeElement))
            modal.querySelector('input:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]')?.focus();
        });
      } else if (previousFocus.has(modal)) {
        let target = previousFocus.get(modal);
        if (target?.closest('[inert]')) target = document.getElementById('header-menu-toggle');
        if (target?.isConnected) target.focus();
        previousFocus.delete(modal);
      }
      document.body.classList.toggle('dialog-open',modals.some(el=>el.style.display && el.style.display !== 'none'));
      queuePanelSave();
    };
    const registered=new WeakSet();
    const mountModal=modal=>{
      if(registered.has(modal))return;registered.add(modal);
      if(!modals.includes(modal))modals.push(modal);
      sync(modal); new MutationObserver(()=>{sync(modal);queuePanelSave()}).observe(modal,{attributes:true,attributeFilter:['style','data-user-id']});
      modal.addEventListener('click',e=>{if (e.target === modal) closeModal(modal)});
      modal.querySelectorAll('.close-button').forEach(button=>button.addEventListener('click',()=>closeModal(modal)));
    };
    modals.forEach(mountModal);
    window.LyriaUI.mountModal=mountModal;
    document.addEventListener('keydown',e=>{
      const modal = document.getElementById(panelOrder.at(-1));
      if (!modal) return;
      if(e.key === 'Escape') {e.preventDefault();closeModal(modal);return;}
      if(e.key !== 'Tab')return;
      const items=[...modal.querySelectorAll('button, a[href], input, select, textarea, [tabindex="0"]')].filter(el=>!el.disabled && el.getClientRects().length);
      const first=items[0],last=items.at(-1);
      if(e.shiftKey && (document.activeElement===first || !modal.contains(document.activeElement))){e.preventDefault();last?.focus()}
      else if(!e.shiftKey && (document.activeElement===last || !modal.contains(document.activeElement))){e.preventDefault();first?.focus()}
    });
    document.addEventListener('click',e=>{
      const open=e.target.closest('[data-open-modal]'); if(open){const modal=document.getElementById(open.dataset.openModal);if(modal)openModal(modal)}
    });
    // Hydrate icons added by live channel, news, and message updates.
    new MutationObserver(records=>{if(records.some(r=>r.addedNodes.length))hydrate(document)}).observe(document.body,{childList:true,subtree:true});
    document.addEventListener('error',e=>{if(e.target.tagName==='IMG' && !e.target.dataset.managedMedia && !e.target.src.endsWith('/assets/avatar.svg'))e.target.src='assets/avatar.svg'},true);
  };
  window.LyriaUI = {icon, hydrate, notify, escape, openModal, closeModal, restorePanels, stopPanelRestoration, panelRevision:()=>panelInteraction};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
