import {before,after,beforeEach,test} from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';import {doc,setDoc,getDoc,Timestamp} from 'firebase/firestore';
let env;before(async()=>{env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}})});after(async()=>env?.cleanup());beforeEach(async()=>env.clearFirestore());
test('read markers are private and cannot grant membership',async()=>{const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore();await assertSucceeds(setDoc(doc(a,'users/alice/readState/community'),{at:Date.now()}));await assertFails(getDoc(doc(b,'users/alice/readState/community')));await assertFails(setDoc(doc(b,'users/alice/readState/community'),{at:1}));await assertFails(setDoc(doc(a,'users/alice/readState/community'),{at:Date.now()+86400000}));await assertFails(getDoc(doc(a,'channels/private-missing')))});
test('actual count endpoint returns unread and mentioned counts under member rules',async()=>{
 const uid='reader',db=env.authenticatedContext(uid).firestore();await setDoc(doc(db,'channels/community/messages/a'),{senderId:uid,message:'Earlier',timestamp:Timestamp.fromMillis(1000)});await setDoc(doc(db,'channels/community/messages/b'),{senderId:uid,message:'Mention',timestamp:Timestamp.fromMillis(3000),mentions:[uid]});
 const {runInNewContext}=await import('node:vm');const now=Math.floor(Date.now()/1000),token=Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,firebase:{sign_in_provider:'anonymous'}})).toString('base64url')+'.';const window={firebaseConfig:{getAuth:()=>({currentUser:{uid,getIdToken:async()=>token}}),getApp:()=>({options:{projectId:'demo-lyria'}})}};
 runInNewContext(await readFile(new URL('../js/data-api.js',import.meta.url),'utf8'),{window,AbortController,setTimeout,clearTimeout,fetch:(u,o)=>fetch(u.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),o)});
 const API=window.LyriaDataAPI,where={fieldFilter:{field:{fieldPath:'timestamp'},op:'GREATER_THAN',value:{timestampValue:new Date(2000).toISOString()}}};assert.equal(await API.count('messages',{parent:'channels/community',where}),1);assert.equal(await API.count('messages',{parent:'channels/community',where:{compositeFilter:{op:'AND',filters:[where,API.equal('mentions',uid,'ARRAY_CONTAINS')]}}}),1);await assert.rejects(API.count('messages',{parent:'channels/private-missing'}));
});
test('private fields stay private and members cannot award themselves staff badges',async()=>{
 const a=env.authenticatedContext('alice').firestore(),b=env.authenticatedContext('bob').firestore();
 await assertSucceeds(setDoc(doc(a,'users/alice'),{displayName:'Alice',email:'private@example.test',friends:[],badges:[],role:'user'}));
 await assertFails(getDoc(doc(b,'users/alice')));
 await assertFails(setDoc(doc(a,'profiles/alice'),{displayName:'Alice',email:'private@example.test'}));
 await assertFails(setDoc(doc(a,'profiles/alice'),{displayName:'Alice',badges:['admin']}));
 await assertSucceeds(setDoc(doc(a,'profiles/alice'),{displayName:'Alice',badges:[]}));
 await assertSucceeds(getDoc(doc(b,'profiles/alice')));
 await assertFails(setDoc(doc(b,'users/bob'),{badges:['admin'],role:'admin'}));
});
test('an accepted friendship proof cannot be replayed later to re-add a removed friend',async()=>{
 const owner=env.authenticatedContext('owner').firestore(),other=env.authenticatedContext('other').firestore();
 await env.withSecurityRulesDisabled(async context=>{const db=context.firestore();await setDoc(doc(db,'users/owner'),{friends:[]});await setDoc(doc(db,'users/other'),{friends:[]});await setDoc(doc(db,'friendRequests/past'),{from:'owner',to:'accepted_owner',status:'accepted'});await setDoc(doc(db,'friendshipApprovals/owner/recipients/other'),{requestId:'past'})});
 const {updateDoc,arrayUnion}=await import('firebase/firestore');await assertFails(updateDoc(doc(other,'users/owner'),{friends:arrayUnion('other')}));
 await assertFails(updateDoc(doc(owner,'users/owner'),{badges:['admin']}));
});
