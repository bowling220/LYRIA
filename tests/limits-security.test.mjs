import {before,after,beforeEach,test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {runInNewContext} from 'node:vm';import {initializeTestEnvironment,assertFails} from '@firebase/rules-unit-testing';
import {doc,collection,query,where,orderBy,limit,getDoc,getDocs,getDocFromServer,getDocsFromServer,setDoc,writeBatch,runTransaction,serverTimestamp,arrayUnion,arrayRemove,deleteField,Timestamp} from 'firebase/firestore';
let env;const apiSource=await readFile(new URL('../js/data-api.js',import.meta.url),'utf8'),limitSource=await readFile(new URL('../js/write-limits.js',import.meta.url),'utf8');
before(async()=>env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}}));after(async()=>env?.cleanup());beforeEach(async()=>{await env.clearFirestore();await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'systemConfig/freeLimits'),{enabled:true}))});
function client(uid,rest=false){const db=env.authenticatedContext(uid).firestore();const plain=v=>v?.constructor?.name==='Object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,plain(x)])):Array.isArray(v)?v.map(plain):v;
 const wrap=d=>({exists:d.exists(),id:d.id,data:()=>d.data(),metadata:d.metadata});
 class Ref{constructor(path,isDoc=false){this.path=path;this.native=isDoc?doc(db,path):collection(db,path);this.isDoc=isDoc}doc(id){return new Ref(this.path+'/'+id,true)}collection(id){return new Ref(this.path+'/'+id)}where(...a){this.native=query(this.native,where(...a));return this}orderBy(...a){this.native=query(this.native,orderBy(...a));return this}limit(n){this.native=query(this.native,limit(n));return this}async get(){return this.isDoc?wrap(await getDocFromServer(this.native)):getDocsFromServer(this.native)}}
 const writer=t=>({get:async r=>wrap(await t.get(r.native)),set:(r,v,o)=>t.set(r.native,plain(v),...(o?[o]:[])),update:(r,v)=>t.update(r.native,plain(v)),delete:r=>t.delete(r.native)});
 const sdk={doc:p=>new Ref(p,true),collection:p=>new Ref(p),batch:()=>{const b=writeBatch(db);return {...writer(b),commit:()=>b.commit()}},runTransaction:fn=>runTransaction(db,t=>fn(writer(t)))};
 const now=Math.floor(Date.now()/1000),token=Buffer.from('{\"alg\":\"none\",\"typ\":\"JWT\"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'anonymous'}})).toString('base64url')+'.';
 const window={LYRIA_RUNTIME:{emulators:{host:'127.0.0.1',firestorePort:8085}},firebaseConfig:{getAuth:()=>({currentUser:{uid,getIdToken:async()=>token}}),getFirestore:()=>sdk,getApp:()=>({options:{projectId:'demo-lyria'}})},firebase:{firestore:{FieldValue:{serverTimestamp,arrayUnion,arrayRemove,delete:deleteField}}}};
 const context={window,Date,AbortController,setTimeout,clearTimeout,console:{info(){},warn(){},error(){}},fetch:rest?fetch:async()=>({ok:false,status:503,json:async()=>({error:{message:'Use SDK in isolated emulator test'}})})};runInNewContext(limitSource,context);runInNewContext(apiSource,context);return {db,sdk,API:window.LyriaDataAPI,limits:window.LyriaWriteLimits};}
function message(A,id,text='hello'){return [{update:{name:A.name('channels/community/messages/'+id),fields:A.fields({senderId:'alice',message:text})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}]}]}
async function seed(action,value){await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'usageLimits/alice/actions/'+action),value))}
const row=(shortCount,longCount,shortAgo=0,longAgo=0)=>({operation:'old',shortAt:Timestamp.fromMillis(Date.now()-shortAgo),longAt:Timestamp.fromMillis(Date.now()-longAgo),shortCount,longCount,updatedAt:Timestamp.now()});
test('direct writes cannot bypass the active rate policy',async()=>{const {db}=client('alice');await assertFails(setDoc(doc(db,'channels/community/messages/no-quota'),{senderId:'alice',message:'bypass'}));await assertFails(setDoc(doc(db,'usageLimits/alice/actions/messages'),{...row(1,1),updatedAt:serverTimestamp()}))});
test('ten-message burst succeeds and the next message is rejected without a write',async()=>{const {API:A,db}=client('alice');for(let i=0;i<10;i++)await A.commit(message(A,'m'+i));await assert.rejects(A.commit(message(A,'over')),e=>e.code==='resource-exhausted');assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/messages'))).data().shortCount,10);assert.equal((await getDoc(doc(db,'channels/community/messages/over'))).exists(),false)});
test('concurrent sends cannot overwrite the counter to exceed the burst',async()=>{await seed('messages',row(9,9));const {API:A,db}=client('alice');const outcomes=await Promise.allSettled([A.commit(message(A,'a')),A.commit(message(A,'b'))]);assert.equal(outcomes.filter(v=>v.status==='fulfilled').length,1);assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/messages'))).data().shortCount,10)});
test('counter rollback, deletion, early reset and another account are rejected by rules',async()=>{await seed('messages',row(10,10));const {db}=client('alice'),other=client('bob');const p=doc(db,'usageLimits/alice/actions/messages');await assertFails(setDoc(p,{...row(1,1),shortAt:serverTimestamp(),longAt:serverTimestamp(),updatedAt:serverTimestamp()}));const b=writeBatch(db);b.delete(p);await assertFails(b.commit());await assertFails(getDoc(doc(other.db,'usageLimits/alice/actions/messages')))});
test('daily friend budget survives a short-window reset and renews after a day',async()=>{await seed('friends',row(10,50,61000));const {limits:L,db}=client('alice');await assert.rejects(L.run('friends','new',()=>{}),e=>e.code==='resource-exhausted');await seed('friends',row(10,50,86401000,86401000));await L.run('friends','new',()=>{});assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/friends'))).data().longCount,1)});
test('a lost acknowledgement retry does not spend another message token',async()=>{const {API:A,db}=client('alice'),write=message(A,'stable');await A.commit(write);await A.commit(write);assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/messages'))).data().shortCount,1)});
test('oversized payload is rejected atomically without spending quota',async()=>{const {API:A,db}=client('alice');await assert.rejects(A.commit(message(A,'large','x'.repeat(4001))),e=>e.code==='permission-denied');assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/messages'))).exists(),false)});

test('channel and invitation creation reserve their own budgets atomically',async()=>{
 const {limits:L,sdk,db}=client('alice');
 await L.run('channels','room',tx=>tx.set(sdk.doc('channels/room'),{name:'Room',createdBy:'alice',members:['alice']}));
 const code='A'.repeat(32);await L.run('invites',code,tx=>{tx.set(sdk.doc('channelInvites/'+code),{name:'Room',channelId:'room',createdBy:'alice',createdAt:serverTimestamp(),expiresAt:null,revoked:false});tx.update(sdk.doc('channels/room'),{activeInvite:code})});
 assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/channels'))).data().shortCount,1);assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/invites'))).data().shortCount,1);
});
test('friend and inbox creation plus profile saves work with the enforced policy',async()=>{
 const {API:A,db}=client('alice');
 await A.commit([{update:{name:A.name('users/alice'),fields:A.fields({displayName:'Alice',bio:'Hello',friends:[],badges:[]})},currentDocument:{exists:false}},{update:{name:A.name('profiles/alice'),fields:A.fields({displayName:'Alice',bio:'Hello',badges:[]})}}]);
 await A.commit([{update:{name:A.name('friendRequests/one'),fields:A.fields({from:'alice',to:'bob',status:'pending'})},currentDocument:{exists:false}}]);
 await A.commit([{update:{name:A.name('inbox/call'),fields:A.fields({senderId:'alice',recipientId:'bob',type:'callInvite'})},currentDocument:{exists:false}}]);
 assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/profiles'))).data().shortCount,1);assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/friends'))).data().shortCount,1);assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/calls'))).data().shortCount,1);
 await assertFails(getDoc(doc(db,'inbox/call')));
});

test('REST recovery commits quota and message atomically when SDK transport fails',async()=>{
 const {API:A,sdk,db}=client('alice',true);sdk.runTransaction=async()=>{throw Object.assign(new Error('SDK transport unavailable'),{code:'unavailable'})};
 await A.commit(message(A,'rest-recovery'));assert.equal((await getDoc(doc(db,'usageLimits/alice/actions/messages'))).data().shortCount,1);assert.equal((await getDoc(doc(db,'channels/community/messages/rest-recovery'))).data().message,'hello');
});

test('active policy rejects unbounded scans and permits bounded browsing',async()=>{
 const {db}=client('alice');await assertFails(getDocs(collection(db,'userArticles')));await getDocs(query(collection(db,'userArticles'),limit(100)));await assertFails(getDocs(query(collection(db,'profiles'),limit(51))));await getDocs(query(collection(db,'profiles'),limit(50)));
});
test('legacy oversized profile media survives an unrelated save and public publication',async()=>{
 const large='data:image/gif;base64,'+'a'.repeat(400001);await env.withSecurityRulesDisabled(c=>setDoc(doc(c.firestore(),'users/alice'),{displayName:'Alice',photoURL:large,badges:[]}));
 const {API:A,db}=client('alice');await A.commit([{update:{name:A.name('users/alice'),fields:A.fields({bio:'Updated bio'})},updateMask:{fieldPaths:['bio']}},{update:{name:A.name('profiles/alice'),fields:A.fields({displayName:'Alice',photoURL:large,bio:'Updated bio',badges:[]})}}]);assert.equal((await getDoc(doc(db,'profiles/alice'))).data().photoURL,large);
});
