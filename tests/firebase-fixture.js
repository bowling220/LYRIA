// In-memory Firebase substitute for browser checks. No requests or production writes.
(() => {
 const stamp={toDate:()=>new Date('2026-10-29T10:30:00Z')};
 const user={uid:'test-member',displayName:'Alex Morgan',photoURL:'assets/avatar.svg',email:'alex@example.test',isAnonymous:false,updateProfile:async data=>Object.assign(user,data)};
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
 const watchers=new Set();let index=0;
 const docSnapshot=path=>({id:path.split('/').at(-1),exists:data.has(path),data:()=>data.get(path)});
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
  async get(){return this.document?docSnapshot(this.path):querySnapshot(this)}
  async set(value){mutate(this.path,value)}
  async update(value){mutate(this.path,value)}
  async delete(){data.delete(this.path);emit()}
  async add(value){if(window.__failNextMessage && this.path.endsWith('/messages')){window.__failNextMessage=false;throw new Error('Simulated send failure')}const ref=this.doc();await ref.set(value);return ref}
  onSnapshot(fn){const w={ref:this,fn};watchers.add(w);queueMicrotask(()=>fn(this.document?docSnapshot(this.path):querySnapshot(this)));return()=>watchers.delete(w)}
 }
 const db={collection:name=>new Ref(name),enablePersistence:async()=>{},batch:()=>{const ops=[];return{set:(ref,val)=>ops.push(()=>ref.set(val)),update:(ref,val)=>ops.push(()=>ref.update(val)),commit:async()=>Promise.all(ops.map(fn=>fn()))}}};
 const auth={currentUser:user,onAuthStateChanged:fn=>{queueMicrotask(()=>fn(user));return()=>{}},signOut:async()=>{},signInWithPopup:async()=>({user}),signInAnonymously:async()=>({user})};
 const firestore=()=>db;firestore.FieldValue={arrayUnion:(...values)=>({op:'union',values}),arrayRemove:(...values)=>({op:'remove',values}),serverTimestamp:()=>stamp,delete:()=>null};
 const authFn=()=>auth;authFn.GoogleAuthProvider=class{};
 window.firebase={apps:[],initializeApp:()=>{window.firebase.apps.push({});return{}},auth:authFn,firestore};
 const toModuleSnapshot=s=>({...s,exists:()=>s.exists});
 window.__firebaseModule={initializeApp:()=>({}),getFirestore:()=>db,getAuth:()=>auth,onAuthStateChanged:(a,fn)=>a.onAuthStateChanged(fn),doc:(db,...path)=>new Ref(path.join('/'),true),collection:(db,...path)=>new Ref(path.join('/')),query:ref=>ref,orderBy:()=>{},increment:value=>({op:'increment',value}),getDoc:async ref=>toModuleSnapshot(await ref.get()),setDoc:(ref,val)=>ref.set(val),addDoc:(ref,val)=>ref.add(val),getDocs:ref=>ref.get(),onSnapshot:(ref,fn)=>ref.onSnapshot(s=>fn(ref.document?toModuleSnapshot(s):s))};
 window.__testData=data;window.__emitFixture=emit;
})();
