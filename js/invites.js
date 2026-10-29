/* Shared static-host invitation URLs and existing channel membership operations. */
(() => {
  const parse=value=>{
    let code=String(value || '').trim();
    if(/^https?:\/\//i.test(code)){
      try{const url=new URL(code);if(url.origin!==location.origin || !url.pathname.endsWith('/invite.html'))return null;code=url.searchParams.get('code') || ''}catch{return null}
    }
    return /^[a-z0-9-]{4,64}$/i.test(code)?code.toUpperCase():null;
  };
  const url=code=>{const normalized=parse(code);if(!normalized)throw new Error('Invalid invite.');const link=new URL('invite.html',location.href);link.searchParams.set('code',normalized);return link.href};
  async function bounded(operation){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('Connection timed out. Please retry; a pending join may still finish.'),{code:'deadline-exceeded'})),12000)})])}finally{clearTimeout(timer)}}
  async function lookup(db,value){
    const code=parse(value);if(!code)throw new Error('Enter a valid LYRIA invite link or code.');
    if(code==='EVERYONE')return {id:'community',name:'Everyone',everyone:true};
    const result=await bounded(db.collection('channels').where('joinCode','==',code).limit(2).get({source:'server'}));
    if(result.empty)throw Object.assign(new Error('This invitation is no longer available. Ask a member for a new link.'),{code:'not-found'});
    if(result.docs.length!==1)throw new Error('This invitation is ambiguous. Ask the conversation owner for a new code.');
    const item=result.docs[0],data=item.data();return {id:item.id,name:typeof data.name==='string'?data.name:'Conversation',members:Array.isArray(data.members)?data.members:[]};
  }
  async function join(db,user,code){
    if(!user)throw new Error('Sign in to accept this invitation.');
    const channel=await lookup(db,code);
    if(!channel.everyone){
      const batch=db.batch(),union=firebase.firestore.FieldValue.arrayUnion;
      batch.update(db.collection('channels').doc(channel.id),{members:union(user.uid)});
      batch.set(db.collection('users').doc(user.uid),{channels:union(channel.id)},{merge:true});
      await bounded(batch.commit());
    }
    return channel;
  }
  const errorMessage=error=>error.code==='permission-denied'?'LYRIA couldn’t confirm this invitation. Sign in again or ask a member for a new link.':error.code==='unavailable'?'Connection interrupted. Check your connection and try again.':error.message || 'Could not check this invitation. Please try again.';
  const home=id=>'home.html?channel='+encodeURIComponent(id);
  window.LyriaInvites={parse,url,lookup,join,home,bounded,errorMessage};
})();
