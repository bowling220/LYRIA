// In-memory Firebase substitute for browser checks. No requests or production writes.
(() => {
 const stamp={toDate:()=>new Date('2026-10-29T10:30:00Z')};
 const user={uid:'test-member',displayName:'Alex Morgan',photoURL:'assets/avatar.svg',email:'alex@example.test',isAnonymous:false,getIdToken:async()=>{if(window.__stallAuthToken)return new Promise(()=>{});return 'fixture-token'},updateProfile:async data=>{if(window.__failAuthProfile)throw new Error('Simulated Auth profile failure');Object.assign(user,data)}};
 const data=new Map([
  ['users/test-member',{displayName:'Alex Morgan',photoURL:'assets/avatar.svg',channels:['personal-test-member','studio'],friends:['maya'],badges:[],bio:'Making room for good conversations.',status:'available'}],
  ['users/maya',{displayName:'Maya Chen',photoURL:'assets/avatar.svg',badges:[],bio:'Design, music, and the occasional very good idea.',friends:[],status:'available'}],
  ['channels/personal-test-member',{name:'My personal channel',id:'personal-test-member',members:['test-member'],joinCode:'ALEX01'}],
  ['channels/studio',{name:'The creative studio',id:'studio',members:['test-member','maya'],joinCode:'STUDIO',activeCallMembers:[]}],
  ['channels/personal-test-member/messages/one',{sender:'Maya Chen',senderId:'maya',message:'Hey Alex! Welcome to your little corner of LYRIA.',timestamp:stamp}],
  ['channels/personal-test-member/messages/two',{sender:'Alex Morgan',senderId:'test-member',message:'Already feels like home. What’s everyone working on?',timestamp:stamp}],
  ['channels/personal-test-member/messages/three',{sender:'Maya Chen',senderId:'maya',message:'A new playlist and a few ideas for the weekend. Come say hello in the studio!',timestamp:stamp}],
  ['friendRequests/invite',{from:'maya',to:'test-member',fromName:'Maya Chen',status:'pending'}],
 ]);
 const persisted=sessionStorage.getItem('lyria-test-profile');if(persisted)data.set('users/test-member',JSON.parse(persisted));
 const shared=[...data].filter(([path])=>path.includes('/personal-test-member/messages/'));shared.forEach(([path,value])=>data.set(path.replace('/personal-test-member/','/community/'),value));
 const watchers=new Set();let index=0;
 const docSnapshot=path=>({id:path.split('/').at(-1),exists:data.has(path),metadata:{hasPendingWrites:false,fromCache:false},data:()=>data.get(path)});
 const querySnapshot=ref=>{const docs=[...data.keys()].filter(p=>p.startsWith(ref.path+'/') && p.split('/').length===ref.path.split('/').length+1).filter(p=>ref.filters.every(([field,op,val])=>{const v=data.get(p)[field];return op==='array-contains'?v?.includes(val):op==='in'?val.includes(v):v===val})).map(docSnapshot);return{docs,empty:!docs.length,size:docs.length,forEach:fn=>docs.forEach(fn)}};
 const emit=()=>watchers.forEach(w=>w.fn(w.ref.document?docSnapshot(w.ref.path):querySnapshot(w.ref)));
 const stable=value=>JSON.stringify(value,(_,item)=>item && typeof item==='object' && !Array.isArray(item)?Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))):item);
 const mutate=(path,values)=>{const target={...(data.get(path)||{})};for(const [field,val]of Object.entries(values)){const parts=field.split('.'),key=parts.pop();let node=target;for(const part of parts){node[part]={...(node[part]||{})};node=node[part]}if(val?.op==='union')node[key]=[...(node[key]||[]),...val.values.filter(value=>!(node[key]||[]).some(existing=>stable(existing)===stable(value)))];else if(val?.op==='remove')node[key]=(node[key]||[]).filter(x=>!val.values.includes(x));else if(val?.op==='increment')node[key]=(node[key]||0)+val.value;else node[key]=val}data.set(path,target);emit()};
 class Ref{
  constructor(path,document=false,filters=[]){this.path=path;this.document=document;this.filters=filters;this.id=path.split('/').at(-1)}
  collection(name){return new Ref(this.path+'/'+name)}
  doc(id){return new Ref(this.path+'/'+(id||'new-'+(++index)),true)}
  where(...filter){return new Ref(this.path,false,[...this.filters,filter])}
  orderBy(){return this}
  limit(){return this}
  limitToLast(){return this}
  async get(){if(window.__stallChannelMetadata && this.document && this.path.startsWith('channels/') && this.path.split('/').length===2 && !this.path.includes('/personal-'))return new Promise(()=>{});if(window.__stallProfileRead && this.path.startsWith('users/'))return new Promise(()=>{});if(window.__stallChannels && this.path==='channels' && !this.document)return new Promise(()=>{});return this.document?docSnapshot(this.path):querySnapshot(this)}
  async set(value){
   if(window.__failNextProfileSave && this.path==='users/test-member'){window.__failNextProfileSave=false;throw Object.assign(new Error('Simulated permission denied'),{code:'permission-denied'})}
   if(window.__delayProfileSave && this.path==='users/test-member')await new Promise(resolve=>{window.__finishProfileSave=resolve});
   mutate(this.path,value);
   if(this.path==='users/test-member')sessionStorage.setItem('lyria-test-profile',JSON.stringify(data.get(this.path)));
  }
  async update(value){mutate(this.path,value)}
  async delete(){data.delete(this.path);emit()}
  async add(value){if(window.__failNextMessage && this.path.endsWith('/messages')){window.__failNextMessage=false;throw new Error('Simulated send failure')}const ref=this.doc();await ref.set(value);return ref}
  onSnapshot(fn,onError){if(window.__stallRequests && this.path==='friendRequests')return()=>{};if(window.__stallMessages && this.path.endsWith('/messages'))return()=>{};if(window.__failMessages && this.path.endsWith('/messages')){queueMicrotask(()=>onError?.({code:'unavailable'}));return()=>{}}if(window.__denyCommunity && this.path==='channels/community/messages'){queueMicrotask(()=>onError?.({code:'permission-denied'}));return()=>{}}const w={ref:this,fn};watchers.add(w);queueMicrotask(()=>fn(this.document?docSnapshot(this.path):querySnapshot(this)));return()=>watchers.delete(w)}
 }
 const db={settings:options=>{window.__firestoreTransport=options},disableNetwork:async()=>{window.__networkRestarts=(window.__networkRestarts||0)+1},enableNetwork:async()=>{},collection:name=>new Ref(name),enablePersistence:async()=>{},batch:()=>{const ops=[];return{set:(ref,val)=>ops.push(()=>ref.set(val)),update:(ref,val)=>ops.push(()=>ref.update(val)),commit:async()=>Promise.all(ops.map(fn=>fn()))}}};
 const auth={setPersistence:async value=>{window.__authPersistence=value},currentUser:user,onAuthStateChanged:fn=>{queueMicrotask(()=>fn(user));return()=>{}},signOut:async()=>{},signInWithPopup:async()=>({user}),signInAnonymously:async()=>({user})};
 const firestore=()=>db;firestore.FieldValue={arrayUnion:(...values)=>({op:'union',values}),arrayRemove:(...values)=>({op:'remove',values}),serverTimestamp:()=>stamp,delete:()=>null};
 const authFn=()=>auth;authFn.GoogleAuthProvider=class{};
 window.firebase={apps:[],initializeApp:options=>{const app={options};window.firebase.apps.push(app);return app},app:()=>window.firebase.apps[0],auth:authFn,firestore};
 const toModuleSnapshot=s=>({...s,exists:()=>s.exists});
 window.__firebaseModule={initializeApp:()=>({}),getFirestore:()=>db,initializeFirestore:(app,settings)=>{db.settings(settings);return db},getAuth:()=>auth,onAuthStateChanged:(a,fn)=>a.onAuthStateChanged(fn),doc:(db,...path)=>new Ref(path.join('/'),true),collection:(db,...path)=>new Ref(path.join('/')),query:ref=>ref,orderBy:()=>{},increment:value=>({op:'increment',value}),getDoc:async ref=>toModuleSnapshot(await ref.get()),setDoc:(ref,val)=>ref.set(val),addDoc:(ref,val)=>ref.add(val),getDocs:ref=>ref.get(),onSnapshot:(ref,fn)=>ref.onSnapshot(s=>fn(ref.document?toModuleSnapshot(s):s))};

 // Exercise the real profile HTTPS adapter without touching a production account.
 const originalFetch=window.fetch.bind(window);
 const encode=value=>value?.toDate?{timestampValue:value.toDate().toISOString()}:typeof value==='string'?{stringValue:value}:typeof value==='boolean'?{booleanValue:value}:typeof value==='number'?{integerValue:String(value)}:value===null?{nullValue:null}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:{mapValue:{fields:encodeFields(value)}};
 const encodeFields=data=>Object.fromEntries(Object.entries(data).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,encode(v)]));
 const decode=value=>'timestampValue'in value?{toDate:()=>new Date(value.timestampValue),toMillis:()=>Date.parse(value.timestampValue)}:'stringValue'in value?value.stringValue:'booleanValue'in value?value.booleanValue:'integerValue'in value?Number(value.integerValue):'doubleValue'in value?value.doubleValue:'nullValue'in value?null:'arrayValue'in value?(value.arrayValue.values||[]).map(decode):Object.fromEntries(Object.entries(value.mapValue.fields).map(([k,v])=>[k,decode(v)]));
 window.fetch=async(input,options={})=>{
   if(!String(input).startsWith('https://firestore.googleapis.com/v1/projects/'))return originalFetch(input,options);
   if(window.__offlineAccount)throw new TypeError('Simulated offline request');
   if(window.__stallAccount)await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
   const url=new URL(input),method=options.method||'GET';
   const documentPath=decodeURIComponent(url.pathname.split('/documents/')[1] || '');
   const block=()=>new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
   const json=(value,status=200)=>new Response(JSON.stringify(value),{status});
   if(url.pathname.endsWith(':runQuery')){
     if(window.__stallRestQueries)return block();
     if(window.__failRestQueries)return json({error:{message:'Simulated query failure'}},503);
     const query=JSON.parse(options.body).structuredQuery;
     const parent=decodeURIComponent(url.pathname.split('/documents')[1].replace(':runQuery','').replace(/^\//,''));
     const collection=[parent,query.from[0].collectionId].filter(Boolean).join('/');
     if(window.__denyCommunity && collection==='channels/community/messages')return json({error:{message:'Simulated permission denied'}},403);
     const matches=(entry,where)=>!where?true:where.compositeFilter?where.compositeFilter.filters.every(w=>matches(entry,w)):(()=>{const f=where.fieldFilter,v=entry[f.field.fieldPath],wanted=decode(f.value);return f.op==='IN'?wanted.includes(v):f.op==='ARRAY_CONTAINS'?v?.includes(wanted):v===wanted})();
     let docs=[...data].filter(([path,value])=>path.startsWith(collection+'/') && path.split('/').length===collection.split('/').length+1 && matches(value,query.where));
     if(query.orderBy){const order=query.orderBy[0],field=order.field.fieldPath;docs=docs.filter(([,v])=>v[field]!==undefined).sort((a,b)=>{const val=v=>v[field]?.toDate?.().getTime() || v[field];return (val(a[1])>val(b[1])?1:val(a[1])<val(b[1])?-1:0)*(order.direction==='DESCENDING'?-1:1)})}
     if(query.limit)docs=docs.slice(0,query.limit);
     return json(docs.map(([path,value])=>({document:{name:'projects/fixture/databases/(default)/documents/'+path,fields:encodeFields(value)}})));
   }
   if(url.pathname.endsWith(':commit')){
     if(window.__failCommit)return json({error:{message:'Simulated commit failure'}},503);
     if(window.__stallCommit)return block();
     const writes=JSON.parse(options.body).writes;
     if(window.__failNextMessage && writes.some(w=>w.update?.name.includes('/messages/'))){window.__failNextMessage=false;return json({error:{message:'Simulated send failure'}},503)}
     for(const write of writes){
       const name=write.delete || write.update?.name || write.transform?.document,path=decodeURIComponent(name.split('/documents/')[1]);
       if(write.currentDocument?.exists===true && !data.has(path))return json({error:{message:'Missing document'}},404);
       if(write.delete){data.delete(path);continue}
       const values=write.update?Object.fromEntries(Object.entries(write.update.fields||{}).map(([k,v])=>[k,decode(v)])):{};
       for(const t of write.updateTransforms || write.transform?.fieldTransforms || [])values[t.fieldPath]=t.setToServerValue?{toDate:()=>new Date(),toMillis:()=>Date.now()}:t.appendMissingElements?{op:'union',values:t.appendMissingElements.values.map(decode)}:{op:'remove',values:t.removeAllFromArray.values.map(decode)};
       mutate(path,values);
       if(path==='users/test-member')sessionStorage.setItem('lyria-test-profile',JSON.stringify(data.get(path)));
     }
     if(window.__loseFeedbackAck && writes.some(w=>w.transform?.fieldTransforms?.some(t=>t.fieldPath==='feedbackSubmissions'))){window.__loseFeedbackAck=false;return json({error:{message:'Simulated lost feedback acknowledgement'}},503)}
     return json({writeResults:writes.map(()=>({updateTime:'2026-10-29T10:30:00Z'}))});
   }
   if(method==='GET' && window.__stallProfileUid && documentPath==='users/'+window.__stallProfileUid)return block();
   if(method==='GET' && documentPath && !documentPath.startsWith('users/'))return data.has(documentPath)?json({name:documentPath,fields:encodeFields(data.get(documentPath))}):json({error:{message:'Not found'}},404);
   const uid=method==='POST'?url.searchParams.get('documentId'):decodeURIComponent(url.pathname.split('/').at(-1));
   const path='users/'+uid;
   if(method==='GET'&&!data.has(path))return new Response(JSON.stringify({error:{message:'Not found'}}),{status:404});
   if(method==='POST'&&data.has(path))return new Response(JSON.stringify({error:{message:'Already exists'}}),{status:409});
   if(method==='PATCH'||method==='POST'){
     const values=Object.fromEntries(Object.entries(JSON.parse(options.body).fields).map(([k,v])=>[k,decode(v)]));
     try{await new Ref(path,true).set(values)}catch(error){return new Response(JSON.stringify({error:{message:error.message}}),{status:error.code==='permission-denied'?403:503})}
   }
   return new Response(JSON.stringify({name:path,fields:encodeFields(data.get(path)||{}),updateTime:'2026-10-29T10:30:00Z'}),{status:200});
 };
 window.__testData=data;window.__emitFixture=emit;
})();
