/* One authoritative account profile and one server-confirmed save path. */
(() => {
  const $ = id => document.getElementById(id);
  const UI = window.LyriaUI;
  let auth, db, profile = {}, unsubscribe;
  const defaults = user => ({
    displayName: user.displayName || (user.isAnonymous ? 'Guest' : 'LYRIA member'),
    email: user.email || null, photoURL: user.photoURL || 'assets/avatar.svg',
    role: user.isAnonymous ? 'guest' : 'user', friends: [], channels: [], badges: [],
    bio: '', status: 'available', darkMode: false, notificationsEnabled: false, showBadges: true
  });
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
    const ref=window.firebaseConfig.getFirestore().collection('users').doc(user.uid);
    const doc=await ref.get({source:'server'});
    if (!doc.exists) await ref.set(defaults(user), {merge:true});
    return ref;
  }
  async function save(patch, {button, statusId, field}={}) {
    const user=auth?.currentUser;
    if (!user) { state(statusId,'error','Not saved. Sign in to save your account.');return false; }
    if (button?.disabled) return false;
    const uid=user.uid, ref=db.collection('users').doc(uid);
    if (button) {button.disabled=true;button.setAttribute('aria-busy','true')}
    state(statusId,'saving','Saving to your account…');
    const timer=setTimeout(()=>{if(auth.currentUser?.uid===uid)state(statusId,'pending','Waiting for a connection. This change is not confirmed yet.');},10000);
    try {
      // Merge also works when a previously created Google account has no user document.
      await ref.set(patch,{merge:true});
      const confirmed=await ref.get({source:'server'});
      const data=confirmed.data() || {};
      if (confirmed.metadata?.hasPendingWrites || Object.entries(patch).some(([key,value])=>JSON.stringify(data[key])!==JSON.stringify(value))) {
        throw Object.assign(new Error('Save could not be verified'),{userMessage:'Not confirmed. Your account returned a different value. Please retry.'});
      }
      if (auth.currentUser?.uid !== uid) return false;
      if (field && Object.values(patch).includes(field.value.trim())) {field.value=field.value.trim();field.dataset.dirty='false';}
      render(data);
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
      if (auth.currentUser?.uid === uid) {const message=errorMessage(error);state(statusId,'error',message);UI.notify(message,'error');}
      return false;
    } finally {
      clearTimeout(timer);if(button){button.disabled=false;button.removeAttribute('aria-busy')}
    }
  }
  function setupFields() {
    for (const [id,statusId] of [['display-name-input','display-name-save-status'],['bio-input','bio-save-status'],['status-select','status-save-status']]) {
      $(id)?.addEventListener(id==='status-select'?'change':'input',()=>{$(id).dataset.dirty='true';state(statusId,'dirty','Unsaved changes.');});
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
  async function init() {
    try {
      await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
      auth.onAuthStateChanged(user=>{
        unsubscribe?.();profile={};if(!user)return;
        if($('account-identity')) $('account-identity').textContent=user.isAnonymous?'Guest account · sign in with Google to keep your account across devices':`Signed in as ${user.email || user.displayName || 'LYRIA member'}`;
        state('account-load-status','loading','Loading your saved account…');
        unsubscribe=db.collection('users').doc(user.uid).onSnapshot(doc=>{
          if(auth.currentUser?.uid !== user.uid)return;
          if(doc.metadata?.hasPendingWrites){state('account-load-status','pending','Changes are waiting for a connection. They are not confirmed yet.');return;}
          render({...defaults(user),...(doc.data() || {})});
          state('account-load-status',doc.metadata?.fromCache?'pending':'ready',doc.metadata?.fromCache?'Showing cached account details. New saves require a connection.':'Account connected. Changes save when you choose a save button.');
        },error=>{console.error(error);state('account-load-status','error','Account details could not load. '+errorMessage(error));});
      });
    } catch(error){console.error(error);state('account-load-status','error','Your account could not connect. Reload and try again.');}
  }
  window.LyriaAccount={save,ensureUser,errorMessage,getProfile:()=>profile};
  if(document.body?.classList.contains('app-page')) {setupFields();init();}
})();
