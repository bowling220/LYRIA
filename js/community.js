/* Page-specific settings and friends. Channel and message logic lives in chat.js. */
(() => {
  const $ = id => document.getElementById(id);
  const UI = window.LyriaUI;
  const open = id => UI.openModal($(id));
  const close = id => UI.closeModal($(id));
  let auth, db, unsubscribeRequests;
  let pendingImage;
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
        const avatar=document.createElement('img');avatar.src=friend.photoURL || 'assets/avatar.svg';avatar.alt='';avatar.className='friend-avatar';
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
  $('gif-button').addEventListener('click',()=>open('gif-modal'));
  $('send-gif-url').addEventListener('click',async()=>{
    const button=$('send-gif-url');if(button.disabled)return;button.disabled=true;
    try{await window.sendGifByUrl($('gif-url-input').value.trim());$('gif-url-input').value='';close('gif-modal');UI.notify('GIF shared.','success')}
    catch(error){report('Could not share that GIF. Check the URL and try again.',error)}
    finally{button.disabled=false}
  });
  $('update-status-btn').addEventListener('click',async()=>{
    if(!current())return;
    const status=$('status-select').value;
    if(!status){UI.notify('Choose a status first.');return}
    const button=$('update-status-btn');button.disabled=true;
    try{await db.collection('users').doc(current().uid).update({status});UI.notify('Status updated.','success')}
    catch(error){report('Could not update your status.',error)}finally{button.disabled=false}
  });
  $('profile-image-input').addEventListener('change',()=>{pendingImage=null});
  $('update-profile-image').addEventListener('click',async()=>{
    const file=$('profile-image-input').files[0];
    if(!file){UI.notify('Choose a profile image first.');return}
    if(!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)){UI.notify('Choose a JPG, PNG, WebP, or GIF image.');return}
    if(file.size>600000){UI.notify('Choose an image smaller than 600 KB.');return}
    try{
      pendingImage=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(file)});
      open('confirm-image-change-modal');
    }catch(error){report('Could not read that image.',error)}
  });
  $('cancel-image-change-btn').addEventListener('click',()=>close('confirm-image-change-modal'));
  $('confirm-image-change-btn').addEventListener('click',async()=>{
    if(!pendingImage || !current())return;
    const button=$('confirm-image-change-btn');button.disabled=true;
    try{
      await db.collection('users').doc(current().uid).update({photoURL:pendingImage});
      $('user-avatar').src=pendingImage;$('profile-modal-image').src=pendingImage;
      close('confirm-image-change-modal');UI.notify('Profile image updated.','success');pendingImage=null;
    }catch(error){report('Could not update your profile image.',error)}finally{button.disabled=false}
  });
  async function init(){
    try{
      if(!window.firebaseConfig)throw new Error('Firebase configuration is unavailable');
      await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
      auth.onAuthStateChanged(async user=>{
        unsubscribeRequests?.();if(!user)return;
        try{
          const doc=await db.collection('users').doc(user.uid).get();const data=doc.data() || {};
          $('status-select').value=data.status || '';
          $('profile-image-input').disabled=!data.isPremium;$('update-profile-image').disabled=!data.isPremium;
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
