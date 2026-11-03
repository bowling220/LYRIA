/* A call stage and compact chat ribbon over the existing voice session. */
(() => {
  const $=id=>document.getElementById(id),stage=$('call-stage'),grid=$('call-participant-grid');
  if(!stage || !grid)return;
  const Voice=window.LyriaVoice,UI=window.LyriaUI;
  let state=null,expanded=false,lastSession=null;
  const tiles=new Map(),speaking=new Map(),profiles=new Map(),loading=new Set();
  document.body.classList.add('voice-ui-ready');
  function show(open,focus=true){
    expanded=!!open && !!state;stage.hidden=!expanded;document.querySelector('.chat-area').classList.toggle('call-focused',expanded);
    $('voice-open-view')?.setAttribute('aria-expanded',String(expanded));
    if(focus){if(expanded){const active=document.activeElement;if(active?.matches('textarea,input'))active.blur();stage.focus({preventScroll:true})}else if(state)$('voice-open-view')?.focus({preventScroll:true})}
  }
  function duration(){
    const seconds=state?.startedAt?Math.max(0,Math.floor((Date.now()-state.startedAt)/1000)):0;
    const format=n=>String(n).padStart(2,'0');
    $('call-stage-duration').textContent=(seconds>=3600?format(Math.floor(seconds/3600))+':':'')+format(Math.floor(seconds/60)%60)+':'+format(seconds%60);
  }
  function initials(name){return String(name).trim().split(/\s+/).slice(0,2).map(s=>Array.from(s)[0]?.toUpperCase() || '').join('') || '?'}
  function paintProfile(tile,person,profile){
    if(!tile.isConnected)return;
    const name=profile.displayName || person.name || 'Member';
    tile.querySelector('.call-avatar-initials').textContent=initials(name);tile.querySelector('.call-person-name').textContent=name;
    const image=tile.querySelector('img');const url=window.LyriaMedia?.profileSource(profile) || '';
    const source=url && !url.includes('assets/avatar.svg')?url:'';
    if(image.getAttribute('src')!==(source || null)){
      if(window.LyriaMedia)window.LyriaMedia.image(image,source);else if(source)image.src=source;
    }
    if(!source)image.hidden=true;
  }
  function profile(tile,person){
    const own=person.self?window.LyriaAccount?.getProfile?.():null;
    const cached=profiles.get(person.userId);paintProfile(tile,person,own || cached?.value || {});
    if(person.self || !person.userId || loading.has(person.userId) || (cached && cached.until>Date.now()) || !window.LyriaDataAPI)return;
    loading.add(person.userId);const sessionId=state?.id;
    window.LyriaDataAPI.read('profiles/'+person.userId).then(doc=>{
      const value=doc.exists?doc.data():{};profiles.set(person.userId,{value,until:Date.now()+300000});
      if(state?.id===sessionId)paintProfile(tile,person,value);
    }).catch(()=>{profiles.set(person.userId,{value:cached?.value || {},until:Date.now()+30000})}).finally(()=>loading.delete(person.userId));
  }
  function createTile(person){
    const tile=document.createElement('article');tile.className='call-person';tile.dataset.participantId=person.id;
    const hue=100+[...String(person.userId)].reduce((sum,c)=>sum+c.codePointAt(0),0)%60;tile.style.setProperty('--person-hue',hue);
    tile.innerHTML='<span class="call-person-connection"></span><div class="call-person-avatar"><span class="call-avatar-initials"></span><img alt="" hidden></div><div class="call-person-caption"><div><strong class="call-person-name"></strong><span class="call-person-self"></span></div><span class="call-person-mic"></span></div><span class="call-person-level" aria-hidden="true"></span>';
    grid.append(tile);return tile;
  }
  function paintActivity(tile,value){
    const active=!!value?.speaking && tile.dataset.muted!=='true' && tile.dataset.connected!=='false';tile.classList.toggle('is-speaking',active);
    tile.style.setProperty('--voice-level',String(tile.dataset.muted==='true'?0:value?.level || 0));
  }
  function render(next){
    const changed=next?.id!==lastSession;state=next;lastSession=next?.id || null;
    if(!state){show(false,false);grid.replaceChildren();tiles.clear();speaking.clear();return}
    $('call-stage-title').textContent=state.label || 'Your call';$('call-stage-status').textContent=state.status || (state.joining?'Joining voice…':'Connected');
    const people=[...(state.participants || [])].sort((a,b)=>Number(a.self)-Number(b.self));
    $('call-stage-count').textContent=people.length+' '+(people.length===1?'person':'people');grid.dataset.count=String(people.length);
    $('call-stage-mic-note').textContent=state.muted?'Microphone muted':state.microphoneState==='interrupted'?'Microphone paused':state.microphoneState==='stopped'?'Microphone stopped':'';
    const present=new Set(people.map(person=>person.id));
    for(const [id,tile] of tiles)if(!present.has(id)){tile.remove();tiles.delete(id);speaking.delete(id)}
    let index=0;for(const person of people){
      let tile=tiles.get(person.id);if(!tile){tile=createTile(person);tiles.set(person.id,tile)}if(grid.children[index]!==tile)grid.insertBefore(tile,grid.children[index] || null);index++;
      tile.dataset.muted=String(!!person.muted);tile.dataset.self=String(!!person.self);tile.dataset.connected=String(!!person.connected);
      tile.querySelector('.call-person-connection').textContent=person.connected?'':'Connecting…';
      tile.querySelector('.call-person-self').textContent=person.self?'You':person.muted?'Microphone muted':'In voice';
      const mic=tile.querySelector('.call-person-mic');mic.innerHTML=UI.icon(person.muted?'micOff':'mic');mic.setAttribute('aria-label',person.muted?'Microphone muted':'Microphone on');mic.title=person.muted?'Microphone muted':'Microphone on';
      profile(tile,person);paintActivity(tile,speaking.get(person.id));
    }
    const mute=$('call-stage-mute');mute.setAttribute('aria-pressed',String(!!state.muted));mute.setAttribute('aria-label',state.muted?'Unmute microphone':'Mute microphone');mute.disabled=state.microphoneState==='starting';mute.querySelector('.call-control-icon').innerHTML=UI.icon(state.muted?'micOff':'mic');mute.querySelector('.call-control-label').textContent=state.muted?'Unmute':'Mute';
    const sound=$('call-stage-sound');sound.setAttribute('aria-pressed',String(!!state.audioMuted));sound.setAttribute('aria-label',state.audioMuted?'Enable call audio':'Mute call audio');sound.querySelector('.call-control-icon').innerHTML=UI.icon(state.audioMuted?'volumeOff':'volume');sound.querySelector('.call-control-label').textContent=state.audioMuted?'Sound off':'Sound';
    $('call-stage-enable-audio').hidden=!state.needsSound;$('call-stage-retry').hidden=!state.needsRetry;
    $('call-stage-repair').hidden=!['stopped','interrupted'].includes(state.microphoneState);$('call-stage-repair').disabled=!!state.repairing;
    duration();if(changed)show(true);
  }
  $('voice-open-view')?.addEventListener('click',()=>show(true));
  $('call-stage-collapse').addEventListener('click',()=>show(false));$('call-stage-chat').addEventListener('click',()=>show(false));
  $('call-stage-mute').addEventListener('click',()=>$('voice-mute')?.click());$('call-stage-sound').addEventListener('click',()=>Voice.toggleAudio());$('call-stage-leave').addEventListener('click',()=>Voice.leave());
  $('call-stage-enable-audio').addEventListener('click',()=>$('voice-enable-sound')?.click());$('call-stage-repair').addEventListener('click',()=>Voice.repairMic());$('call-stage-retry').addEventListener('click',()=>$('voice-retry')?.click());
  window.addEventListener('lyria:voice-state',event=>render(event.detail));
  window.addEventListener('lyria:voice-speaking',event=>{
    const value=event.detail;if(!state || value.sessionId!==state.id)return;speaking.set(value.participantId,value);
    const tile=tiles.get(value.participantId);if(tile)paintActivity(tile,value);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape' && expanded && !document.querySelector('.modal[aria-hidden="false"]'))show(false)});
  setInterval(duration,1000);
  window.LyriaVoiceView={showCall:()=>show(true),showChat:()=>show(false,false)};
  render(Voice.getSession());
})();
