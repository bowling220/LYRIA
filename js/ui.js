/* Shared LYRIA interface: local line icons, feedback, and accessible dialogs. */
(() => {
  const paths = {
    chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/><path d="M8 11h.01M12 11h.01M16 11h.01"/>',
    arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
    back: '<path d="M19 12H5m6-6-6 6 6 6"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    hash: '<path d="m10 3-4 18M18 3l-4 18M4 8h17M2 16h17"/>',
    news: '<rect x="4" y="3" width="16" height="18" rx="3"/><path d="M8 7h8M8 11h8M8 15h3M8 18h8M15 15h1"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/>',
    settings: '<path d="m9 3-.5 2-2 .9-1.9-.6-2 3.4 1.5 1.4v2.8L2.6 14l2 3.4 1.9-.6 2 .9.5 2.3h4l.5-2.3 2-.9 1.9.6 2-3.4-1.5-1.1v-2.8l1.5-1.4-2-3.4-1.9.6-2-.9L13 3z"/><circle cx="11" cy="11.5" r="3"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    phoneOff: '<path d="m3 3 18 18M5 8c1 5 5 9 10 10l2-2 4 2v3c-9 1-19-9-18-18h3l2 4-2 2M14 3h6v6"/>',
    inbox: '<path d="m4 4-3 12v4h22v-4L20 4zM1 16h6l2 3h6l2-3h6"/>',
    send: '<path d="m22 2-7 20-4-9L2 9zM22 2 11 13"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    sparkles: '<path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4zM21 2v4M19 4h4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    logout: '<path d="M9 21H4V3h5M9 12h12m-5-5 5 5-5 5"/>',
    contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6zM8 12l3 3 5-6"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    link: '<path d="m10 13 4-4M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 2 1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    google: '<path d="M20.5 10H12v4h4.8a5 5 0 1 1-1.2-6.8l2.8-2.8A9 9 0 1 0 21 12z"/>'
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.chat}</svg>`;
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
      modal.setAttribute('aria-hidden', String(!open)); modal.toggleAttribute('inert', !open);
      modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
      if (open) {
        const trigger = document.activeElement === document.body ? lastTrigger : document.activeElement;
        previousFocus.set(modal, trigger?.closest('[inert]') ? document.getElementById('header-menu-toggle') : trigger);
        requestAnimationFrame(()=>modal.querySelector('input:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]')?.focus());
      } else if (previousFocus.has(modal)) {
        let target = previousFocus.get(modal);
        if (target?.closest('[inert]')) target = document.getElementById('header-menu-toggle');
        if (target?.isConnected) target.focus();
        previousFocus.delete(modal);
      }
      document.body.classList.toggle('dialog-open',modals.some(el=>el.style.display && el.style.display !== 'none'));
    };
    modals.forEach(modal => {
      sync(modal); new MutationObserver(()=>sync(modal)).observe(modal,{attributes:true,attributeFilter:['style']});
      modal.addEventListener('click',e=>{if (e.target === modal) closeModal(modal)});
      modal.querySelectorAll('.close-button').forEach(button=>button.addEventListener('click',()=>closeModal(modal)));
    });
    document.addEventListener('keydown',e=>{
      const modal = modals.filter(el=>el.dataset.uiOpen === 'true').at(-1);
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
  window.LyriaUI = {icon, hydrate, notify, escape, openModal, closeModal};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
