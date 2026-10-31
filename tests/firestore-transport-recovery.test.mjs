/* Actual rules and Firestore transactions; REST transport is deliberately unavailable. */
import {before,after,beforeEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc,collection,query,where,orderBy,limit,getDocsFromServer,getDocFromServer,getDoc,setDoc,runTransaction,writeBatch,serverTimestamp,arrayUnion,arrayRemove,deleteField} from 'firebase/firestore';
let env;
const source=await readFile(new URL('../js/data-api.js',import.meta.url),'utf8');
before(async()=>{env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}})});
after(async()=>{await env?.cleanup()});beforeEach(async()=>{await env.clearFirestore()});
function transport(uid){
 const plain=value=>value?.constructor?.name==='Object'?Object.fromEntries(Object.entries(value).map(([key,v])=>[key,plain(v)])):Array.isArray(value)?value.map(plain):value;
 const db=env.authenticatedContext(uid).firestore(),ref=path=>({path,native:doc(db,path),get:async()=>{const result=await getDocFromServer(doc(db,path));return {exists:result.exists(),id:result.id,data:()=>result.data(),metadata:result.metadata}}});
 const compat={batch:()=>{const b=writeBatch(db);return {set:(r,data)=>b.set(r.native,plain(data)),update:(r,data)=>b.update(r.native,plain(data)),delete:r=>b.delete(r.native),commit:()=>b.commit()}},doc:ref,collection:path=>{
  let q=collection(db,path);const wrapped={where:(...args)=>{q=query(q,where(...args));return wrapped},orderBy:(...args)=>{q=query(q,orderBy(...args));return wrapped},limit:n=>{q=query(q,limit(n));return wrapped},get:()=>getDocsFromServer(q)};return wrapped;
 },runTransaction:fn=>runTransaction(db,t=>fn({get:async r=>{const d=await t.get(r.native);return {exists:d.exists(),data:()=>d.data()}},set:(r,data)=>t.set(r.native,plain(data)),update:(r,data)=>t.update(r.native,plain(data)),delete:r=>t.delete(r.native)}))};
 const window={firebaseConfig:{getFirestore:()=>compat,getAuth:()=>({currentUser:{uid,getIdToken:async()=>'fixture-token'}}),getApp:()=>({options:{projectId:'demo-lyria'}})},firebase:{firestore:{FieldValue:{serverTimestamp,arrayUnion,arrayRemove,delete:deleteField}}}};
 runInNewContext(source,{window,Date,AbortController,setTimeout,clearTimeout,console:{info(){},warn(){},error(){}},fetch:async()=>({ok:false,status:503,json:async()=>({error:{message:'REST deliberately unavailable'}})})});return {API:window.LyriaDataAPI,db};
}
test('real SDK fallback writes, reads, queries and reconciles one exact message under real rules',async()=>{
 const {API:A,db}=transport('alice'),path='channels/community/messages/stable-id';
 const writes=[{update:{name:A.name(path),fields:A.fields({senderId:'alice',sender:'Alice',message:'one logical send'})},currentDocument:{exists:false},updateTransforms:[{fieldPath:'timestamp',setToServerValue:'REQUEST_TIME'}]}];
 await A.commit(writes);await A.commit(writes);
 const result=await A.query('messages',{parent:'channels/community',orderBy:[{field:{fieldPath:'timestamp'},direction:'DESCENDING'}],limit:100});assert.equal(result.docs.length,1);assert.equal(result.docs[0].data().message,'one logical send');assert.ok((await getDoc(doc(db,path))).data().timestamp.toMillis()>0);
 await assert.rejects(A.commit([{...writes[0],update:{...writes[0].update,fields:A.fields({senderId:'alice',message:'changed'})}}]),e=>e.code==='already-exists');
});
test('friend request send and atomic acceptance work when REST is unavailable',async()=>{
 await env.withSecurityRulesDisabled(async context=>{for(const uid of ['alice','bob'])await setDoc(doc(context.firestore(),'users/'+uid),{displayName:uid,friends:[],badges:[]})});
 const {API:A}=transport('alice'),{API:B,db:bob}=transport('bob');
 await A.commit([{update:{name:A.name('friendRequests/request-1'),fields:A.fields({from:'alice',to:'bob',status:'pending'})},currentDocument:{exists:false}}]);
 await assert.rejects(A.commit([{update:{name:A.name('friendRequests/request-1'),fields:A.fields({from:'alice',to:'bob',status:'pending'})},currentDocument:{exists:false}}]),e=>e.code==='permission-denied');
 const incoming=await B.query('friendRequests',{where:B.equal('to','bob')});assert.equal(incoming.docs.length,1);
 await B.commit([
  ...[['alice','bob'],['bob','alice']].map(([uid,other])=>({transform:{document:B.name('users/'+uid),fieldTransforms:[{fieldPath:'friends',appendMissingElements:{values:[{stringValue:other}]}}]},currentDocument:{exists:true}})),
  {update:{name:B.name('friendshipApprovals/alice/recipients/bob'),fields:B.fields({requestId:'request-1'})}},
  {update:{name:B.name('friendRequests/request-1'),fields:B.fields({to:'accepted_alice',status:'accepted',acceptedByName:'Bob'})},updateMask:{fieldPaths:['to','status','acceptedByName']},currentDocument:{exists:true}}
 ]);
 assert.deepEqual((await getDoc(doc(bob,'users/bob'))).data().friends,['alice']);
 assert.equal((await A.query('friendRequests',{where:A.equal('to','accepted_alice')})).docs.length,1);
});
test('SDK fallback never grants access to a private room or another user profile',async()=>{
 await env.withSecurityRulesDisabled(async context=>{await setDoc(doc(context.firestore(),'channels/private'),{name:'Private',createdBy:'owner',members:['owner']});await setDoc(doc(context.firestore(),'users/owner'),{bio:'Private'})});
 const {API:A}=transport('outsider');await assert.rejects(A.read('users/owner'),e=>e.code==='permission-denied');
 await assert.rejects(A.commit([{update:{name:A.name('channels/private/messages/attempt'),fields:A.fields({senderId:'outsider',message:'blocked'})},currentDocument:{exists:false}}]),e=>e.code==='permission-denied');
});
