/* Explicit friend calls. Inbox records carry invitations/replies; media stays opt-in. */
(() => {
  const API=window.LyriaDataAPI,Voice=window.LyriaVoice,UI=window.LyriaUI;
  const LIFE=45000;let auth,db,off,outgoing=null,incoming=null,version=0;
  const seen=new Set(),cancelledInvites=new Set(),pendingChecks=new Map();let latestInvites=new Map();const stamp=v=>v?.toMillis?.() || v?.toDate?.().getTime() || 0;
  const current=()=>auth?.currentUser;
  const age=value=>Date.now()-stamp(value.timestamp);
  const fresh=value=>stamp(value.timestamp)>0 && age(value)>=-30000 && age(value)<LIFE;
  function panel(){
    let el=document.getElementById('call-invite-panel');if(el)return el;
    el=document.createElement('section');el.id='call-invite-panel';el.className='call-invite-panel';el.hidden=true;el.setAttribute('aria-label','Call invitation');el.setAttribute('aria-live','polite');
    el.innerHTML='<strong id="call-invite-title"></strong><p id="call-invite-status"></p><div class="call-invite-actions"><button id="answer-call" type="button">Answer</button><button id="decline-call" type="button">Decline</button><button id="cancel-call-invite" type="button">Cancel</button><button id="enable-call-ring" type="button">Enable ringing</button><button id="dismiss-call-invite" type="button">Done</button></div>';
    document.body.append(el);
    el.querySelector('#answer-call').addEventListener('click',answer);
    el.querySelector('#decline-call').addEventListener('click',()=>finishIncoming('declined'));
    el.querySelector('#cancel-call-invite').addEventListener('click',()=>finishOutgoing('Call cancelled.'));
    el.querySelector('#enable-call-ring').addEventListener('click',async()=>{await Voice.enableSounds();render()});
    el.querySelector('#dismiss-call-invite').addEventListener('click',()=>{el.hidden=true});return el;
  }
  function render(message){
    const el=panel(),item=incoming || outgoing;if(!item && !message){el.hidden=true;return}
    el.hidden=false;el.querySelector('#call-invite-title').textContent=incoming?'Incoming call from '+incoming.name:outgoing?'Calling '+outgoing.name:'Call ended';
    el.querySelector('#call-invite-status').textContent=message || (incoming?(incoming.answering?'Connecting your microphone…':(Voice.getSession()?'Answer replaces your current voice call.':'Answer to join a private voice call.')):(outgoing.phase==='preparing'?'Preparing your microphone and private call…':'Ringing · waiting for an answer…'));
    for(const [id,show] of [['answer-call',!!incoming],['decline-call',!!incoming],['cancel-call-invite',!!outgoing],['enable-call-ring',!!item && !Voice.soundReady()],['dismiss-call-invite',!item]])el.querySelector('#'+id).hidden=!show;
    el.querySelector('#answer-call').disabled=!!incoming?.answering;el.querySelector('#decline-call').disabled=!!incoming?.answering;
  }
  async function record(recipientId,type,data,id=crypto.randomUUID()){
    const user=current();if(!user)throw new Error('Sign in to call.');
    await API.commit([{update:{name:API.name('inbox/'+id),fields:API.fields({...data,senderId:user.uid,recipientId,type})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);return id;
  }
  function stopLease(item){item.cancelled=true;item.media?.then(stream=>stream.getTracks().forEach(track=>track.stop())).catch(()=>{})}
  function leaveOwned(item){if(item.sessionId && Voice.getSession()?.id===item.sessionId)Voice.leave()}
  function finishOutgoing(message='No answer. Try again later.',notify=true){
    const item=outgoing;if(!item)return;outgoing=null;clearTimeout(item.timer);Voice.stopRinging();
    if(item.phase!=='accepted'){stopLease(item);leaveOwned(item)}
    if(notify && item.inviteId)record(item.uid,'callCancel',{inviteId:item.inviteId},'call-cancel-'+item.inviteId).catch(()=>{});
    render(message);
  }
  async function finishIncoming(status='declined',notify=true){
    const item=incoming;if(!item)return;incoming=null;clearTimeout(item.timer);Voice.stopRinging();
    if(status!=='accepted'){stopLease(item);leaveOwned(item)}
    render(status==='accepted'?undefined:status==='expired'?'Missed call from '+item.name+'.':'Call declined.');
    if(notify && current())API.commit([
      {update:{name:API.name('inbox/'+item.id),fields:API.fields({status})},updateMask:{fieldPaths:['status']},currentDocument:{exists:true}},
      {update:{name:API.name('inbox/'+crypto.randomUUID()),fields:API.fields({senderId:current().uid,recipientId:item.uid,type:'callReply',inviteId:item.id,status})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}
    ]).catch(error=>console.warn('Call reply could not be delivered',error));
  }
  async function roomFor(uid,name){
    const user=current();const mine=await API.read('users/'+user.uid);
    if(!mine.data()?.friends?.includes(uid))throw new Error('Add each other as friends before calling.');
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode([user.uid,uid].sort().join('\0')));
    const room='call-'+Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
    let doc;try{doc=await API.read('channels/'+room)}catch(error){if(error.code!=='permission-denied')throw error;doc={exists:false}}
    if(!doc.exists){
      try{await API.commit([{update:{name:API.name('channels/'+room),fields:API.fields({id:room,name:'Call · '+(mine.data().displayName || 'Member')+' & '+name,createdBy:user.uid,members:[user.uid,uid],isPublic:false,isDirectCall:true})},currentDocument:{exists:false}}])}
      catch(error){doc=await API.read('channels/'+room);if(!doc.exists)throw error}
      doc=await API.read('channels/'+room);
    }
    const members=doc.data()?.members;if(!Array.isArray(members) || members.length!==2 || !members.includes(uid) || !members.includes(user.uid))throw new Error('This private call is unavailable.');return room;
  }
  async function callFriend(uid,name='your friend'){
    if(!current() || uid===current().uid){UI.notify('Choose a friend to call.');return}
    try{if(window.LyriaSafety && await window.LyriaSafety.check(uid)){UI.notify('Unblock this member before calling.');return}}catch(e){UI.notify(e.message,'error');return}
    if(outgoing || incoming){UI.notify('Finish the current call invitation first.');return}
    const item={uid,name:String(name).slice(0,60),phase:'preparing',cancelled:false};outgoing=item;render();
    // Request microphone access from this click, while room checks run independently.
    item.media=Voice.prepare();item.media.catch(()=>{});
    item.timer=setTimeout(()=>finishOutgoing('Call setup took too long. Please try again.'),LIFE);
    try{
      const [room]=await Promise.all([roomFor(uid,item.name),item.media]);if(outgoing!==item || item.cancelled)return;
      Voice.leave();
      const joining=Voice.join('lounge',room,'Call with '+item.name,item.media);item.sessionId=Voice.getSession()?.id;const joined=await joining;
      if(outgoing!==item || item.cancelled)return;
      if(!joined)throw new Error('The voice call could not connect.');
      item.room=room;item.sessionId=Voice.getSession()?.id;if(!item.sessionId)throw new Error('The voice call could not connect.');
      item.inviteId=crypto.randomUUID();
      await record(uid,'callInvite',{room,status:'pending',channel:'lounge',sessionId:item.sessionId,callerName:window.LyriaAccount?.getProfile()?.displayName || current().displayName || 'A friend'},item.inviteId);
      if(outgoing!==item || item.cancelled){if(item.phase!=='accepted')record(uid,'callCancel',{inviteId:item.inviteId},'call-cancel-'+item.inviteId).catch(()=>{});return}
      item.phase='ringing';clearTimeout(item.timer);item.timer=setTimeout(()=>finishOutgoing(),LIFE);Voice.startRinging('outgoing');render();
    }catch(error){if(outgoing===item){console.warn('Call setup failed',error);finishOutgoing(error.message || 'The call could not start.')}}
  }
  async function answer(){
    const item=incoming;if(!item || item.answering)return;item.answering=true;render();Voice.stopRinging();
    item.media=Voice.prepare();item.media.catch(()=>{});
    try{
      const [room,caller,cancelled,mine]=await Promise.all([API.read('channels/'+item.room),API.read('channels/'+item.room+'/typingStatus/'+item.uid),API.query('inbox',{where:API.equal('recipientId',current().uid)}),API.read('users/'+current().uid)]);
      if(incoming!==item || item.cancelled)return;
      const members=room.data()?.members,voice=caller.data()?.voice;
      if(cancelled.docs.some(d=>d.data().type==='callCancel' && d.data().inviteId===item.id && d.data().senderId===item.uid) || cancelledInvites.has(item.uid+':'+item.id) || !fresh(item.data) || !mine.data()?.friends?.includes(item.uid) || !Array.isArray(members) || members.length!==2 || !members.includes(current().uid) || !members.includes(item.uid) || voice?.sessionId!==item.data.sessionId || Date.now()-stamp(voice.updatedAt)>65000)throw new Error('This call is no longer available.');
      Voice.leave();const joining=Voice.join('lounge',item.room,'Call with '+item.name,item.media);item.sessionId=Voice.getSession()?.id;const joined=await joining;
      if(incoming!==item || item.cancelled)return;
      if(!joined)throw new Error('Could not answer the call.');
      item.sessionId=Voice.getSession()?.id;await finishIncoming('accepted');
    }catch(error){if(incoming===item){await finishIncoming('unavailable');render(error.message || 'Could not answer the call.')}}
  }
  async function receive(snapshot,epoch){
    const docs=snapshot.docs.map(doc=>({id:doc.id,...doc.data()}));latestInvites=new Map(docs.map(d=>[d.id,d]));
    for(const value of docs){
      if(value.type==='callCancel')cancelledInvites.add(value.senderId+':'+value.inviteId);
      if(value.type==='callReply' && outgoing?.inviteId===value.inviteId && value.senderId===outgoing.uid && fresh(value)){
        if(value.status==='accepted'){outgoing.phase='accepted';finishOutgoing('',false)}
        else if(['declined','busy','expired','unavailable'].includes(value.status))finishOutgoing(value.status==='declined'?outgoing.name+' declined the call.':'Your friend couldn’t answer.',false);
      }
      if(value.type==='callCancel' && incoming?.id===value.inviteId && incoming.uid===value.senderId){await finishIncoming('expired',false)}
    }
    for(const value of docs){
      if(value.type!=='callInvite' || (value.status && value.status!=='pending') || seen.has(value.id) || !fresh(value) || value.senderId===current()?.uid)continue;
      if(pendingChecks.get(value.id)===epoch)continue;
      if(!/^call-[a-f0-9]{64}$/.test(value.room) || value.channel!=='lounge' || !/^v[a-f0-9]{32}$/.test(value.sessionId))continue;
      if(docs.some(d=>d.type==='callCancel' && d.inviteId===value.id && d.senderId===value.senderId))continue;
      if(window.LyriaSafety?.isBlocked(value.senderId))continue;
      pendingChecks.set(value.id,epoch);
      try{
        if(window.LyriaSafety && await window.LyriaSafety.check(value.senderId))continue;
        const profile=await API.read('users/'+current().uid);
        if(epoch!==version)continue;
        seen.add(value.id);
        const latest=latestInvites.get(value.id);if(!latest || (latest.status && latest.status!=='pending'))continue;
        if(epoch!==version || !current() || !fresh(value) || cancelledInvites.has(value.senderId+':'+value.id) || !profile.data()?.friends?.includes(value.senderId))continue;
        if(incoming || outgoing){record(value.senderId,'callReply',{inviteId:value.id,status:'busy'}).catch(()=>{});continue}
        incoming={id:value.id,uid:value.senderId,name:String(value.callerName || 'A friend').slice(0,60),room:value.room,data:value};
        incoming.timer=setTimeout(()=>finishIncoming('expired'),Math.max(0,LIFE-age(value)));Voice.startRinging('incoming');render();
      }catch(error){console.warn('Call invitation could not be checked',error);seen.delete(value.id)}
      finally{if(pendingChecks.get(value.id)===epoch)pendingChecks.delete(value.id)}
    }
  }
  function refresh(){
    off?.();const user=current(),epoch=++version;if(!user)return;
    off=API.watch(db.collection('inbox').where('recipientId','==',user.uid),'inbox',{where:API.equal('recipientId',user.uid)},snapshot=>receive(snapshot,epoch),error=>console.warn('Call invitations could not load',error));
  }
  window.addEventListener('lyria:voice-state',event=>{
    const item=outgoing;if(!item || item.phase!=='ringing')return;
    if(event.detail?.id!==item.sessionId){finishOutgoing('Call ended.');return}
    if(event.detail.connectedUserIds.includes(item.uid)){item.phase='accepted';finishOutgoing('',false)}
  });
  window.addEventListener('lyria:blocks-updated',()=>{if(incoming && window.LyriaSafety?.isBlocked(incoming.uid))finishIncoming('declined');if(outgoing && window.LyriaSafety?.isBlocked(outgoing.uid))finishOutgoing('Member blocked.')});
  window.addEventListener('pagehide',()=>{if(outgoing)finishOutgoing('Call ended.');if(incoming)finishIncoming('expired',false);off?.()});
  window.LyriaCalls={callFriend,refresh};
  (async()=>{
    try{await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();auth.onAuthStateChanged(()=>{seen.clear();cancelledInvites.clear();pendingChecks.clear();latestInvites.clear();if(outgoing)finishOutgoing('Call ended.');if(incoming)finishIncoming('expired',false);refresh()})}
    catch(error){console.warn('Call invitations unavailable',error)}
  })();
})();
