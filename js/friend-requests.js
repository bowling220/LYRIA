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
    if(action==='accept')writes.push(transform(user.uid,request.from),transform(request.from,user.uid));
    if(action==='decline')writes.push({delete:API.name('friendRequests/'+id),currentDocument:{exists:true}});
    else writes.push({update:{name:API.name('friendRequests/'+id),fields:API.fields({to:'accepted_'+request.from,status:'accepted',acceptedByName:window.LyriaAccount?.getProfile()?.displayName || user.displayName || 'A member'})},updateMask:{fieldPaths:['to','status','acceptedByName']},updateTransforms:[{fieldPath:'acceptedAt',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:true}});
    await API.commit(writes);
  }
  async function send(to){
    const user=current();if(!user || !to || to===user.uid)throw new Error('Choose another member.');
    const [existing,profile]=await Promise.all([API.query('friendRequests',{where:{compositeFilter:{op:'AND',filters:[API.equal('from',user.uid),API.equal('to',to)]}}}),API.read('users/'+user.uid)]);
    if(profile.data()?.friends?.includes(to))throw new Error('You are already friends with this member.');
    if(existing.docs.some(d=>!d.data().status || d.data().status==='pending'))throw new Error('You already sent this person a friend request.');
    const id=crypto.randomUUID();
    await API.commit([{update:{name:API.name('friendRequests/'+id),fields:API.fields({from:user.uid,to,status:'pending',fromName:window.LyriaAccount?.getProfile()?.displayName || user.displayName || 'LYRIA member'})},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}],currentDocument:{exists:false}}]);
  }
  window.LyriaFriendRequests={watch,respond,send};
})();
