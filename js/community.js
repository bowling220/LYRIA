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
    const list=$('friends-list'); list.replaceChildren();
    if(!current())return;
    try {
      const doc=await db.collection('users').doc(current().uid).get();
      const ids=doc.data()?.friends || [];
      if(!ids.length){
        list.innerHTML='<li class="empty-state"><span class="empty-icon">'+UI.icon('users')+'</span><h3>Good company starts here.</h3><p>Open someone’s profile in a conversation to send a friend request.</p></li>';
        return;
      }
      const friends=await Promise.all(ids.map(id=>db.collection('users').doc(id).get()));
      friends.forEach((doc,index)=>{
        if(!doc.exists)return;
        const friend=doc.data();
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
        li.append(avatar,name,status,remove);list.append(li);
      });
    }catch(error){list.innerHTML='<li>Friends couldn’t load. Close this panel and try again.</li>';console.error(error)}
  }
  $('open-friends-modal').addEventListener('click',()=>{open('friends-modal');loadFriends()});
  $('close-friends-modal').addEventListener('click',()=>close('friends-modal'));
  $('upgrade-to-premium').addEventListener('click',()=>location.href='premium-upgrade.html');
  async function init(){
    try{
      if(!window.firebaseConfig)throw new Error('Firebase configuration is unavailable');
      await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
      auth.onAuthStateChanged(async user=>{
        unsubscribeRequests?.();if(!user)return;
        try{
          unsubscribeRequests=db.collection('friendRequests').where('to','==',user.uid).onSnapshot(snapshot=>{
            const count=snapshot.docs.filter(doc=>!doc.data().status || doc.data().status==='pending').length;
            const badge=$('friend-request-count');badge.textContent=count;badge.style.display=count?'inline-block':'none';
            $('inbox-btn').setAttribute('aria-label',count?`Friend requests: ${count} pending`:'Open friend requests');
          },error=>console.error('Friend requests could not load',error));
        }catch(error){console.error('Profile extras could not load',error)}
      });
    }catch(error){
      console.error(error);
      $('messages').innerHTML='<div class="empty-state"><span class="empty-icon">'+UI.icon('info')+'</span><h2>We couldn’t connect.</h2><p>Check your connection, then reload to get back to your conversations.</p><button type="button" onclick="location.reload()">Try again</button></div>';
    }
  }
  init();
})();
