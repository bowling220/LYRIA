/* Opt-in voice sessions. Media is stopped locally before any network cleanup. */
(() => {
  const $=id=>document.getElementById(id);
  const UI=window.LyriaUI, Presence=window.LyriaVoicePresence;
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
  const micLeases=new Set();let capturePending,captureSource;
  const usable=stream=>stream?.getAudioTracks().some(track=>track.readyState==='live' && !track.muted);
  const stopStream=stream=>stream?.getTracks().forEach(track=>track.stop());
  function lease(stream){
    if(!usable(stream))throw new Error('The microphone stopped before it was ready. Try reconnecting it.');
    const copy=stream.clone();copy.getAudioTracks().forEach(track=>track.enabled=true);micLeases.add(copy);return copy;
  }
  function prepare(){
    unlockSound();window.LyriaVoiceTransport?.get().catch(()=>{});
    if(!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)return Promise.reject(new Error('Voice needs microphone access on HTTPS.'));
    for(const stream of micLeases)if(!stream.getAudioTracks().some(track=>track.readyState==='live'))micLeases.delete(stream);
    // Clone a healthy capture for handoff. Opening another device stream can interrupt Safari's first capture.
    const source=[session?.stream,captureSource,...micLeases].find(usable);
    if(source)return Promise.resolve(lease(source));
    if(!capturePending){
      for(const stream of micLeases)stopStream(stream);micLeases.clear();
      let expired=false,timer;
      const capture=constraints=>{try{return Promise.resolve(navigator.mediaDevices.getUserMedia(constraints))}catch(error){return Promise.reject(error)}};
      const raw=capture({audio:{echoCancellation:true,noiseSuppression:true},video:false}).catch(error=>{
        if(!['OverconstrainedError','ConstraintNotSatisfiedError','NotReadableError','AbortError'].includes(error.name))throw error;
        return capture({audio:true,video:false});
      });
      raw.then(stream=>{if(expired)stopStream(stream)}).catch(()=>{});
      capturePending=Promise.race([raw,new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(new Error('The microphone did not start. Check the permission prompt, then tap Join again.'))},15000)})]).then(stream=>{
        if(!usable(stream)){stopStream(stream);throw new Error('No working microphone audio track was returned.');}
        captureSource=stream;setTimeout(()=>{if(captureSource===stream)captureSource=null;stopStream(stream)},0);return stream;
      }).finally(()=>{clearTimeout(timer);capturePending=null});
    }
    return capturePending.then(lease);
  }
  function micHealth(s){
    const track=s.stream?.getAudioTracks()[0];return !track || track.readyState!=='live'?'stopped':track.muted?'interrupted':'ready';
  }
  function stopMeter(s){clearInterval(s.meterTimer);s.micSource?.disconnect();s.analyser?.disconnect();s.micSource=null;s.analyser=null;s.unbindMic?.();}
  function bindMic(s){
    stopMeter(s);const stream=s.stream;
    const update=()=>{if(live(s) && s.stream===stream)render()};
    for(const track of stream.getAudioTracks())for(const type of ['ended','mute','unmute'])track.addEventListener(type,update);
    s.unbindMic=()=>{for(const track of stream.getAudioTracks())for(const type of ['ended','mute','unmute'])track.removeEventListener(type,update)};
    try{if(audioContext){s.micSource=audioContext.createMediaStreamSource(stream);s.analyser=audioContext.createAnalyser();s.analyser.fftSize=256;s.micSource.connect(s.analyser)}}catch(error){console.info('Microphone level meter unavailable',error)}
    s.meterTimer=setInterval(()=>{
      if(!live(s))return;
      const state=micHealth(s);if(state!==s.lastMicHealth){s.lastMicHealth=state;render()}
      const meter=$('voice-mic-level');if(meter){let level=0;if(s.analyser && !s.muted && state==='ready'){const data=new Uint8Array(s.analyser.fftSize);s.analyser.getByteTimeDomainData(data);level=Math.min(1,Math.sqrt(data.reduce((sum,n)=>sum+((n-128)/128)**2,0)/data.length)*5)}meter.value=level}
    },250);
  }
  async function repairMic(){
    const s=session;if(!live(s) || s.repairing)return;s.repairing=true;render();let old;
    try{
      const stream=await prepare();if(!live(s)){stopStream(stream);return}
      const track=stream.getAudioTracks()[0];track.enabled=!s.muted;
      old=s.stream;s.repairPrevious=old;s.stream=stream;bindMic(s);
      await Promise.all([...s.calls.values()].map(async entry=>{
        try{
          const sender=entry.call.peerConnection?.getSenders().find(sender=>sender.track?.kind==='audio');
          if(!sender)throw new Error('Audio sender needs a new connection.');
          await timeout(sender.replaceTrack(track),5000,'Audio replacement timed out.');
        }catch(error){if(live(s))retryCall(s,entry)}
      }));
    }catch(error){if(live(s))UI.notify(failure(error),'error')}
    finally{stopStream(old);s.repairPrevious=null;if(live(s)){s.repairing=false;render()}}
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
    if(!roomId)return;
    const db=window.firebaseConfig?.getFirestore();if(!db)return;
    const feedback=$('voice-directory-status');if(feedback)feedback.textContent='Loading people in voice…';
    directoryOff=Presence.watch(roomId,snapshot=>{
      if(version!==directoryVersion)return;directoryMembers=membersOf(snapshot);renderDirectory();if(feedback)feedback.textContent='Choose a channel to join · up to 6 people each';
    },()=>{if(version!==directoryVersion)return;if(feedback)feedback.textContent='Voice channels are unavailable. Reopen this conversation to retry.';});
  }
  const now=()=>Date.now();
  const stamp=value=>value?.toMillis?.() || value?.toDate?.()?.getTime() || 0;
  const timeout=(promise,ms,message)=>{
    let timer;
    return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(message)),ms)})]).finally(()=>clearTimeout(timer));
  };
  const live=s=>Boolean(s && session===s && !s.closed);
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
    const health=s.stream?micHealth(s):'starting';
    if($('voice-mic-status'))$('voice-mic-status').textContent=s.repairing?'Reconnecting microphone…':health==='stopped'?'Microphone stopped. Reconnect it to speak.':health==='interrupted'?'Your device paused the microphone.':s.muted?'Microphone muted':health==='ready'?'Microphone ready · speak to test':'Waiting for microphone…';
    if($('voice-repair-mic')){$('voice-repair-mic').hidden=health==='ready' || health==='starting';$('voice-repair-mic').disabled=!!s.repairing;}
    if($('voice-mic-level') && (health!=='ready' || s.muted))$('voice-mic-level').value=0;
    const peers=[...s.calls.values()], count=participants(s).length || 1;
    const retries=[...s.retries.values()];
    const failed=peers.some(entry=>entry.failed) || retries.some(r=>r.attempts>3);
    const retrying=retries.some(r=>r.attempts<=3);
    const connected=peers.filter(entry=>entry.connected).length;
    const blocked=peers.some(entry=>entry.blocked && entry.connected);
    if($('voice-enable-sound'))$('voice-enable-sound').hidden=!blocked;
    if($('voice-enable-effects'))$('voice-enable-effects').hidden=soundEnabled && audioContext?.state==='running';
    if($('voice-retry'))$('voice-retry').hidden=!(failed || s.signalAttempts>=5);
    if($('voice-mute')){$('voice-mute').disabled=!s.stream;$('voice-mute').setAttribute('aria-pressed',String(Boolean(s.muted)));$('voice-mute').textContent=s.muted?'Unmute':'Mute';}
    if(s.joining)return;
    if(health==='stopped' || health==='interrupted')status('Your microphone was interrupted. Reconnect the microphone to speak.','error');
    else if(failed)status(s.relay?'Audio could not reconnect. Try Rejoin voice.':'Audio could not connect on this network. A working voice relay is needed.','error');
    else if(s.signalLost)status(connected?'Call audio is connected. Reconnecting the call service…':'Reconnecting the call service…');
    else if(s.presenceLost)status('Reconnecting the voice room…');
    else if(retrying)status('Reconnecting audio…');
    else if(blocked)status('Voice is connected. Tap Enable sound to hear people.');
    else if(!navigator.onLine)status('Your network disconnected. Voice is reconnecting…');
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
  function clearPresence(s){Presence.clear(s).catch(error=>console.warn('Voice presence cleanup will expire automatically.',error));}
  function stop(s){
    if(!s || s.closed)return;
    s.closed=true;clearInterval(s.heartbeat);clearInterval(s.presenceCheck);clearTimeout(s.signalTimer);s.unsubscribe?.();stopMeter(s);
    s.stream?.getTracks().forEach(track=>track.stop());stopStream(s.repairPrevious);
    for(const key of [...s.calls.keys()])removeCall(s,key);
    s.peer?.destroy();
    // Capture the old room reference. Channel changes must never remove a new room's presence.
    if(s.registered)clearPresence(s);
  }
  function leave(){
    generation++;const old=session;session=null;if(old && !old.joining && !old.closed)sound('leave');stop(old);render();
  }
  function failure(error){
    if(error?.name==='NotAllowedError' || error?.name==='SecurityError')return 'Microphone access is blocked. Allow this site to use the microphone in your browser’s website settings, then try again.';
    if(error?.name==='NotFoundError')return 'No microphone was found. Connect a microphone and try again.';
    if(error?.name==='NotReadableError')return 'Your microphone is busy or unavailable. Close other calls and try again.';
    if(error?.code==='permission-denied')return 'This account cannot join voice in this conversation.';
    return error?.message || 'Voice could not connect. Please try again.';
  }
  async function play(entry){
    try{entry.audio.muted=false;await entry.audio.play();entry.blocked=false}catch(error){if(error.name!=='AbortError'){entry.blocked=true;console.info('A tap is needed to enable remote sound.')}}
    render();
  }
  function retryCall(s,entry){
    if(!live(s) || s.calls.get(entry.id)!==entry)return;
    const previous=s.retries.get(entry.id) || {attempts:0};
    s.retries.set(entry.id,{attempts:previous.attempts+1,next:now()+Math.min(8000,1000*2**previous.attempts)});
    removeCall(s,entry.id);render();
  }
  function reconnectSignaling(s){
    if(!live(s) || s.peer.destroyed || s.signalTimer || !s.peer.disconnected)return;
    s.signalLost=true;s.signalAttempts=(s.signalAttempts || 0)+1;
    if(s.signalAttempts>5){render();return}
    s.signalTimer=setTimeout(()=>{s.signalTimer=null;if(!live(s) || !s.peer.disconnected)return;try{s.peer.reconnect()}catch(error){console.warn('Signaling retry failed',error);reconnectSignaling(s)}},Math.min(5000,500*2**(s.signalAttempts-1)));render();
  }
  function watchSession(s){
    s.unsubscribe?.();
    s.unsubscribe=Presence.watch(s.room,snapshot=>{
      if(!live(s))return;s.presenceLost=false;
      const previous=s.known || new Set();s.members=membersOf(snapshot);
      const next=new Set(participants(s).map(([id])=>id));
      if([...next].some(id=>id!==s.id && !previous.has(id)))sound('join');
      if([...previous].some(id=>id!==s.id && !next.has(id)))sound('leave');
      s.known=next;
      const mine=Object.entries(s.members).find(([,member])=>member.userId===s.userId);
      if(mine && mine[0]!==s.id){leave();UI.notify('Voice was opened in another tab or device.');return}
      sync(s);
    },error=>{if(!live(s))return;if(error.code==='permission-denied'){leave();UI.notify('You no longer have access to this voice room.','error');return}s.presenceLost=true;render()},()=>{if(live(s) && s.presenceLost){s.presenceLost=false;render()}});
  }
  function addCall(s,otherId,call){
    if(!call)return;
    if(!live(s) || s.calls.has(otherId)){call.close();return;}
    const entry={id:otherId,call,connected:false,failed:false,blocked:false,audio:null};s.calls.set(otherId,entry);
    entry.timer=setTimeout(()=>{if(live(s)&&s.calls.get(otherId)===entry&&!entry.connected){retryCall(s,entry)}},18000);
    call.on('stream',stream=>{
      if(!live(s)||s.calls.get(otherId)!==entry)return;
      entry.connected=call.peerConnection?.connectionState==='connected';
      if(entry.connected){clearTimeout(entry.timer);entry.failed=false;s.retries.delete(otherId);}
      if(!entry.audio){
        const audio=document.createElement('audio');audio.autoplay=true;audio.setAttribute('playsinline','');audio.setAttribute('aria-hidden','true');audio.className='voice-remote-audio';
        audio.addEventListener('playing',render);audio.addEventListener('pause',render);document.body.append(audio);entry.audio=audio;
      }
      entry.audio.srcObject=stream;watchConnection(s,entry);play(entry);render();
    });
    call.on('close',()=>{if(s.calls.get(otherId)===entry)retryCall(s,entry)});
    call.on('error',error=>{console.warn('Peer audio connection failed',error);retryCall(s,entry)});
    watchConnection(s,entry);
  }
  function watchConnection(s,entry){
    const call=entry.call;
    if(entry.watching || !call.peerConnection)return;
    entry.watching=true;
    call.peerConnection?.addEventListener('connectionstatechange',()=>{
      if(!live(s) || s.calls.get(entry.id)!==entry)return;
      const connection=call.peerConnection.connectionState;
      if(connection==='failed'){entry.connected=false;retryCall(s,entry)}
      else if(connection==='connected'){clearTimeout(entry.timer);clearTimeout(entry.disconnectTimer);entry.connected=Boolean(entry.audio);entry.failed=false;s.retries.delete(entry.id);render()}
      else if(connection==='disconnected'){
        entry.connected=false;render();
        clearTimeout(entry.disconnectTimer);entry.disconnectTimer=setTimeout(()=>{if(live(s))retryCall(s,entry)},7000);
      }
    });
  }

  function sync(s){
    if(!live(s)||s.joining)return;
    const active=new Map(participants(s));
    for(const id of [...s.calls.keys()])if(!active.has(id))removeCall(s,id);
    for(const id of s.retries.keys())if(!active.has(id))s.retries.delete(id);
    for(const [id,member]of active){
      // Exactly one side creates each offer; the other side only answers.
      if(id===s.id || s.id.localeCompare(id)>=0 || s.calls.has(id))continue;
      const retry=s.retries.get(id);if(retry && (retry.attempts>3 || now()<retry.next))continue;
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
      try{const snapshot=await timeout(Presence.list(s.room),8000,'Participant lookup timed out.');s.members=membersOf(snapshot);}
      catch{call.close();return;}
    }
    const member=new Map(participants(s)).get(id);
    if(!live(s)||!member||member.peerId!==call.peer||id.localeCompare(s.id)>=0){call.close();return;}
    const previous=s.calls.get(id);if(previous){if(previous.call===call)return;removeCall(s,id)}
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
    const s={id,room:targetRoom,channel,label:label || document.getElementById('channel-title')?.textContent || (targetRoom==='community'?'Everyone':'Conversation'),userId:user.uid,db,calls:new Map(),retries:new Map(),members:{},joining:true,closed:false,registered:false};
    session=s;const version=++generation;render();status('Allow microphone access to join voice…');
    // Start microphone permission from this direct user gesture, not an incoming call.
    const media=(prepared || prepare()).then(stream=>{
      if(!live(s)){stream.getTracks().forEach(track=>track.stop());throw new Error('Voice join cancelled.')}
      s.stream=stream;bindMic(s);status('Microphone ready. Connecting to voice…');return stream;
    });
    media.catch(()=>{});
    try{
      const config=window.LYRIA_VOICE_CONFIG || {};
      // Relay configuration comes from deployment, never from the SDK's retired shared relay pool.
      const transport=await window.LyriaVoiceTransport.get();
      if(!live(s)){return false}
      s.relay=transport.relay;
      const peerOptions={secure:true,...(config.signaling || {}),config:{iceServers:transport.iceServers}};
      s.peer=new Peer('lyria-'+id,peerOptions);
      const ready=timeout(new Promise((resolve,reject)=>{
        s.peer.once('open',resolve);s.peer.once('error',reject);
      }),15000,'The voice service could not be reached. Try another network or rejoin.');
      s.peer.on('call',call=>incoming(s,call));
      s.peer.on('open',()=>{if(live(s)){s.signalLost=false;s.signalAttempts=0;clearTimeout(s.signalTimer);s.signalTimer=null;render()}});
      s.peer.on('disconnected',()=>reconnectSignaling(s));
      s.peer.on('error',error=>{
        if(!live(s) || s.joining)return;
        console.warn('Voice service error',error.type);
        if(error.type==='peer-unavailable'){for(const entry of [...s.calls.values()])if(!entry.connected)retryCall(s,entry);return}
        if(['invalid-id','invalid-key','unavailable-id','browser-incompatible','ssl-unavailable'].includes(error.type)){leave();UI.notify('The voice service is unavailable. Rejoin to try again.','error');return}
        s.signalLost=true;reconnectSignaling(s);render();
      });
      const [,peerId,snapshot]=await Promise.all([media,ready,timeout(Presence.list(s.room),15000,'The voice room could not load. Try again.')]);
      if(!live(s)||version!==generation)return;
      s.members=membersOf(snapshot);
      if(participants(s).filter(([,member])=>member.userId!==user.uid).length>=MAX_PEOPLE)throw new Error('This voice room is full (6 people). Try again when someone leaves.');
      if(micHealth(s)!=='ready')throw new Error('The microphone stopped while connecting. Reconnect it and try again.');
      s.peerId=peerId;status('Connecting to the voice room…');s.registered=true;
      const registration=Presence.register(s);
      registration.then(()=>{if(!live(s))clearPresence(s)}).catch(()=>{});
      await timeout(registration,15000,'The voice room could not confirm your connection. Please rejoin.');
      if(!live(s)||version!==generation)return;
      s.joining=false;sound('join');s.known=new Set(participants(s).map(([id])=>id));
      watchSession(s);
      s.heartbeat=setInterval(()=>{
        if(live(s) && !s.heartbeatBusy){s.heartbeatBusy=true;Presence.heartbeat(s).then(ok=>{if(!live(s))clearPresence(s);else if(!ok){leave();UI.notify('Voice was opened in another session.')}}).catch(error=>{if(live(s)){s.presenceLost=true;render()}console.warn('Voice presence update failed',error)}).finally(()=>s.heartbeatBusy=false)}
      },HEARTBEAT_MS);
      s.presenceCheck=setInterval(()=>sync(s),1000);render();return true;
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
    const s=session;if(!s?.stream)return;s.muted=!s.muted;s.stream.getAudioTracks().forEach(track=>{track.enabled=!s.muted});unlockSound();sound(s.muted?'mute':'unmute');Presence.mute(s,s.muted).catch(error=>console.warn('Mute indicator update failed',error));render();
  });
  $('voice-repair-mic')?.addEventListener('click',repairMic);
  $('voice-enable-sound')?.addEventListener('click',()=>{if(session)for(const entry of session.calls.values())if(entry.audio)play(entry)});
  $('voice-retry')?.addEventListener('click',()=>{const channel=session?.channel || 'lounge',room=session?.room,label=session?.label;leave();join(channel,room,label)});
  function refreshConnection(){const s=session;watchDirectory();if(live(s)){watchSession(s);s.retries.clear();reconnectSignaling(s);sync(s);render()}}
  window.addEventListener('online',refreshConnection);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden && session){render();for(const entry of session.calls.values())if(entry.audio?.paused)play(entry)}});
  window.addEventListener('pagehide',()=>{stopRinging();leave()});
  window.leaveCurrentCall=leave;
  window.setupCallListeners=setRoom;
  const effects=$('voice-sound-effects');if(effects){effects.checked=soundEnabled;effects.addEventListener('change',()=>{soundEnabled=effects.checked;unlockSound();if(!soundEnabled)for(const node of ringNodes){try{node.stop()}catch{}}try{localStorage.setItem('lyria-voice-sounds',soundEnabled?'on':'off')}catch{}})}
  $('voice-enable-effects')?.addEventListener('click',async()=>{await enableSounds();sound('join');render()});
  $('voice-test-sound')?.addEventListener('click',async()=>{await enableSounds();sound('join')});
  setInterval(renderDirectory,5000);
  window.LyriaVoice={join,leave,setRoom,prepare,repairMic,getSession,startRinging,stopRinging,enableSounds,soundReady:()=>soundEnabled && audioContext?.state==='running',refreshDirectory:watchDirectory,refreshConnection,leaveRoom:room=>{if(session?.room===room)leave()}};
})();
