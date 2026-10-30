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
  async function request(suffix,body,retry=true){
    const user=window.firebaseConfig.getAuth().currentUser;if(!user)throw Object.assign(new Error('Sign in to continue.'),{code:'unauthenticated'});
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
    try{
      const token=await Promise.race([user.getIdToken(!retry),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Object.assign(new Error('Connection timed out.'),{code:'deadline-exceeded'})),{once:true}))]);
      const response=await fetch((window.LYRIA_RUNTIME?.emulators?'http://'+window.LYRIA_RUNTIME.emulators.host+':'+window.LYRIA_RUNTIME.emulators.firestorePort:'https://firestore.googleapis.com')+'/v1/'+root()+suffix,{method:body?'POST':'GET',cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
      if(response.status===401 && retry){clearTimeout(timer);return request(suffix,body,false)}
      const value=await response.json();if(!response.ok)throw Object.assign(new Error(value.error?.message || 'Request failed.'),{code:['ABORTED','FAILED_PRECONDITION'].includes(value.error?.status)?'aborted':({401:'unauthenticated',403:'permission-denied',404:'not-found'})[response.status] || 'unavailable'});
      if(window.firebaseConfig.getAuth().currentUser?.uid!==user.uid)throw Object.assign(new Error('Account changed. Retry after signing in.'),{code:'unauthenticated'});
      return value;
    }catch(error){
      if(error.name==='AbortError')throw Object.assign(new Error('Connection timed out.'),{code:'deadline-exceeded'});
      if(errorCode(error)==='unavailable' && error?.code!=='unavailable')throw Object.assign(new Error(error.message || 'Connection unavailable.'),{code:'unavailable'});
      throw error;
    }
    finally{clearTimeout(timer)}
  }
  async function channelSdkFallback(collectionId,options,restError){
    const filter=options.where?.fieldFilter;
    const canFallback=collectionId==='channels' && !options.parent
      && filter?.field?.fieldPath==='members' && filter.op==='ARRAY_CONTAINS'
      && typeof filter.value?.stringValue==='string' && !options.orderBy;
    if(!canFallback)throw restError;
    const db=window.firebaseConfig.getFirestore?.();
    if(!db)throw restError;
    console.warn('Firestore REST conversation query failed; trying Firebase SDK fallback.',errorDetail(restError));
    let ref=db.collection('channels').where('members','array-contains',filter.value.stringValue);
    if(options.limit)ref=ref.limit(options.limit);
    try{
      const result=await ref.get();
      const docs=[...result.docs];if(options.reverse)docs.reverse();
      console.info('Conversation list recovered with Firebase SDK fallback.');
      return {docs,empty:!docs.length,metadata:result.metadata || {fromCache:false},forEach:fn=>docs.forEach(fn)};
    }catch(sdkError){
      if(networkError(sdkError)){
        try{
          const cached=await ref.get({source:'cache'});
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
    const options={parent,where,orderBy,limit,reverse};
    try{
      const result=await request((parent?'/'+parent:'')+':runQuery',{structuredQuery:{from:[{collectionId}],...(where?{where}:{}),...(orderBy?{orderBy}:{}),...(limit?{limit}:{} )}});
      const docs=result.filter(row=>row.document).map(row=>snapshot(row.document));if(reverse)docs.reverse();
      return {docs,empty:!docs.length,readTime:result.find(row=>row.readTime)?.readTime,metadata:{fromCache:false},forEach:fn=>docs.forEach(fn)};
    }catch(error){return channelSdkFallback(collectionId,options,error)}
  }
  async function count(collectionId,{parent='',where}={}){
    const result=await request((parent?'/'+parent:'')+':runAggregationQuery',{structuredAggregationQuery:{structuredQuery:{from:[{collectionId}],...(where?{where}:{})},aggregations:[{alias:'total',count:{}}]}});
    return Number(result.find(row=>row.result)?.result.aggregateFields.total.integerValue || 0);
  }
  async function sdkReadFallback(path,restError){
    const db=window.firebaseConfig.getFirestore?.();
    if(!db?.doc)throw restError;
    const ref=db.doc(path);
    console.warn('Firestore REST document read failed; trying Firebase SDK fallback.',{path,rest:errorDetail(restError)});
    try{
      const doc=await ref.get({source:'server'});
      console.info('Firestore document read recovered with Firebase SDK fallback.',path);
      return doc.exists?doc:{id:path.split('/').at(-1),exists:false,data:()=>null,metadata:doc.metadata || {fromCache:false}};
    }catch(sdkError){
      if(networkError(sdkError)){
        try{
          const cached=await ref.get({source:'cache'});
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
    try{return snapshot(await request('/'+path.split('/').map(encodeURIComponent).join('/')))}
    catch(error){if(errorCode(error)==='not-found')return {id:path.split('/').at(-1),exists:false,data:()=>null};return sdkReadFallback(path,error)}
  }
  const equal=(field,value,op='EQUAL')=>({fieldFilter:{field:{fieldPath:field},op,value:encode(value)}});
  const canonical=v=>v?.toMillis? v.toMillis():Array.isArray(v)?v.map(canonical):v && typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  function watch(ref,collectionId,options,next,error){
    const pollMs=options.pollIntervalMs || 15000;
    let stopped=false,serverLive=false,inFlight=false,interval,off,last='',generation=0,refreshQueued=false;
    const deliver=value=>{
      if(stopped)return;options.onHealthy?.();const signature=JSON.stringify(value.docs.map(d=>[d.id,canonical(d.data())]));
      if(signature!==last){last=signature;next(value)}
    };
    async function poll(force=false){
      if(inFlight){if(force)refreshQueued=true;return}
      if(stopped || (!force && serverLive) || document.hidden || !navigator.onLine)return;
      inFlight=true;const version=generation;
      try{const value=await query(collectionId,options);if(!stopped && (force || !serverLive) && version===generation)deliver(value)}
      catch(e){if(!stopped && !serverLive)error(e)}finally{inFlight=false;if(refreshQueued){refreshQueued=false;poll(true)}}
    }
    try{off=ref.onSnapshot(value=>{if(stopped || value.metadata?.fromCache)return;serverLive=true;generation++;clearInterval(interval);deliver(value)},()=>{if(stopped)return;serverLive=false;clearInterval(interval);interval=setInterval(poll,pollMs);poll()})}catch{}
    // HTTPS does not wait for an SDK stream to open. Poll only while that stream is unavailable.
    interval=setInterval(poll,pollMs);poll();
    const resume=()=>poll();window.addEventListener('online',resume);document.addEventListener('visibilitychange',resume);
    const stop=()=>{stopped=true;generation++;off?.();clearInterval(interval);window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume)};
    stop.refresh=()=>poll(true);return stop;
  }
  window.LyriaDataAPI={query,count,read,watch,equal,name,fields,commit:writes=>request(':commit',{writes})};
})();
