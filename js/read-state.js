/* Private, monotonic read markers; bounded count refreshes, no message-history downloads. */
(() => {
 const API=window.LyriaDataAPI;let user,rooms=[],active,latest=0,generation=0,refreshing=false,earlier=false,navigation={},off,interval,saveTimer;
 let remoteReady=false,lastRefresh=0;let markers={},counts=new Map(),pending=new Map();let initializedAt=Date.now();
 const key=()=> 'lyria:read-state:'+user.uid;
 const cache=()=>{try{localStorage.setItem(key(),JSON.stringify(markers))}catch{}};
 const lastRead=id=>Number(markers[id] || initializedAt);
 function paint(){
  for(const button of document.querySelectorAll('[data-channel-id]')){
   const id=button.dataset.channelId,count=counts.get(id);let badge=button.querySelector('.channel-unread');
   if(!count || (!count.unread && !count.mentions)){badge?.remove();continue}
   if(!badge){badge=document.createElement('span');badge.className='channel-unread';button.append(badge)}
   badge.textContent=(count.mentions?'@ ':'')+Math.min(count.unread,999)+(count.unread>999?'+':'');badge.setAttribute('aria-label',count.unread+' unread messages'+(count.mentions?', '+count.mentions+' mentions':''));
  }
 }
 const status=text=>{const element=document.getElementById('read-state-status');if(element)element.textContent=text};
 const after=at=>({fieldFilter:{field:{fieldPath:'timestamp'},op:'GREATER_THAN',value:{timestampValue:new Date(at).toISOString()}}});
 async function refresh(force=false){
  if(!user || !rooms.length || !remoteReady || refreshing || document.hidden || !navigator.onLine)return;if(Date.now()-lastRefresh<(force?10000:60000))return;lastRefresh=Date.now();refreshing=true;let failed=0;const run=generation;
  try{const work=rooms.slice();await Promise.all(Array.from({length:Math.min(4,work.length)},async()=>{
   while(work.length){const room=work.shift(),at=lastRead(room.id);try{
    const filter=after(at),parent='channels/'+room.id;
    const results=await Promise.allSettled([API.count('messages',{parent,where:filter}),API.count('messages',{parent,where:{compositeFilter:{op:'AND',filters:[filter,API.equal('mentions',user.uid,'ARRAY_CONTAINS')]}}})]);
    const rejected=results.find(r=>r.status==='rejected');if(rejected)throw rejected.reason;const [unread,mentions]=results.map(r=>r.value);
    if(run!==generation)return;if(lastRead(room.id)!==at)continue;const old=counts.get(room.id);counts.set(room.id,{unread,mentions});
    if(old && mentions>old.mentions && room.id!==active && window.LyriaAccount?.getProfile()?.notificationsEnabled)window.LyriaUI.notify('You were mentioned in '+room.name+'.');
   }catch(error){failed++;if(error.code==='permission-denied')counts.delete(room.id);/* Failed counts never become false zeroes. */}
   }
  }));if(run===generation){paint();status(failed?'Unread counts couldn’t refresh. Try reconnecting.':'')}}finally{refreshing=false}
 }
 async function flush(){
  if(!user)return;const uid=user.uid,run=generation;
  for(const [id,at]of [...pending]){
   try{for(let attempt=0;attempt<3;attempt++){
    const path='users/'+uid+'/readState/'+id,doc=await API.read(path);if(run!==generation)return;
    const value=Math.max(at,Number(doc.data()?.at || 0));
    try{await API.commit([{update:{name:API.name(path),fields:API.fields({at:value})},currentDocument:doc.exists?(doc.updateTime?{updateTime:doc.updateTime}:{exists:true}):{exists:false}}]);if(pending.get(id)===at)pending.delete(id);break}catch(error){if(error.code!=='aborted' || attempt===2)throw error}
   }}catch{ /* Keep the local marker and retry on reconnect; never discard a pending read. */ }
  }
 }
 function mark(id,at,all=false){at=Math.ceil(at);if(!user || !Number.isFinite(at) || at<=lastRead(id))return;markers[id]=at;cache();pending.set(id,at);if(!earlier || all)counts.set(id,{unread:0,mentions:0});if(id===active && at>=latest){document.getElementById('first-unread-marker')?.remove();document.getElementById('unread-actions').hidden=!earlier || all}paint();clearTimeout(saveTimer);saveTimer=setTimeout(flush,750)}
 function visible(){const box=document.getElementById('messages');if(active && latest && !document.hidden && box && box.scrollHeight-box.scrollTop-box.clientHeight<48)mark(active,latest)}
 async function init(value){
  if(user?.uid===value.uid && remoteReady)return;user=value;const run=++generation;off?.();clearInterval(interval);clearTimeout(saveTimer);markers={};remoteReady=false;lastRefresh=0;counts=new Map();pending=new Map();
  try{const saved=JSON.parse(localStorage.getItem(key()));if(saved && typeof saved==='object' && !Array.isArray(saved))for(const [id,at]of Object.entries(saved).slice(-300))if(Number.isFinite(at) && at>=0 && at<=Math.max(initializedAt,Date.now())+60000)markers[id]=at}catch{}
  for(const [id,at]of Object.entries(markers))pending.set(id,at);
  const merge=snapshot=>{for(const doc of snapshot.docs){const at=Number(doc.data().at);if(Number.isFinite(at) && at>=0 && at<=Math.max(initializedAt,Date.now())+60000){markers[doc.id]=Math.max(markers[doc.id] || 0,at);if((pending.get(doc.id) || 0)<=at)pending.delete(doc.id)}}cache()};
  try{const snapshot=await API.query('readState',{parent:'users/'+user.uid,limit:300});if(run!==generation)return;initializedAt=Date.parse(snapshot.readTime) || initializedAt;merge(snapshot);remoteReady=true;seed();
    off=API.watch(window.firebaseConfig.getFirestore().collection('users').doc(user.uid).collection('readState'),'readState',{parent:'users/'+user.uid,limit:300},snapshot=>{merge(snapshot);refresh()},()=>{});
  }catch{if(run!==generation)return;remoteReady=false;status('Unread history couldn’t sync. Try reconnecting.')}
  interval=setInterval(()=>{flush();refresh()},60000);refresh();
 }
 function seed(){if(!remoteReady)return;for(const room of rooms)if(!markers[room.id]){markers[room.id]=initializedAt;pending.set(room.id,initializedAt)}cache();clearTimeout(saveTimer);saveTimer=setTimeout(flush,750)}
 function setRooms(value){const next=[{id:'community',name:'Everyone'},...value.filter(r=>r.id!=='community')].slice(0,50),changed=next.map(r=>r.id).join('|')!==rooms.map(r=>r.id).join('|');rooms=next;seed();paint();refresh(changed)}
 function setActive(id){active=id;latest=0}
 function rendered(id,docs,history=false){if(id!==active)return;earlier=history;latest=docs.reduce((max,doc)=>Math.max(max,doc.data().timestamp?.toMillis?.() || doc.data().timestamp?.toDate?.().getTime() || 0),0);visible()}
 async function markCurrent(){
  if(!active || !user)return;const room=active,button=document.getElementById('mark-room-read');button.disabled=true;
  try{const result=await API.query('messages',{parent:'channels/'+room,orderBy:[{field:{fieldPath:'timestamp'},direction:'DESCENDING'}],limit:1});if(room!==active)return;const value=result.docs[0]?.data().timestamp;mark(room,value?.toMillis?.() || value?.toDate?.().getTime() || latest,true);navigation.latest?.()}
  catch{window.LyriaUI.notify('Read status could not be confirmed. Try again.','error')}finally{button.disabled=false}
 }

 window.addEventListener('online',()=>{if(user && !remoteReady)init(user);flush();refresh()});document.addEventListener('visibilitychange',()=>{visible();refresh()});document.getElementById('messages')?.addEventListener('scroll',visible);
 document.getElementById('jump-first-unread')?.addEventListener('click',()=>navigation.first?.());document.getElementById('mark-room-read')?.addEventListener('click',markCurrent);
 document.getElementById('back-to-latest')?.addEventListener('click',()=>navigation.latest?.());
 window.LyriaReadState={setNavigation:handlers=>navigation=handlers,init,setRooms,setActive,lastRead,rendered,mark,paint,refresh};
})();
