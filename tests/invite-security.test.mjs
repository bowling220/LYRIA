import {before,after,beforeEach,test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,getDoc,getDocs,collection,updateDoc,arrayUnion,arrayRemove,Timestamp} from 'firebase/firestore';
let env;before(async()=>{env=await initializeTestEnvironment({projectId:'demo-lyria',firestore:{host:'127.0.0.1',port:8085,rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}})});after(async()=>env?.cleanup());beforeEach(async()=>env.clearFirestore());
const db=uid=>env.authenticatedContext(uid).firestore(),code='A'.repeat(32);
async function seed(){const owner=db('owner');await setDoc(doc(owner,'channels/room'),{createdBy:'owner',name:'Room',members:['owner']});await setDoc(doc(owner,'channelInvites/'+code),{channelId:'room',name:'Room',createdBy:'owner',createdAt:Timestamp.now(),expiresAt:null,revoked:false});return owner}
test('invite holders can preview and join, but room IDs and metadata queries grant no access',async()=>{
 const owner=await seed(),guest=db('guest');
 await assertSucceeds(getDoc(doc(guest,'channelInvites/'+code)));
 await assertFails(getDocs(collection(guest,'channelInvites')));await assertFails(getDoc(doc(guest,'channels/room')));
 await assertFails(updateDoc(doc(guest,'channels/room'),{members:arrayUnion('guest')}));
 await assertFails(updateDoc(doc(guest,'channels/room'),{members:arrayUnion('guest'),joinInvite:code,name:'Taken over'}));
 await assertSucceeds(updateDoc(doc(guest,'channels/room'),{members:arrayUnion('guest'),joinInvite:code}));
 await assertSucceeds(getDoc(doc(guest,'channels/room')));
 await assertFails(updateDoc(doc(guest,'channels/room'),{createdBy:'guest'}));
 await assertFails(updateDoc(doc(guest,'channels/room'),{members:arrayRemove('owner')}));
 await assertSucceeds(updateDoc(doc(guest,'channels/room'),{members:arrayRemove('guest')}));
 await assertFails(getDoc(doc(guest,'channels/room')));
});
test('revocation and expiration deny new joins; members retain access',async()=>{
 const owner=await seed(),guest=db('guest');await assertSucceeds(updateDoc(doc(owner,'channelInvites/'+code),{revoked:true}));
 await assertFails(updateDoc(doc(guest,'channels/room'),{members:arrayUnion('guest'),joinInvite:code}));
 await assertFails(updateDoc(doc(owner,'channelInvites/'+code),{revoked:false}));
 await env.withSecurityRulesDisabled(async ctx=>updateDoc(doc(ctx.firestore(),'channelInvites/'+code),{revoked:false,expiresAt:Timestamp.fromMillis(1)}));
 await assertFails(updateDoc(doc(guest,'channels/room'),{members:arrayUnion('guest'),joinInvite:code}));
 await assertSucceeds(getDoc(doc(owner,'channels/room')));
});
test('only the owner can issue or revoke links and arbitrary users cannot create unsolicited group memberships',async()=>{
 const owner=await seed(),guest=db('guest');const invite={channelId:'room',name:'Room',createdBy:'guest',createdAt:Timestamp.now(),expiresAt:null,revoked:false};
 await assertFails(setDoc(doc(guest,'channelInvites/'+'B'.repeat(32)),invite));
 await assertFails(updateDoc(doc(guest,'channelInvites/'+code),{revoked:true}));
 await assertFails(setDoc(doc(owner,'channelInvites/SHORT'),{...invite,createdBy:'owner'}));
 await assertFails(setDoc(doc(guest,'channels/unsolicited'),{createdBy:'guest',members:['guest','owner']}));
 await assertFails(setDoc(doc(guest,'channels/fake-call'),{createdBy:'guest',members:['guest','owner'],isDirectCall:true}));
});

test('deleted channel history cannot be claimed by recreating its parent ID',async()=>{
 const owner=await seed(),guest=db('guest');const {writeBatch,deleteDoc,serverTimestamp}=await import('firebase/firestore');
 await setDoc(doc(owner,'channels/room/messages/history'),{senderId:'owner',message:'Keep private'});
 await assertFails(deleteDoc(doc(owner,'channels/room')));
 const batch=writeBatch(owner);batch.set(doc(owner,'channelTombstones/room'),{createdBy:'owner',deletedAt:serverTimestamp()});batch.delete(doc(owner,'channels/room'));await assertSucceeds(batch.commit());
 await assertFails(setDoc(doc(guest,'channels/room'),{createdBy:'guest',members:['guest']}));await assertFails(getDoc(doc(guest,'channels/room/messages/history')));
});
test('only the original owner can repair their own personal workspace membership',async()=>{
 const owner=db('owner'),guest=db('guest');await setDoc(doc(owner,'channels/personal-owner'),{createdBy:'owner',members:['owner']});await updateDoc(doc(owner,'channels/personal-owner'),{members:[]});
 await assertFails(updateDoc(doc(guest,'channels/personal-owner'),{members:['guest']}));await assertSucceeds(updateDoc(doc(owner,'channels/personal-owner'),{members:['owner']}));
});

test('a user cannot squat another account’s reserved personal channel ID',async()=>{await assertFails(setDoc(doc(db('attacker'),'channels/personal-owner'),{createdBy:'attacker',members:['attacker']}))});
