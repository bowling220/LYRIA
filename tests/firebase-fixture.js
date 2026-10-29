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
 const mutate=(path,values)=>{const target={...(data.get(path)||{})};for(const [key,val]of Object.entries(values)){if(val?.op==='union')target[key]=[...new Set([...(target[key]||[]),...val.values])];else if(val?.op==='remove')target[key]=(target[key]||[]).filter(x=>!val.values.includes(x));else if(val?.op==='increment')target[key]=(target[key]||0)+val.value;else target[key]=val}data.set(path,target);emit()};
 class Ref{
  constructor(path,document=false,filters=[]){this.path=path;this.document=document;this.filters=filters;this.id=path.split('/').at(-1)}
  collection(name){return new Ref(this.path+'/'+name)}
  doc(id){return new Ref(this.path+'/'+(id||'new-'+(++index)),true)}
  where(...filter){return new Ref(this.path,false,[...this.filters,filter])}
  orderBy(){return this}
  limit(){return this}
  limitToLast(){return this}
  async get(){return this.document?docSnapshot(this.path):querySnapshot(this)}
  async set(value){
   if(window.__failNextProfileSave && this.path==='users/test-member'){window.__failNextProfileSave=false;throw Object.assign(new Error('Simulated permission denied'),{code:'permission-denied'})}
   if(window.__delayProfileSave && this.path==='users/test-member')await new Promise(resolve=>{window.__finishProfileSave=resolve});
   mutate(this.path,value);
   if(this.path==='users/test-member')sessionStorage.setItem('lyria-test-profile',JSON.stringify(data.get(this.path)));
  }
  async update(value){mutate(this.path,value)}
  async delete(){data.delete(this.path);emit()}
  async add(value){if(window.__failNextMessage && this.path.endsWith('/messages')){window.__failNextMessage=false;throw new Error('Simulated send failure')}const ref=this.doc();await ref.set(value);return ref}
  onSnapshot(fn,onError){if(window.__denyCommunity && this.path==='channels/community/messages'){queueMicrotask(()=>onError?.({code:'permission-denied'}));return()=>{}}const w={ref:this,fn};watchers.add(w);queueMicrotask(()=>fn(this.document?docSnapshot(this.path):querySnapshot(this)));return()=>watchers.delete(w)}
 }
 const db={settings:options=>{window.__firestoreTransport=options},disableNetwork:async()=>{window.__networkRestarts=(window.__networkRestarts||0)+1},enableNetwork:async()=>{},collection:name=>new Ref(name),enablePersistence:async()=>{},batch:()=>{const ops=[];return{set:(ref,val)=>ops.push(()=>ref.set(val)),update:(ref,val)=>ops.push(()=>ref.update(val)),commit:async()=>Promise.all(ops.map(fn=>fn()))}}};
 const auth={currentUser:user,onAuthStateChanged:fn=>{queueMicrotask(()=>fn(user));return()=>{}},signOut:async()=>{},signInWithPopup:async()=>({user}),signInAnonymously:async()=>({user})};
 const firestore=()=>db;firestore.FieldValue={arrayUnion:(...values)=>({op:'union',values}),arrayRemove:(...values)=>({op:'remove',values}),serverTimestamp:()=>stamp,delete:()=>null};
 const authFn=()=>auth;authFn.GoogleAuthProvider=class{};
 window.firebase={apps:[],initializeApp:options=>{const app={options};window.firebase.apps.push(app);return app},app:()=>window.firebase.apps[0],auth:authFn,firestore};
 const toModuleSnapshot=s=>({...s,exists:()=>s.exists});
 window.__firebaseModule={initializeApp:()=>({}),getFirestore:()=>db,initializeFirestore:(app,settings)=>{db.settings(settings);return db},getAuth:()=>auth,onAuthStateChanged:(a,fn)=>a.onAuthStateChanged(fn),doc:(db,...path)=>new Ref(path.join('/'),true),collection:(db,...path)=>new Ref(path.join('/')),query:ref=>ref,orderBy:()=>{},increment:value=>({op:'increment',value}),getDoc:async ref=>toModuleSnapshot(await ref.get()),setDoc:(ref,val)=>ref.set(val),addDoc:(ref,val)=>ref.add(val),getDocs:ref=>ref.get(),onSnapshot:(ref,fn)=>ref.onSnapshot(s=>fn(ref.document?toModuleSnapshot(s):s))};

 // Exercise the real profile HTTPS adapter without touching a production account.
 const originalFetch=window.fetch.bind(window);
 const encode=value=>typeof value==='string'?{stringValue:value}:typeof value==='boolean'?{booleanValue:value}:value===null?{nullValue:null}:Array.isArray(value)?{arrayValue:{values:value.map(encode)}}:{mapValue:{fields:encodeFields(value)}};
 const encodeFields=data=>Object.fromEntries(Object.entries(data).map(([k,v])=>[k,encode(v)]));
 const decode=value=>'stringValue'in value?value.stringValue:'booleanValue'in value?value.booleanValue:'nullValue'in value?null:'arrayValue'in value?(value.arrayValue.values||[]).map(decode):Object.fromEntries(Object.entries(value.mapValue.fields).map(([k,v])=>[k,decode(v)]));
 window.fetch=async(input,options={})=>{
   if(!String(input).startsWith('https://firestore.googleapis.com/v1/projects/'))return originalFetch(input,options);
   if(window.__offlineAccount)throw new TypeError('Simulated offline request');
   if(window.__stallAccount)await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError')),{once:true}));
   const url=new URL(input),method=options.method||'GET';
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
