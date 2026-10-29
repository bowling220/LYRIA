/* Voice presence uses server-confirmed HTTPS writes; live snapshots have an HTTPS fallback. */
(() => {
  const API=window.LyriaDataAPI;
  const path=s=>'channels/'+s.room+'/typingStatus/'+s.userId;
  const fieldMask=keys=>({fieldPaths:keys});
  const list=room=>API.query('typingStatus',{parent:'channels/'+room});
  function watch(room,next,error,onHealthy){const ref=window.firebaseConfig.getFirestore().collection('channels').doc(room).collection('typingStatus');return API.watch(ref,'typingStatus',{parent:'channels/'+room,pollIntervalMs:3000,onHealthy},next,error)}
  async function register(s){
    await API.commit([{update:{name:API.name(path(s)),fields:API.fields({voice:{sessionId:s.id,peerId:s.peerId,channel:s.channel,displayName:String(window.LyriaAccount?.getProfile?.()?.displayName || window.firebaseConfig.getAuth().currentUser?.displayName || 'Member').slice(0,60),muted:!!s.muted}})},updateMask:fieldMask(['voice']),updateTransforms:[{fieldPath:'voice.updatedAt',setToServerValue:'REQUEST_TIME'}]}]);
  }
  async function change(s,patch,remove=false){
    for(let attempt=0;attempt<3;attempt++){
      const doc=await API.read(path(s));if(!doc.exists || doc.data().voice?.sessionId!==s.id)return false;
      const write={update:{name:API.name(path(s)),fields:remove?{}:API.fields({voice:patch})},updateMask:fieldMask(remove?['voice']:Object.keys(patch).map(k=>'voice.'+k)),...(remove?{}:{updateTransforms:[{fieldPath:'voice.updatedAt',setToServerValue:'REQUEST_TIME'}]}),currentDocument:doc.updateTime?{updateTime:doc.updateTime}:{exists:true}};
      try{await API.commit([write]);return true}catch(error){if(error.code!=='aborted' || attempt===2)throw error}
    }
  }
  window.LyriaVoicePresence={list,watch,register,heartbeat:s=>change(s,{}),mute:(s,muted)=>change(s,{muted}),clear:s=>change(s,{},true)};
})();
