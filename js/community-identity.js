/* Per-conversation identity, room appearance, and bundled sticker packs. */
(() => {
  const $ = id => document.getElementById(id);
  const accents = ['#7dd3a7','#7db8ff','#c5a3ff','#ff9f80','#ffd166','#ff89b5'];
  const icons = ['💬','🌿','🎨','🎮','🎵','🚀'];
  const banners = ['glow','waves','grid','sunset'];
  const packs = {
    lyria: [['hello','Hello','👋'],['love','Lots of love','💚'],['spark','Brilliant','✨'],['party','Celebrate','🎉'],['idea','Great idea','💡'],['cozy','Cozy','☕'],['wow','Amazing','🤩'],['thanks','Thank you','🙌']],
    critters: [['cat','Happy cat','😺'],['fox','Clever fox','🦊'],['frog','Friendly frog','🐸'],['bear','Bear hug','🐻'],['bee','Busy bee','🐝'],['owl','Wise owl','🦉'],['panda','Panda hello','🐼'],['otter','Otterly delighted','🦦']],
    cosmic: [['rocket','Launch','🚀'],['moon','Good night','🌙'],['star','Superstar','🌟'],['planet','Out of this world','🪐'],['alien','Hello earthling','👽'],['comet','On my way','☄️'],['sun','Bright day','🌞'],['satellite','Message received','🛰️']]
  };
  let auth, db, currentId, currentRoom, ownOverride = {}, selection = 0, profileRevision = 0;
  const cache = new Map();
  const clean = (value,max) => String(value || '').trim().slice(0,max);
  const preset = (value,list,fallback) => list.includes(value) ? value : fallback;
  const mergeProfile = (base={},override={}) => ({...base,...Object.fromEntries(['displayName','bio','photoURL','bannerURL'].filter(key=>typeof override[key]==='string' && override[key].trim()).map(key=>[key,override[key]]))});
  function style(room={}) {
    return {accent:preset(room.accent,accents,accents[0]),icon:preset(room.icon,icons,icons[0]),banner:preset(room.bannerStyle,banners,banners[0]),stickerPack:preset(room.stickerPack,Object.keys(packs),'lyria')};
  }
  function apply(room={}) {
    const value=style(room), area=document.querySelector('.chat-area');
    area?.style.setProperty('--room-accent',value.accent);
    area?.setAttribute('data-room-banner',value.banner);
    const symbol=document.querySelector('.channel-symbol');if(symbol){symbol.textContent=value.icon;symbol.setAttribute('aria-hidden','true')}
    const cover=document.querySelector('.details-cover');if(cover){cover.style.setProperty('--room-accent',value.accent);cover.dataset.roomBanner=value.banner}
    const coverSymbol=document.querySelector('.details-cover-symbol');if(coverSymbol)coverSymbol.textContent=value.icon;
    renderStickers(value.stickerPack);
  }
  function fillOwner(room={}) {
    const owner=room.createdBy && room.createdBy===auth?.currentUser?.uid;
    const section=$('room-appearance-settings');if(section)section.hidden=!owner;
    if(!owner)return;
    const value=style(room);
    $('room-description').value=room.description || '';
    $('room-accent').value=value.accent;$('room-icon').value=value.icon;
    $('room-banner-style').value=value.banner;$('room-sticker-pack').value=value.stickerPack;
  }
  function fillProfile(value={}) {
    ownOverride=value;
    $('room-profile-name').value=value.displayName || '';
    $('room-profile-bio').value=value.bio || '';
    $('room-profile-avatar').value=value.photoURL || '';
    $('room-profile-banner').value=value.bannerURL || '';
    $('room-profile-status').textContent=value.displayName?'This conversation uses your custom profile.':'Blank fields inherit your account profile.';
  }
  async function loadOwn(id,run) {
    const uid=auth?.currentUser?.uid;if(!uid)return;
    const revision=profileRevision;
    try{const doc=await window.LyriaDataAPI.read(`channels/${id}/memberProfiles/${uid}`);if(run===selection && revision===profileRevision)fillProfile(doc.exists?doc.data():{})}
    catch(error){if(run===selection && revision===profileRevision)$('room-profile-status').textContent='Your conversation profile could not load.';console.warn('Conversation profile unavailable',error)}
  }
  async function select(id) {
    if(!id)return;if(id===currentId && currentRoom){apply(currentRoom);return}currentId=id;profileRevision++;ownOverride={};fillProfile({});const run=++selection;cache.clear();
    let room=window.LyriaInvites?.publicSpace(id) || {};
    try{const doc=await window.LyriaDataAPI.read('channels/'+id);if(doc.exists)room={...room,...doc.data(),id}}
    catch(error){if(!window.LyriaInvites?.publicSpace(id))console.warn('Room appearance unavailable',error)}
    if(run!==selection)return;currentRoom=room;apply(room);fillOwner(room);loadOwn(id,run);
  }
  async function resolveProfile(roomId,uid,base={}) {
    if(!roomId || !uid)return base;const key=roomId+':'+uid;
    if(!cache.has(key))cache.set(key,window.LyriaDataAPI.read(`channels/${roomId}/memberProfiles/${uid}`).then(doc=>doc.exists?mergeProfile(base,doc.data()):base).catch(()=>base));
    return cache.get(key);
  }
  const currentProfile = base => mergeProfile(base,ownOverride);
  async function saveProfile() {
    const user=auth?.currentUser;if(!user || !currentId)return;
    const button=$('save-room-profile'),status=$('room-profile-status');button.disabled=true;status.textContent='Saving…';
    const value={displayName:clean($('room-profile-name').value,48),bio:clean($('room-profile-bio').value,240),photoURL:clean($('room-profile-avatar').value,4096),bannerURL:clean($('room-profile-banner').value,4096),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    for(const key of ['photoURL','bannerURL'])if(value[key] && !/^https:\/\//.test(value[key])){status.textContent='Image links must use HTTPS.';button.disabled=false;return}
    const ref=db.collection('channels').doc(currentId).collection('memberProfiles').doc(user.uid);
    try{await window.LyriaWriteLimits.run('profiles',user.uid,async(batch,legacy)=>{batch.set(ref,value,{merge:true});if(legacy)await batch.commit()});profileRevision++;ownOverride=value;cache.delete(currentId+':'+user.uid);status.textContent='Saved for this conversation.';window.LyriaUI.notify('Conversation profile saved.','success');window.dispatchEvent(new CustomEvent('lyria:room-identity-updated',{detail:{roomId:currentId}}))}
    catch(error){status.textContent=error.code==='resource-exhausted'?error.message:'Conversation profile wasn’t saved.';window.LyriaUI.notify(status.textContent,'error')}
    finally{button.disabled=false}
  }
  async function saveRoom() {
    if(!currentRoom?.createdBy || currentRoom.createdBy!==auth?.currentUser?.uid)return;
    const button=$('save-room-appearance'),status=$('room-appearance-status');button.disabled=true;status.textContent='Saving…';
    const value={description:clean($('room-description').value,160),accent:preset($('room-accent').value,accents,accents[0]),icon:preset($('room-icon').value,icons,icons[0]),bannerStyle:preset($('room-banner-style').value,banners,banners[0]),stickerPack:preset($('room-sticker-pack').value,Object.keys(packs),'lyria'),updatedAt:firebase.firestore.FieldValue.serverTimestamp()};
    const ref=db.collection('channels').doc(currentId);
    try{await window.LyriaWriteLimits.run('channels',currentId,async(batch,legacy)=>{batch.update(ref,value);if(legacy)await batch.commit()});currentRoom={...currentRoom,...value};apply(currentRoom);status.textContent='Conversation look saved.';window.LyriaUI.notify('Conversation look saved.','success')}
    catch(error){status.textContent=error.code==='resource-exhausted'?error.message:'Conversation look wasn’t saved.';window.LyriaUI.notify(status.textContent,'error')}
    finally{button.disabled=false}
  }
  function renderStickers(packName) {
    const grid=$('sticker-grid');if(!grid)return;grid.replaceChildren();
    for(const [id,label,emoji] of packs[packName] || packs.lyria){const button=document.createElement('button');button.type='button';button.className='sticker-choice';button.innerHTML=`<span aria-hidden="true">${emoji}</span><small>${label}</small>`;button.setAttribute('aria-label','Send sticker: '+label);button.addEventListener('click',async()=>{button.disabled=true;try{await window.sendSticker?.({id,label,emoji,pack:packName});window.LyriaUI.closeModal($('sticker-modal'))}catch(error){window.LyriaUI.notify(error.code==='resource-exhausted'?error.message:'Sticker wasn’t sent. Try again.','error')}finally{button.disabled=false}});grid.append(button)}
    $('sticker-pack-name').textContent=packName==='critters'?'Critters':packName==='cosmic'?'Cosmic':'LYRIA';
  }
  async function init() {
    await window.firebaseConfig.initialize();auth=window.firebaseConfig.getAuth();db=window.firebaseConfig.getFirestore();
    $('open-room-profile')?.addEventListener('click',()=>window.LyriaUI.openModal($('room-profile-modal')));
    $('close-room-profile')?.addEventListener('click',()=>window.LyriaUI.closeModal($('room-profile-modal')));
    $('save-room-profile')?.addEventListener('click',saveProfile);
    $('save-room-appearance')?.addEventListener('click',saveRoom);
    $('composer-sticker')?.addEventListener('click',()=>window.LyriaUI.openModal($('sticker-modal')));
    $('tools-stickers')?.addEventListener('click',()=>{window.LyriaUI.closeModal($('composer-tools-modal'));window.LyriaUI.openModal($('sticker-modal'))});
    $('close-sticker-modal')?.addEventListener('click',()=>window.LyriaUI.closeModal($('sticker-modal')));
  }
  window.LyriaCommunityIdentity={select,resolveProfile,currentProfile,style,packs};
  init().catch(error=>console.warn('Community identity could not start',error));
})();
