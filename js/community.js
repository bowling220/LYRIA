/* Page-specific settings and friends. Channel and message logic lives in chat.js. */
(() => {
  const $ = id => document.getElementById(id);
  const UI = window.LyriaUI;
  const open = id => UI.openModal($(id));
  const close = id => UI.closeModal($(id));
  let auth, db, unsubscribeRequests;
  const current = () => auth?.currentUser;
  const report = (message,error) => { console.error(message,error); UI.notify(message,'error'); };

  async function loadFriends() {
    const list=$('friends-list'); list.textContent='Loading friends…';
    if(!current())return;
    try {
      const doc=await window.LyriaDataAPI.read('users/'+current().uid);
      list.replaceChildren();
      const ids=doc.data()?.friends || [];
      if(!ids.length){
        list.innerHTML='<li class="empty-state"><span class="empty-icon">'+UI.icon('users')+'</span><h3>Good company starts here.</h3><p>Open someone’s profile in a conversation to send a friend request.</p></li>';
        return;
      }
      const friends=await Promise.all(ids.map(id=>window.LyriaDataAPI.read('profiles/'+id)));
      friends.forEach((doc,index)=>{
        const friend=doc.exists?doc.data():{displayName:'LYRIA member'};
        const li=document.createElement('li');
        const avatar=document.createElement('img');avatar.src=window.LyriaMedia.profileSource(friend);avatar.alt='';avatar.className='friend-avatar';
        const name=document.createElement('span');name.className='friend-name';name.textContent=friend.displayName || 'LYRIA member';
        const status=document.createElement('span');status.className='friend-status';status.textContent=friend.status || 'Member';
        const remove=document.createElement('button');remove.className='remove-friend-btn';remove.type='button';remove.innerHTML=UI.icon('close');remove.setAttribute('aria-label','Remove '+name.textContent+' from friends');
        remove.addEventListener('click',async()=>{
          remove.disabled=true;
          try{
            const batch=db.batch();
            batch.update(db.collection('users').doc(current().uid),{friends:firebase.firestore.FieldValue.arrayRemove(ids[index])});
            batch.update(db.collection('users').doc(ids[index]),{friends:firebase.firestore.FieldValue.arrayRemove(current().uid)});
            await batch.commit();await loadFriends();UI.notify('Friend removed.');
          }catch(error){report('Could not remove this friend. Please try again.',error);remove.disabled=false}
        });
        const call=document.createElement('button');call.type='button';call.className='friend-call-btn';call.textContent='Call';call.setAttribute('aria-label','Call '+name.textContent);call.addEventListener('click',()=>{close('friends-modal');window.LyriaCalls.callFriend(ids[index],name.textContent)});
        li.append(avatar,name,status,call,remove);list.append(li);
      });
    }catch(error){list.innerHTML='<li>Friends couldn’t load. Close this panel and try again.</li>';console.error(error)}
  }
  const openFriends=()=>{open('friends-modal');return loadFriends()};
  $('open-friends-modal').addEventListener('click',openFriends);
  $('close-friends-modal').addEventListener('click',()=>close('friends-modal'));
  $('call-profile-user').addEventListener('click',()=>{const modal=$('profile-modal');const uid=modal.dataset.userId;if(uid){close('profile-modal');window.LyriaCalls.callFriend(uid,$('profile-modal-name').textContent)}});
  function refreshRequests(){
    unsubscribeRequests?.();if(!current())return;
    window.LyriaConnection.pending('requests');
    unsubscribeRequests=window.LyriaFriendRequests.watch(false,snapshot=>{
      window.LyriaConnection.ready('requests');
      const count=snapshot.docs.filter(doc=>(!doc.data().status || doc.data().status==='pending') && !window.LyriaSafety?.isBlocked(doc.data().from)).length;
      const badge=$('friend-request-count');badge.textContent=count;badge.style.display=count?'inline-block':'none';
      $('inbox-btn').setAttribute('aria-label',count?`Friend requests: ${count} pending`:'Open friend requests');
    },error=>{console.warn('Friend requests unavailable',error);window.LyriaConnection.fail('requests','Friend requests couldn’t load. Try reconnecting.')});
  }
  window.addEventListener('lyria:blocks-updated',()=>{if(current())refreshRequests()});
  async function init(){
    try{
      await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
      auth.onAuthStateChanged(()=>refreshRequests());
    }catch(error){console.warn('Friend request startup failed',error);window.LyriaConnection.fail('requests','Friend requests couldn’t start. Reload to try again.')}
  }
  window.LyriaCommunity={refreshRequests,openFriends};init();
})();
