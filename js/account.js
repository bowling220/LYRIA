/* One authoritative account profile and one server-confirmed save path. */
(() => {
  const $ = id => document.getElementById(id);
  const UI = window.LyriaUI;
  let auth, db, profile = {}, reconnecting;
  let profileVersion=0;
  let needsReconnect=false;
  let loadTimer;
  const API=window.LyriaAccountAPI;
  const defaults = user => ({
    displayName: user.displayName || (user.isAnonymous ? 'Guest' : 'LYRIA member'),
    email: user.email || null, photoURL: user.photoURL || 'assets/avatar.svg',
    role: user.isAnonymous ? 'guest' : 'user', friends: [], channels: [], badges: [],
    bio: '', status: 'available', darkMode: false, notificationsEnabled: false, showBadges: true
  });
  const draftKey=uid=>'lyria-profile-draft:'+uid;
  function rememberDraft(field){
    const user=auth?.currentUser;if(!user || !['display-name-input','bio-input'].includes(field.id))return;
    try{const drafts=JSON.parse(sessionStorage.getItem(draftKey(user.uid)) || '{}');drafts[field.id]=field.value;sessionStorage.setItem(draftKey(user.uid),JSON.stringify(drafts));}catch(error){console.warn('Draft backup unavailable',error)}
  }
  function forgetDraft(uid,field){
    try{const drafts=JSON.parse(sessionStorage.getItem(draftKey(uid)) || '{}');delete drafts[field.id];sessionStorage.setItem(draftKey(uid),JSON.stringify(drafts));}catch{}
  }
  function restoreDrafts(user){
    try{
      const drafts=JSON.parse(sessionStorage.getItem(draftKey(user.uid)) || '{}');
      for(const [id,statusId]of [['display-name-input','display-name-save-status'],['bio-input','bio-save-status']]){
        const field=$(id);if(!field)continue;delete field.dataset.dirty;field.value='';
        if(typeof drafts[id]==='string'){field.value=drafts[id];field.dataset.dirty='true';state(statusId,'dirty','Restored your unsaved draft. Choose Save to keep it in your account.');}
      }
    }catch(error){console.warn('Draft restore unavailable',error)}
  }
  const state = (id, kind, text) => {
    const el = $(id); if (!el) return;
    el.dataset.state = kind; el.textContent = text;
  };
  function errorMessage(error) {
    if (error?.code === 'permission-denied') return 'Not saved. Your account does not have permission to save changes yet.';
    if (error?.code === 'unauthenticated') return 'Not saved. Sign in again, then retry.';
    if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded') return 'Not confirmed. Check your connection and try again.';
    return error?.userMessage || 'Not saved. Your changes are still here. Please try again.';
  }
  function render(data) {
    profile = data;
    if ($('user-name')) $('user-name').textContent = data.displayName || auth.currentUser?.displayName || 'LYRIA member';
    if ($('user-avatar')) $('user-avatar').src = data.photoURL || 'assets/avatar.svg';
    for (const [id,key] of [['display-name-input','displayName'],['bio-input','bio']]) {
      const input=$(id);if(input && input.dataset.dirty !== 'true' && document.activeElement !== input) input.value=data[key] || '';
    }
    if ($('status-select') && $('status-select').dataset.dirty !== 'true') $('status-select').value=data.status || 'available';
    document.body.classList.toggle('contrast-mode',Boolean(data.darkMode));
    if ($('toggle-dark-mode')) {
      $('toggle-dark-mode').setAttribute('aria-pressed',String(Boolean(data.darkMode)));
      $('toggle-dark-mode').innerHTML=UI.icon('contrast')+(data.darkMode?'Use standard contrast':'Increase contrast');
    }
    if ($('notifications-toggle') && !$('notifications-toggle').disabled) $('notifications-toggle').checked=Boolean(data.notificationsEnabled);
    if ($('badge-visibility-toggle') && !$('badge-visibility-toggle').disabled) $('badge-visibility-toggle').checked=data.showBadges !== false;
    document.querySelectorAll('.admin-badge').forEach(el=>el.style.display=data.showBadges===false?'none':'inline-block');
    if ($('profile-image-input')) $('profile-image-input').disabled=!data.isPremium;
    if ($('update-profile-image')) $('update-profile-image').disabled=!data.isPremium;
  }
  async function ensureUser(user) {
    await window.firebaseConfig.initialize();
    const result=await API.read(user);
    if(!result.exists){
      try{await API.create(user,defaults(user));}
      catch(error){if(error.code!=='already-exists')throw error}
    }
  }

  async function save(patch, {button, statusId, field}={}) {
    const user=auth?.currentUser;
    if (!user) { state(statusId,'error','Not saved. Sign in to save your account.');return false; }
    if (button?.disabled) return false;
    const uid=user.uid;
    if (button) {button.disabled=true;button.setAttribute('aria-busy','true')}
    state(statusId,'saving','Saving to your account…');
    const timer=setTimeout(()=>{if(auth.currentUser?.uid===uid){state(statusId,'pending','Still connecting. This change is not confirmed yet.');offerReconnect();}},10000);
    try {
      // PATCH merges only these fields. Its response is the server-acknowledged document,
      // so saves do not depend on a live stream or an offline write queue draining.
      const confirmed=await API.save(user,patch);
      const data=confirmed.data;
      if(Object.entries(patch).some(([key,value])=>JSON.stringify(data[key])!==JSON.stringify(value))){
        throw Object.assign(new Error('Save could not be verified'),{userMessage:'Not confirmed. Your account returned a different value. Please retry.'});
      }
      if (auth.currentUser?.uid !== uid) return false;
      if (field && Object.values(patch).includes(field.value.trim())) {field.value=field.value.trim();field.dataset.dirty='false';forgetDraft(uid,field);}
      profileVersion++;
      render(data);
      markConnected();
      const newerDraft=field && field.dataset.dirty === 'true';
      state(statusId,newerDraft?'dirty':'saved',newerDraft?'Saved the earlier change. Your new edits are not saved yet.':'Saved to your account.');
      UI.notify(newerDraft?'Earlier change saved. Save again to keep your new edits.':'Saved to your account.','success');
      // Authentication profile details are a secondary copy, never a prerequisite to save LYRIA settings.
      const authPatch={};if ('displayName' in patch) authPatch.displayName=patch.displayName;
      if ('photoURL' in patch && !patch.photoURL.startsWith('data:')) authPatch.photoURL=patch.photoURL;
      if (Object.keys(authPatch).length) user.updateProfile(authPatch).catch(error=>console.warn('Auth profile sync deferred; LYRIA account is saved.',error));
      return true;
    } catch (error) {
      console.error('Account save failed:',error);
      if (auth.currentUser?.uid === uid) {if(['unavailable','deadline-exceeded'].includes(error.code))offerReconnect();const message=errorMessage(error);state(statusId,'error',message);UI.notify(message,'error');}
      return false;
    } finally {
      clearTimeout(timer);if(button){button.disabled=false;button.removeAttribute('aria-busy')}
    }
  }
  function setupFields() {
    for (const [id,statusId] of [['display-name-input','display-name-save-status'],['bio-input','bio-save-status'],['status-select','status-save-status']]) {
      $(id)?.addEventListener(id==='status-select'?'change':'input',()=>{$(id).dataset.dirty='true';rememberDraft($(id));state(statusId,'dirty','Unsaved changes.');});
    }
    $('update-display-name')?.addEventListener('click',()=>{
      const field=$('display-name-input'), name=field.value.trim();
      if (!name || name.length>48) {state('display-name-save-status','error','Enter a name between 1 and 48 characters.');return;}
      save({displayName:name},{button:$('update-display-name'),statusId:'display-name-save-status',field});
    });
    $('update-bio-btn')?.addEventListener('click',()=>{
      const field=$('bio-input');
      if(field.value.length>240){state('bio-save-status','error','Keep your bio under 240 characters.');return;}
      save({bio:field.value.trim()},{button:$('update-bio-btn'),statusId:'bio-save-status',field});
    });
    $('toggle-dark-mode')?.addEventListener('click',()=>save({darkMode:!profile.darkMode},{button:$('toggle-dark-mode'),statusId:'contrast-save-status'}));
    $('badge-visibility-toggle')?.addEventListener('change',async()=>{
      const button=$('badge-visibility-toggle');
      if (!await save({showBadges:button.checked},{button,statusId:'badges-save-status'}))button.checked=profile.showBadges !== false;
    });
    $('notifications-toggle')?.addEventListener('change',async()=>{
      const button=$('notifications-toggle');
      let enabled=button.checked;
      if(enabled){
        if(!('Notification' in window) || await Notification.requestPermission() !== 'granted') {
          button.checked=Boolean(profile.notificationsEnabled);state('notifications-save-status','error','Not changed. Allow notifications in your browser to enable them.');return;
        }
      }
      if(!await save({notificationsEnabled:enabled},{button,statusId:'notifications-save-status'}))button.checked=Boolean(profile.notificationsEnabled);
    });
    $('update-status-btn')?.addEventListener('click',()=>{
      const field=$('status-select');
      if(!field.value){state('status-save-status','error','Choose a status first.');return;}
      save({status:field.value},{button:$('update-status-btn'),statusId:'status-save-status',field});
    });
  }
  function offerReconnect(){
    needsReconnect=true;
    if($('reconnect-account'))$('reconnect-account').hidden=false;
  }
  function markConnected(){
    clearTimeout(loadTimer);needsReconnect=false;
    state('account-load-status','ready','Account connected. Changes save when you choose a save button.');
    if($('reconnect-account'))$('reconnect-account').hidden=true;
  }
  async function loadAccount(user){
    const version=profileVersion;
    state('account-load-status','loading','Connecting to your saved account…');
    try{
      const result=await API.read(user);
      if(auth.currentUser?.uid !== user.uid)return;
      if(version===profileVersion)render({...defaults(user),...result.data});
      markConnected();
    }catch(error){
      clearTimeout(loadTimer);
      console.error('Account connection failed',error);
      if(auth.currentUser?.uid !== user.uid)return;
      state('account-load-status','error','Your sign-in is working, but saved account details could not load. '+errorMessage(error));
      offerReconnect();
    }
  }
  async function reconnect(){
    if(reconnecting || !auth?.currentUser)return reconnecting;
    const button=$('reconnect-account');if(button){button.disabled=true;button.textContent='Reconnecting…'}
    const user=auth.currentUser;
    reconnecting=(async()=>{
      // Restart live chat independently; a stalled stream cannot block the profile HTTPS check.
      db.disableNetwork().then(()=>db.enableNetwork()).catch(error=>console.warn('Live connection restart failed',error));
      await loadAccount(user);
    })();
    try{await reconnecting}finally{reconnecting=null;if(button){button.disabled=false;button.textContent='Reconnect account'}}
  }
  async function init() {
    try {
      await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
      $('reconnect-account')?.addEventListener('click',reconnect);
      $('settings-btn')?.addEventListener('click',()=>{if(auth.currentUser)loadAccount(auth.currentUser)});
      window.addEventListener('online',()=>{if(needsReconnect)reconnect()});
      document.addEventListener('visibilitychange',()=>{if(!document.hidden && needsReconnect)reconnect()});
      auth.onAuthStateChanged(user=>{
        clearTimeout(loadTimer);profile={};profileVersion++;if(!user)return;
        restoreDrafts(user);
        if($('account-identity')) $('account-identity').textContent=user.isAnonymous?'Guest account · sign in with Google to keep your account across devices':`Signed in as ${user.email || user.displayName || 'LYRIA member'}`;
        state('account-load-status','loading','Connecting to your saved account…');
        loadTimer=setTimeout(()=>{
          if(auth.currentUser?.uid!==user.uid)return;
          state('account-load-status','pending','Your sign-in is working, but the account server is taking too long. Try reconnecting.');offerReconnect();
        },10000);
        loadAccount(user);

      });
    } catch(error){console.error(error);state('account-load-status','error','Your account could not connect. Reload and try again.');}
  }
  window.LyriaAccount={save,ensureUser,reconnect,errorMessage,getProfile:()=>profile};
  if(document.body?.classList.contains('app-page')) {setupFields();init();}
})();
