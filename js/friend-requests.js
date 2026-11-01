/* One friend-request path shared by the inbox, badges, and profile actions. */
(() => {
  const API=window.LyriaDataAPI;
  const current=()=>window.firebaseConfig.getAuth().currentUser;
  const db=()=>window.firebaseConfig.getFirestore();
  function watch(inbox,next,error){
    const uid=current().uid,values=inbox?[uid,'accepted_'+uid]:null;
    const ref=inbox?db().collection('friendRequests').where('to','in',values):db().collection('friendRequests').where('to','==',uid);
    return API.watch(ref,'friendRequests',{where:API.equal('to',values || uid,inbox?'IN':'EQUAL'),onHealthy:()=>window.LyriaConnection?.ready('requests')},next,error);
  }
  const transform=(uid,other,remove=false)=>({transform:{document:API.name('users/'+uid),fieldTransforms:[{fieldPath:'friends',[remove?'removeAllFromArray':'appendMissingElements']:{values:[{stringValue:other}]}},{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]},currentDocument:{exists:true}});
  async function respond(id,action){
    const user=current();if(!user || !['accept','decline'].includes(action))throw new Error('Sign in to respond.');
    const doc=await API.read('friendRequests/'+id),request=doc.data();
    if(!doc.exists || request.to!==user.uid || (request.status && request.status!=='pending'))throw new Error('This request has already been handled. Refresh the list.');
    const writes=[];
    if(action==='accept')writes.push(transform(user.uid,request.from),transform(request.from,user.uid),{update:{name:API.name('friendshipApprovals/'+request.from+'/recipients/'+user.uid),fields:API.fields({requestId:id})}});
    if(action==='decline')writes.push({delete:API.name('friendRequests/'+id),currentDocument:{exists:true}});
    else writes.push({update:{name:API.name('friendRequests/'+id),fields:API.fields({to:'accepted_'+request.from,status:'accepted',acceptedByName:window.LyriaAccount?.getProfile()?.displayName || user.displayName || 'A member'})},updateMask:{fieldPaths:['to','status','acceptedByName']},updateTransforms:[{fieldPath:'acceptedAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:true}});
    await API.commit(writes);
  }
  async function send(to){
    const user=current();if(!user || !to || to===user.uid)throw new Error('Choose another member.');
    const [existing,profile]=await Promise.all([API.query('friendRequests',{where:{compositeFilter:{op:'AND',filters:[API.equal('from',user.uid),API.equal('to',to)]}}}),API.read('users/'+user.uid)]);
    if(profile.data()?.friends?.includes(to))throw new Error('You are already friends with this member.');
    if(existing.docs.some(d=>!d.data().status || d.data().status==='pending'))throw new Error('You already sent this person a friend request.');
    // A fixed per-recipient slot serializes new request lifecycles. Older rules
    // deny this probe; keep the old path working until matching rules are published.
    const slot='friendRequestSlots/'+user.uid+'/recipients/'+to;
    let guarded=true;
    try{await API.read(slot)}catch(error){if(error.code==='permission-denied')guarded=false;else throw error}
    if(current()?.uid!==user.uid)throw new Error('Your account changed. Sign in again.');
    const id=crypto.randomUUID();
    try{await API.commit([...(guarded?[{update:{name:API.name(slot),fields:API.fields({requestId:id})}}]:[]),{update:{name:API.name('friendRequests/'+id),fields:API.fields({from:user.uid,to,status:'pending',fromName:window.LyriaAccount?.getProfile()?.displayName || user.displayName || 'LYRIA member'})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}])}catch(error){
      // A competing tab/device may have claimed the slot after our initial query.
      // Do not report success or mask unrelated permission/connection failures.
      if(guarded && ['permission-denied','already-exists','aborted'].includes(error.code)){
        const pending=await API.query('friendRequests',{where:{compositeFilter:{op:'AND',filters:[API.equal('from',user.uid),API.equal('to',to)]}}});
        if(pending.docs.some(d=>!d.data().status || d.data().status==='pending'))throw new Error('You already sent this person a friend request.');
      }
      throw error;
    }
  }
  window.LyriaFriendRequests={watch,respond,send};
})();
