/* Spark-compatible write budgets. Server rules are authoritative, not this module. */
(() => {
 const policy={messages:[10,10,60,60],friends:[10,60,50,86400],channels:[3,60,15,86400],invites:[5,60,100,86400],profiles:[15,60,500,86400],calls:[10,60,200,86400],reactions:[30,10,300,60],articles:[3,60,20,86400],comments:[10,60,100,86400]};
 let adapter;const db=()=>adapter?.db || window.firebaseConfig.getFirestore(),user=()=>adapter?adapter.auth.currentUser:window.firebaseConfig.getAuth().currentUser;
 let cached;const clock=value=>value?.toMillis?.() ?? value?.toDate?.().getTime() ?? Date.parse(value);
 async function bounded(p){let timer;try{return await Promise.race([p,new Promise((_,reject)=>timer=setTimeout(()=>reject(Object.assign(new Error('Limit status could not connect.'),{code:'unavailable'})),8000))])}finally{clearTimeout(timer)}}
 async function enabled(){
  const uid=user()?.uid;if(!uid)return false;if(cached?.uid===uid && cached.until>Date.now())return cached.value;
  try{const doc=window.LyriaDataAPI?await window.LyriaDataAPI.read('systemConfig/freeLimits'):await bounded(db().collection('systemConfig').doc('freeLimits').get({source:'server'}));const value=doc.exists && doc.data().enabled===true;cached={uid,value,until:Date.now()+60000};return value}
  catch(error){if(['permission-denied','not-found'].includes(error.code)){cached={uid,value:false,until:Date.now()+60000};return false}throw error}
 }
 const path=(uid,action)=>'usageLimits/'+uid+'/actions/'+action;
 const ref=(uid,action)=>db().collection('usageLimits').doc(uid).collection('actions').doc(action);
 function next(action,operation,old){
  const p=policy[action];if(!p)throw new Error('Unknown write budget.');const result={operation};
  for(const [prefix,cap,seconds]of [['short',p[0],p[1]],['long',p[2],p[3]]]){
   const start=old && clock(old[prefix+'At']),reset=!Number.isFinite(start) || Date.now()-start>=seconds*1000;
   const count=reset?1:Number(old[prefix+'Count'])+1;
   if(!Number.isInteger(count) || count>cap){const retryAfter=Math.max(1,Math.ceil((start+seconds*1000-Date.now())/1000));throw Object.assign(new Error('Please slow down a little. Try again in '+retryAfter+' seconds.'),{code:'resource-exhausted',retryAfter,rateLimited:true})}
   result[prefix+'Count']=count;result[prefix+'At']=reset?null:old[prefix+'At'];
  }return result;
 }
 function stage(transaction,uid,groups,snapshots){
  const stamp=adapter?.serverTimestamp || window.firebase.firestore.FieldValue.serverTimestamp;
  groups.forEach((g,i)=>{const data=next(g.action,g.operation,snapshots[i].exists?snapshots[i].data():null);transaction.set(ref(uid,g.action),{...data,shortAt:data.shortAt || stamp(),longAt:data.longAt || stamp(),updatedAt:stamp()})});
 }
 async function run(action,operation,write){
  if(!await enabled())return write(db().batch(),true);
  const uid=user()?.uid;
  return bounded(db().runTransaction(async tx=>{const doc=await tx.get(ref(uid,action));if(user()?.uid!==uid)throw new Error('Your account changed.');next(action,operation,doc.exists?doc.data():null);const pending=[],buffer={get:(...a)=>tx.get(...a),set:(...a)=>pending.push(()=>tx.set(...a)),update:(...a)=>pending.push(()=>tx.update(...a)),delete:(...a)=>pending.push(()=>tx.delete(...a))};const result=await write(buffer,false);stage(tx,uid,[{action,operation}],[doc]);pending.forEach(fn=>fn());return result}));
 }
 async function plan(writes,API){
  if(!await enabled())return [];
  const result=new Map(),prefix=API.name('');
  for(const w of writes){const name=w.update?.name || w.transform?.document || w.delete;if(!name)continue;const p=name.slice(prefix.length),f=w.update?.fields || {};let action;
   if(/^channels\/[^/]+\/messages\/[^/]+$/.test(p) && w.currentDocument?.exists===false)action='messages';
   else if(/^channels\/[^/]+\/messages\/[^/]+$/.test(p))action='reactions';
   else if(/^friendRequests\/[^/]+$/.test(p) && f.status?.stringValue==='pending')action='friends';
   else if(/^inbox\/[^/]+$/.test(p))action='calls';
   else if(/^channels\/[^/]+$/.test(p) && w.currentDocument?.exists===false)action=p.startsWith('channels/personal-')?null:f.isDirectCall?.booleanValue===true?'calls':'channels';
   else if(/^profiles\/[^/]+$/.test(p))action='profiles';
   if(action){const operation=action==='profiles'?user().uid:p.split('/').at(-1);if(result.has(action) && result.get(action).operation!==operation)throw new Error('Submit these actions separately.');result.set(action,{action,operation})}
  }return [...result.values()];
 }
 async function restWrites(groups,uid,API){
  const docs=await Promise.all(groups.map(g=>API.read(path(uid,g.action))));
  return groups.map((g,i)=>{const doc=docs[i],data=next(g.action,g.operation,doc.exists?doc.data():null),transforms=[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}],fields={operation:{stringValue:data.operation},shortCount:{integerValue:String(data.shortCount)},longCount:{integerValue:String(data.longCount)}};
   for(const key of ['shortAt','longAt'])if(data[key])fields[key]={timestampValue:new Date(clock(data[key])).toISOString()};else transforms.push({fieldPath:key,setToServerValue:'REQUEST_TIME'});
   return {update:{name:API.name(path(uid,g.action)),fields},updateTransforms:transforms,...(!doc.exists?{currentDocument:{exists:false}}:doc.updateTime?{currentDocument:{updateTime:doc.updateTime}}:{})};
  });
 }
 window.LyriaWriteLimits={configure:value=>{adapter=value;cached=null},policy,enabled,plan,ref,path,stage,restWrites,run};
})();
