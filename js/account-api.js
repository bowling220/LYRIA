/* Profile requests use bounded HTTPS calls, independently of Firestore's live streams. */
(() => {
  const timeoutMs = 15000;
  const encode = value => {
    if (typeof value === 'string') return {stringValue:value};
    if (typeof value === 'boolean') return {booleanValue:value};
    if (value === null) return {nullValue:null};
    if (typeof value === 'number') return Number.isInteger(value)?{integerValue:String(value)}:{doubleValue:value};
    if (Array.isArray(value)) return {arrayValue:{values:value.map(encode)}};
    if (value && typeof value === 'object') return {mapValue:{fields:fields(value)}};
    throw new Error('Unsupported profile value');
  };
  const fields = object => Object.fromEntries(Object.entries(object).map(([key,value])=>[key,encode(value)]));
  const decode = value => {
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('nullValue' in value) return null;
    if ('integerValue' in value) return Number(value.integerValue);
    if ('doubleValue' in value) return value.doubleValue;
    if ('timestampValue' in value) return value.timestampValue;
    if ('arrayValue' in value) return (value.arrayValue.values || []).map(decode);
    if ('mapValue' in value) return fromFields(value.mapValue.fields);
    return null;
  };
  const fromFields = object => Object.fromEntries(Object.entries(object || {}).map(([key,value])=>[key,decode(value)]));
  const baseUrl = () => {
    const project=window.firebaseConfig.getApp().options.projectId;
    return (window.LYRIA_RUNTIME?.emulators?'http://'+window.LYRIA_RUNTIME.emulators.host+':'+window.LYRIA_RUNTIME.emulators.firestorePort:'https://firestore.googleapis.com')+'/v1/projects/'+encodeURIComponent(project)+'/databases/(default)/documents/users';
  };
  async function request(user, method, suffix, data, retry=true, commit=false) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      // Bound token refresh too: an interrupted sign-in connection must not leave saving stuck.
      const token=await Promise.race([
        user.getIdToken(!retry),
        new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Object.assign(new Error('Connection timed out'),{code:'deadline-exceeded'})),{once:true}))
      ]);
      const response=await fetch(commit?baseUrl().replace(/\/users$/,'')+':commit':baseUrl()+suffix,{
        method,signal:controller.signal,cache:'no-store',
        headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
        ...(data?{body:JSON.stringify(commit?data:{fields:fields(data)})}:{})
      });
      if(response.status===401 && retry){clearTimeout(timer);return request(user,method,suffix,data,false,commit)}
      const body=await response.json();
      if(!response.ok){
        const code=({401:'unauthenticated',403:'permission-denied',404:'not-found',409:'already-exists',429:'resource-exhausted'})[response.status] || 'unavailable';
        throw Object.assign(new Error(body.error?.message || 'Account request failed'),{code});
      }
      return {exists:true,data:fromFields(body.fields),version:body.updateTime};
    } catch(error) {
      if(error.name==='AbortError')throw Object.assign(new Error('Account connection timed out'),{code:'deadline-exceeded'});
      if(error instanceof TypeError)throw Object.assign(new Error('Account server could not be reached'),{code:'unavailable'});
      throw error;
    } finally {clearTimeout(timer)}
  }
  async function read(user) {
    try {return await request(user,'GET','/'+encodeURIComponent(user.uid));}
    catch(error){if(error.code==='not-found')return {exists:false,data:{}};throw error}
  }
  const publicKeys=['displayName','photoURL','avatarGif','bannerURL','bannerGif','bio','status','showBadges','badges','appearance','updatedAt'];
  async function write(user,patch,createOnly=false){
    const current=await read(user),merged={...current.data,...patch};
    const publicData={displayName:user.displayName || 'LYRIA member',photoURL:user.photoURL || 'assets/avatar.svg',...Object.fromEntries(Object.entries(merged).filter(([key])=>publicKeys.includes(key)))};
    const root='projects/'+window.firebaseConfig.getApp().options.projectId+'/databases/(default)/documents/';
    await request(user,'POST','',{writes:[
      ...(Object.keys(patch).length?[{update:{name:root+'users/'+user.uid,fields:fields(patch)},updateMask:{fieldPaths:Object.keys(patch)},...(createOnly?{currentDocument:{exists:false}}:current.version?{currentDocument:{updateTime:current.version}}:{})}]:current.version?[{verify:root+'users/'+user.uid,currentDocument:{updateTime:current.version}}]:[]),
      {update:{name:root+'profiles/'+user.uid,fields:fields(publicData)}}
    ]},true,true);
    return read(user);
  }
  const save=(user,patch)=>write(user,patch);
  const create=(user,data)=>write(user,data,true);
  async function publish(user){const own=await read(user);if(!own.exists)return own;return save(user,{})}
  window.LyriaAccountAPI={read,save,create,publish};
})();
