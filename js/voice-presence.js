/* Voice presence prefers the Firebase SDK so a browser-specific REST failure cannot block calls. */
(() => {
  const API=window.LyriaDataAPI;
  const path=s=>'channels/'+s.room+'/typingStatus/'+s.userId;
  const fieldMask=keys=>({fieldPaths:keys});
  const db=()=>window.firebaseConfig.getFirestore();
  const collection=room=>db().collection('channels').doc(room).collection('typingStatus');
  const docRef=s=>collection(s.room).doc(s.userId);
  const fieldValue=()=>window.firebase?.firestore?.FieldValue;
  const code=error=>String(error?.code || '').replace(/^firestore\//,'').replace(/^auth\//,'');
  const networkError=error=>['unavailable','deadline-exceeded','aborted','internal','unknown','resource-exhausted','network-request-failed'].includes(code(error));

  async function restList(room){return API.query('typingStatus',{parent:'channels/'+room})}
  async function list(room){
    const ref=collection(room);
    try{return await ref.get({source:'server'})}
    catch(sdkError){
      if(!networkError(sdkError))throw sdkError;
      try{return await restList(room)}
      catch(restError){
        try{const cached=await ref.get({source:'cache'});if(!cached.empty)return cached}catch{}
        console.error('Voice room presence could not load through SDK or REST.',{sdk:sdkError?.code || sdkError?.message,rest:restError?.code || restError?.message});
        throw restError;
      }
    }
  }

  function watch(room,next,error,onHealthy){
    const ref=collection(room);
    // LyriaDataAPI.watch already prefers this SDK listener, then polls if it drops.
    return API.watch(ref,'typingStatus',{parent:'channels/'+room,pollIntervalMs:3000,onHealthy},next,error);
  }

  function restRegister(s){
    return API.commit([{update:{name:API.name(path(s)),fields:API.fields({voice:{sessionId:s.id,peerId:s.peerId,channel:s.channel,displayName:String(window.LyriaAccount?.getProfile?.()?.displayName || window.firebaseConfig.getAuth().currentUser?.displayName || 'Member').slice(0,60),muted:!!s.muted}})},updateMask:fieldMask(['voice']),updateTransforms:[{fieldPath:'voice.updatedAt',setToServerValue:'REQUEST_TIME'}]}]);
  }
  async function register(s){
    const values=fieldValue();
    if(!values?.serverTimestamp)return restRegister(s);
    const voice={sessionId:s.id,peerId:s.peerId,channel:s.channel,displayName:String(window.LyriaAccount?.getProfile?.()?.displayName || window.firebaseConfig.getAuth().currentUser?.displayName || 'Member').slice(0,60),muted:!!s.muted,updatedAt:values.serverTimestamp()};
    try{await docRef(s).set({voice},{merge:true});return true}
    catch(sdkError){if(!networkError(sdkError))throw sdkError;console.warn('Voice presence SDK registration failed; trying REST fallback.',sdkError?.code || sdkError?.message);await restRegister(s);return true}
  }

  async function restChange(s,patch,remove=false){
    for(let attempt=0;attempt<3;attempt++){
      const doc=await API.read(path(s));if(!doc.exists || doc.data().voice?.sessionId!==s.id)return false;
      const write={update:{name:API.name(path(s)),fields:remove?{}:API.fields({voice:patch})},updateMask:fieldMask(remove?['voice']:Object.keys(patch).map(k=>'voice.'+k)),...(remove?{}:{updateTransforms:[{fieldPath:'voice.updatedAt',setToServerValue:'REQUEST_TIME'}]}),currentDocument:doc.updateTime?{updateTime:doc.updateTime}:{exists:true}};
      try{await API.commit([write]);return true}catch(error){if(error.code!=='aborted' || attempt===2)throw error}
    }
    return false;
  }
  async function change(s,patch,remove=false){
    const values=fieldValue();
    if(!values?.serverTimestamp || !db()?.runTransaction)return restChange(s,patch,remove);
    try{
      return await db().runTransaction(async transaction=>{
        const ref=docRef(s),snapshot=await transaction.get(ref);
        if(!snapshot.exists || snapshot.data()?.voice?.sessionId!==s.id)return false;
        if(remove){
          if(!values.delete)throw new Error('Voice cleanup is unavailable.');
          transaction.update(ref,{voice:values.delete()});
        }else{
          const updates={'voice.updatedAt':values.serverTimestamp()};
          for(const [key,value] of Object.entries(patch))updates['voice.'+key]=value;
          transaction.update(ref,updates);
        }
        return true;
      });
    }catch(sdkError){
      if(!networkError(sdkError))throw sdkError;
      console.warn('Voice presence SDK update failed; trying REST fallback.',sdkError?.code || sdkError?.message);
      return restChange(s,patch,remove);
    }
  }

  window.LyriaVoicePresence={list,watch,register,heartbeat:s=>change(s,{}),mute:(s,muted)=>change(s,{muted}),clear:s=>change(s,{},true)};
})();
