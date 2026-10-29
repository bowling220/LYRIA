/* Opt-in voice sessions. Media is stopped locally before any network cleanup. */
(() => {
  const $=id=>document.getElementById(id);
  const UI=window.LyriaUI;
  const MAX_PEOPLE=6, PRESENCE_MS=65000, HEARTBEAT_MS=20000;
  let roomId=null, session=null, generation=0, directoryOff=null, directoryMembers={}, directoryVersion=0, directorySignature='';
  const CHANNELS=[{id:'lounge',name:'Lounge'},{id:'gaming',name:'Gaming'},{id:'quiet',name:'Quiet Corner'}];
  const channelOf=p=>CHANNELS.some(c=>c.id===p?.channel)?p.channel:'lounge';
  const channelName=id=>CHANNELS.find(c=>c.id===id)?.name || 'Lounge';
  let soundEnabled=true, audioContext, ringKind=null, ringTimer;const ringNodes=new Set();
  try{soundEnabled=localStorage.getItem('lyria-voice-sounds')!=='off'}catch{}
  function unlockSound(){
    try{
      const Audio=window.AudioContext || window.webkitAudioContext;if(!Audio)return Promise.resolve(false);
      audioContext ||= new Audio();
      return audioContext.resume().then(()=>audioContext.state==='running').catch(()=>false);
    }catch{return Promise.resolve(false)}
  }
  function note(frequency,start,duration,volume=.12,ring=false){
    const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();
    oscillator.type='sine';oscillator.frequency.value=frequency;
    gain.gain.setValueAtTime(0,start);gain.gain.linearRampToValueAtTime(volume,start+.015);gain.gain.exponentialRampToValueAtTime(.001,start+duration);
    oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(start);oscillator.stop(start+duration+.01);
    if(ring){ringNodes.add(oscillator);oscillator.onended=()=>ringNodes.delete(oscillator)}
  }
  function sound(kind){
    if(!soundEnabled)return;
    const notes={join:[440,660],leave:[660,440],mute:[330,220],unmute:[440,550]}[kind];if(!notes)return;
    unlockSound().then(ready=>{if(ready && soundEnabled)notes.forEach((frequency,index)=>note(frequency,audioContext.currentTime+index*.15,.14))});
  }
  function ringPattern(){
    if(!ringKind || !soundEnabled || audioContext?.state!=='running')return;
    const start=audioContext.currentTime;
    if(ringKind==='outgoing'){note(440,start,.8,.065,true);note(480,start,.8,.065,true)}
    else for(const offset of [0,.55]){note(620,start+offset,.35,.075,true);note(780,start+offset,.35,.065,true)}
  }
  function stopRinging(){ringKind=null;clearInterval(ringTimer);for(const node of ringNodes){try{node.stop()}catch{}}ringNodes.clear()}
  function startRinging(kind){stopRinging();ringKind=kind;ringPattern();ringTimer=setInterval(ringPattern,3000)}
  function enableSounds(){
    soundEnabled=true;const effects=$('voice-sound-effects');if(effects)effects.checked=true;
    try{localStorage.setItem('lyria-voice-sounds','on')}catch{}
    return unlockSound().then(ready=>{if(ready)ringPattern();return ready});
  }
  // A normal page interaction unlocks incoming-call audio before someone calls.
  for(const event of ['pointerdown','keydown'])document.addEventListener(event,()=>{if(soundEnabled)unlockSound().then(ready=>{if(ready && ringKind)ringPattern()})},{once:true,capture:true});
  function prepare(){
    unlockSound();
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)return Promise.reject(new Error('Voice needs microphone access on HTTPS.'));
    try{return navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false})}catch(error){return Promise.reject(error)}
  }
  function getSession(){return session && !session.closed?{id:session.id,room:session.room,channel:session.channel,joining:session.joining,connectedUserIds:participants(session).filter(([id])=>session.calls.get(id)?.connected).map(([,p])=>p.userId)}:null}
  function renderDirectory(){
    const list=$('voice-channels');if(!list)return;
    const current=Object.values(directoryMembers).filter(p=>stamp(p.updatedAt)>now()-PRESENCE_MS);
    const signature=JSON.stringify([roomId,session?.closed?null:session?.id,session?.channel,current.map(p=>[p.userId,channelOf(p),p.displayName,p.muted])]);
    if(signature===directorySignature)return;directorySignature=signature;
    const focused=list.contains(document.activeElement)?document.activeElement.dataset.voiceChannel:null;list.replaceChildren();
    for(const channel of CHANNELS){
      const people=Object.values(directoryMembers).filter(p=>channelOf(p)===channel.id && stamp(p.updatedAt)>now()-PRESENCE_MS);
      const item=document.createElement('li'),button=document.createElement('button');button.type='button';button.className='voice-channel-button';button.dataset.voiceChannel=channel.id;
      const active=session && !session.closed && session.room===roomId && session.channel===channel.id;
      button.setAttribute('aria-pressed',String(Boolean(active)));button.innerHTML=UI.icon('mic');
      const name=document.createElement('span');name.textContent=channel.name;button.append(name);
      const count=document.createElement('small');count.textContent=people.length+'/6';button.append(count);
      button.disabled=Boolean(active);button.title=active?'Connected here':'Join '+channel.name;
      button.addEventListener('click',()=>{unlockSound();if(session)leave();join(channel.id)});item.append(button);
      const members=document.createElement('ul');members.className='voice-channel-members';members.setAttribute('aria-label',channel.name+' participants');
      for(const person of people){const row=document.createElement('li');row.textContent=(person.displayName || 'Member')+(person.muted?' · muted':'');members.append(row)}
      if(people.length)item.append(members);list.append(item);
    }
    if(focused)list.querySelector('[data-voice-channel="'+focused+'"]')?.focus();
    const label=$('voice-directory-label');if(label)label.textContent=roomId==='community'?'Everyone’s voice channels':'This conversation’s voice channels';
  }
  function watchDirectory(){
    directoryOff?.();directoryOff=null;directoryMembers={};const version=++directoryVersion;renderDirectory();
    const db=window.firebaseConfig?.getFirestore();if(!db || !roomId)return;
    const feedback=$('voice-directory-status');if(feedback)feedback.textContent='Loading people in voice…';
    directoryOff=db.collection('channels').doc(roomId).collection('typingStatus').onSnapshot(snapshot=>{
      if(version!==directoryVersion)return;directoryMembers=membersOf(snapshot);renderDirectory();if(feedback)feedback.textContent='Choose a channel to join · up to 6 people each';
    },()=>{if(version!==directoryVersion)return;if(feedback)feedback.textContent='Voice channels are unavailable. Reopen this conversation to retry.';});
  }
  const now=()=>Date.now();
  const stamp=value=>value?.toMillis?.() || value?.toDate?.()?.getTime() || 0;
  const timeout=(promise,ms,message)=>{
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms)})]).finally(()=>clearTimeout(timer));
  };
  const live=s=>session===s && !s.closed;
  const membersOf=snapshot=>{const members=Object.create(null);snapshot.forEach(doc=>{const voice=doc.data().voice;if(voice && /^v[a-f0-9]{32}$/.test(voice.sessionId) && voice.peerId==='lyria-'+voice.sessionId)members[voice.sessionId]={...voice,userId:doc.id};});return members;};
  const participants=s=>Object.entries(s.members || {}).filter(([id,p])=>p && channelOf(p)===s.channel && typeof p.peerId==='string' && (stamp(p.updatedAt)>now()-PRESENCE_MS || id===s.id || s.calls.get(id)?.connected));
  function status(text,kind='info'){
    const el=$('voice-status');if(el){el.textContent=text;el.dataset.state=kind;}
  }
  function render(){
    const s=session, active=s && !s.closed;
    renderDirectory();
    window.dispatchEvent(new CustomEvent('lyria:voice-state',{detail:getSession()}));
    if($('make-voice-call')){$('make-voice-call').disabled=Boolean(active);$('make-voice-call').style.display=active?'none':'inline-flex';}
    if($('end-call')){$('end-call').style.display=active?'inline-flex':'none';$('end-call').setAttribute('aria-label',s?.joining?'Cancel joining voice':'Leave voice call');$('end-call').innerHTML=UI.icon('phoneOff')+'<span class="button-label">'+(s?.joining?'Cancel':'Leave voice')+'</span>';}
    if($('voice-panel'))$('voice-panel').hidden=!active;
    if(!active)return;
    const roomLabel=$('voice-room-name');if(roomLabel)roomLabel.textContent=s.label+' · '+channelName(s.channel);
    const memberList=$('voice-participants');if(memberList){memberList.replaceChildren();for(const [id,person] of participants(s)){const item=document.createElement('li');item.textContent=(id===s.id?'You':person.displayName || 'Member')+((id===s.id?s.muted:person.muted)?' · muted':'');memberList.append(item)}}
    const peers=[...s.calls.values()], count=participants(s).length || 1;
    const failed=peers.some(entry=>entry.failed);
    const connected=peers.filter(entry=>entry.connected).length;
    const blocked=peers.some(entry=>entry.audio?.paused && entry.connected);
    if($('voice-enable-sound'))$('voice-enable-sound').hidden=!blocked;
    if($('voice-enable-effects'))$('voice-enable-effects').hidden=soundEnabled && audioContext?.state==='running';
    if($('voice-retry'))$('voice-retry').hidden=!failed;
    if($('voice-mute')){$('voice-mute').disabled=!s.stream;$('voice-mute').setAttribute('aria-pressed',String(Boolean(s.muted)));$('voice-mute').textContent=s.muted?'Unmute':'Mute';}
    if(s.joining)return;
    if(failed)status('Some audio could not connect. Try rejoining voice or using another network.','error');
    else if(blocked)status('Voice is connected. Tap Enable sound to hear people.');
    else if(count===1)status('You’re in voice. Waiting for someone else to join.');
    else if(connected<count-1)status(`Connecting audio · ${count} people in voice…`);
    else status(`Connected · ${count} people${s.muted?' · microphone muted':''}`,'connected');
  }
  function removeCall(s,key){
    const entry=s.calls.get(key);if(!entry)return;
    s.calls.delete(key);clearTimeout(entry.timer);clearTimeout(entry.disconnectTimer);
    if(entry.audio){entry.audio.pause();entry.audio.srcObject=null;entry.audio.remove();}
    entry.call.close();if(live(s))render();
  }
  function clearPresence(s){
    // A cancelled old session must not delete a newer session from another tab.
    s.db.runTransaction(async tx=>{
      const doc=await tx.get(s.presenceRef);
      if(doc.exists && doc.data().voice?.sessionId===s.id)tx.update(s.presenceRef,{voice:firebase.firestore.FieldValue.delete()});
    }).catch(error=>console.warn('Voice presence cleanup will expire automatically.',error));
  }
  function stop(s){
    if(!s || s.closed)return;
    s.closed=true;clearInterval(s.heartbeat);clearInterval(s.presenceCheck);s.unsubscribe?.();
    s.stream?.getTracks().forEach(track=>track.stop());
    for(const key of [...s.calls.keys()])removeCall(s,key);
    s.peer?.destroy();
    // Capture the old room reference. Channel changes must never remove a new room's presence.
    if(s.registered)clearPresence(s);
  }
  function leave(){
    generation++;const old=session;session=null;if(old && !old.joining && !old.closed)sound('leave');stop(old);render();
  }
  function failure(error){
    if(error?.name==='NotAllowedError' || error?.name==='SecurityError')return 'Microphone access is blocked. Allow Microphone for LYRIA in Safari’s website settings, then try again.';
    if(error?.name==='NotFoundError')return 'No microphone was found. Connect a microphone and try again.';
    if(error?.name==='NotReadableError')return 'Your microphone is busy or unavailable. Close other calls and try again.';
    if(error?.code==='permission-denied')return 'This account cannot join voice in this conversation.';
    return error?.message || 'Voice could not connect. Please try again.';
  }
  async function play(entry){
    try{await entry.audio.play()}catch(error){if(error.name!=='AbortError')console.info('A tap is needed to enable remote sound.');}
    render();
  }
  function addCall(s,otherId,call){
    if(!call)return;
    if(!live(s) || s.calls.has(otherId)){call.close();return;}
    const entry={call,connected:false,failed:false,audio:null};s.calls.set(otherId,entry);
    entry.timer=setTimeout(()=>{if(live(s)&&s.calls.get(otherId)===entry&&!entry.connected){entry.failed=true;render()}},18000);
    call.on('stream',stream=>{
      if(!live(s)||s.calls.get(otherId)!==entry)return;
      entry.connected=call.peerConnection?.connectionState==='connected';
      if(entry.connected){clearTimeout(entry.timer);entry.failed=false;}
      if(!entry.audio){
        const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.setAttribute('aria-hidden','true');audio.className='voice-remote-audio';
        audio.addEventListener('playing',render);audio.addEventListener('pause',render);document.body.append(audio);entry.audio=audio;
      }
      entry.audio.srcObject=stream;watchConnection(s,entry);play(entry);render();
    });
    call.on('close',()=>{if(s.calls.get(otherId)===entry)removeCall(s,otherId)});
    call.on('error',error=>{console.warn('Peer audio connection failed',error);entry.failed=true;render()});
    watchConnection(s,entry);
  }
  function watchConnection(s,entry){
    const call=entry.call;
    if(entry.watching || !call.peerConnection)return;
    entry.watching=true;
    call.peerConnection?.addEventListener('connectionstatechange',()=>{
      if(!live(s))return;
      const connection=call.peerConnection.connectionState;
      if(connection==='failed'){entry.failed=true;entry.connected=false;render()}
      else if(connection==='connected'){clearTimeout(entry.timer);clearTimeout(entry.disconnectTimer);entry.connected=Boolean(entry.audio);entry.failed=false;render()}
      else if(connection==='disconnected'){
        entry.connected=false;render();
        clearTimeout(entry.disconnectTimer);entry.disconnectTimer=setTimeout(()=>{if(live(s)){entry.failed=true;render()}},10000);
      }
    });
  }

  function sync(s){
    if(!live(s)||s.joining)return;
    const active=new Map(participants(s));
    for(const id of [...s.calls.keys()])if(!active.has(id))removeCall(s,id);
    for(const [id,member]of active){
      // Exactly one side creates each offer; the other side only answers.
      if(id===s.id || s.id.localeCompare(id)>=0 || s.calls.has(id))continue;
      try{addCall(s,id,s.peer.call(member.peerId,s.stream,{metadata:{roomId:s.room,channel:s.channel,sessionId:s.id}}))}
      catch(error){console.warn('Could not create audio offer',error);status('Audio could not connect. Try rejoining voice.','error');$('voice-retry').hidden=false;}
    }
    render();
  }
  async function incoming(s,call){
    if(!live(s)||!s.registered||!s.stream||call.metadata?.roomId!==s.room || channelOf(call.metadata)!==s.channel){call.close();return;}
    const id=call.metadata?.sessionId;
    if(typeof id!=='string' || !/^v[a-f0-9]{32}$/.test(id)){call.close();return;}
    // Only an active participant in this same room may send an incoming call.
    if(!s.members[id]){
      try{const snapshot=await timeout(s.presence.get({source:'server'}),8000,'Participant lookup timed out.');s.members=membersOf(snapshot);}
      catch{call.close();return;}
    }
    const member=new Map(participants(s)).get(id);
    if(!live(s)||!member||member.peerId!==call.peer||id.localeCompare(s.id)>=0||s.calls.has(id)){call.close();return;}
    addCall(s,id,call);call.answer(s.stream);
  }
  async function join(channel='lounge',targetRoom=roomId,label,prepared){
    unlockSound();
    if(!CHANNELS.some(c=>c.id===channel))return;
    if(session)return false;
    const auth=window.firebaseConfig?.getAuth(), db=window.firebaseConfig?.getFirestore();
    const user=auth?.currentUser;
    if(!user || !targetRoom){UI.notify('Wait for your conversation to finish loading.');return;}
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia){UI.notify('Voice needs a microphone-capable browser on HTTPS.','error');return;}
    if(typeof Peer!=='function'){UI.notify('The voice connection library could not load. Refresh and try again.','error');return;}
    const id='v'+Array.from(crypto.getRandomValues(new Uint8Array(16)),byte=>byte.toString(16).padStart(2,'0')).join('');
    const s={id,room:targetRoom,channel,label:label || document.getElementById('channel-title')?.textContent || (targetRoom==='community'?'Everyone':'Conversation'),userId:user.uid,db,presence:db.collection('channels').doc(targetRoom).collection('typingStatus'),presenceRef:db.collection('channels').doc(targetRoom).collection('typingStatus').doc(user.uid),calls:new Map(),members:{},joining:true,closed:false,registered:false};
    session=s;const version=++generation;render();status('Allow microphone access to join voice…');
    // Start microphone permission from this direct user gesture, not an incoming call.
    const media=(prepared || prepare()).then(stream=>{
      if(!live(s)){stream.getTracks().forEach(track=>track.stop());throw new Error('Voice join cancelled.')}
      s.stream=stream;return stream;
    });
    media.catch(()=>{});
    try{
      const config=window.LYRIA_VOICE_CONFIG || {};
      // Preserve the pinned SDK's STUN and TURN relay pool by default.
      // Supplying a STUN-only configuration would break calls on restrictive mobile networks.
      const peerOptions={secure:true,...(config.signaling || {})};
      if(config.iceServers)peerOptions.config={iceServers:config.iceServers};
      else if(window.peerjs?.util?.defaultConfig){
        const defaults=window.peerjs.util.defaultConfig;
        // Keep the SDK's public relay pool and add TCP alternatives when UDP is blocked.
        peerOptions.config={...defaults,iceServers:defaults.iceServers.map(server=>{
          const urls=Array.isArray(server.urls)?server.urls:[server.urls];
          const tcp=urls.filter(url=>url.startsWith('turn:')&&!url.includes('?')).map(url=>url+'?transport=tcp');
          return {...server,urls:[...urls,...tcp]};
        })};
      }
      s.peer=new Peer('lyria-'+id,peerOptions);
      const ready=timeout(new Promise((resolve,reject)=>{
        s.peer.once('open',resolve);s.peer.once('error',reject);
      }),15000,'The voice service could not be reached. Try another network or rejoin.');
      s.peer.on('call',call=>incoming(s,call));
      s.peer.on('disconnected',()=>{
        if(!live(s))return;
        status('Voice signaling disconnected. Reconnecting…');
        try{s.peer.reconnect()}catch(error){console.warn(error);$('voice-retry').hidden=false;}
      });
      s.peer.on('error',error=>{
        if(!live(s)||s.joining)return;
        console.warn('Voice service error',error);
        if(error.type==='peer-unavailable'){for(const entry of s.calls.values())if(!entry.connected)entry.failed=true;render();return;}
        leave();UI.notify('The voice service disconnected. Rejoin to try again.','error');
      });
      const [,peerId,snapshot]=await Promise.all([media,ready,timeout(s.presence.get({source:'server'}),15000,'The voice room could not load. Try again.')]);
      if(!live(s)||version!==generation)return;
      s.members=membersOf(snapshot);
      if(participants(s).filter(([,member])=>member.userId!==user.uid).length>=MAX_PEOPLE)throw new Error('This voice room is full (6 people). Try again when someone leaves.');
      s.peerId=peerId;status('Connecting to the voice room…');s.registered=true;
      const registration=s.presenceRef.set({voice:{sessionId:id,peerId,channel,displayName:String(window.LyriaAccount?.getProfile?.()?.displayName || user.displayName || 'Member').slice(0,60),muted:false,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}},{merge:true});
      registration.then(()=>{if(!live(s))clearPresence(s)}).catch(()=>{});
      await timeout(registration,15000,'The voice room could not confirm your connection. Please rejoin.');
      if(!live(s)||version!==generation)return;
      s.joining=false;sound('join');s.known=new Set(participants(s).map(([id])=>id));
      s.unsubscribe=s.presence.onSnapshot(snapshot=>{
        if(!live(s))return;
        const previous=s.known;s.members=membersOf(snapshot);
        const next=new Set(participants(s).map(([id])=>id));
        if([...next].some(id=>id!==s.id && !previous.has(id)))sound('join');
        if([...previous].some(id=>id!==s.id && !next.has(id)))sound('leave');
        s.known=next;
        const mine=Object.entries(s.members).find(([,member])=>member.userId===s.userId);
        if(mine && mine[0]!==s.id){leave();UI.notify('Voice was opened in another tab or device.');return;}
        sync(s);
      },error=>{if(live(s)){leave();UI.notify('The voice room disconnected. Rejoin to try again.','error')}console.warn(error)});
      s.heartbeat=setInterval(()=>{
        if(live(s))s.presenceRef.update({'voice.updatedAt':firebase.firestore.FieldValue.serverTimestamp()}).then(()=>{if(!live(s))clearPresence(s)}).catch(error=>console.warn('Voice presence update failed',error));
      },HEARTBEAT_MS);
      s.presenceCheck=setInterval(()=>sync(s),5000);render();return true;
    }catch(error){
      if(live(s)){leave();UI.notify(failure(error),'error')}
      else stop(s);
      return false;
    }
  }
  function setRoom(next){
    if(next!==roomId){roomId=next;watchDirectory()}render();
  }
  $('make-voice-call')?.addEventListener('click',()=>join('lounge'));
  $('end-call')?.addEventListener('click',leave);
  $('voice-mute')?.addEventListener('click',()=>{
    const s=session;if(!s?.stream)return;s.muted=!s.muted;s.stream.getAudioTracks().forEach(track=>{track.enabled=!s.muted});unlockSound();sound(s.muted?'mute':'unmute');s.presenceRef.update({'voice.muted':s.muted}).catch(()=>{});render();
  });
  $('voice-enable-sound')?.addEventListener('click',()=>{if(session)for(const entry of session.calls.values())if(entry.audio)play(entry)});
  $('voice-retry')?.addEventListener('click',()=>{const channel=session?.channel || 'lounge',room=session?.room,label=session?.label;leave();join(channel,room,label)});
  window.addEventListener('pagehide',()=>{stopRinging();leave()});
  window.leaveCurrentCall=leave;
  window.setupCallListeners=setRoom;
  const effects=$('voice-sound-effects');if(effects){effects.checked=soundEnabled;effects.addEventListener('change',()=>{soundEnabled=effects.checked;unlockSound();if(!soundEnabled)for(const node of ringNodes){try{node.stop()}catch{}}try{localStorage.setItem('lyria-voice-sounds',soundEnabled?'on':'off')}catch{}})}
  $('voice-enable-effects')?.addEventListener('click',async()=>{await enableSounds();sound('join');render()});
  $('voice-test-sound')?.addEventListener('click',async()=>{await enableSounds();sound('join')});
  setInterval(renderDirectory,5000);
  window.LyriaVoice={join,leave,setRoom,prepare,getSession,startRinging,stopRinging,enableSounds,soundReady:()=>soundEnabled && audioContext?.state==='running',refreshDirectory:watchDirectory,leaveRoom:room=>{if(session?.room===room)leave()}};
})();
