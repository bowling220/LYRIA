/* Bearer invitations: unguessable tokens, owner controls, no channel enumeration. */
(() => {
  const parse=value=>{let code=String(value || '').trim();if(/^https?:\/\//i.test(code)){try{const u=new URL(code);if(u.origin!==location.origin || !u.pathname.endsWith('/invite.html'))return null;code=u.searchParams.get('code') || ''}catch{return null}}return /^[a-z0-9-]{4,64}$/i.test(code)?code.toUpperCase():null};
  const url=code=>{const normalized=parse(code);if(!normalized)throw new Error('Invalid invite.');const u=new URL('invite.html',location.href);u.searchParams.set('code',normalized);return u.href};
  async function bounded(operation){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Connection timed out. Please retry; a pending change may still finish.'),{code:'deadline-exceeded'})),12000)})])}finally{clearTimeout(timer)}}
  const millis=value=>value?.toMillis?.() ?? (value instanceof Date?value.getTime():Date.parse(value));
  const available=invite=>invite && invite.revoked===false && (invite.expiresAt===null || millis(invite.expiresAt)>Date.now());
  const unavailable=()=>Object.assign(new Error('This invitation has expired, was revoked, or is no longer available. Ask the owner for a new link.'),{code:'not-found'});
  async function lookup(db,value){
    const code=parse(value);if(!code)throw new Error('Enter a valid LYRIA invite link or code.');
    if(code==='EVERYONE')return {id:'community',name:'Everyone',everyone:true};
    const ref=await bounded(db.collection('channelInvites').doc(code).get({source:'server'}));
    if(!ref.exists || !available(ref.data()))throw unavailable();
    const invite=ref.data();let members=[];
    try{const channel=await bounded(db.collection('channels').doc(invite.channelId).get({source:'server'}));if(channel.exists)members=channel.data().members || []}catch(error){if(error.code!=='permission-denied')throw error}
    return {id:invite.channelId,name:typeof invite.name==='string'?invite.name:'Conversation',members,code,expiresAt:invite.expiresAt};
  }
  async function join(db,user,code){
    if(!user)throw new Error('Sign in to accept this invitation.');const channel=await lookup(db,code);
    if(!channel.everyone){const batch=db.batch(),union=firebase.firestore.FieldValue.arrayUnion;
      if(!channel.members.includes(user.uid))batch.update(db.collection('channels').doc(channel.id),{members:union(user.uid),joinInvite:channel.code});
      batch.set(db.collection('users').doc(user.uid),{channels:union(channel.id)},{merge:true});await bounded(batch.commit());
    }return channel;
  }
  async function replace(db,user,id,hours=0){
    if(!user || ![0,1,24,168].includes(Number(hours)))throw new Error('Choose a valid invitation lifetime.');
    const ref=db.collection('channels').doc(id),doc=await bounded(ref.get({source:'server'})),channel=doc.data();
    if(!doc.exists || channel.createdBy!==user.uid || !channel.members?.includes(user.uid))throw new Error('Only the conversation owner can manage invitations.');
    const bytes=crypto.getRandomValues(new Uint8Array(16)),code=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('').toUpperCase();
    const save=async(batch,legacy)=>{
    if(channel.activeInvite){const old=await bounded(db.collection('channelInvites').doc(channel.activeInvite).get({source:'server'}));if(old.exists)batch.update(db.collection('channelInvites').doc(channel.activeInvite),{revoked:true})}
    const data={channelId:id,name:channel.name || 'Conversation',createdBy:user.uid,createdAt:firebase.firestore.FieldValue.serverTimestamp(),expiresAt:Number(hours)?new Date(Date.now()+Number(hours)*3600000):null,revoked:false};
    batch.set(db.collection('channelInvites').doc(code),data);batch.update(ref,{activeInvite:code});if(legacy)await bounded(batch.commit());return {code,link:url(code),owner:true,expiresAt:data.expiresAt};};
    return window.LyriaWriteLimits?window.LyriaWriteLimits.run('invites',code,save):save(db.batch(),true);
  }
  async function current(db,user,id){
    if(id==='community')return {code:'EVERYONE',link:url('EVERYONE'),owner:false,expiresAt:null};
    const doc=await bounded(db.collection('channels').doc(id).get({source:'server'})),channel=doc.data();if(!doc.exists)throw unavailable();
    const owner=channel.createdBy===user?.uid;
    if(channel.activeInvite){const invite=await bounded(db.collection('channelInvites').doc(channel.activeInvite).get({source:'server'}));if(invite.exists && available(invite.data()))return {code:channel.activeInvite,link:url(channel.activeInvite),owner,expiresAt:invite.data().expiresAt}}
    if(owner)return replace(db,user,id);throw new Error('Ask the conversation owner to create a new invitation. Old short codes are retired.');
  }
  async function revoke(db,user,id){
    const ref=db.collection('channels').doc(id),doc=await bounded(ref.get({source:'server'})),channel=doc.data();
    if(!doc.exists || channel.createdBy!==user?.uid)throw new Error('Only the owner can revoke invitations.');
    const batch=db.batch();if(channel.activeInvite)batch.update(db.collection('channelInvites').doc(channel.activeInvite),{revoked:true});batch.update(ref,{activeInvite:null});await bounded(batch.commit());
  }
  const errorMessage=error=>error.code==='permission-denied'?'LYRIA couldn’t confirm this invitation. Sign in again or ask the owner for a new link.':error.message || 'Could not check this invitation. Please try again.';
  window.LyriaInvites={parse,url,lookup,join,current,replace,revoke,available,home:id=>'home.html?channel='+encodeURIComponent(id),bounded,errorMessage};
})();
