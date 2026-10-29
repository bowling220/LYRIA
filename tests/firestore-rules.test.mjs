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
