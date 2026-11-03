/* Authenticated Firestore HTTPS reads: bounded, independent of live-stream startup. */
(() => {
  const encode=v=>typeof v==='string'?{stringValue:v}:typeof v==='boolean'?{booleanValue:v}:typeof v==='number'?{doubleValue:v}:v===null?{nullValue:null}:Array.isArray(v)?{arrayValue:{values:v.map(encode)}}:{mapValue:{fields:fields(v)}};
  const fields=v=>Object.fromEntries(Object.entries(v).map(([k,value])=>[k,encode(value)]));
  const decode=v=>'stringValue'in v?v.stringValue:'booleanValue'in v?v.booleanValue:'integerValue'in v?Number(v.integerValue):'doubleValue'in v?v.doubleValue:'timestampValue'in v?{toDate:()=>new Date(v.timestampValue),toMillis:()=>Date.parse(v.timestampValue),toJSON:()=>v.timestampValue}:'arrayValue'in v?(v.arrayValue.values||[]).map(decode):'mapValue'in v?fromFields(v.mapValue.fields):null;
  const fromFields=v=>Object.fromEntries(Object.entries(v||{}).map(([k,value])=>[k,decode(value)]));
  const root=()=>`projects/${window.firebaseConfig.getApp().options.projectId}/databases/(default)/documents`;
  const name=path=>root()+'/'+path.split('/').map(encodeURIComponent).join('/');
  const snapshot=document=>({id:document.name.split('/').at(-1),exists:true,updateTime:document.updateTime,data:()=>fromFields(document.fields)});
  const errorCode=error=>{
    const raw=String(error?.code || 'unknown').replace(/^firestore\//,'').replace(/^auth\//,'');
    return raw==='network-request-failed'?'unavailable':raw;
  };
  const errorDetail=error=>({code:errorCode(error),message:error?.message || String(error)});
  const networkError=error=>['unavailable','deadline-exceeded','aborted','internal','unknown','resource-exhausted'].includes(errorCode(error));
  const currentUid=()=>window.firebaseConfig.getAuth().currentUser?.uid;
  const checkAccount=uid=>{if(!uid || currentUid()!==uid)throw Object.assign(new Error('Account changed. Sign in again.'),{code:'unauthenticated'})};
  async function bounded(operation){let timer;try{return await Promise.race([operation,new Promise((_,reject)=>timer=setTimeout(()=>reject(Object.assign(new Error('Firebase connection timed out.'),{code:'deadline-exceeded'})),12000))])}finally{clearTimeout(timer)}}
  async function request(suffix,body,retry=true){
    const user=window.firebaseConfig.getAuth().currentUser;if(!user)throw Object.assign(new Error('Sign in to continue.'),{code:'unauthenticated'});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const token=await Promise.race([user.getIdToken(!retry),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Object.assign(new Error('Connection timed out.'),{code:'deadline-exceeded'})),{once:true}))]);
      const response=await fetch((window.LYRIA_RUNTIME?.emulators?'http://'+window.LYRIA_RUNTIME.emulators.host+':'+window.LYRIA_RUNTIME.emulators.firestorePort:'https://firestore.googleapis.com')+'/v1/'+root()+suffix,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
      if(response.status===401 && retry){clearTimeout(timer);return request(suffix,body,false)}
      const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error?.message || 'Request failed.'),{code:['ABORTED','FAILED_PRECONDITION'].includes(value.error?.status)?'aborted':({401:'unauthenticated',403:'permission-denied',404:'not-found',409:'already-exists',429:'resource-exhausted'})[response.status] || 'unavailable'});
      if(window.firebaseConfig.getAuth().currentUser?.uid!==user.uid)throw Object.assign(new Error('Account changed. Retry after signing in.'),{code:'unauthenticated'});
      return value;
    }catch(error){
      if(error.name==='AbortError')throw Object.assign(new Error('Connection timed out.'),{code:'deadline-exceeded'});
      if(errorCode(error)==='unavailable' && error?.code!=='unavailable')throw Object.assign(new Error(error.message || 'Connection unavailable.'),{code:'unavailable'});
      throw error;
    }
    finally{clearTimeout(timer)}
  }
  async function querySdkFallback(collectionId,options,restError){
    if(!networkError(restError))throw restError;
    const uid=options.uid;checkAccount(uid);
    const db=window.firebaseConfig.getFirestore?.();
    if(!db)throw restError;
    const isConversations=collectionId==='channels' && !options.parent;
    console.warn('Firestore REST query failed; trying Firebase SDK fallback.',errorDetail(restError));
    let ref=db.collection([options.parent,collectionId].filter(Boolean).join('/'));
    const operators={EQUAL:'==',ARRAY_CONTAINS:'array-contains',IN:'in',GREATER_THAN:'>',GREATER_THAN_OR_EQUAL:'>=',LESS_THAN:'<',LESS_THAN_OR_EQUAL:'<='};
    function filter(where){
      if(!where)return;
      if(where.compositeFilter){if(where.compositeFilter.op!=='AND')throw restError;where.compositeFilter.filters.forEach(filter);return}
      const f=where.fieldFilter,operator=operators[f?.op];if(!operator)throw restError;
      ref=ref.where(f.field.fieldPath,operator,'timestampValue' in f.value?new Date(f.value.timestampValue):decode(f.value));
    }
    filter(options.where);
    for(const order of options.orderBy || [])ref=ref.orderBy(order.field.fieldPath,order.direction==='DESCENDING'?'desc':'asc');
    if(options.limit)ref=ref.limit(options.limit);
    try{
      const result=await bounded(ref.get({source:'server'}));checkAccount(uid);
      const docs=[...result.docs];if(options.reverse)docs.reverse();
      console.info(isConversations?'Conversation list recovered with Firebase SDK fallback.':'Firestore query recovered with Firebase SDK fallback.');
      return {docs,empty:!docs.length,metadata:result.metadata || {fromCache:false},forEach:fn=>docs.forEach(fn)};
    }catch(sdkError){
      if(networkError(sdkError) && isConversations){
        try{
          const cached=await bounded(ref.get({source:'cache'}));checkAccount(uid);
          const docs=[...cached.docs];if(options.reverse)docs.reverse();
          if(docs.length){
            console.warn('Conversation list recovered from Firestore cache after network transports failed.',{rest:errorDetail(restError),sdk:errorDetail(sdkError)});
            return {docs,empty:false,metadata:{...(cached.metadata || {}),fromCache:true},forEach:fn=>docs.forEach(fn)};
          }
        }catch(cacheError){
          console.warn('Firestore conversation cache was unavailable.',errorDetail(cacheError));
        }
      }
      console.error('Conversation list failed through both Firestore REST and Firebase SDK.',{rest:errorDetail(restError),sdk:errorDetail(sdkError)});
      throw sdkError;
    }
  }
  async function query(collectionId,{parent='',where,orderBy,limit,reverse=false}={}){
    const options={parent,where,orderBy,limit,reverse,uid:currentUid()};
    try{
      const result=await request((parent?'/'+parent:'')+':runQuery',{structuredQuery:{from:[{collectionId}],...(where?{where}:{}),...(orderBy?{orderBy}:{}),...(limit?{limit}:{} )}});
      const docs=result.filter(row=>row.document).map(row=>snapshot(row.document));if(reverse)docs.reverse();
      return {docs,empty:!docs.length,readTime:result.find(row=>row.readTime)?.readTime,metadata:{fromCache:false},forEach:fn=>docs.forEach(fn)};
    }catch(error){return querySdkFallback(collectionId,options,error)}
  }
  async function count(collectionId,{parent='',where}={}){
    const result=await request((parent?'/'+parent:'')+':runAggregationQuery',{structuredAggregationQuery:{structuredQuery:{from:[{collectionId}],...(where?{where}:{}),limit:1000},aggregations:[{alias:'total',count:{}}]}});
    return Number(result.find(row=>row.result)?.result.aggregateFields.total.integerValue || 0);
  }
  async function sdkReadFallback(path,restError,uid){
    if(!networkError(restError))throw restError;checkAccount(uid);
    const db=window.firebaseConfig.getFirestore?.();
    if(!db?.doc)throw restError;
    const ref=db.doc(path);
    console.warn('Firestore REST document read failed; trying Firebase SDK fallback.',{path,rest:errorDetail(restError)});
    try{
      const doc=await bounded(ref.get({source:'server'}));checkAccount(uid);
      console.info('Firestore document read recovered with Firebase SDK fallback.',path);
      return doc.exists?doc:{id:path.split('/').at(-1),exists:false,data:()=>null,metadata:doc.metadata || {fromCache:false}};
    }catch(sdkError){
      if(networkError(sdkError)){
        try{
          const cached=await bounded(ref.get({source:'cache'}));checkAccount(uid);
          if(cached.exists){
            console.warn('Firestore document read recovered from local cache.',{path,rest:errorDetail(restError),sdk:errorDetail(sdkError)});
            return cached;
          }
        }catch(cacheError){console.warn('Firestore document cache was unavailable.',{path,cache:errorDetail(cacheError)})}
      }
      console.error('Firestore document read failed through REST and SDK.',{path,rest:errorDetail(restError),sdk:errorDetail(sdkError)});
      throw sdkError;
    }
  }
  async function read(path){
    const uid=currentUid();
    try{return snapshot(await request('/'+path.split('/').map(encodeURIComponent).join('/')))}
    catch(error){if(errorCode(error)==='not-found')return {id:path.split('/').at(-1),exists:false,data:()=>null};return sdkReadFallback(path,error,uid)}
  }
  const equal=(field,value,op='EQUAL')=>({fieldFilter:{field:{fieldPath:field},op,value:encode(value)}});
  const canonical=v=>v?.toMillis? v.toMillis():Array.isArray(v)?v.map(canonical):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  function watch(ref,collectionId,options,next,error){
    const pollMs=options.pollIntervalMs || 15000;
    let stopped=false,serverLive=false,inFlight=false,interval,off,last='',generation=0,refreshQueued=false,lastHealthy=0;
    const deliver=value=>{
      if(stopped)return;if(!value.metadata?.fromCache){lastHealthy=Date.now();options.onHealthy?.()}const signature=JSON.stringify(value.docs.map(d=>[d.id,canonical(d.data())]));
      if(signature!==last){last=signature;next(value)}
    };
    async function poll(force=false){
      if(inFlight){if(force)refreshQueued=true;return}
      if(stopped || (!force && serverLive && Date.now()-lastHealthy<60000) || document.hidden || !navigator.onLine)return;
      inFlight=true;const version=generation;
      try{const value=await query(collectionId,options);if(!stopped && version===generation)deliver(value)}
      catch(e){if(!stopped && (!serverLive || Date.now()-lastHealthy>=60000))error(e)}finally{inFlight=false;if(refreshQueued){refreshQueued=false;poll(true)}}
    }
    try{off=ref.onSnapshot(value=>{if(stopped || value.metadata?.fromCache)return;serverLive=true;generation++;deliver(value)},()=>{if(stopped)return;serverLive=false;poll()})}catch{}
    // HTTPS does not wait for an SDK stream to open. Poll only while that stream is unavailable.
    interval=setInterval(poll,pollMs);poll();
    const resume=()=>{if(!document.hidden)poll(true)};window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
    const stop=()=>{stopped=true;generation++;off?.();clearInterval(interval);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume)};
    stop.refresh=()=>poll(true);return stop;
  }
  function messageCreate(write){return write.currentDocument?.exists===false && /^channels\/[^/]+\/messages\/[^/]+$/.test(write.update?.name?.slice(root().length+1) || '')}
  async function sdkCommit(writes,restError,uid,limits=[]){
    checkAccount(uid);
    const db=window.firebaseConfig.getFirestore?.(),values=window.firebase?.firestore?.FieldValue;
    if(!db?.runTransaction || !db.doc || !values)throw restError;
    // A REST updateTime cannot be compared to the compat SDK's public snapshots.
    // Never silently weaken an explicit optimistic-concurrency precondition.
    if(writes.some(w=>w.currentDocument?.updateTime))throw restError;
    const pathOf=write=>{
      const value=write.update?.name || write.delete || write.transform?.document || write.verify;
      if(!value?.startsWith(root()+'/'))throw restError;
      return value.slice(root().length+1).split('/').map(decodeURIComponent).join('/');
    };
    const sdkValue=value=>'timestampValue' in value?new Date(value.timestampValue):'arrayValue' in value?(value.arrayValue.values || []).map(sdkValue):'mapValue' in value?Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key,item])=>[key,sdkValue(item)])):decode(value);
    const nested=(object,path,value)=>{const keys=path.split('.');if(keys.some(k=>['__proto__','prototype','constructor'].includes(k)))throw restError;const last=keys.pop();let target=object;for(const key of keys)target=target[key] ??= {};target[last]=value};
    const at=(object,path)=>path.split('.').reduce((value,key)=>value?.[key],object);
    const refs=new Map(writes.map(w=>{const path=pathOf(w);return [path,db.doc(path)]}));
    const apply=(transaction,docs)=>{
      checkAccount(uid);
      for(const write of writes){
        const path=pathOf(write),ref=refs.get(path),doc=docs.get(path),condition=write.currentDocument;
        if(condition?.exists===false && doc.exists){
          // An acknowledgement can be lost after REST accepted a create. Reconcile
          // this exact message ID and payload; never deduplicate by text alone.
          const expected=Object.fromEntries(Object.entries(write.update?.fields || {}).map(([key,value])=>[key,sdkValue(value)]));
          if(messageCreate(write) && expected.senderId===uid && Object.entries(expected).every(([key,value])=>JSON.stringify(canonical(doc.data()[key]))===JSON.stringify(canonical(value))))continue;
          throw Object.assign(new Error('This operation already exists.'),{code:'already-exists'});
        }
        if(condition?.exists===true && !doc.exists)throw Object.assign(new Error('This item no longer exists.'),{code:'not-found'});
        if(write.verify)continue;
        if(write.delete){transaction.delete(ref);continue}
        const data=Object.fromEntries(Object.entries(write.update?.fields || {}).map(([key,value])=>[key,sdkValue(value)]));
        const changes={};
        if(write.updateMask)for(const key of write.updateMask.fieldPaths){const value=at(data,key);if(value!==undefined)changes[key]=value;else if(doc.exists)changes[key]=values.delete()}
        else for(const [key,value]of Object.entries(data))changes[key]=value;
        for(const transform of write.updateTransforms || write.transform?.fieldTransforms || []){
          const key=transform.fieldPath;
          if(transform.setToServerValue==='REQUEST_TIME')changes[key]=values.serverTimestamp();
          else if(transform.appendMissingElements)changes[key]=values.arrayUnion(...transform.appendMissingElements.values.map(sdkValue));
          else if(transform.removeAllFromArray)changes[key]=values.arrayRemove(...transform.removeAllFromArray.values.map(sdkValue));
          else throw restError;
        }
        if(write.update && !write.updateMask){for(const [key,value]of Object.entries(changes))nested(data,key,value);transaction.set(ref,data)}
        else if(doc.exists)transaction.update(ref,changes);
        else{const created={};for(const [key,value]of Object.entries(changes))nested(created,key,value);transaction.set(ref,created)}
      }
      checkAccount(uid);
      return {writeResults:writes.map(()=>({})),transport:'sdk'};
    };
    // Friend acceptance deliberately uses blind transforms: private user records
    // are not readable by friends. Batch.update preserves existence checks.
    // A pending request's sender cannot update an existing request under the
    // rules, so this narrowly validated set is create-only without a denied read
    // of a nonexistent document. All other create-only writes use a transaction.
    const friendCreate=write=>write.currentDocument?.exists===false
      && /^friendRequests\/[^/]+$/.test(pathOf(write)) && !write.updateMask
      && write.update?.fields?.from?.stringValue===uid
      && typeof write.update.fields.to?.stringValue==='string'
      && write.update.fields.to.stringValue!==uid && write.update.fields.status?.stringValue==='pending';
    const blind=writes.every(w=>friendCreate(w) || (!w.currentDocument && w.update && !w.updateMask)
      || (w.currentDocument?.exists===true && !w.delete && (w.updateMask || w.transform)));
    if(blind && db.batch && !limits.length){
      const batch=db.batch(),docs=new Map(writes.map(w=>[pathOf(w),{exists:!friendCreate(w)}]));
      const result=apply(batch,docs);await bounded(batch.commit());checkAccount(uid);return result;
    }
    const result=await bounded(db.runTransaction(async transaction=>{
      const docs=new Map(await Promise.all([...refs].map(async([path,ref])=>{
        const w=writes.find(item=>pathOf(item)===path);
        const blindTarget=friendCreate(w) || (!w.currentDocument && w.update && !w.updateMask) || (w.currentDocument?.exists===true && !w.delete && (w.updateMask || w.transform));
        return [path,blindTarget?{exists:!friendCreate(w)}:await transaction.get(ref)];
      })));
      if(limits.length){
        const snapshots=await Promise.all(limits.map(g=>transaction.get(window.LyriaWriteLimits.ref(uid,g.action))));
        const already=writes.every(w=>messageCreate(w) && docs.get(pathOf(w))?.exists && Object.entries(w.update.fields).every(([key,value])=>JSON.stringify(canonical(docs.get(pathOf(w)).data()[key]))===JSON.stringify(canonical(decode(value)))));
        if(!already)window.LyriaWriteLimits.stage(transaction,uid,limits,snapshots);
      }
      return apply(transaction,docs);
    }));checkAccount(uid);return result;
  }
  async function commit(writes){
    const uid=currentUid();
    const limits=window.LyriaWriteLimits?await window.LyriaWriteLimits.plan(writes,window.LyriaDataAPI):[];
    if(limits.length){
      try{return await sdkCommit(writes,Object.assign(new Error('Rate-limited SDK transport unavailable.'),{code:'unavailable'}),uid,limits)}
      catch(error){if(error.rateLimited || (!networkError(error) && errorCode(error)!=='permission-denied'))throw error;
        // The same authenticated REST commit can recover a stale SDK auth channel.
        // Identical server rules, quota proof and write preconditions still apply.
        const quotas=await window.LyriaWriteLimits.restWrites(limits,uid,window.LyriaDataAPI);checkAccount(uid);
        try{return await request(':commit',{writes:[...quotas,...writes]})}
        catch(restError){if(errorCode(restError)!=='already-exists'){if(errorCode(error)==='permission-denied' && networkError(restError))throw error;throw restError;}/* Existing message reconciliation below uses the original writes. */}
      }
    }
    try{return await request(':commit',{writes})}
    catch(error){
      if(errorCode(error)==='already-exists' && writes.every(messageCreate)){
        const confirmed=await Promise.all(writes.map(async write=>{
          const doc=await read(write.update.name.slice(root().length+1));checkAccount(uid);
          return write.update.fields.senderId?.stringValue===uid && doc.exists && !doc.metadata?.fromCache && Object.entries(write.update.fields).every(([key,value])=>JSON.stringify(canonical(doc.data()[key]))===JSON.stringify(canonical(decode(value))));
        }));
        if(confirmed.every(Boolean))return {writeResults:writes.map(()=>({})),transport:'reconciled'};
      }
      if(!networkError(error) && !(errorCode(error)==='already-exists' && writes.every(messageCreate)))throw error;
      return sdkCommit(writes,error,uid);
    }
  }
  window.LyriaDataAPI={query,count,read,watch,equal,name,fields,commit};
})();
