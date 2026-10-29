import { before, after, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, collection, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-lyria',
    firestore: {host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}
  });
});
after(async () => { await env?.cleanup(); });
beforeEach(async () => { await env.clearFirestore(); });
const member = uid => env.authenticatedContext(uid).firestore();

test('two different signed-in accounts use the same Everyone room without joining or provisioning metadata',async()=>{
  const alice=member('alice'),bob=member('bob');
  const message=await assertSucceeds(addDoc(collection(alice,'channels/community/messages'),{senderId:'alice',sender:'Alice',message:'Hello everyone',timestamp:serverTimestamp()}));
  const visible=await assertSucceeds(getDocs(collection(bob,'channels/community/messages')));
  assert.equal(visible.size,1);assert.equal(visible.docs[0].data().message,'Hello everyone');
  await assertSucceeds(addDoc(collection(bob,'channels/community/messages'),{senderId:'bob',message:'Hi Alice',timestamp:serverTimestamp()}));
  assert.equal((await getDocs(collection(alice,'channels/community/messages'))).size,2);
  await assertFails(updateDoc(doc(bob,message.path),{message:'Changed by someone else'}));
  await assertFails(deleteDoc(doc(bob,message.path)));
  await assertSucceeds(deleteDoc(message));
});

test('Everyone rejects unauthenticated reads, sender spoofing, system-message spoofing and metadata takeover',async()=>{
  const alice=member('alice'),guest=env.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(guest,'channels/community/messages')));
  await assertFails(addDoc(collection(alice,'channels/community/messages'),{senderId:'bob',message:'Spoofed'}));
  await assertFails(addDoc(collection(alice,'channels/community/messages'),{type:'system',message:'Spoofed system'}));
  await assertFails(setDoc(doc(alice,'channels/community'),{createdBy:'alice',members:['alice'],name:'My room'}));
  await assertSucceeds(setDoc(doc(alice,'channels/community/typingStatus/alice'),{displayName:'Alice',timestamp:serverTimestamp()}));
  await assertFails(setDoc(doc(alice,'channels/community/typingStatus/bob'),{displayName:'Bob'}));
});

test('private conversations remain restricted to their members',async()=>{
  const alice=member('alice'),bob=member('bob');
  await assertSucceeds(setDoc(doc(alice,'channels/private'),{name:'Private',createdBy:'alice',members:['alice']}));
  await assertSucceeds(addDoc(collection(alice,'channels/private/messages'),{senderId:'alice',message:'Private note'}));
  await assertFails(getDocs(collection(bob,'channels/private/messages')));
  await assertFails(addDoc(collection(bob,'channels/private/messages'),{senderId:'bob',message:'Not a member'}));
});

test('account settings save when the profile document is missing and persist under the same Google UID',async()=>{
  const alice=member('google-alice'),ref=doc(alice,'users/google-alice');
  await assertSucceeds(setDoc(ref,{displayName:'Alice',bio:'First bio'},{merge:true}));
  await assertSucceeds(setDoc(ref,{bio:'Updated bio',darkMode:true,notificationsEnabled:false,showBadges:false,status:'busy'},{merge:true}));
  const reloaded=await assertSucceeds(getDoc(doc(member('google-alice'),'users/google-alice')));
  assert.equal(reloaded.data().displayName,'Alice');assert.equal(reloaded.data().bio,'Updated bio');assert.equal(reloaded.data().darkMode,true);assert.equal(reloaded.data().status,'busy');
  await assertFails(setDoc(doc(member('bob'),'users/google-alice'),{displayName:'Changed by Bob'},{merge:true}));
});

test('signed-in guests can also take part in Everyone',async()=>{
  const guest=env.authenticatedContext('guest',{firebase:{sign_in_provider:'anonymous'}}).firestore();
  await assertSucceeds(addDoc(collection(guest,'channels/community/messages'),{senderId:'guest',message:'Hello as a guest',timestamp:serverTimestamp()}));
  assert.equal((await getDocs(collection(member('alice'),'channels/community/messages'))).size,1);
});

test('the real account HTTPS adapter merges and verifies profiles without a live stream',async()=>{
  const {runInNewContext}=await import('node:vm');
  const window={firebaseConfig:{getApp:()=>({options:{projectId:'demo-lyria'}})}};
  const nativeFetch=globalThis.fetch;
  runInNewContext(await readFile(new URL('../js/account-api.js',import.meta.url),'utf8'),{
    window,AbortController,URLSearchParams,setTimeout,clearTimeout,
    fetch:(url,options)=>nativeFetch(url.replace('https://firestore.googleapis.com','http://127.0.0.1:8085'),options)
  });
  const token=uid=>{
    const now=Math.floor(Date.now()/1000);
    return Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({aud:'demo-lyria',iss:'https://securetoken.google.com/demo-lyria',sub:uid,user_id:uid,iat:now,exp:now+3600,auth_time:now,firebase:{sign_in_provider:'google.com'}})).toString('base64url')+'.';
  };
  const user={uid:'rest-alice',getIdToken:async()=>token('rest-alice')};
  assert.equal((await window.LyriaAccountAPI.read(user)).exists,false);
  await window.LyriaAccountAPI.create(user,{displayName:'Alice',bio:'First bio',darkMode:false,friends:[]});
  const result=await window.LyriaAccountAPI.save(user,{bio:'Confirmed over HTTPS',darkMode:true});
  assert.equal(result.data.bio,'Confirmed over HTTPS');assert.equal(result.data.darkMode,true);assert.equal(result.data.displayName,'Alice');
  assert.equal((await getDoc(doc(member('rest-alice'),'users/rest-alice'))).data().bio,'Confirmed over HTTPS');
  await assert.rejects(window.LyriaAccountAPI.save({uid:'rest-alice',getIdToken:async()=>token('bob')},{bio:'Not my account'}),error=>error.code==='permission-denied');
});
