/* Render requests before optional profile lookups; recover listeners after reconnect. */
(() => {
  const container=document.getElementById('inbox-messages');let auth,db,off,version=0;const working=new Set();
  function empty(text){const p=document.createElement('p');p.textContent=text;container.replaceChildren(p)}
  function load(){
    const user=auth?.currentUser;if(!user)return;off?.();const current=++version;
    window.LyriaConnection.pending('requests');empty('Loading friend requests…');
    off=window.LyriaFriendRequests.watch(true,snapshot=>{
      if(current!==version)return;window.LyriaConnection.ready('requests');container.replaceChildren();
      if(snapshot.empty){container.innerHTML='<div class="empty-state"><span class="empty-icon">'+window.LyriaUI.icon('inbox')+'</span><h2>You’re all caught up.</h2><p>New friend requests will appear here.</p><a href="home.html?view=hub">Back to community</a></div>';return}
      for(const doc of snapshot.docs){
        const request=doc.data();if(window.LyriaSafety?.isBlocked(request.from))continue;const row=document.createElement('div');row.className='inbox-message';row.dataset.requestId=doc.id;row.dataset.senderId=request.from || '';
        const message=document.createElement('p');
        const incoming=request.to===user.uid && (!request.status || request.status==='pending');
        message.textContent=incoming?(request.fromName || 'A member')+' sent you a friend request!':request.to==='accepted_'+user.uid?(request.acceptedByName || 'A member')+' accepted your friend request!':'You '+(['decline','declined'].includes(request.status)?'declined':'accepted')+' the request from '+(request.fromName || 'a member')+'.';row.append(message);container.append(row);
        if(!incoming)continue;
        const actions=document.createElement('div');actions.className='friend-request-actions';row.append(actions);
        for(const action of ['accept','decline']){
          const button=document.createElement('button');button.className=action+'-btn';button.textContent=action==='accept'?'Accept':'Decline';button.disabled=working.has(doc.id);actions.append(button);
          button.addEventListener('click',async()=>{
            if(working.has(doc.id))return;working.add(doc.id);for(const b of actions.children)b.disabled=true;
            try{await window.LyriaFriendRequests.respond(doc.id,action);if(current!==version)return;window.LyriaUI.notify(action==='accept'?'Friend request accepted.':'Friend request declined.','success');load()}
            catch(error){console.warn('Friend request response failed',error);if(current!==version)return;for(const b of actions.children)b.disabled=false;window.LyriaConnection.fail('requests','Couldn’t confirm that response. Reconnect to refresh requests before trying again.')}
            finally{working.delete(doc.id);for(const currentRow of container.querySelectorAll('[data-request-id]'))if(currentRow.dataset.requestId===doc.id)for(const b of currentRow.querySelectorAll('button'))b.disabled=false}
          });
        }
        // This lookup never delays rendering the request or its controls.
        window.LyriaDataAPI.read('profiles/'+request.from).then(profile=>{if(current===version && row.isConnected && profile.exists)message.textContent=(profile.data().displayName || request.fromName || 'A member')+' sent you a friend request!'}).catch(()=>{});
      }
      if(!container.children.length)empty('Requests from blocked members are hidden.');
    },error=>{if(current!==version)return;console.warn('Request loading failed',error);window.LyriaConnection.fail('requests','Friend requests couldn’t load. Try reconnecting.')});
  }
  window.addEventListener('lyria:blocks-updated',()=>{if(auth?.currentUser)load()});
  (async()=>{
    try{
      await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
      window.LyriaConnection.setRetry(async()=>{window.LyriaConnection.ready('recovery');await db.disableNetwork();await db.enableNetwork();load()});
      auth.onAuthStateChanged(user=>{off?.();version++;if(!user){location.href='login.html';return}window.LyriaConnection.ready('startup');load()});
    }catch(error){console.warn(error);window.LyriaConnection.fail('startup','Your inbox couldn’t start. Reload LYRIA to try again.')}
  })();
})();
